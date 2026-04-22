import { TTBCharacterData } from "./module/data/character-data.mjs";
import { TTBCharacterSheet } from "./module/sheets/character-sheet.mjs";
import {
    ensureFateDeck,
    ensureConflictPile,
    flipTopCardToConflict
} from "./module/cards/fate-deck.mjs";
import {
    ensureFlipFateMacro,
    setupFlipFateMacroForCurrentUser
} from "./module/macros/fate-macros.mjs";
import {
    ensurePlayerTwistDeck,
    ensurePlayerTwistDecks,
    getPlayerTwistDeck,
    addFateCardsToUserDeck,
    setUserDeckComposition,
    listFateCardIds
} from "./module/cards/player-decks.mjs";

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
        ensureFateDeck,
        ensureConflictPile,
        flipTopCardToConflict,

        ensurePlayerTwistDeck,
        ensurePlayerTwistDecks,
        getPlayerTwistDeck,
        addFateCardsToUserDeck,
        setUserDeckComposition,
        listFateCardIds,

        ensureFlipFateMacro,
        setupFlipFateMacroForCurrentUser
    };

    if (game.user.isGM) {
        try {
            await ensureFateDeck({ notify: true });
            await ensureConflictPile({ notify: true });
            await ensureFlipFateMacro({ notify: true });
            await ensurePlayerTwistDecks({ notify: true });
        } catch (error) {
            console.error(`${SYSTEM_ID} | Failed to prepare TTB system`, error);
            ui.notifications.error("Through the Breach | Failed to prepare system. Check console.");
        }
    }

    try {
        await setupFlipFateMacroForCurrentUser({ notify: false });

        window.setTimeout(() => {
            setupFlipFateMacroForCurrentUser({ notify: false });
        }, 2000);
    } catch (error) {
        console.error(`${SYSTEM_ID} | Failed to assign flip macro`, error);
    }
});