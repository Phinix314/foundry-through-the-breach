import { CONFLICT_PILE_NAME } from "./fate-deck.mjs";
import { getActorTwistDeck } from "./actor-decks.mjs";
import {
    getCharacterActors,
    getActorCardStackOwnership
} from "./actor-card-permissions.mjs";

const SYSTEM_ID = "through-the-breach";
export const ACTOR_HAND_PREFIX = "Hand";

const CARD_IMAGE = "icons/svg/card-joker.svg";

async function resolveActor(actorOrIdOrNameOrUuid) {
    if (!actorOrIdOrNameOrUuid) return null;

    if (actorOrIdOrNameOrUuid instanceof Actor) {
        return actorOrIdOrNameOrUuid;
    }

    if (typeof actorOrIdOrNameOrUuid !== "string") {
        return null;
    }

    if (actorOrIdOrNameOrUuid.startsWith("Actor.")) {
        return await fromUuid(actorOrIdOrNameOrUuid);
    }

    return (
        game.actors.get(actorOrIdOrNameOrUuid) ??
        game.actors.getName(actorOrIdOrNameOrUuid) ??
        null
    );
}

function getActorOwnershipLevel(actor, user) {
    return actor.ownership?.[user.id]
        ?? actor.ownership?.default
        ?? CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;
}

function isOwnedByNonGmPlayer(actor) {
    return game.users.some((user) => {
        if (user.isGM) return false;
        return getActorOwnershipLevel(actor, user) >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    });
}

function getCharacterActorsOwnedByPlayers() {
    return game.actors.filter((actor) => {
        return actor.type === "character" && isOwnedByNonGmPlayer(actor);
    });
}

function getHandOwnershipFromActor(actor) {
    const ownership = foundry.utils.deepClone(actor.ownership ?? {});

    if (ownership.default === undefined) {
        ownership.default = CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;
    }

    return ownership;
}

export function getActorTwistHandName(actor) {
    return `${ACTOR_HAND_PREFIX} - ${actor.name}`;
}

export function getActorTwistHand(actor) {
    if (!actor) return null;

    return game.cards.find((hand) => {
        return (
            hand.getFlag(SYSTEM_ID, "stack") === "twist-hand" &&
            hand.getFlag(SYSTEM_ID, "actorUuid") === actor.uuid
        );
    }) ?? null;
}

export async function ensureActorTwistHand(actorOrIdOrNameOrUuid, { notify = false } = {}) {
    if (!game.user.isGM) return null;

    const actor = await resolveActor(actorOrIdOrNameOrUuid);
    if (!actor) return null;
    if (actor.type !== "character") return null;

    let hand = getActorTwistHand(actor);
    let created = false;

    const handData = {
        name: getActorTwistHandName(actor),
        type: "hand",
        img: CARD_IMAGE,
        description: `Current Through the Breach hand for ${actor.name}.`,
        displayCount: true,
        ownership: getActorCardStackOwnership(actor),
        flags: {
            [SYSTEM_ID]: {
                stack: "twist-hand",
                actorUuid: actor.uuid,
                actorId: actor.id,
                actorName: actor.name,
                version: 1
            }
        }
    };

    if (!hand) {
        hand = await Cards.implementation.create(handData);
        created = true;
        console.log(`${SYSTEM_ID} | Created hand for ${actor.name}`);
    } else {
        await hand.update({
            name: handData.name,
            description: handData.description,
            ownership: handData.ownership,
            flags: handData.flags
        });
    }

    if (notify && created) {
        ui.notifications.info(`Created hand for ${actor.name}.`);
    }

    return hand;
}

export async function ensureActorTwistHands({ notify = false } = {}) {
    if (!game.user.isGM) return [];

    const hands = [];

    for (const actor of game.actors.filter(a => a.type === "character")) {
        const hand = await ensureActorTwistHand(actor, { notify });
        if (hand) hands.push(hand);
    }

    return hands;
}

export async function syncActorTwistHandOwnership(actorOrIdOrNameOrUuid) {
    if (!game.user.isGM) {
        ui.notifications.error("Only the GM can sync hand ownership.");
        return null;
    }

    const actor = await resolveActor(actorOrIdOrNameOrUuid);
    if (!actor) return null;

    const hand = getActorTwistHand(actor);
    if (!hand) return null;

    await hand.update({
        ownership: getHandOwnershipFromActor(actor)
    });

    return hand;
}

function getCardFaceImage(card) {
    const face = card.faces?.[card.face ?? 0];
    return face?.img ?? card.img ?? CARD_IMAGE;
}

function getCardData(card) {
    return {
        id: card.id,
        name: card.name,
        suit: card.getFlag(SYSTEM_ID, "suit") ?? card.suit ?? "",
        suitLabel: card.getFlag(SYSTEM_ID, "suitLabel") ?? card.suit ?? "",
        value: card.getFlag(SYSTEM_ID, "value") ?? card.value ?? "",
        joker: card.getFlag(SYSTEM_ID, "joker") ?? false,
        color: card.getFlag(SYSTEM_ID, "color") ?? "",
        img: getCardFaceImage(card)
    };
}

