const SYSTEM_ID = "through-the-breach";

export class TTBCharacterSheet extends ActorSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: [SYSTEM_ID, "sheet", "actor"],
            template: `systems/${SYSTEM_ID}/templates/actor/character-sheet.hbs`,
            width: 600,
            height: 400,
            resizable: true
        });
    }

    async getData(options = {}) {
        return await super.getData(options);
    }
}