import { FATE_DECK_NAME, CONFLICT_PILE_NAME } from "./fate-deck.mjs";
import { FATE_DISCARD_NAME, getActorTwistDiscard } from "./discard-piles.mjs";
import { getActorTwistDeck } from "./actor-decks.mjs";
import { getActorTwistHand } from "./actor-hands.mjs";

const SYSTEM_ID = "through-the-breach";

async function resolveActor(actorOrIdOrNameOrUuid) {
    if (!actorOrIdOrNameOrUuid) return null;

    if (actorOrIdOrNameOrUuid instanceof Actor) return actorOrIdOrNameOrUuid;

    if (typeof actorOrIdOrNameOrUuid !== "string") return null;

    if (actorOrIdOrNameOrUuid.startsWith("Actor.")) {
        return await fromUuid(actorOrIdOrNameOrUuid);
    }

    return (
        game.actors.get(actorOrIdOrNameOrUuid) ??
        game.actors.getName(actorOrIdOrNameOrUuid) ??
        null
    );
}

function getCardFaceImage(card) {
    const face = card.faces?.[card.face ?? 0];
    return face?.img ?? card.img ?? "icons/svg/card-joker.svg";
}

function getAvailableDeckCount(stack) {
    if (!stack) return 0;
    return stack.cards.filter((card) => !card.drawn).length;
}

function makePreviewBacks(count, max = 4) {
    return Array.from({ length: Math.min(count, max) }, (_, i) => ({ index: i }));
}

function formatFaceCard(card) {
    return {
        id: card.id,
        name: card.name,
        value: card.getFlag(SYSTEM_ID, "value") ?? card.value ?? "",
        suitLabel: card.getFlag(SYSTEM_ID, "suitLabel") ?? card.suit ?? "",
        img: getCardFaceImage(card)
    };
}

function getTopCardsByFlag(stack, flagKey, count = 4) {
    if (!stack) return [];

    return [...stack.cards]
        .sort((a, b) => {
            const aSeq = Number(a.getFlag(SYSTEM_ID, flagKey) ?? 0);
            const bSeq = Number(b.getFlag(SYSTEM_ID, flagKey) ?? 0);
            return bSeq - aSeq;
        })
        .slice(0, count)
        .map(formatFaceCard);
}

export function viewerOwnsActorPrivateCards(actor, user = game.user) {
    return actor.getUserLevel(user) >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
}

export async function syncActorCardSummary(actorOrIdOrNameOrUuid) {
    const actor = await resolveActor(actorOrIdOrNameOrUuid);
    if (!actor) return null;
    if (actor.type !== "character") return null;

    const deck = getActorTwistDeck(actor);
    const hand = getActorTwistHand(actor);
    const discard = getActorTwistDiscard(actor);

    const summary = {
        handCount: hand?.cards.size ?? 0,
        twistDeckCount: getAvailableDeckCount(deck),
        twistDiscardCount: discard?.cards.size ?? 0,
        twistDiscardTop: getTopCardsByFlag(discard, "discardSeq", 4)
    };

    await actor.setFlag(SYSTEM_ID, "cardSummary", summary);

    ui.players?.render?.(true);

    return summary;
}

export async function syncAllActorCardSummaries() {
    const actors = game.actors.filter((actor) => actor.type === "character");

    for (const actor of actors) {
        await syncActorCardSummary(actor);
    }

    ui.players?.render?.(true);

    return true;
}

export function getActorDockPresentation(actor, user = game.user) {
    const summary = actor.getFlag(SYSTEM_ID, "cardSummary") ?? {
        handCount: 0,
        twistDeckCount: 0,
        twistDiscardCount: 0,
        twistDiscardTop: []
    };

    const ownsPrivate = viewerOwnsActorPrivateCards(actor, user);
    const hand = getActorTwistHand(actor);

    return {
        actorId: actor.id,
        actorUuid: actor.uuid,
        actorName: actor.name,
        actorImg: actor.img,
        ownsPrivate,

        twistDeck: {
            count: summary.twistDeckCount ?? 0,
            previewBacks: makePreviewBacks(summary.twistDeckCount ?? 0)
        },

        hand: {
            mode: ownsPrivate ? "faces" : "backs",
            count: summary.handCount ?? 0,
            previewBacks: makePreviewBacks(summary.handCount ?? 0),
            cards: ownsPrivate && hand ? hand.cards.map(formatFaceCard) : []
        },

        twistDiscard: {
            count: summary.twistDiscardCount ?? 0,
            cards: summary.twistDiscardTop ?? []
        }
    };
}

export function getGlobalDockPresentation() {
    const fateDeck = game.cards.getName(FATE_DECK_NAME);
    const fateDiscard = game.cards.getName(FATE_DISCARD_NAME);
    const conflict = game.cards.getName(CONFLICT_PILE_NAME);

    const fateDeckCount = getAvailableDeckCount(fateDeck);
    const fateDiscardCount = fateDiscard?.cards.size ?? 0;
    const conflictCount = conflict?.cards.size ?? 0;

    return {
        fateDeck: {
            count: fateDeckCount,
            previewBacks: makePreviewBacks(fateDeckCount)
        },

        fateDiscard: {
            count: fateDiscardCount,
            cards: getTopCardsByFlag(fateDiscard, "discardSeq", 4)
        },

        conflict: {
            count: conflictCount,
            cards: getTopCardsByFlag(conflict, "conflictSeq", 4)
        }
    };
}