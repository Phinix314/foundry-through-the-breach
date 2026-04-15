const SYSTEM_ID = "through-the-breach";

export class TTBCharacterSheet extends ActorSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: [SYSTEM_ID, "sheet", "actor"],
            template: `systems/${SYSTEM_ID}/templates/actor/character-sheet.hbs`,
            width: 650,
            height: 700,
            resizable: true,
            submitOnChange: true,
            closeOnSubmit: false
        });
    }

    get title() {
        return this.actor.name || "Character";
    }

    async getData(options = {}) {
        const context = await super.getData(options);
        context.system = this.actor.system;
        return context;
    }
}