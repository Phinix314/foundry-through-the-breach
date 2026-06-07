
import { FATE_DECK_NAME } from "./fate-deck.mjs";
import { FATE_DISCARD_NAME, getActorTwistDiscard } from "./discard-piles.mjs";
import { getActorTwistDeck } from "./actor-decks.mjs";

const SYSTEM_ID = "through-the-breach";

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
            updateData: {}
        }
    );
}

export async function recycleFateDeckIfEmpty({ notify = true } = {}) {
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

    await discard.shuffle({ chatNotification: false });
    await moveAllCards(discard, deck);

    if (notify) {
        await announce("<p><strong>Fate Deck</strong> has been shuffled from its discard pile.</p>");
    }

    return true;
}

export async function recycleActorTwistDeckIfEmpty(actorOrIdOrNameOrUuid, { notify = true } = {}) {
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

    await discard.shuffle({ chatNotification: false });
    await moveAllCards(discard, deck);

    if (notify) {
        await announce(`<p><strong>${foundry.utils.escapeHTML(actor.name)}</strong>'s Twist Deck has been shuffled from its discard pile.</p>`);
    }

    return true;
}

export async function prepareFateDeckForDraw(number = 1) {
    const deck = game.cards.getName(FATE_DECK_NAME);
    if (!deck) {
        ui.notifications.error("Fate Deck does not exist.");
        return false;
    }

    if (getAvailableCardCount(deck) < number) {
        await recycleFateDeckIfEmpty({ notify: true });
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
        await recycleActorTwistDeckIfEmpty(actor, { notify: true });
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