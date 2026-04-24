import {
    getCharacterActors,
    getActorCardStackOwnership
} from "./actor-card-permissions.mjs";

const SYSTEM_ID = "through-the-breach";

export const FATE_DISCARD_NAME = "Fate Discard";
export const ACTOR_TWIST_DISCARD_PREFIX = "Twist Discard";

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

export function getActorTwistDiscardName(actor) {
    return `${ACTOR_TWIST_DISCARD_PREFIX} - ${actor.name}`;
}

export function getActorTwistDiscard(actor) {
    if (!actor) return null;

    return game.cards.find((pile) => {
        return (
            pile.getFlag(SYSTEM_ID, "stack") === "twist-discard" &&
            pile.getFlag(SYSTEM_ID, "actorUuid") === actor.uuid
        );
    }) ?? null;
}

export async function ensureFateDiscard({ notify = false } = {}) {
    if (!game.user.isGM) {
        console.warn(`${SYSTEM_ID} | Only a GM may create or repair the Fate Discard pile.`);
        return game.cards.getName(FATE_DISCARD_NAME) ?? null;
    }

    let pile = game.cards.getName(FATE_DISCARD_NAME);
    let created = false;

    const pileData = {
        name: FATE_DISCARD_NAME,
        type: "pile",
        img: CARD_IMAGE,
        description: "Shared discard pile for the main Fate Deck.",
        displayCount: true,
        ownership: {
            default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
        },
        flags: {
            [SYSTEM_ID]: {
                stack: "fate-discard",
                version: 1
            }
        }
    };

    if (!pile) {
        pile = await Cards.implementation.create(pileData);
        created = true;
        console.log(`${SYSTEM_ID} | Created Fate Discard`);
    } else {
        await pile.update({
            name: pileData.name,
            description: pileData.description,
            ownership: pileData.ownership,
            flags: pileData.flags
        });
    }

    if (notify && created) {
        ui.notifications.info("Created Fate Discard.");
    }

    return pile;
}

export async function ensureActorTwistDiscard(actorOrIdOrNameOrUuid, { notify = false } = {}) {
    if (!game.user.isGM) {
        console.warn(`${SYSTEM_ID} | Only a GM may create or repair actor Twist Discards.`);
        const actor = await resolveActor(actorOrIdOrNameOrUuid);
        return getActorTwistDiscard(actor);
    }

    const actor = await resolveActor(actorOrIdOrNameOrUuid);

    if (!actor) return null;
    if (actor.type !== "character") return null;

    let pile = getActorTwistDiscard(actor);
    let created = false;

    const pileData = {
        name: getActorTwistDiscardName(actor),
        type: "pile",
        img: CARD_IMAGE,
        description: `Discard pile for ${actor.name}'s Twist Deck.`,
        displayCount: true,
        ownership: getActorCardStackOwnership(actor),
        flags: {
            [SYSTEM_ID]: {
                stack: "twist-discard",
                actorUuid: actor.uuid,
                actorId: actor.id,
                actorName: actor.name,
                version: 1
            }
        }
    };

    if (!pile) {
        pile = await Cards.implementation.create(pileData);
        created = true;
        console.log(`${SYSTEM_ID} | Created Twist Discard for ${actor.name}`);
    } else {
        await pile.update({
            name: pileData.name,
            description: pileData.description,
            ownership: pileData.ownership,
            flags: pileData.flags
        });
    }

    if (notify && created) {
        ui.notifications.info(`Created Twist Discard for ${actor.name}.`);
    }

    return pile;
}

export async function ensureActorTwistDiscards({ notify = false } = {}) {
    if (!game.user.isGM) return [];

    const piles = [];

    for (const actor of getCharacterActors()) {
        const pile = await ensureActorTwistDiscard(actor, { notify });
        if (pile) piles.push(pile);
    }

    return piles;
}

export async function syncActorTwistDiscardOwnership(actorOrIdOrNameOrUuid) {
    if (!game.user.isGM) return null;

    const actor = await resolveActor(actorOrIdOrNameOrUuid);
    if (!actor) return null;

    const pile = getActorTwistDiscard(actor);
    if (!pile) return null;

    await pile.update({
        name: getActorTwistDiscardName(actor),
        ownership: getActorCardStackOwnership(actor),
        flags: {
            [SYSTEM_ID]: {
                ...(pile.flags?.[SYSTEM_ID] ?? {}),
                stack: "twist-discard",
                actorUuid: actor.uuid,
                actorId: actor.id,
                actorName: actor.name,
                version: 1
            }
        }
    });

    return pile;
}