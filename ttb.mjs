import { TTBCharacterData } from "./module/data/character-data.mjs";
import { TTBCharacterSheet } from "./module/sheets/character-sheet.mjs";
import { ensureFateDeck } from "./module/cards/fate-deck.mjs";

const SYSTEM_ID = "through-the-breach";

Hooks.once("init", () => {
    console.log(`${SYSTEM_ID} | init`);

    CONFIG.Actor.dataModels.character = TTBCharacterData;

    Actors.registerSheet(SYSTEM_ID, TTBCharacterSheet, {
        types: ["character"],
        makeDefault: true
    });
});

Hooks.once("ready", async () => {
    console.log(`${SYSTEM_ID} | ready`);

    game.throughTheBreach = {
        ensureFateDeck
    };

    if (!game.user.isGM) return;

    try {
        await ensureFateDeck({ notify: true });
    } catch (error) {
        console.error(`${SYSTEM_ID} | Failed to create Fate Deck`, error);
        ui.notifications.error("Through the Breach | Failed to create Fate Deck. Check console.");
    }
});