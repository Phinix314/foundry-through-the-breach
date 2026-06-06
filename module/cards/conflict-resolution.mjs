import { CONFLICT_PILE_NAME } from "./fate-deck.mjs";
import { FATE_DISCARD_NAME, getActorTwistDiscard } from "./discard-piles.mjs";

const SYSTEM_ID = "through-the-breach";

function getTtbFlag(card, key, fallback = null) {
    return card.getFlag(SYSTEM_ID, key) ?? fallback;
}

async function reserveNextSequence(stack, stackFlag) {
    const current = Number(stack.getFlag(SYSTEM_ID, stackFlag) ?? 0);
    const next = current + 1;
    await stack.setFlag(SYSTEM_ID, stackFlag, next);
    return next;
}

export async function markCardEnteredConflict(card, extra = {}) {
    const conflictPile = game.cards.getName(CONFLICT_PILE_NAME);
    if (!conflictPile || !card) return card;

    const conflictSeq = await reserveNextSequence(conflictPile, "lastConflictSeq");

    const update = {
        [`flags.${SYSTEM_ID}.inConflict`]: true,
        [`flags.${SYSTEM_ID}.conflictSeq`]: conflictSeq
    };

    for (const [key, value] of Object.entries(extra)) {
        update[`flags.${SYSTEM_ID}.${key}`] = value;
    }

    await card.update(update);
    return card;
}

function getConflictCardsInOrder(conflictPile) {
    return [...conflictPile.cards].sort((a, b) => {
        const aSeq = Number(getTtbFlag(a, "conflictSeq", 0));
        const bSeq = Number(getTtbFlag(b, "conflictSeq", 0));
        return aSeq - bSeq;
    });
}

async function appendCardToDiscard(discardPile, originPile, card) {
    const movedCards = await originPile.pass(
        discardPile,
        [card.id],
        {
            chatNotification: false,
            action: "resolve-conflict",
            updateData: {}
        }
    );

    const movedCard = movedCards?.[0];
    if (!movedCard) return null;

    const discardSeq = await reserveNextSequence(discardPile, "lastDiscardSeq");

    await movedCard.update({
        [`flags.${SYSTEM_ID}.discardSeq`]: discardSeq,
        [`flags.${SYSTEM_ID}.inConflict`]: false
    });

    return movedCard;
}

async function resolveDiscardDestination(card) {
    const deckType = getTtbFlag(card, "deck", "");
    const actorUuid = getTtbFlag(card, "actorUuid", null);

    if (deckType === "fate") {
        const fateDiscard = game.cards.getName(FATE_DISCARD_NAME);
        if (!fateDiscard) {
            ui.notifications.error("Fate Discard does not exist.");
            return null;
        }
        return fateDiscard;
    }

    if (deckType === "twist" && actorUuid) {
        let actor = null;
        try {
            actor = await fromUuid(actorUuid);
        } catch (_err) {
            actor = null;
        }

        if (!actor) {
            ui.notifications.error("Could not resolve actor for a cheated Twist card.");
            return null;
        }

        const twistDiscard = getActorTwistDiscard(actor);
        if (!twistDiscard) {
            ui.notifications.error(`Twist Discard missing for ${actor.name}.`);
            return null;
        }

        return twistDiscard;
    }

    ui.notifications.warn(`Could not determine discard destination for ${card.name}.`);
    return null;
}

export async function resolveCurrentConflict({ chat = true } = {}) {
    const conflictPile = game.cards.getName(CONFLICT_PILE_NAME);
    if (!conflictPile) {
        ui.notifications.error("Current Conflict pile does not exist.");
        return [];
    }

    const conflictCards = getConflictCardsInOrder(conflictPile);
    if (conflictCards.length === 0) {
        ui.notifications.warn("Current Conflict is empty.");
        return [];
    }

    const moved = [];

    for (const card of conflictCards) {
        const destination = await resolveDiscardDestination(card);
        if (!destination) continue;

        const movedCard = await appendCardToDiscard(destination, conflictPile, card);
        if (movedCard) {
            moved.push({
                card: movedCard,
                destination: destination.name
            });
        }
    }

    if (chat) {
        const lines = moved.map(({ card, destination }) => {
            return `<li><strong>${foundry.utils.escapeHTML(card.name)}</strong> → ${foundry.utils.escapeHTML(destination)}</li>`;
        }).join("");

        await ChatMessage.create({
            content: `
        <div class="ttb-chat-card ttb-fate-flip">
          <h2>Conflict Resolved</h2>
          <p>Cards were moved to their discard piles.</p>
          <ul>${lines}</ul>
        </div>
      `,
            flags: {
                [SYSTEM_ID]: {
                    type: "resolveConflict"
                }
            }
        });
    }

    return moved;
}

export function getTopDiscardCards(discardPile, count = 1) {
    return [...discardPile.cards]
        .sort((a, b) => {
            const aSeq = Number(getTtbFlag(a, "discardSeq", 0));
            const bSeq = Number(getTtbFlag(b, "discardSeq", 0));
            return bSeq - aSeq;
        })
        .slice(0, count);
}