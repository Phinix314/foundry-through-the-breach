const SYSTEM_ID = "through-the-breach";

const DRAW_TWIST_MACRO_NAME = "Draw Twist Card";
const CHEAT_FATE_MACRO_NAME = "Cheat Fate";

const DRAW_TWIST_COMMAND = `
const actor = canvas.tokens?.controlled?.[0]?.actor ?? game.user.character ?? null;

if (!actor) {
  ui.notifications.warn("Select a token or assign a character first.");
  return;
}

if (!game.throughTheBreach?.drawTwistCardsForActor) {
  ui.notifications.error("Through the Breach system API is not ready.");
  return;
}

await game.throughTheBreach.drawTwistCardsForActor(actor, 1);
`;

const CHEAT_FATE_COMMAND = `
const actor = canvas.tokens?.controlled?.[0]?.actor ?? game.user.character ?? null;

if (!actor) {
  ui.notifications.warn("Select a token or assign a character first.");
  return;
}

if (!game.throughTheBreach?.openCheatFateDialogForActor) {
  ui.notifications.error("Through the Breach system API is not ready.");
  return;
}

await game.throughTheBreach.openCheatFateDialogForActor(actor);
`;

const MACROS = [
    {
        name: DRAW_TWIST_MACRO_NAME,
        flag: "draw-twist-card",
        img: "icons/svg/card-joker.svg",
        command: DRAW_TWIST_COMMAND
    },
    {
        name: CHEAT_FATE_MACRO_NAME,
        flag: "cheat-fate",
        img: "icons/svg/card-joker.svg",
        command: CHEAT_FATE_COMMAND
    }
];

function findMacroByFlag(flag) {
    return game.macros.find((macro) => {
        return macro.getFlag(SYSTEM_ID, "macro") === flag;
    });
}

async function ensureMacro(definition, { notify = false } = {}) {
    if (!game.user.isGM) {
        return findMacroByFlag(definition.flag);
    }

    let macro = findMacroByFlag(definition.flag);

    const macroData = {
        name: definition.name,
        type: "script",
        img: definition.img,
        command: definition.command.trim(),
        ownership: {
            default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
        },
        flags: {
            [SYSTEM_ID]: {
                macro: definition.flag,
                version: 1
            }
        }
    };

    if (!macro) {
        macro = await Macro.implementation.create(macroData);

        if (notify) {
            ui.notifications.info(`Created macro: ${definition.name}`);
        }

        return macro;
    }

    await macro.update(macroData);
    return macro;
}

export async function ensureTwistMacros({ notify = false } = {}) {
    const macros = [];

    for (const definition of MACROS) {
        const macro = await ensureMacro(definition, { notify });
        if (macro) macros.push(macro);
    }

    return macros;
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

async function assignMacroToCurrentUser(macro) {
    if (!macro) return null;

    const existingSlot = getAssignedHotbarSlot(macro);
    if (existingSlot) return macro;

    const emptySlot = getFirstEmptyHotbarSlot();
    if (!emptySlot) return macro;

    await game.user.assignHotbarMacro(macro, emptySlot);
    return macro;
}

export async function setupTwistMacrosForCurrentUser({ notify = false } = {}) {
    if (game.user.isGM) {
        await ensureTwistMacros({ notify });
    }

    for (const definition of MACROS) {
        const macro = findMacroByFlag(definition.flag);
        await assignMacroToCurrentUser(macro);
    }
}