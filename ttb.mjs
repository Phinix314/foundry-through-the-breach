import { TTBCharacterData } from "./module/data/character-data.mjs";
import { TTBCharacterSheet } from "./module/sheets/character-sheet.mjs";

const SYSTEM_ID = "through-the-breach";

Hooks.on("init", () => {
    console.log(`${SYSTEM_ID} | Initializing system`);

    CONFIG.Actor.dataModels.character = TTBCharacterData;

    Actors.registerSheet(SYSTEM_ID, TTBCharacterSheet, {
        types: ["character"],
        makeDefault: true,
        label: "TTB.CharacterSheet"
    });
});