function esc(value) {
    return foundry.utils.escapeHTML(String(value ?? ""));
}

function renderCheatChatContent(cardData, actor) {
    const jokerLine = cardData.joker
        ? `<p><strong>Joker:</strong> ${esc(cardData.color)}</p>`
        : "";

    return `
    <div class="ttb-chat-card ttb-fate-flip">
      <h2>Cheat Fate</h2>
      <p><strong>Actor:</strong> ${esc(actor.name)}</p>

      <div style="display:flex; gap:10px; align-items:center;">
        <img src="${esc(cardData.img)}" width="64" height="64" style="border:0;" />

        <div>
          <p><strong>Card:</strong> ${esc(cardData.name)}</p>
          <p><strong>Value:</strong> ${esc(cardData.value)}</p>
          <p><strong>Suit:</strong> ${esc(cardData.suitLabel)}</p>
          ${jokerLine}
        </div>
      </div>
    </div>
  `;
}

export async function drawTwistCardsForActor(actorOrIdOrNameOrUuid, number = 1) {
    const actor = await resolveActor(actorOrIdOrNameOrUuid);

    if (!actor) {
        ui.notifications.warn("Select a token or assign a character first.");
        return [];
    }

    const deck = getActorTwistDeck(actor);
    const hand = getActorTwistHand(actor);

    if (!deck) {
        ui.notifications.error(`No Twist Deck found for ${actor.name}.`);
        return [];
    }

    if (!hand) {
        ui.notifications.error(`No hand found for ${actor.name}. Ask the GM to create/sync hands.`);
        return [];
    }

    if (deck.cards.size < number) {
        ui.notifications.warn(`${actor.name}'s Twist Deck does not have enough cards.`);
        return [];
    }

    const drawMode = CONST.CARD_DRAW_MODES?.TOP ?? CONST.CARD_DRAW_MODES?.FIRST ?? 0;

    const drawnCards = await hand.draw(
        deck,
        number,
        { chatNotification: false },
        drawMode,
        {}
    );

    ui.notifications.info(`${actor.name} drew ${drawnCards.length} Twist card(s).`);

    return drawnCards;
}

export async function cheatFateCardFromActorHand(actorOrIdOrNameOrUuid, cardId) {
    const actor = await resolveActor(actorOrIdOrNameOrUuid);

    if (!actor) {
        ui.notifications.warn("Select a token or assign a character first.");
        return null;
    }

    const hand = getActorTwistHand(actor);
    const conflictPile = game.cards.getName(CONFLICT_PILE_NAME);

    if (!hand) {
        ui.notifications.error(`No hand found for ${actor.name}.`);
        return null;
    }

    if (!conflictPile) {
        ui.notifications.error("Current Conflict pile does not exist.");
        return null;
    }

    const card = hand.cards.get(cardId);

    if (!card) {
        ui.notifications.error("That card is not in this actor's hand.");
        return null;
    }

    const movedCards = await hand.pass(
        conflictPile,
        [card.id],
        {
            chatNotification: false,
            action: "cheat-fate",
            updateData: {}
        }
    );

    const movedCard = movedCards?.[0];
    if (!movedCard) return null;

    const cardData = getCardData(movedCard);

    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: renderCheatChatContent(cardData, actor),
        flags: {
            [SYSTEM_ID]: {
                type: "cheatFate",
                card: cardData,
                actorUuid: actor.uuid
            }
        }
    });

    return movedCard;
}

export async function openCheatFateDialogForActor(actorOrIdOrNameOrUuid) {
    const actor = await resolveActor(actorOrIdOrNameOrUuid);

    if (!actor) {
        ui.notifications.warn("Select a token or assign a character first.");
        return null;
    }

    const hand = getActorTwistHand(actor);

    if (!hand) {
        ui.notifications.error(`No hand found for ${actor.name}.`);
        return null;
    }

    const cards = hand.cards.map((card) => getCardData(card));

    if (cards.length === 0) {
        ui.notifications.warn(`${actor.name} has no cards in hand.`);
        return null;
    }

    const options = cards.map((card) => {
        const label = `${card.name} (${card.value} ${card.suitLabel})`;
        return `<option value="${esc(card.id)}">${esc(label)}</option>`;
    }).join("");

    return new Promise((resolve) => {
        new Dialog({
            title: `Cheat Fate - ${actor.name}`,
            content: `
        <form>
          <div class="form-group">
            <label>Card</label>
            <select name="cardId">
              ${options}
            </select>
          </div>
        </form>
      `,
            buttons: {
                cheat: {
                    label: "Cheat Fate",
                    callback: async (html) => {
                        const cardId = html.find("[name='cardId']").val();
                        const movedCard = await cheatFateCardFromActorHand(actor, cardId);
                        resolve(movedCard);
                    }
                },
                cancel: {
                    label: "Cancel",
                    callback: () => resolve(null)
                }
            },
            default: "cheat",
            close: () => resolve(null)
        }).render(true);
    });
}