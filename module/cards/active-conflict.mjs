import {
    CONFLICT_PILE_NAME,
    flipTopCardToConflict
} from "./fate-deck.mjs";

import {
    getActorTwistHand,
    cheatFateCardFromActorHand
} from "./actor-hands.mjs";

import {
    resolveCurrentConflict
} from "./conflict-resolution.mjs";

const SYSTEM_ID = "through-the-breach";
const ACTIVE_CONFLICT_FLAG = "activeConflict";

const RED_JOKER_SUITS = Object.freeze({
    rams: "Rams",
    crows: "Crows",
    tomes: "Tomes",
    masks: "Masks"
});

function normalizeSuitList(suits = []) {
    const list = Array.isArray(suits)
        ? suits
        : [suits];

    return list
        .map((suit) =>
            String(suit ?? "").toLowerCase()
        )
        .filter((suit) =>
            Object.hasOwn(
                RED_JOKER_SUITS,
                suit
            )
        );
}

function hasRequiredSuits(
    resultSuits,
    requiredSuits
) {
    const available = new Map();

    for (const suit of resultSuits) {
        available.set(
            suit,
            (available.get(suit) ?? 0) + 1
        );
    }

    for (const requiredSuit of requiredSuits) {
        const remaining =
            available.get(requiredSuit) ?? 0;

        if (remaining < 1) {
            return false;
        }

        available.set(
            requiredSuit,
            remaining - 1
        );
    }

    return true;
}

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

