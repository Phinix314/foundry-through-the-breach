import { flipTopCardToConflict } from "../cards/fate-deck.mjs";

const SYSTEM_ID = "through-the-breach";

function rowData(array, count, fallback = {}) {
    return Array.from({ length: count }, (_, index) => ({
        index,
        data: array?.[index] ?? fallback
    }));
}

export class TTBCharacterSheet extends ActorSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: [SYSTEM_ID, "sheet", "actor", "ttb-character-sheet"],
            template: `systems/${SYSTEM_ID}/templates/actor/character-sheet.hbs`,
            width: 900,
            height: 760,
            left: 120,
            top: 80,
            resizable: true,
            submitOnChange: true,
            closeOnSubmit: false,
            tabs: [
                {
                    navSelector: ".sheet-tabs",
                    contentSelector: ".sheet-body",
                    initial: "main"
                }
            ]
        });
    }

    async getData(options = {}) {
        console.log("TTB | getData start", this.actor.name);

        const context = await super.getData(options);
        const system = this.actor.system ?? {};

        context.system = system;

        context.rows = {
            attacks: rowData(system.attacks, 2, {}),
            skills: rowData(system.skills, 24, {}),
            talents: rowData(system.talents, 20, {}),
            equipment: rowData(system.equipment, 12, {}),
            destiny: rowData(system.destiny, 5, {})
        };

        console.log("TTB | getData done", context);

        return context;
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find("[data-action='flip-fate']").on("click", async (event) => {
            event.preventDefault();

            try {
                await flipTopCardToConflict({ actor: this.actor });
            } catch (error) {
                console.error("TTB | Failed to flip Fate card", error);
                ui.notifications.error("Failed to flip Fate card. Check console.");
            }
        });
    }

    setPosition(position = {}) {
        const result = super.setPosition(position);
        console.log("TTB | setPosition", this.position);
        return result;
    }
}