const SYSTEM_ID = "through-the-breach";

export const FATE_DECK_NAME = "Fate Deck";

const CARD_IMAGE = "icons/svg/card-joker.svg";
const CARD_BACK_IMAGE = "icons/svg/card-joker.svg";

const SUITS = [
    { key: "rams", label: "Rams" },
    { key: "crows", label: "Crows" },
    { key: "tomes", label: "Tomes" },
    { key: "masks", label: "Masks" }
];

function makeFateCardId(suitKey, value) {
    return `${suitKey}-${value}`;
}

function makeJokerId(color) {
    return `${color}-joker`;
}

function makeNumberCard(suit, value, sort) {
    const name = `${value} of ${suit.label}`;
    const fateId = makeFateCardId(suit.key, value);

    return {
        name,
        type: "base",
        suit: suit.label,
        value,
        drawn: false,
        face: 0,
        sort,

        faces: [
            {
                name,
                img: CARD_IMAGE,
                text: name
            }
        ],

        back: {
            name: "Fate Deck Back",
            img: CARD_BACK_IMAGE,
            text: "Through the Breach Fate Deck"
        },

        flags: {
            [SYSTEM_ID]: {
                deck: "fate",
                fateId,
                suit: suit.key,
                value,
                joker: false
            }
        }
    };
}

function makeJoker(color, value, sort) {
    const name = `${color} Joker`;
    const fateId = makeJokerId(color.toLowerCase());

    return {
        name,
        type: "base",
        suit: "Joker",
        value,
        drawn: false,
        face: 0,
        sort,

        faces: [
            {
                name,
                img: CARD_IMAGE,
                text: name
            }
        ],

        back: {
            name: "Fate Deck Back",
            img: CARD_BACK_IMAGE,
            text: "Through the Breach Fate Deck"
        },

        flags: {
            [SYSTEM_ID]: {
                deck: "fate",
                fateId,
                suit: "joker",
                value,
                joker: true,
                color: color.toLowerCase()
            }
        }
    };
}

export function buildFateDeckCards() {
    const cards = [];
    let sort = 100000;

    for (const suit of SUITS) {
        for (let value = 1; value <= 13; value++) {
            cards.push(makeNumberCard(suit, value, sort));
            sort += 100000;
        }
    }

    cards.push(makeJoker("Red", 14, sort));
    sort += 100000;

    cards.push(makeJoker("Black", 0, sort));

    return cards;
}

function getCardFateId(card) {
    return card.getFlag(SYSTEM_ID, "fateId");
}

export async function ensureFateDeck({ notify = false } = {}) {
    if (!game.user.isGM) {
        console.warn(`${SYSTEM_ID} | Only a GM may create or repair the Fate Deck.`);
        return null;
    }

    let deck = game.cards.getName(FATE_DECK_NAME);
    let createdDeck = false;

    if (!deck) {
        deck = await Cards.implementation.create({
            name: FATE_DECK_NAME,
            type: "deck",
            img: CARD_IMAGE,
            description: "Shared Through the Breach Fate Deck.",
            displayCount: true,
            flags: {
                [SYSTEM_ID]: {
                    deck: "fate",
                    version: 1
                }
            }
        });

        createdDeck = true;
    }

    const expectedCards = buildFateDeckCards();

    const existingFateIds = new Set(
        deck.cards
            .map(getCardFateId)
            .filter((id) => typeof id === "string" && id.length > 0)
    );

    const missingCards = expectedCards.filter((card) => {
        const fateId = card.flags[SYSTEM_ID].fateId;
        return !existingFateIds.has(fateId);
    });

    if (missingCards.length > 0) {
        await deck.createEmbeddedDocuments("Card", missingCards);
    }

    const finalCount = deck.cards.size + missingCards.length;

    console.log(
        `${SYSTEM_ID} | Fate Deck ready`,
        {
            createdDeck,
            addedCards: missingCards.length,
            expectedCards: expectedCards.length,
            finalCount
        }
    );

    if (notify && (createdDeck || missingCards.length > 0)) {
        ui.notifications.info(
            `Through the Breach Fate Deck ready: added ${missingCards.length} card(s).`
        );
    }

    return deck;
}