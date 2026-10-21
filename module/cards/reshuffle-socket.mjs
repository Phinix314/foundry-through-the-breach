import {
    reshuffleFateDeck,
    reshuffleActorTwistDeck
} from "./deck-recycling.mjs";

const SYSTEM_ID = "through-the-breach";
const SOCKET_NAME = `system.${SYSTEM_ID}`;

function isPrimaryActiveGm() {
    if (!game.user.isGM) return false;

    const activeGms = game.users
        .filter((user) => user.isGM && user.active)
        .sort((a, b) => a.id.localeCompare(b.id));

    return activeGms[0]?.id === game.user.id;
}

async function requesterMayUseActor(requesterId, actorUuid) {
    const requester = game.users.get(requesterId);
    if (!requester?.active) return false;
    if (requester.isGM) return true;

    const actor = await fromUuid(actorUuid);
    if (!actor) return false;

    return (
        actor.getUserLevel(requester) >=
        CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
    );
}

async function refreshCardDock() {
    ui.players?.render?.(true);
    await game.throughTheBreach?.rerenderTtbCardDockPopout?.();
}

function notifyRequesterOfCompletion(requesterId) {
    game.socket.emit(SOCKET_NAME, {
        type: "reshuffle-complete",
        requesterId
    });
}

export function initializeReshuffleSocket() {
    game.socket.on(SOCKET_NAME, async (message) => {
        /*
         * This message is handled by the player who originally requested
         * the reshuffle.
         */
        if (message?.type === "reshuffle-complete") {
            if (message.requesterId !== game.user.id) return;

            await refreshCardDock();
            return;
        }

        /*
         * Actual reshuffle requests are handled only by the primary GM.
         */
        if (!isPrimaryActiveGm()) return;
        if (!message || message.requesterId === undefined) return;

        try {
            if (message.type === "reshuffle-fate") {
                const requester = game.users.get(message.requesterId);
                if (!requester?.active) return;

                const reshuffled = await reshuffleFateDeck({
                    notify: true,
                    conflictChoice: message.conflictChoice
                });

                if (reshuffled) {
                    await refreshCardDock();
                    notifyRequesterOfCompletion(message.requesterId);
                }

                return;
            }

            if (message.type === "reshuffle-twist") {
                const allowed = await requesterMayUseActor(
                    message.requesterId,
                    message.actorUuid
                );

                if (!allowed) {
                    console.warn(
                        `${SYSTEM_ID} | Rejected unauthorized Twist Deck reshuffle request.`
                    );
                    return;
                }

                const reshuffled = await reshuffleActorTwistDeck(
                    message.actorUuid,
                    {
                        notify: true,
                        conflictChoice: message.conflictChoice
                    }
                );

                if (reshuffled) {
                    await refreshCardDock();
                    notifyRequesterOfCompletion(message.requesterId);
                }
            }
        } catch (error) {
            console.error(
                `${SYSTEM_ID} | GM reshuffle request failed`,
                error
            );
        }
    });
}