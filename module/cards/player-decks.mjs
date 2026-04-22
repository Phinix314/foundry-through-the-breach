import { buildFateDeckCards } from "./fate-deck.mjs";

const SYSTEM_ID = "through-the-breach";

export const PLAYER_DECK_PREFIX = "Twist Deck";

const CARD_IMAGE = "icons/svg/card-joker.svg";

function resolveUser(userOrIdOrName) {
    if (!userOrIdOrName) return null;

    if (typeof userOrIdOrName !== "string") return userOrIdOrName;

    return (
        game.users.get(userOrIdOrName) ??
        game.users.find((user) => user.name === userOrIdOrName) ??
        null
    );
}

export function getPlayerTwistDeckName(user) {
    return `${PLAYER_DECK_PREFIX} - ${user.name}`;
}

export function getPlayerTwistDeck(userOrIdOrName) {
    const user = resolveUser(userOrIdOrName);
    if (!user) return null;

    return game.cards.getName(getPlayerTwistDeckName(user)) ?? null;
}

function getPlayerUsers() {
    return game.users.filter((user) => !user.isGM);
}

function getPrivatePlayerOwnership(user) {
    return {
        default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
        [user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    };
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

function makePlayerDeckCardFromFateCard(fateCard, user, sort) {
    const card = foundry.utils.deepClone(fateCard);
    const fateId = fateCard.flags[SYSTEM_ID].fateId;

    card.drawn = false;
    card.sort = sort;

    card.flags = foundry.utils.mergeObject(card.flags ?? {}, {
        [SYSTEM_ID]: {
            ...card.flags?.[SYSTEM_ID],
            deck: "twist",
            sourceDeck: "fate",
            fateId,
            ownerUserId: user.id,
            ownerUserName: user.name
        }
    });

    return card;
}

export function listFateCardIds() {
    return Array.from(getCanonicalFateCardsById().keys());
}

export async function ensurePlayerTwistDeck(userOrIdOrName, { notify = false } = {}) {
    if (!game.user.isGM) {
        console.warn(`${SYSTEM_ID} | Only a GM may create or repair player Twist Decks.`);
        return getPlayerTwistDeck(userOrIdOrName);
    }

    const user = resolveUser(userOrIdOrName);
    if (!user) {
        ui.notifications.warn("Could not find user for Twist Deck creation.");
        return null;
    }

    let deck = getPlayerTwistDeck(user);
    let createdDeck = false;

    if (!deck) {
        deck = await Cards.implementation.create({
            name: getPlayerTwistDeckName(user),
            type: "deck",
            img: CARD_IMAGE,
            description: `Personal Through the Breach Twist Deck for ${user.name}.`,
            displayCount: true,
            ownership: getPrivatePlayerOwnership(user),
            flags: {
                [SYSTEM_ID]: {
                    deck: "twist",
                    ownerUserId: user.id,
                    ownerUserName: user.name,
                    version: 1
                }
            }
        });

        createdDeck = true;
    } else {
        await deck.update({
            name: getPlayerTwistDeckName(user),
            ownership: {
                ...(deck.ownership ?? {}),
                ...getPrivatePlayerOwnership(user)
            },
            flags: {
                [SYSTEM_ID]: {
                    ...(deck.flags?.[SYSTEM_ID] ?? {}),
                    deck: "twist",
                    ownerUserId: user.id,
                    ownerUserName: user.name,
                    version: 1
                }
            }
        });
    }

    if (notify && createdDeck) {
        ui.notifications.info(`Created Twist Deck for ${user.name}.`);
    }

    return deck;
}

export async function ensurePlayerTwistDecks({ notify = false } = {}) {
    if (!game.user.isGM) {
        console.warn(`${SYSTEM_ID} | Only a GM may create or repair player Twist Decks.`);
        return [];
    }

    const decks = [];

    for (const user of getPlayerUsers()) {
        const deck = await ensurePlayerTwistDeck(user, { notify });
        if (deck) decks.push(deck);
    }

    console.log(`${SYSTEM_ID} | Player Twist Decks ready`, {
        count: decks.length,
        decks: decks.map((deck) => deck.name)
    });

    return decks;
}

export async function addFateCardsToUserDeck(userOrIdOrName, fateIds, { shuffle = false, notify = true } = {}) {
    if (!game.user.isGM) {
        ui.notifications.error("Only the GM can add cards to a player's Twist Deck for now.");
        return null;
    }

    const user = resolveUser(userOrIdOrName);
    if (!user) {
        ui.notifications.error("Could not find that user.");
        return null;
    }

    const deck = await ensurePlayerTwistDeck(user);
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

        cardsToCreate.push(makePlayerDeckCardFromFateCard(canonicalCard, user, sort));
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

export async function setUserDeckComposition(userOrIdOrName, fateIds, { shuffle = true, notify = true } = {}) {
    if (!game.user.isGM) {
        ui.notifications.error("Only the GM can set a player's Twist Deck composition for now.");
        return null;
    }

    const user = resolveUser(userOrIdOrName);
    if (!user) {
        ui.notifications.error("Could not find that user.");
        return null;
    }

    const deck = await ensurePlayerTwistDeck(user);
    if (!deck) return null;

    const existingCardIds = deck.cards.map((card) => card.id);

    if (existingCardIds.length > 0) {
        await deck.deleteEmbeddedDocuments("Card", existingCardIds);
    }

    await addFateCardsToUserDeck(user, fateIds, {
        shuffle,
        notify: false
    });

    if (notify) {
        ui.notifications.info(`Set ${deck.name} to ${fateIds.length} card(s).`);
    }

    return deck;
}