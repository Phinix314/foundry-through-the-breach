export function getCharacterActors() {
    return game.actors.filter((actor) => actor.type === "character");
}

export function getActorCardStackOwnership(actor) {
    const ownership = {
        default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE
    };

    for (const user of game.users) {
        if (user.isGM) continue;

        const actorLevel = actor.getUserLevel(user);

        if (actorLevel >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
            ownership[user.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
        }
    }

    return ownership;
}