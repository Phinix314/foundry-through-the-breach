const SYSTEM_ID = "through-the-breach";

export const FATE_DECK_NAME = "Fate Deck";
export const CONFLICT_PILE_NAME = "Current Conflict";

const CARD_IMAGE = "icons/svg/card-joker.svg";
const CARD_BACK_IMAGE = "icons/svg/card-joker.svg";

const PLAYER_OWNERSHIP = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;

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
                suitLabel: suit.label,
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
                suitLabel: "Joker",
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

async function setPublicOwnership(cardsDocument) {
    if (!game.user.isGM) return cardsDocument;

    const currentDefault = cardsDocument.ownership?.default;

    if (currentDefault !== PLAYER_OWNERSHIP) {
        await cardsDocument.update({
            "ownership.default": PLAYER_OWNERSHIP
        });
    }

    return cardsDocument;
}

export async function ensureFateDeck({ notify = false } = {}) {
    if (!game.user.isGM) {
        console.warn(`${SYSTEM_ID} | Only a GM may create or repair the Fate Deck.`);
        return game.cards.getName(FATE_DECK_NAME) ?? null;
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
            ownership: {
                default: PLAYER_OWNERSHIP
            },
            flags: {
                [SYSTEM_ID]: {
                    deck: "fate",
                    version: 1
                }
            }
        });

        createdDeck = true;
    }

    await setPublicOwnership(deck);

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

    if (createdDeck) {
        await deck.shuffle({ chatNotification: false });
    }

    console.log(`${SYSTEM_ID} | Fate Deck ready`, {
        createdDeck,
        addedCards: missingCards.length,
        cardsInDeck: deck.cards.size
    });

    if (notify && (createdDeck || missingCards.length > 0)) {
        ui.notifications.info(
            `Through the Breach Fate Deck ready: added ${missingCards.length} card(s).`
        );
    }

    return deck;
}

export async function ensureConflictPile({ notify = false } = {}) {
    if (!game.user.isGM) {
        console.warn(`${SYSTEM_ID} | Only a GM may create or repair the Conflict pile.`);
        return game.cards.getName(CONFLICT_PILE_NAME) ?? null;
    }

    let pile = game.cards.getName(CONFLICT_PILE_NAME);
    let createdPile = false;

    if (!pile) {
        pile = await Cards.implementation.create({
            name: CONFLICT_PILE_NAME,
            type: "pile",
            img: CARD_IMAGE,
            description: "Public pile for currently flipped Fate cards.",
            displayCount: true,
            ownership: {
                default: PLAYER_OWNERSHIP
            },
            flags: {
                [SYSTEM_ID]: {
                    deck: "conflict",
                    version: 1
                }
            }
        });

        createdPile = true;
    }

    await setPublicOwnership(pile);

    console.log(`${SYSTEM_ID} | Conflict pile ready`, {
        createdPile,
        cardsInPile: pile.cards.size
    });

    if (notify && createdPile) {
        ui.notifications.info("Through the Breach Conflict pile ready.");
    }

    return pile;
}

function getCardFaceImage(card) {
    const face = card.faces?.[card.face ?? 0];
    return face?.img ?? card.img ?? CARD_IMAGE;
}

function getFlippedCardData(card) {
    return {
        name: card.name,
        suit: card.getFlag(SYSTEM_ID, "suit") ?? card.suit ?? "",
        suitLabel: card.getFlag(SYSTEM_ID, "suitLabel") ?? card.suit ?? "",
        value: card.getFlag(SYSTEM_ID, "value") ?? card.value ?? "",
        joker: card.getFlag(SYSTEM_ID, "joker") ?? false,
        color: card.getFlag(SYSTEM_ID, "color") ?? "",
        img: getCardFaceImage(card)
    };
}

function renderFlipChatContent(cardData, actor = null) {
    const actorName = actor?.name ? `<p><strong>Actor:</strong> ${actor.name}</p>` : "";

    const jokerLine = cardData.joker
        ? `<p><strong>Joker:</strong> ${cardData.color}</p>`
        : "";

    return `
    <div class="ttb-chat-card ttb-fate-flip">
      <h2>Fate Flip</h2>
      ${actorName}
      <div style="display:flex; gap:10px; align-items:center;">
        <img src="${cardData.img}" width="64" height="64" style="border:0;" />
        <div>
          <p><strong>Card:</strong> ${cardData.name}</p>
          <p><strong>Value:</strong> ${cardData.value}</p>
          <p><strong>Suit:</strong> ${cardData.suitLabel}</p>
          ${jokerLine}
        </div>
      </div>
    </div>
  `;
}

export async function flipTopCardToConflict({ actor = null } = {}) {
    const deck = game.cards.getName(FATE_DECK_NAME);
    const conflictPile = game.cards.getName(CONFLICT_PILE_NAME);

    if (!deck) {
        ui.notifications.error("Fate Deck does not exist yet. A GM must reload or run deck setup.");
        return null;
    }

    if (!conflictPile) {
        ui.notifications.error("Current Conflict pile does not exist yet. A GM must reload or run deck setup.");
        return null;
    }

    if (deck.cards.size < 1) {
        ui.notifications.warn("The Fate Deck is empty. Recall or reshuffle the deck before flipping.");
        return null;
    }

    const drawMode = CONST.CARD_DRAW_MODES?.TOP ?? CONST.CARD_DRAW_MODES?.FIRST ?? 0;

    const drawnCards = await conflictPile.draw(
        deck,
        1,
        { chatNotification: false },
        drawMode,
        {}
    );

    const card = drawnCards?.[0];

    if (!card) {
        ui.notifications.warn("No Fate card could be flipped.");
        return null;
    }

    const cardData = getFlippedCardData(card);

    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: renderFlipChatContent(cardData, actor),
        flags: {
            [SYSTEM_ID]: {
                type: "fateFlip",
                card: cardData,
                actorUuid: actor?.uuid ?? null
            }
        }
    });

    return card;
}