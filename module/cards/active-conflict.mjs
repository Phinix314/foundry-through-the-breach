import {
    CONFLICT_PILE_NAME,
    flipTopCardToConflict
} from "./fate-deck.mjs";

import {
    getActorTwistHand
} from "./actor-hands.mjs";

const SYSTEM_ID = "through-the-breach";
const ACTIVE_CONFLICT_FLAG = "activeConflict";

let conflictCreationPending = false;

function requireGm() {
    if (!game.user.isGM) {
        throw new Error("Only a GM may change the active conflict.");
    }
}

function getConflictPile() {
    const pile = game.cards.getName(CONFLICT_PILE_NAME);

    if (!pile) {
        throw new Error("Current Conflict pile does not exist.");
    }

    return pile;
}

function integer(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number)
        ? Math.trunc(number)
        : fallback;
}

export function buildSelectionPolicy(flipModifier, overrides = {}) {
    const modifier = integer(flipModifier);
    const negative = modifier < 0;

    const defaults = {
        fateSelection: negative ? "lowest-only" : "choose",
        defaultFateSelection: negative ? "lowest" : "highest",

        cheat: {
            allowed: !negative,
            maximumCards: 1,
            source: "actor-hand"
        }
    };

    return foundry.utils.mergeObject(
        defaults,
        overrides,
        {
            inplace: false,
            recursive: true
        }
    );
}

export function getActiveConflict() {
    const pile = game.cards.getName(CONFLICT_PILE_NAME);
    if (!pile) return null;

    const conflict = pile.getFlag(
        SYSTEM_ID,
        ACTIVE_CONFLICT_FLAG
    );

    return conflict
        ? foundry.utils.deepClone(conflict)
        : null;
}

export async function createActiveConflict({
                                               actorUuid,
                                               requestedBy = game.user.id,
                                               source,
                                               baseValue = 0,
                                               tn = null,
                                               inherentModifier = 0,
                                               situationalModifier = 0,
                                               selectionOverrides = {}
                                           } = {}) {
    requireGm();

    /*
     * This prevents two requests handled by this GM from passing
     * the availability check at the same time.
     */
    if (conflictCreationPending) {
        throw new Error("Another conflict is currently being created.");
    }

    conflictCreationPending = true;

    try {
        const pile = getConflictPile();
        const existingConflict = getActiveConflict();

        if (existingConflict) {
            throw new Error(
                `A conflict is already active: ${
                    existingConflict.source?.label ?? existingConflict.id
                }`
            );
        }

        if (pile.cards.size > 0) {
            throw new Error(
                "Current Conflict already contains cards. Resolve or clear it first."
            );
        }

        if (!actorUuid) {
            throw new Error("An actor UUID is required.");
        }

        if (!source?.label) {
            throw new Error("The conflict source requires a label.");
        }

        const inherent = integer(inherentModifier);
        const situational = integer(situationalModifier);
        const flipModifier = inherent + situational;

        const parsedTn =
            tn === null || tn === ""
                ? null
                : integer(tn);

        const conflict = {
            version: 1,
            id: foundry.utils.randomID(16),
            phase: "locked",

            actorUuid,
            requestedBy,

            source: {
                type: source.type ?? "unknown",
                id: source.id ?? null,
                label: source.label
            },

            baseValue: integer(baseValue),
            tn: parsedTn,

            inherentModifier: inherent,
            situationalModifier: situational,
            flipModifier,
            cardCount: 1 + Math.abs(flipModifier),

            selectionPolicy: buildSelectionPolicy(
                flipModifier,
                selectionOverrides
            ),

            flippedCardIds: [],
            selectedCardId: null,

            createdAt: Date.now()
        };

        await pile.setFlag(
            SYSTEM_ID,
            ACTIVE_CONFLICT_FLAG,
            conflict
        );

        return foundry.utils.deepClone(conflict);
    } finally {
        conflictCreationPending = false;
    }
}

export async function startActiveConflict(options = {}) {
    requireGm();

    const conflict = await createActiveConflict(options);
    const pile = getConflictPile();

    try {
        const actor = await fromUuid(conflict.actorUuid);

        if (!actor) {
            throw new Error(
                `Conflict actor could not be found: ${conflict.actorUuid}`
            );
        }

        conflict.phase = "flipping";

        await pile.setFlag(
            SYSTEM_ID,
            ACTIVE_CONFLICT_FLAG,
            conflict
        );

        for (let index = 0; index < conflict.cardCount; index += 1) {
            const card = await flipTopCardToConflict({
                actor,
                chat: false,
                conflictId: conflict.id
            });

            conflict.flippedCardIds.push(card.id);

            /*
             * Save after every card so a partial failure or disconnect
             * does not lose track of cards already moved.
             */
            await pile.setFlag(
                SYSTEM_ID,
                ACTIVE_CONFLICT_FLAG,
                conflict
            );
        }

        conflict.phase = "selecting";

        await pile.setFlag(
            SYSTEM_ID,
            ACTIVE_CONFLICT_FLAG,
            conflict
        );

        return foundry.utils.deepClone(conflict);
    } catch (error) {
        /*
         * Keep both the conflict lock and any cards already flipped.
         * The GM can inspect and recover the interrupted conflict.
         */
        conflict.phase = "error";
        conflict.error = error.message;
        conflict.failedAt = Date.now();

        await pile.setFlag(
            SYSTEM_ID,
            ACTIVE_CONFLICT_FLAG,
            conflict
        );

        throw error;
    }
}

