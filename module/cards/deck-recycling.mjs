import {
    FATE_DECK_NAME,
    CONFLICT_PILE_NAME
} from "./fate-deck.mjs";
import {resolveCurrentConflict} from "./conflict-resolution.mjs";
import {FATE_DISCARD_NAME, getActorTwistDiscard} from "./discard-piles.mjs";
import {getActorTwistDeck} from "./actor-decks.mjs";

const SYSTEM_ID = "through-the-breach";
const SOCKET_NAME = `system.${SYSTEM_ID}`;

function getAvailableCards(stack) {
    return stack.cards.filter((card) => !card.drawn);
}

function getAvailableCardCount(stack) {
    return getAvailableCards(stack).length;
}

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

async function announce(content) {
    return ChatMessage.create({
        speaker: {
            alias: "Through the Breach"
        },
        content,
        flags: {
            [SYSTEM_ID]: {
                type: "systemNotice"
            }
        }
    });
}

async function moveAllCards(sourceStack, destinationStack) {
    const ids = sourceStack.cards.map((card) => card.id);
    if (!ids.length) return [];

    return sourceStack.pass(
        destinationStack,
        ids,
        {
            chatNotification: false,
            action: "recycle",
            updateData: {
                drawn: false
            }
        }
    );
}

async function shuffleDeckWithDiscard(deck, discard) {
    await moveAllCards(discard, deck);

    if (getAvailableCardCount(deck) < 1) {
        return false;
    }

    await deck.shuffle({
        chatNotification: false
    });

    return true;
}

function getRelevantConflictCards(deckType, actorUuid = null) {
    const conflictPile = game.cards.getName(CONFLICT_PILE_NAME);
    if (!conflictPile) return [];

    return conflictPile.cards.filter((card) => {
        const sourceStack = card.getFlag(SYSTEM_ID, "sourceStack");
        const sourceActorUuid = card.getFlag(
            SYSTEM_ID,
            "sourceActorUuid"
        );

        if (deckType === "fate") {
            return sourceStack === "fate";
        }

        if (deckType === "twist") {
            return (
                sourceStack === "twist" &&
                sourceActorUuid === actorUuid
            );
        }

        return false;
    });
}

async function askHowToHandleConflict(deckName) {
    return new Promise((resolve) => {
        let finished = false;

        const finish = (choice) => {
            if (finished) return;
            finished = true;
            resolve(choice);
        };

        new Dialog({
            title: `Reshuffle ${deckName}`,
            content: `
                <p>
                    Cards from this deck are currently in the
                    Current Conflict.
                </p>
                <p>How should the reshuffle continue?</p>
            `,
            buttons: {
                resolveConflict: {
                    label: "Resolve conflict and shuffle",
                    callback: () => finish("resolve")
                },
                keepConflict: {
                    label: "Do not resolve and shuffle",
                    callback: () => finish("keep")
                },
                cancel: {
                    label: "Cancel",
                    callback: () => finish("cancel")
                }
            },
            default: "cancel",
            close: () => finish("cancel")
        }).render(true);
    });
}

async function chooseConflictHandlingForReshuffle(
    deckName,
    deckType,
    actorUuid = null,
    suppliedChoice = null
) {
    const relevantCards = getRelevantConflictCards(
        deckType,
        actorUuid
    );

    if (relevantCards.length === 0) {
        return "keep";
    }

    const allowedChoices = new Set([
        "resolve",
        "keep",
        "cancel"
    ]);

    if (allowedChoices.has(suppliedChoice)) {
        return suppliedChoice;
    }

    return askHowToHandleConflict(deckName);
}

export async function reshuffleFateDeck({
                                            notify = true,
                                            conflictChoice = null
                                        } = {}) {
    const deck = game.cards.getName(FATE_DECK_NAME);
    const discard = game.cards.getName(FATE_DISCARD_NAME);

    if (!deck) {
        ui.notifications.error("Fate Deck does not exist.");
        return false;
    }

    if (!discard) {
        ui.notifications.error("Fate Discard does not exist.");
        return false;
    }

    const selectedChoice =
        await chooseConflictHandlingForReshuffle(
            deck.name,
            "fate",
            null,
            conflictChoice
        );

    if (selectedChoice === "cancel") {
        return false;
    }

    if (!game.user.isGM) {
        const hasActiveGm = game.users.some(
            (user) => user.isGM && user.active
        );

        if (!hasActiveGm) {
            ui.notifications.error(
                "A GM must be online to reshuffle the Fate Deck."
            );
            return false;
        }

        game.socket.emit(SOCKET_NAME, {
            type: "reshuffle-fate",
            requesterId: game.user.id,
            conflictChoice: selectedChoice
        });

        return true;
    }

    if (selectedChoice === "resolve") {
        await resolveCurrentConflict({ chat: true });
    }

    const shuffled = await shuffleDeckWithDiscard(deck, discard);

    if (!shuffled) {
        ui.notifications.warn(
            "No Fate cards are available to shuffle."
        );
        return false;
    }

    if (notify) {
        await announce(
            "<p><strong>Fate Deck</strong> has been reshuffled.</p>"
        );
    }

    ui.players?.render?.(true);
    await game.throughTheBreach?.rerenderTtbCardDockPopout?.();

    return true;
}

