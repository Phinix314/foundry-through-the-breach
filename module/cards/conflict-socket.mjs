import {
    getActiveConflict,
    startActiveConflict,
    selectActiveConflictCard,
    resolveActiveConflict
} from "./active-conflict.mjs";

import {
    CONFLICT_PILE_NAME
} from "./fate-deck.mjs";

const SYSTEM_ID = "through-the-breach";
const SOCKET_NAME = `system.${SYSTEM_ID}`;
const REQUEST_TIMEOUT_MS = 15000;

/*
 * Requests waiting for an answer from the GM.
 */
const pendingRequests = new Map();

/*
 * Ensures that the primary GM handles only one shared-deck
 * operation at a time.
 */
let gmOperationQueue = Promise.resolve();

export class ConflictRequestError extends Error {
    constructor(code, message, details = {}) {
        super(message);

        this.name = "ConflictRequestError";
        this.code = code;
        this.details = details;
    }
}

function getPrimaryActiveGm() {
    return game.users
        .filter((user) =>
            user.isGM &&
            user.active
        )
        .sort((a, b) =>
            a.id.localeCompare(b.id)
        )[0] ?? null;
}

function isPrimaryActiveGm() {
    return (
        getPrimaryActiveGm()?.id ===
        game.user.id
    );
}

async function requireActorPermission(
    requester,
    actorUuid
) {
    if (!requester?.active) {
        throw new ConflictRequestError(
            "REQUESTER_UNAVAILABLE",
            "The requesting user is no longer connected."
        );
    }

    const actor = actorUuid
        ? await fromUuid(actorUuid)
        : null;

    if (!actor) {
        throw new ConflictRequestError(
            "ACTOR_NOT_FOUND",
            "The character for this conflict could not be found."
        );
    }

    const mayUseActor =
        requester.isGM ||
        actor.getUserLevel(requester) >=
        CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;

    if (!mayUseActor) {
        throw new ConflictRequestError(
            "ACTOR_NOT_OWNED",
            `You do not own ${actor.name} and cannot start this conflict.`,
            {
                actorName: actor.name
            }
        );
    }

    return actor;
}

function createConflictBusyError(conflict) {
    const requestingUser =
        game.users.get(conflict.requestedBy);

    const conflictLabel =
        conflict.source?.label ??
        "Another conflict";

    const userName =
        requestingUser?.name ??
        "another player";

    return new ConflictRequestError(
        "CONFLICT_BUSY",
        `${conflictLabel} is currently being resolved by ${userName}. ` +
        "Please wait for it to finish before starting another conflict.",

        {
            conflictId: conflict.id,
            conflictLabel,
            userName,
            phase: conflict.phase
        }
    );
}

async function handleStartRequest(message) {
    const requester =
        game.users.get(message.requesterId);

    const options =
        message.payload?.options ?? {};

    await requireActorPermission(
        requester,
        options.actorUuid
    );

    const existingConflict =
        getActiveConflict();

    /*
     * If this player closed or lost their selection window,
     * reopen the existing conflict instead of drawing again.
     */
    if (
        existingConflict?.requestedBy === requester.id &&
        existingConflict.phase === "selecting"
    ) {
        return {
            conflict: existingConflict,
            resumed: true
        };
    }

    if (existingConflict) {
        throw createConflictBusyError(
            existingConflict
        );
    }

    const conflictPile =
        game.cards.getName(CONFLICT_PILE_NAME);

    if (!conflictPile) {
        throw new ConflictRequestError(
            "CONFLICT_PILE_MISSING",
            "The Current Conflict pile does not exist. Ask a GM to repair the Fate Deck."
        );
    }

    /*
     * Cards without an active structured conflict belong to
     * the manual dock-flip workflow.
     */
    if (conflictPile.cards.size > 0) {
        throw new ConflictRequestError(
            "MANUAL_CONFLICT_PENDING",
            "A manual Fate flip is still in Current Conflict. " +
            "It must be resolved or cleared before a structured conflict can begin."
        );
    }

    const conflict =
        await startActiveConflict({
            ...options,

            /*
             * Never trust a requestedBy value supplied by the
             * client. The socket identifies the actual requester.
             */
            requestedBy: requester.id
        });

    return {
        conflict,
        resumed: false
    };
}

async function handleConfirmRequest(message) {
    const requester =
        game.users.get(message.requesterId);

    const selection =
        message.payload ?? {};

    const conflict =
        getActiveConflict();

    if (!requester?.active) {
        throw new ConflictRequestError(
            "REQUESTER_UNAVAILABLE",
            "The requesting user is no longer connected."
        );
    }

    if (
        !conflict ||
        conflict.id !== selection.conflictId
    ) {
        throw new ConflictRequestError(
            "CONFLICT_CHANGED",
            "This conflict is no longer active. It may already have been resolved."
        );
    }

    await requireActorPermission(
        requester,
        conflict.actorUuid
    );

    /*
     * A normal player may only confirm the conflict they started.
     * A GM may intervene when recovery is necessary.
     */
    if (
        conflict.requestedBy !== requester.id &&
        !requester.isGM
    ) {
        throw new ConflictRequestError(
            "NOT_REQUESTER",
            "Only the player who started this conflict may confirm its card."
        );
    }

    if (conflict.phase === "selecting") {
        await selectActiveConflictCard({
            conflictId: selection.conflictId,
            source: selection.source,
            cardId: selection.cardId,
            selectedSuit: selection.selectedSuit,
            selectedBy: requester.id
        });
    } else if (
        conflict.phase !== "selected" ||
        conflict.selectedBy !== requester.id
    ) {
        throw new ConflictRequestError(
            "CONFLICT_NOT_SELECTING",
            `This conflict cannot accept a selection during phase "${conflict.phase}".`
        );
    }

    /*
     * The selected phase is also accepted here. This allows the
     * player to retry if selection succeeded but resolution failed.
     */
    const resolution =
        await resolveActiveConflict({
            chat: true
        });

    /*
     * Do not send card Documents through the socket.
     * Return only the small pieces the player needs.
     */
    return {
        conflictId: selection.conflictId,
        resolved: true,
        chatMessageId:
        resolution.chatMessageId
    };
}

