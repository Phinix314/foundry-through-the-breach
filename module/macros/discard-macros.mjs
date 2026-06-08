const SYSTEM_ID = "through-the-breach";

const PEEK_FATE_DISCARD_MACRO_NAME = "Peek Fate Discard";
const PEEK_TWIST_DISCARD_MACRO_NAME = "Peek Twist Discard";

const PEEK_FATE_DISCARD_COMMAND = `
if (!game.throughTheBreach?.showPeekFateDiscard) {
  ui.notifications.error("Through the Breach system API is not ready.");
  return;
}

new Dialog({
  title: "Peek Fate Discard",
  content: \`
    <form>
      <div class="form-group">
        <label>How many cards?</label>
        <input type="number" name="count" value="3" min="1" max="20"/>
      </div>
    </form>
  \`,
  buttons: {
    ok: {
      label: "Peek",
      callback: async (html) => {
        const count = Number(html.find('[name="count"]').val() || 1);
        await game.throughTheBreach.showPeekFateDiscard(count);
      }
    },
    cancel: {
      label: "Cancel"
    }
  },
  default: "ok"
}).render(true);
`;

const PEEK_TWIST_DISCARD_COMMAND = `
const actor = canvas.tokens?.controlled?.[0]?.actor ?? game.user.character ?? null;

if (!actor) {
  ui.notifications.warn("Select a token or assign a character first.");
  return;
}

if (!game.throughTheBreach?.showPeekActorTwistDiscard) {
  ui.notifications.error("Through the Breach system API is not ready.");
  return;
}

new Dialog({
  title: "Peek Twist Discard",
  content: \`
    <form>
      <div class="form-group">
        <label>How many cards?</label>
        <input type="number" name="count" value="3" min="1" max="20"/>
      </div>
    </form>
  \`,
  buttons: {
    ok: {
      label: "Peek",
      callback: async (html) => {
        const count = Number(html.find('[name="count"]').val() || 1);
        await game.throughTheBreach.showPeekActorTwistDiscard(actor, count);
      }
    },
    cancel: {
      label: "Cancel"
    }
  },
  default: "ok"
}).render(true);
`;

const MACROS = [
    {
        name: PEEK_FATE_DISCARD_MACRO_NAME,
        flag: "peek-fate-discard",
        img: "icons/svg/card-joker.svg",
        command: PEEK_FATE_DISCARD_COMMAND
    },
    {
        name: PEEK_TWIST_DISCARD_MACRO_NAME,
        flag: "peek-twist-discard",
        img: "icons/svg/card-joker.svg",
        command: PEEK_TWIST_DISCARD_COMMAND
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
        if (notify) ui.notifications.info(`Created macro: ${definition.name}`);
        return macro;
    }

    await macro.update(macroData);
    return macro;
}

export async function ensureDiscardMacros({ notify = false } = {}) {
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

export async function setupDiscardMacrosForCurrentUser({ notify = false } = {}) {
    if (game.user.isGM) {
        await ensureDiscardMacros({ notify });
    }

    for (const definition of MACROS) {
        const macro = findMacroByFlag(definition.flag);
        if (!macro) continue;

        const existingSlot = getAssignedHotbarSlot(macro);
        if (existingSlot) continue;

        const emptySlot = getFirstEmptyHotbarSlot();
        if (!emptySlot) continue;

        await game.user.assignHotbarMacro(macro, emptySlot);
    }
}