export async function clearActiveConflictState({
                                                   expectedId = null
                                               } = {}) {
    requireGm();

    const pile = getConflictPile();
    const existingConflict = getActiveConflict();

    if (!existingConflict) return null;

    /*
     * Normal resolution can provide expectedId so that an old
     * operation cannot accidentally clear a newer conflict.
     * A GM recovery button may omit it to force-clear the lock.
     */
    if (
        expectedId &&
        existingConflict.id !== expectedId
    ) {
        throw new Error(
            "The active conflict changed before it could be cleared."
        );
    }

    await pile.unsetFlag(
        SYSTEM_ID,
        ACTIVE_CONFLICT_FLAG
    );

    return existingConflict;
}

function getCardFaceImage(card) {
    const face = card.faces?.[card.face ?? 0];

    return face?.img
        ?? card.img
        ?? "icons/svg/card-joker.svg";
}

function formatSelectionCard(card, source) {
    return {
        id: card.id,
        source,
        name: card.name,
        value: integer(
            card.getFlag(SYSTEM_ID, "value")
            ?? card.value
        ),
        suit: card.getFlag(SYSTEM_ID, "suit")
            ?? card.suit
            ?? "",
        suitLabel: card.getFlag(SYSTEM_ID, "suitLabel")
            ?? card.suit
            ?? "",
        joker: card.getFlag(SYSTEM_ID, "joker") ?? false,
        color: card.getFlag(SYSTEM_ID, "color") ?? "",
        img: getCardFaceImage(card),
        selectable: false,
        defaultSelected: false,
        isCheat: source === "hand"
    };
}

function sortCardsHighestFirst(cards) {
    return [...cards].sort((a, b) => {
        if (b.value !== a.value) {
            return b.value - a.value;
        }

        return a.name.localeCompare(b.name);
    });
}

export async function getActiveConflictSelectionPresentation() {
    const conflict = getActiveConflict();

    if (!conflict) {
        throw new Error("No active conflict exists.");
    }

    if (conflict.phase !== "selecting") {
        throw new Error(
            `Conflict cannot select cards during phase "${conflict.phase}".`
        );
    }

    const pile = getConflictPile();
    const actor = await fromUuid(conflict.actorUuid);

    if (!actor) {
        throw new Error(
            `Conflict actor could not be found: ${conflict.actorUuid}`
        );
    }

    const fateCards = conflict.flippedCardIds.map((cardId) => {
        const card = pile.cards.get(cardId);

        if (!card) {
            throw new Error(
                `Flipped card ${cardId} is missing from Current Conflict.`
            );
        }

        const cardConflictId = card.getFlag(
            SYSTEM_ID,
            "conflictId"
        );

        if (cardConflictId !== conflict.id) {
            throw new Error(
                `Card ${card.name} does not belong to conflict ${conflict.id}.`
            );
        }

        return formatSelectionCard(card, "fate");
    });

    if (fateCards.length !== conflict.cardCount) {
        throw new Error(
            `Conflict expected ${conflict.cardCount} flipped cards but found ${fateCards.length}.`
        );
    }

    const sortedFateCards = sortCardsHighestFirst(fateCards);
    const policy = conflict.selectionPolicy;

    let defaultFateCard = null;

    if (policy.defaultFateSelection === "lowest") {
        defaultFateCard =
            sortedFateCards[sortedFateCards.length - 1];
    } else {
        defaultFateCard = sortedFateCards[0];
    }

    for (const card of sortedFateCards) {
        switch (policy.fateSelection) {
            case "lowest-only":
                card.selectable =
                    card.id === sortedFateCards.at(-1)?.id;
                break;

            case "highest-only":
                card.selectable =
                    card.id === sortedFateCards[0]?.id;
                break;

            case "choose":
                card.selectable = true;
                break;

            default:
                throw new Error(
                    `Unknown Fate selection rule: ${policy.fateSelection}`
                );
        }

        card.defaultSelected =
            card.id === defaultFateCard?.id;
    }

    const handCards = [];

    if (
        policy.cheat?.allowed === true &&
        policy.cheat?.source === "actor-hand"
    ) {
        const hand = getActorTwistHand(actor);

        if (!hand) {
            throw new Error(
                `No Twist hand exists for ${actor.name}.`
            );
        }

        const formattedHandCards = sortCardsHighestFirst(
            hand.cards.map((card) =>
                formatSelectionCard(card, "hand")
            )
        );

        for (const card of formattedHandCards) {
            card.selectable = true;
            handCards.push(card);
        }
    }

    return {
        conflictId: conflict.id,
        actorUuid: actor.uuid,
        actorName: actor.name,
        source: foundry.utils.deepClone(conflict.source),
        baseValue: conflict.baseValue,
        tn: conflict.tn,
        flipModifier: conflict.flipModifier,
        selectionPolicy: foundry.utils.deepClone(policy),

        fateCards: sortedFateCards,
        handCards,

        defaultSelection: defaultFateCard
            ? {
                source: "fate",
                cardId: defaultFateCard.id
            }
            : null
    };
}