function formatFlipModifier(value) {
    const modifier = integer(value);

    if (modifier === 0) {
        return "";
    }

    const symbol = modifier > 0 ? "+" : "−";

    return symbol.repeat(Math.abs(modifier));
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
                                               inherentSuits = [],
                                               tnSuits = [],
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

            inherentSuits:
                normalizeSuitList(inherentSuits),

            tnSuits:
                normalizeSuitList(tnSuits),

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

    const blackJoker = sortedFateCards.find(
        (card) =>
            card.joker === true &&
            card.color === "black"
    );

    const redJoker = sortedFateCards.find(
        (card) =>
            card.joker === true &&
            card.color === "red"
    );

    let defaultFateCard = null;

    if (blackJoker) {
        /*
         * A flipped Black Joker must be used, regardless of
         * positive or negative Fate modifiers.
         */
        defaultFateCard = blackJoker;

        for (const card of sortedFateCards) {
            card.selectable = card.id === blackJoker.id;
            card.defaultSelected = card.id === blackJoker.id;
        }
    } else {
        if (redJoker) {
            defaultFateCard = redJoker;
        } else if (policy.defaultFateSelection === "lowest") {
            defaultFateCard =
                sortedFateCards[sortedFateCards.length - 1];
        } else {
            defaultFateCard = sortedFateCards[0];
        }

        for (const card of sortedFateCards) {
            switch (policy.fateSelection) {
                case "lowest-only":
                    card.selectable =
                        card.id === sortedFateCards.at(-1)?.id ||
                        card.id === redJoker?.id;
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
    }

    const handCards = [];

    if (
        !blackJoker &&
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
        flipLabel: formatFlipModifier(conflict.flipModifier),
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

export async function selectActiveConflictCard({
                                                   conflictId,
                                                   source,
                                                   cardId,
                                                   selectedSuit = null,
                                                   selectedBy = game.user.id
                                               } = {}) {
    requireGm();

    const conflict = getActiveConflict();

    if (!conflict) {
        throw new Error("No active conflict exists.");
    }

    if (conflict.id !== conflictId) {
        throw new Error(
            "The active conflict changed before the card was selected."
        );
    }

    if (conflict.phase !== "selecting") {
        throw new Error(
            `Conflict cannot accept a selection during phase "${conflict.phase}".`
        );
    }

    const presentation =
        await getActiveConflictSelectionPresentation();

    let candidates;

    switch (source) {
        case "fate":
            candidates = presentation.fateCards;
            break;

        case "hand":
            candidates = presentation.handCards;
            break;

        default:
            throw new Error(
                `Unknown selection source: ${source}`
            );
    }

    const selectedCard = candidates.find(
        (card) => card.id === cardId
    );

    if (!selectedCard) {
        throw new Error(
            "The selected card is not part of the legal selection."
        );
    }

    if (!selectedCard.selectable) {
        throw new Error(
            `${selectedCard.name} cannot be selected for this conflict.`
        );
    }

    const isRedJoker =
        selectedCard.joker === true &&
        selectedCard.color === "red";

    let resolvedSuit = selectedCard.suit;
    let resolvedSuitLabel = selectedCard.suitLabel;

    if (isRedJoker) {
        resolvedSuit = String(
            selectedSuit ?? ""
        ).toLowerCase();

        resolvedSuitLabel =
            RED_JOKER_SUITS[resolvedSuit];

        if (!resolvedSuitLabel) {
            throw new Error(
                "A valid suit must be chosen for the Red Joker."
            );
        }
    }
    let confirmedCardId = selectedCard.id;

    if (source === "hand") {
        const movedCard = await cheatFateCardFromActorHand(
            conflict.actorUuid,
            selectedCard.id,
            {chat: false}
        );

        if (!movedCard) {
            throw new Error(
                "The selected hand card could not be moved into the conflict."
            );
        }

        confirmedCardId = movedCard.id;
    }


    conflict.phase = "selected";
    conflict.selectedCardId = confirmedCardId;
    conflict.selectedCardSource = selectedCard.source;
    conflict.selectedSuit = isRedJoker ? resolvedSuit : null;
    conflict.selectedBy = selectedBy;
    conflict.selectedAt = Date.now();

    /*
     * Snapshot the relevant card information. The final resolver
     * should not depend on mutable presentation data.
     */
    conflict.selectedCard = {
        id: confirmedCardId,
        source: selectedCard.source,
        name: selectedCard.name,
        value: selectedCard.value,
        suit: resolvedSuit,
        suitLabel: resolvedSuitLabel,
        joker: selectedCard.joker,
        color: selectedCard.color,
        img: selectedCard.img,
        isCheat: selectedCard.isCheat,
    };

    const pile = getConflictPile();

    await pile.setFlag(
        SYSTEM_ID,
        ACTIVE_CONFLICT_FLAG,
        conflict
    );

    return foundry.utils.deepClone(conflict);
}

export function getActiveConflictResult() {
    const conflict = getActiveConflict();

    if (!conflict) {
        throw new Error("No active conflict exists.");
    }

    if (conflict.phase !== "selected") {
        throw new Error(
            `Conflict has no confirmed result during phase "${conflict.phase}".`
        );
    }

    const selectedCard = conflict.selectedCard;

    if (
        !selectedCard ||
        selectedCard.id !== conflict.selectedCardId
    ) {
        throw new Error(
            "The active conflict has no valid selected-card snapshot."
        );
    }

    const baseValue = integer(conflict.baseValue);
    const cardValue = integer(selectedCard.value);
    const total = baseValue + cardValue;

    const tn = conflict.tn === null
        ? null
        : integer(conflict.tn);

    const difference = tn === null
        ? null
        : total - tn;

    const inherentSuits =
        normalizeSuitList(
            conflict.inherentSuits
        );

    const cardSuit =
        Object.hasOwn(
            RED_JOKER_SUITS,
            selectedCard.suit
        )
            ? selectedCard.suit
            : null;

    const resultSuits = [
        ...inherentSuits,
        ...(cardSuit ? [cardSuit] : [])
    ];

    const tnSuits =
        normalizeSuitList(
            conflict.tnSuits
        );

    const numberMet = difference === null
        ? null
        : difference >= 0;

    const suitsMet =
        hasRequiredSuits(
            resultSuits,
            tnSuits
        );

    const success = numberMet === null
        ? null
        : numberMet && suitsMet;

    const marginCount = difference === null
        ? null
        : !success && numberMet && !suitsMet
            ? 0
            : Math.floor(
                Math.abs(difference) / 5
            );

    const pile = getConflictPile();

    const unselectedFateCards =
        (conflict.flippedCardIds ?? [])
            .map((id) => pile.cards.get(id))
            .filter((card) =>
                card &&
                card.id !== conflict.selectedCardId
            )
            .map((card) =>
                formatSelectionCard(card, "fate")
            );

    return {
        conflictId: conflict.id,
        actorUuid: conflict.actorUuid,
        source: foundry.utils.deepClone(conflict.source),

        baseValue,
        cardValue,
        total,
        tn,

        difference,
        success,
        numberMet,
        suitsMet,

        inherentSuits,
        resultSuits,
        tnSuits,


        marginType:
            difference === null
                ? null
                : success
                    ? "success"
                    : "failure",
        marginCount,

        selectedCard:
            foundry.utils.deepClone(selectedCard),

        unselectedFateCards,

        requiresSuitChoice:
            selectedCard.joker === true &&
            selectedCard.color === "red" &&
            !RED_JOKER_SUITS[selectedCard.suit]
    };
}

function escapeChat(value) {
    return foundry.utils.escapeHTML(
        String(value ?? "")
    );
}

function renderSuitSymbols(
    suits = [],
    {
        sourceLabel = null,
        requiredByTn = false
    } = {}
) {
    return normalizeSuitList(suits)
        .map((suit) => {
            const suitLabel =
                RED_JOKER_SUITS[suit];

            const origin = requiredByTn
                ? "Required by TN"
                : sourceLabel
                    ? `From ${sourceLabel}`
                    : "";

            const tooltip = origin
                ? `${suitLabel} — ${origin}`
                : suitLabel;

            return `
                <span
                    class="
                        ttb-conflict-suit
                        ttb-conflict-suit--${suit}
                    "
                    data-tooltip="${escapeChat(tooltip)}"
                    aria-label="${escapeChat(suitLabel)}"
                ></span>
            `;
        })
        .join("");
}

function renderActiveConflictResult(result) {
    const card = result.selectedCard;
    const hasTn = result.tn !== null;

    const outcome = !hasTn
        ? "Result"
        : result.success
            ? "Success"
            : "Failure";

    const outcomeClass = !hasTn
        ? "neutral"
        : result.success
            ? "success"
            : "failure";

    const degreeType =
        result.success
            ? "Success"
            : "Failure";

    const degreeWord =
        result.marginCount === 1
            ? "Degree"
            : "Degrees";

    const degreeText = hasTn
        ? `${result.marginCount} ${degreeWord} of ${degreeType}`
        : "";

    const calculationTooltip =
        `Base ${result.baseValue} + ` +
        `Card ${result.cardValue} = ` +
        `${result.total}`;

    const outcomeTooltip = !hasTn
        ? calculationTooltip
        : [
            calculationTooltip,
            result.numberMet
                ? "TN number met"
                : "TN number not met",
            result.suitsMet
                ? "Required suits met"
                : "Required suits missing"
        ].join(" · ");

    const cardSuit =
        Object.hasOwn(
            RED_JOKER_SUITS,
            card.suit
        )
            ? [card.suit]
            : [];

    const resultSuitsHtml = [
        renderSuitSymbols(
            result.inherentSuits,
            {
                sourceLabel:
                result.source.label
            }
        ),

        renderSuitSymbols(
            cardSuit,
            {
                sourceLabel:
                card.name
            }
        )
    ].join("");

    const tnSuitsHtml =
        renderSuitSymbols(
            result.tnSuits,
            {
                requiredByTn: true
            }
        );

    const otherCards =
        result.unselectedFateCards ?? [];

    const otherCardNames =
        otherCards
            .map((otherCard) =>
                otherCard.name
            )
            .join(", ");

    const stackTooltip =
        otherCards.length > 0
            ? `Selected: ${card.name}. Other flipped cards: ${otherCardNames}`
            : `Selected: ${card.name}`;

    const stackClass =
        otherCards.length === 0
            ? ""
            : otherCards.length === 1
                ? "ttb-conflict-card-stack--one"
                : "ttb-conflict-card-stack--many";

    const tnHtml = hasTn
        ? `
            <div class="ttb-conflict-number-row">
                <span class="ttb-conflict-number-label">
                    TN
                </span>

                <span class="ttb-conflict-number">
                    <span class="ttb-conflict-number__value">
                        ${result.tn}
                    </span>
                
                    <span class="ttb-conflict-suits">
                        ${tnSuitsHtml}
                    </span>
                </span>
            </div>
        `
        : "";

    return `
        <div class="ttb-chat-card ttb-conflict-result">
            <h3 class="ttb-conflict-title">
                ${escapeChat(result.source.label)}
            </h3>

            <div class="ttb-conflict-main">
                <div class="ttb-conflict-selected">
                    <span class="ttb-conflict-selected__label">
                        Selected
                    </span>

                    <div
                        class="ttb-conflict-card-stack ${stackClass}"
                        data-tooltip="${escapeChat(stackTooltip)}"
                    >
                        <img
                            class="ttb-conflict-selected__card"
                            src="${escapeChat(card.img)}"
                            alt="${escapeChat(card.name)}"
                        >

                        ${otherCards.length > 0
        ? `
                                <span class="ttb-conflict-stack-count">
                                    +${otherCards.length}
                                </span>
                            `
        : ""
    }

                        ${card.isCheat
        ? `
                                <span class="ttb-conflict-cheat">
                                    Cheated
                                </span>
                            `
        : ""
    }
                    </div>
                </div>

                <div class="ttb-conflict-summary">
                    <div class="ttb-conflict-number-row">
                        <span class="ttb-conflict-number-label">
                            Result
                        </span>

                        <strong
                            class="ttb-conflict-number ttb-conflict-number--result"
                            data-tooltip="${escapeChat(
                                calculationTooltip
                            )}"
                        >
                            <span class="ttb-conflict-number__value">
                                ${result.total}
                            </span>
                        
                            <span class="ttb-conflict-suits">
                                ${resultSuitsHtml}
                            </span>
                        </strong>
                    </div>

                    ${tnHtml}

                    <div
                        class="ttb-conflict-outcome ttb-conflict-outcome--${outcomeClass}"
                        data-tooltip="${escapeChat(outcomeTooltip)}"
                    >
                        <strong>${outcome}</strong>

                        ${hasTn
        ? `
                                <small>
                                    ${degreeText}
                                </small>
                            `
        : ""
    }
                    </div>
                </div>
            </div>
        </div>
    `;
}

export async function resolveActiveConflict({
                                                chat = true
                                            } = {}) {
    requireGm();

    const conflict = getActiveConflict();

    if (!conflict) {
        throw new Error("No active conflict exists.");
    }

    const result = getActiveConflictResult();
    const actor = await fromUuid(conflict.actorUuid);

    if (!actor) {
        throw new Error(
            `Conflict actor could not be found: ${conflict.actorUuid}`
        );
    }

    let chatMessage = game.messages.find((message) => {
        return (
            message.getFlag(SYSTEM_ID, "type") ===
            "activeConflictResult" &&
            message.getFlag(SYSTEM_ID, "conflictId") ===
            conflict.id
        );
    }) ?? null;

    /*
     * Create the result before moving cards. If card movement later
     * fails, retrying will reuse this message instead of duplicating it.
     */
    if (chat && !chatMessage) {
        chatMessage = await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: renderActiveConflictResult(
                result,
                actor
            ),
            flags: {
                [SYSTEM_ID]: {
                    type: "activeConflictResult",
                    conflictId: conflict.id,
                    result
                }
            }
        });
    }

    const moved = await resolveCurrentConflict({
        chat: false
    });

    const pile = getConflictPile();

    if (pile.cards.size > 0) {
        throw new Error(
            "Not all conflict cards could be moved to their discard piles."
        );
    }

    await clearActiveConflictState({
        expectedId: conflict.id
    });

    return {
        result,
        moved,
        chatMessageId: chatMessage?.id ?? null
    };
}