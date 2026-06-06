const SYSTEM_ID = "through-the-breach";

const RESOLVE_CONFLICT_MACRO_NAME = "Resolve Conflict";

const RESOLVE_CONFLICT_COMMAND = `
if (!game.throughTheBreach?.resolveCurrentConflict) {
  ui.notifications.error("Through the Breach system API is not ready.");
  return;
}

await game.throughTheBreach.resolveCurrentConflict({ chat: true });
`;

function findResolveMacro() {
    return game.macros.find((macro) => {
        return macro.getFlag(SYSTEM_ID, "macro") === "resolve-conflict";
    }) ?? game.macros.getName(RESOLVE_CONFLICT_MACRO_NAME);
}

export async function ensureResolveConflictMacro({ notify = false } = {}) {
    if (!game.user.isGM) {
        return findResolveMacro();
    }

    let macro = findResolveMacro();

    const macroData = {
        name: RESOLVE_CONFLICT_MACRO_NAME,
        type: "script",
        img: "icons/svg/card-joker.svg",
        command: RESOLVE_CONFLICT_COMMAND.trim(),
        ownership: {
            default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
        },
        flags: {
            [SYSTEM_ID]: {
                macro: "resolve-conflict",
                version: 1
            }
        }
    };

    if (!macro) {
        macro = await Macro.implementation.create(macroData);
        if (notify) ui.notifications.info("Created macro: Resolve Conflict");
        return macro;
    }

    await macro.update(macroData);
    return macro;
}

function getAssignedHotbarSlot(macro) {
    const hotbar = game.user.hotbar ?? {};

    for (const [slot, macroId] of Object.entries(hotbar)) {
        if (macroId === macro.id) return Number(slot);
    }

    return null;
}

function getFirstEmptyHotbarSlot() {
    const hotbar = game.user.hotbar ?? {};

    for (let slot = 1; slot <= 50; slot++) {
        if (!hotbar[String(slot)]) return slot;
    }

    return null;
}

export async function setupResolveConflictMacroForCurrentUser({ notify = false } = {}) {
    if (game.user.isGM) {
        await ensureResolveConflictMacro({ notify });
    }

    const macro = findResolveMacro();
    if (!macro) return null;

    const existingSlot = getAssignedHotbarSlot(macro);
    if (existingSlot) return macro;

    const emptySlot = getFirstEmptyHotbarSlot();
    if (!emptySlot) return macro;

    await game.user.assignHotbarMacro(macro, emptySlot);
    return macro;
}