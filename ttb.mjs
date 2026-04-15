import { TTBCharacterSheet } from "./module/sheets/character-sheet.mjs";

const SYSTEM_ID = "through-the-breach";

Hooks.once("init", () => {
    console.log(`${SYSTEM_ID} | init`);

    Actors.registerSheet(SYSTEM_ID, TTBCharacterSheet, {
        types: ["character"],
        makeDefault: true
    });
});