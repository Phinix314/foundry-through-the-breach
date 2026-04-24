import { buildFateDeckCards } from "./fate-deck.mjs";
import {
    getCharacterActors,
    getActorCardStackOwnership
} from "./actor-card-permissions.mjs";

const SYSTEM_ID = "through-the-breach";

export const ACTOR_DECK_PREFIX = "Twist Deck";

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

export function getActorTwistDeckName(actor) {
    return `${ACTOR_DECK_PREFIX} - ${actor.name}`;
}

export function getActorTwistDeck(actor) {
    if (!actor) return null;

    return game.cards.find((deck) => {
        return (
            deck.getFlag(SYSTEM_ID, "deck") === "twist" &&
            deck.getFlag(SYSTEM_ID, "actorUuid") === actor.uuid
        );
    }) ?? null;
}

function getCanonicalFateCardsById() {
    const cards = buildFateDeckCards();
    const map = new Map();

    for (const card of cards) {
        const fateId = card.flags?.[SYSTEM_ID]?.fateId;
        if (fateId) map.set(fateId, card);
    }

    return map;
}

function getCardFateId(card) {
    return card.getFlag(SYSTEM_ID, "fateId");
}

function makeActorDeckCardFromFateCard(fateCard, actor, sort) {
    const card = foundry.utils.deepClone(fateCard);
    const fateId = fateCard.flags[SYSTEM_ID].fateId;

    card.drawn = false;
    card.sort = sort;

    card.flags = foundry.utils.mergeObject(card.flags ?? {}, {
        [SYSTEM_ID]: {
            ...(card.flags?.[SYSTEM_ID] ?? {}),
            deck: "twist",
            sourceDeck: "fate",
            fateId,
            actorUuid: actor.uuid,
            actorId: actor.id,
            actorName: actor.name
        }
    });

    return card;
}

export function listFateCardIds() {
    return Array.from(getCanonicalFateCardsById().keys());
}

export async function ensureActorTwistDeck(actorOrIdOrNameOrUuid, { notify = false } = {}) {
    if (!game.user.isGM) {
        console.warn(`${SYSTEM_ID} | Only a GM may create or repair actor Twist Decks.`);
        const actor = await resolveActor(actorOrIdOrNameOrUuid);
        return getActorTwistDeck(actor);
    }

    const actor = await resolveActor(actorOrIdOrNameOrUuid);

    if (!actor) {
        ui.notifications.warn("Could not find actor for Twist Deck creation.");
        return null;
    }

    let deck = getActorTwistDeck(actor);
    let createdDeck = false;

    const deckData = {
        name: getActorTwistDeckName(actor),
        type: "deck",
        img: CARD_IMAGE,
        description: `Personal Through the Breach Twist Deck for ${actor.name}.`,
        displayCount: true,
        ownership: getActorCardStackOwnership(actor),
        flags: {
            [SYSTEM_ID]: {
                deck: "twist",
                actorUuid: actor.uuid,
                actorId: actor.id,
                actorName: actor.name,
                version: 1
            }
        }
    };

    if (!deck) {
        deck = await Cards.implementation.create(deckData);
        createdDeck = true;
    } else {
        await deck.update({
            name: deckData.name,
            description: deckData.description,
            ownership: deckData.ownership,
            flags: deckData.flags
        });
    }

    if (notify && createdDeck) {
        ui.notifications.info(`Created Twist Deck for ${actor.name}.`);
    }

    return deck;
}

export async function ensureActorTwistDecks({ notify = false } = {}) {
    if (!game.user.isGM) {
        console.warn(`${SYSTEM_ID} | Only a GM may create or repair actor Twist Decks.`);
        return [];
    }

    const decks = [];

    for (const actor of getCharacterActors()) {
        const deck = await ensureActorTwistDeck(actor, { notify });
        if (deck) decks.push(deck);
    }

    console.log(`${SYSTEM_ID} | Actor Twist Decks ready`, {
        count: decks.length,
        decks: decks.map((deck) => deck.name)
    });

    return decks;
}

export async function addFateCardsToActorDeck(
    actorOrIdOrNameOrUuid,
    fateIds,
    { shuffle = false, notify = true } = {}
) {
    if (!game.user.isGM) {
        ui.notifications.error("Only the GM can add cards to an actor's Twist Deck for now.");
        return null;
    }

    const actor = await resolveActor(actorOrIdOrNameOrUuid);

    if (!actor) {
        ui.notifications.error("Could not find that actor.");
        return null;
    }

    const deck = await ensureActorTwistDeck(actor);
    if (!deck) return null;

    const canonicalCards = getCanonicalFateCardsById();

    const existingFateIds = new Set(
        deck.cards
            .map(getCardFateId)
            .filter((id) => typeof id === "string" && id.length > 0)
    );

    const cardsToCreate = [];
    let sort = 100000 * (deck.cards.size + 1);

    for (const fateId of fateIds) {
        const canonicalCard = canonicalCards.get(fateId);

        if (!canonicalCard) {
            console.warn(`${SYSTEM_ID} | Unknown Fate card id: ${fateId}`);
            continue;
        }

        if (existingFateIds.has(fateId)) {
            console.warn(`${SYSTEM_ID} | ${deck.name} already contains ${fateId}`);
            continue;
        }

        cardsToCreate.push(makeActorDeckCardFromFateCard(canonicalCard, actor, sort));
        existingFateIds.add(fateId);
        sort += 100000;
    }

    if (cardsToCreate.length > 0) {
        await deck.createEmbeddedDocuments("Card", cardsToCreate);
    }

    if (shuffle) {
        await deck.shuffle({ chatNotification: false });
    }

    if (notify) {
        ui.notifications.info(`Added ${cardsToCreate.length} card(s) to ${deck.name}.`);
    }

    return deck;
}

export async function setActorDeckComposition(
    actorOrIdOrNameOrUuid,
    fateIds,
    { shuffle = true, notify = true } = {}
) {
    if (!game.user.isGM) {
        ui.notifications.error("Only the GM can set an actor's Twist Deck composition for now.");
        return null;
    }

    const actor = await resolveActor(actorOrIdOrNameOrUuid);

    if (!actor) {
        ui.notifications.error("Could not find that actor.");
        return null;
    }

    const deck = await ensureActorTwistDeck(actor);
    if (!deck) return null;

    const existingCardIds = deck.cards.map((card) => card.id);

    if (existingCardIds.length > 0) {
        await deck.deleteEmbeddedDocuments("Card", existingCardIds);
    }

    await addFateCardsToActorDeck(actor, fateIds, {
        shuffle,
        notify: false
    });

    if (notify) {
        ui.notifications.info(`Set ${deck.name} to ${fateIds.length} card(s).`);
    }

    return deck;
}

export async function syncActorTwistDeckOwnership(actorOrIdOrNameOrUuid) {
    if (!game.user.isGM) {
        ui.notifications.error("Only the GM can sync Twist Deck ownership.");
        return null;
    }

    const actor = await resolveActor(actorOrIdOrNameOrUuid);
    if (!actor) return null;

    const deck = getActorTwistDeck(actor);
    if (!deck) return null;

    await deck.update({
        ownership: getActorCardStackOwnership(actor)
    });

    return deck;
}