async function handleGmRequest(message) {
    switch (message.type) {
        case "active-conflict-start-request":
            return handleStartRequest(message);

        case "active-conflict-confirm-request":
            return handleConfirmRequest(message);

        default:
            throw new ConflictRequestError(
                "UNKNOWN_REQUEST",
                "The GM received an unknown conflict request."
            );
    }
}

function enqueueGmRequest(message) {
    const operation =
        gmOperationQueue.then(() =>
            handleGmRequest(message)
        );

    /*
     * Keep the queue usable even when this particular
     * operation fails.
     */
    gmOperationQueue =
        operation.catch(() => undefined);

    return operation;
}

function serializeError(error) {
    return {
        code:
            error.code ??
            "CONFLICT_REQUEST_FAILED",

        message:
            error.message ??
            "The conflict request could not be completed.",

        details:
            error.details ?? {}
    };
}

function restoreError(error = {}) {
    return new ConflictRequestError(
        error.code ??
        "CONFLICT_REQUEST_FAILED",

        error.message ??
        "The conflict request could not be completed.",

        error.details ?? {}
    );
}

async function submitRequest(
    type,
    payload
) {
    const primaryGm =
        getPrimaryActiveGm();

    if (!primaryGm) {
        throw new ConflictRequestError(
            "NO_ACTIVE_GM",
            "No GM is currently connected. A GM must be online to use the shared Fate Deck."
        );
    }

    const message = {
        type,
        requestId:
            foundry.utils.randomID(16),

        requesterId:
        game.user.id,

        payload
    };

    /*
     * When the current user is the primary GM, process the
     * request locally. Socket messages are not guaranteed to
     * return to the client that emitted them.
     */
    if (isPrimaryActiveGm()) {
        return enqueueGmRequest(
            message
        );
    }

    return new Promise((
        resolve,
        reject
    ) => {
        const timeout =
            window.setTimeout(() => {
                pendingRequests.delete(
                    message.requestId
                );

                reject(
                    new ConflictRequestError(
                        "GM_TIMEOUT",
                        "The GM did not answer the conflict request. They may be reconnecting; try again shortly."
                    )
                );
            }, REQUEST_TIMEOUT_MS);

        pendingRequests.set(
            message.requestId,
            {
                resolve,
                reject,
                timeout
            }
        );

        game.socket.emit(
            SOCKET_NAME,
            message
        );
    });
}

export function requestActiveConflict(
    options = {}
) {
    return submitRequest(
        "active-conflict-start-request",
        {
            options
        }
    );
}

export function confirmActiveConflictSelection({
                                                   conflictId,
                                                   source,
                                                   cardId,
                                                   selectedSuit = null
                                               } = {}) {
    return submitRequest(
        "active-conflict-confirm-request",
        {
            conflictId,
            source,
            cardId,
            selectedSuit
        }
    );
}

export function initializeActiveConflictSocket() {
    game.socket.on(
        SOCKET_NAME,
        async (message) => {
            /*
             * A response is only relevant to the player who
             * originally sent the matching request.
             */
            if (
                message?.type ===
                "active-conflict-response"
            ) {
                if (
                    message.requesterId !==
                    game.user.id
                ) {
                    return;
                }

                const pending =
                    pendingRequests.get(
                        message.requestId
                    );

                /*
                 * The request may already have timed out.
                 */
                if (!pending) return;

                window.clearTimeout(
                    pending.timeout
                );

                pendingRequests.delete(
                    message.requestId
                );

                if (message.ok) {
                    pending.resolve(
                        message.result
                    );
                } else {
                    pending.reject(
                        restoreError(
                            message.error
                        )
                    );
                }

                return;
            }

            /*
             * Only one consistently selected GM may handle
             * requests that manipulate the shared Fate Deck.
             */
            if (!isPrimaryActiveGm()) {
                return;
            }

            if (![
                "active-conflict-start-request",
                "active-conflict-confirm-request"
            ].includes(message?.type)) {
                return;
            }

            /*
             * Ignore malformed requests instead of trying to
             * send a response without an identifiable recipient.
             */
            if (
                !message.requestId ||
                !message.requesterId
            ) {
                return;
            }

            try {
                const result =
                    await enqueueGmRequest(
                        message
                    );

                game.socket.emit(
                    SOCKET_NAME,
                    {
                        type:
                            "active-conflict-response",

                        requestId:
                        message.requestId,

                        requesterId:
                        message.requesterId,

                        ok: true,
                        result
                    }
                );
            } catch (error) {
                console.error(
                    `${SYSTEM_ID} | Active conflict request failed`,
                    error
                );

                game.socket.emit(
                    SOCKET_NAME,
                    {
                        type:
                            "active-conflict-response",

                        requestId:
                        message.requestId,

                        requesterId:
                        message.requesterId,

                        ok: false,

                        error:
                            serializeError(error)
                    }
                );
            }
        }
    );
}
