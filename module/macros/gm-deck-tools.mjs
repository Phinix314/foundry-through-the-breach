const SYSTEM_ID = "through-the-breach";

const ASSIGN_TWIST_DECK_MACRO_NAME = "Assign Twist Deck";

function getCharacterActors() {
    return game.actors
        .filter((actor) => actor.type === "character")
        .sort((a, b) => a.name.localeCompare(b.name));
}

function parseCardIds(raw) {
    return String(raw ?? "")
        .split(/[\n,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function buildActorOptions() {
    return getCharacterActors()
        .map((actor) => `<option value="${actor.uuid}">${foundry.utils.escapeHTML(actor.name)}</option>`)
        .join("");
}

function getMacroByFlag(flag) {
    return game.macros.find((macro) => {
        return macro.getFlag(SYSTEM_ID, "macro") === flag;
    }) ?? null;
}

async function openAssignTwistDeckDialog() {
    const actorOptions = buildActorOptions();

    if (!actorOptions) {
        ui.notifications.warn("No character actors available.");
        return;
    }

    const content = `
    <form class="ttb-gm-deck-tool">
        <div class="form-group">
            <label>Actor</label>
            <select name="actorUuid">
                ${actorOptions}
            </select>
        </div>

        <div class="form-group">
            <label>Card IDs</label>
            <textarea
                name="cardIds"
                rows="12"
                placeholder="Example:
rams-1
rams-2
crows-13
red-joker"
            ></textarea>
        </div>

        <div class="form-group">
            <label>
                <input type="checkbox" name="shuffle" checked />
                Shuffle after change
            </label>
        </div>
    </form>
    `;

    new Dialog({
        title: "Assign Twist Deck",
        content,
        buttons: {
            replace: {
                label: "Replace Deck",
                callback: async (html) => {
                    const actorUuid = html.find('[name="actorUuid"]').val();
                    const raw = html.find('[name="cardIds"]').val();
                    const shuffle = html.find('[name="shuffle"]').is(":checked");
                    const fateIds = parseCardIds(raw);

                    await game.throughTheBreach.setActorDeckComposition(actorUuid, fateIds, {
                        shuffle,
                        notify: true
                    });
                }
            },
            add: {
                label: "Add Cards",
                callback: async (html) => {
                    const actorUuid = html.find('[name="actorUuid"]').val();
                    const raw = html.find('[name="cardIds"]').val();
                    const shuffle = html.find('[name="shuffle"]').is(":checked");
                    const fateIds = parseCardIds(raw);

                    await game.throughTheBreach.addFateCardsToActorDeck(actorUuid, fateIds, {
                        shuffle,
                        notify: true
                    });
                }
            },
            clear: {
                label: "Clear Deck",
                callback: async (html) => {
                    const actorUuid = html.find('[name="actorUuid"]').val();

                    await game.throughTheBreach.setActorDeckComposition(actorUuid, [], {
                        shuffle: false,
                        notify: true
                    });
                }
            },
            cancel: {
                label: "Cancel"
            }
        },
        default: "replace"
    }).render(true);
}

export async function ensureGmDeckToolsMacro({ notify = false } = {}) {
    if (!game.user.isGM) return null;

    let macro = getMacroByFlag("assign-twist-deck");

    const command = `
if (!game.user.isGM) {
    ui.notifications.warn("Only the GM can use this macro.");
    return;
}

if (!game.throughTheBreach?.openAssignTwistDeckDialog) {
    ui.notifications.error("Through the Breach system API is not ready.");
    return;
}

await game.throughTheBreach.openAssignTwistDeckDialog();
`.trim();

    const macroData = {
        name: ASSIGN_TWIST_DECK_MACRO_NAME,
        type: "script",
        img: "icons/svg/card-joker.svg",
        command,
        ownership: {
            default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE
        },
        flags: {
            [SYSTEM_ID]: {
                macro: "assign-twist-deck",
                version: 1
            }
        }
    };

    if (!macro) {
        macro = await Macro.implementation.create(macroData);

        if (notify) {
            ui.notifications.info(`Created macro: ${ASSIGN_TWIST_DECK_MACRO_NAME}`);
        }

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

export async function setupGmDeckToolsMacroForCurrentUser({ notify = false } = {}) {
    if (!game.user.isGM) return null;

    const macro = await ensureGmDeckToolsMacro({ notify });
    if (!macro) return null;

    const existingSlot = getAssignedHotbarSlot(macro);
    if (existingSlot) return macro;

    const emptySlot = getFirstEmptyHotbarSlot();
    if (!emptySlot) return macro;

    await game.user.assignHotbarMacro(macro, emptySlot);
    return macro;
}

export async function openAssignTwistDeckDialogFromApi() {
    return openAssignTwistDeckDialog();
}