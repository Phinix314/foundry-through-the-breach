const SYSTEM_ID = "through-the-breach";

export const FLIP_FATE_MACRO_NAME = "Flip Fate Card";

const FLIP_FATE_MACRO_COMMAND = `
const controlledToken = canvas.tokens?.controlled?.[0] ?? null;
const actor = controlledToken?.actor ?? game.user.character ?? null;

if (!game.throughTheBreach?.flipTopCardToConflict) {
  ui.notifications.error("Through the Breach system API is not ready.");
  return;
}

await game.throughTheBreach.flipTopCardToConflict({ actor });
`;

function findFlipFateMacro() {
    return game.macros.find((macro) => {
        return macro.getFlag("through-the-breach", "macro") === "flip-fate-card";
    }) ?? game.macros.getName(FLIP_FATE_MACRO_NAME);
}

export async function ensureFlipFateMacro({ notify = false } = {}) {
    if (!game.user.isGM) {
        return findFlipFateMacro();
    }

    let macro = findFlipFateMacro();

    const macroData = {
        name: FLIP_FATE_MACRO_NAME,
        type: "script",
        img: "icons/svg/card-joker.svg",
        command: FLIP_FATE_MACRO_COMMAND.trim(),
        ownership: {
            default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
        },
        flags: {
            [SYSTEM_ID]: {
                macro: "flip-fate-card",
                version: 1
            }
        }
    };

    if (!macro) {
        macro = await Macro.implementation.create(macroData);

        if (notify) {
            ui.notifications.info("Created Through the Breach flip macro.");
        }

        return macro;
    }

    await macro.update({
        type: macroData.type,
        img: macroData.img,
        command: macroData.command,
        ownership: macroData.ownership,
        flags: macroData.flags
    });

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

    for (let slot = 1; slot <= 10; slot++) {
        if (!hotbar[String(slot)]) return slot;
    }

    for (let slot = 11; slot <= 50; slot++) {
        if (!hotbar[String(slot)]) return slot;
    }

    return null;
}

export async function assignFlipFateMacroToCurrentUser({ notify = false } = {}) {
    const macro = findFlipFateMacro();

    if (!macro) {
        if (notify) {
            ui.notifications.warn("Flip Fate Card macro does not exist yet.");
        }
        return null;
    }

    const existingSlot = getAssignedHotbarSlot(macro);
    if (existingSlot) {
        return macro;
    }

    const emptySlot = getFirstEmptyHotbarSlot();

    if (!emptySlot) {
        if (notify) {
            ui.notifications.warn("No empty hotbar slot available for Flip Fate Card macro.");
        }
        return macro;
    }

    await game.user.assignHotbarMacro(macro, emptySlot);

    if (notify) {
        ui.notifications.info(`Assigned Flip Fate Card macro to hotbar slot ${emptySlot}.`);
    }

    return macro;
}

export async function setupFlipFateMacroForCurrentUser({ notify = false } = {}) {
    if (game.user.isGM) {
        await ensureFlipFateMacro({ notify });
    }

    return assignFlipFateMacroToCurrentUser({ notify });
}