export async function reshuffleActorTwistDeck(
    actorOrIdOrNameOrUuid,
    {
        notify = true,
        conflictChoice = null
    } = {}
) {
    const actor = await resolveActor(actorOrIdOrNameOrUuid);

    if (!actor) {
        ui.notifications.error(
            "Could not find actor for Twist Deck reshuffle."
        );
        return false;
    }

    const deck = getActorTwistDeck(actor);
    const discard = getActorTwistDiscard(actor);

    if (!deck) {
        ui.notifications.error(
            `No Twist Deck found for ${actor.name}.`
        );
        return false;
    }

    if (!discard) {
        ui.notifications.error(
            `No Twist Discard found for ${actor.name}.`
        );
        return false;
    }

    const selectedChoice =
        await chooseConflictHandlingForReshuffle(
            deck.name,
            "twist",
            actor.uuid,
            conflictChoice
        );

    if (selectedChoice === "cancel") {
        return false;
    }

    if (!game.user.isGM) {
        const hasActiveGm = game.users.some(
            (user) => user.isGM && user.active
        );

        if (!hasActiveGm) {
            ui.notifications.error(
                "A GM must be online to reshuffle a Twist Deck."
            );
            return false;
        }

        game.socket.emit(SOCKET_NAME, {
            type: "reshuffle-twist",
            requesterId: game.user.id,
            actorUuid: actor.uuid,
            conflictChoice: selectedChoice
        });

        return true;
    }

    if (selectedChoice === "resolve") {
        await resolveCurrentConflict({ chat: true });
    }

    const shuffled = await shuffleDeckWithDiscard(deck, discard);

    if (!shuffled) {
        ui.notifications.warn(
            `No Twist cards are available to shuffle for ${actor.name}.`
        );
        return false;
    }

    if (notify) {
        const safeName = foundry.utils.escapeHTML(actor.name);

        await announce(
            `<p><strong>${safeName}</strong>'s Twist Deck has been reshuffled.</p>`
        );
    }

    await game.throughTheBreach?.syncActorCardSummary?.(actor);

    return true;
}

export async function recycleFateDeckIfEmpty({notify = true} = {}) {
    const deck = game.cards.getName(FATE_DECK_NAME);
    const discard = game.cards.getName(FATE_DISCARD_NAME);

    if (!deck) {
        ui.notifications.error("Fate Deck does not exist.");
        return false;
    }

    if (!discard) {
        ui.notifications.error("Fate Discard does not exist.");
        return false;
    }

    if (getAvailableCardCount(deck) > 0) return false;
    if (discard.cards.size < 1) return false;

    await shuffleDeckWithDiscard(deck, discard);
    f

    if (notify) {
        await announce("<p><strong>Fate Deck</strong> has been shuffled from its discard pile.</p>");
    }

    return true;
}

export async function recycleActorTwistDeckIfEmpty(actorOrIdOrNameOrUuid, {notify = true} = {}) {
    const actor = await resolveActor(actorOrIdOrNameOrUuid);
    if (!actor) {
        ui.notifications.error("Could not find actor for Twist Deck recycle.");
        return false;
    }

    const deck = getActorTwistDeck(actor);
    const discard = getActorTwistDiscard(actor);

    if (!deck) {
        ui.notifications.error(`No Twist Deck found for ${actor.name}.`);
        return false;
    }

    if (!discard) {
        ui.notifications.error(`No Twist Discard found for ${actor.name}.`);
        return false;
    }

    if (getAvailableCardCount(deck) > 0) return false;
    if (discard.cards.size < 1) return false;

    await shuffleDeckWithDiscard(deck, discard);

    if (notify) {
        await announce(`<p><strong>${foundry.utils.escapeHTML(actor.name)}</strong>'s Twist Deck has been shuffled from its discard pile.</p>`);
    }

    await game.throughTheBreach?.syncActorCardSummary?.(actor);

    return true;
}

export async function prepareFateDeckForDraw(number = 1) {
    const deck = game.cards.getName(FATE_DECK_NAME);
    if (!deck) {
        ui.notifications.error("Fate Deck does not exist.");
        return false;
    }

    if (getAvailableCardCount(deck) < number) {
        await recycleFateDeckIfEmpty({notify: true});
    }

    if (getAvailableCardCount(deck) < number) {
        ui.notifications.warn("The Fate Deck does not contain enough available cards.");
        return false;
    }

    return true;
}

export async function prepareActorTwistDeckForDraw(actorOrIdOrNameOrUuid, number = 1) {
    const actor = await resolveActor(actorOrIdOrNameOrUuid);
    if (!actor) {
        ui.notifications.warn("Select a token or assign a character first.");
        return false;
    }

    const deck = getActorTwistDeck(actor);
    if (!deck) {
        ui.notifications.error(`No Twist Deck found for ${actor.name}.`);
        return false;
    }

    if (getAvailableCardCount(deck) < number) {
        await recycleActorTwistDeckIfEmpty(actor, {notify: true});
    }

    if (getAvailableCardCount(deck) < number) {
        ui.notifications.warn(`${actor.name}'s Twist Deck does not contain enough available cards.`);
        return false;
    }

    return true;
}

export function getAvailableCardCountForStack(stackOrName) {
    const stack = typeof stackOrName === "string"
        ? game.cards.getName(stackOrName)
        : stackOrName;

    if (!stack) return 0;
    return stack.cards.filter((card) => !card.drawn).length;
}

export async function announceActorTwistDraw(actor, number = 1) {
    const safeName = foundry.utils.escapeHTML(actor.name);
    const cardWord = number === 1 ? "card" : "cards";

    return announce(`<p><strong>${safeName}</strong> draws ${number} ${cardWord}.</p>`);
}