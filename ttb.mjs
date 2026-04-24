import {TTBCharacterData} from "./module/data/character-data.mjs";
import {TTBCharacterSheet} from "./module/sheets/character-sheet.mjs";
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
    ensureActorTwistDeck,
    ensureActorTwistDecks,
    getActorTwistDeck,
    addFateCardsToActorDeck,
    setActorDeckComposition,
    syncActorTwistDeckOwnership,
    listFateCardIds
} from "./module/cards/actor-decks.mjs";
import {
    ensureActorTwistHand,
    ensureActorTwistHands,
    getActorTwistHand,
    syncActorTwistHandOwnership,
    drawTwistCardsForActor,
    cheatFateCardFromActorHand,
    openCheatFateDialogForActor
} from "./module/cards/actor-hands.mjs";
import {
    ensureTwistMacros,
    setupTwistMacrosForCurrentUser
} from "./module/macros/twist-macros.mjs";

import {
    ensureFateDiscard,
    ensureActorTwistDiscard,
    ensureActorTwistDiscards,
    getActorTwistDiscard,
    syncActorTwistDiscardOwnership
} from "./module/cards/discard-piles.mjs";

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
        ensureFateDiscard,
        ensureConflictPile,

        ensureActorTwistDeck,
        ensureActorTwistHand,
        ensureActorTwistDiscard,

        ensureActorTwistDiscards,
        getActorTwistDiscard,
        syncActorTwistDiscardOwnership,

        ensureActorCardStacks,
        flipTopCardToConflict,

        ensureActorTwistDecks,
        getActorTwistDeck,
        addFateCardsToActorDeck,
        setActorDeckComposition,
        syncActorTwistDeckOwnership,
        listFateCardIds,

        ensureActorTwistHands,
        getActorTwistHand,
        syncActorTwistHandOwnership,
        drawTwistCardsForActor,
        cheatFateCardFromActorHand,
        openCheatFateDialogForActor,

        ensureFlipFateMacro,
        setupFlipFateMacroForCurrentUser
    };

    if (game.user.isGM) {
        try {
            await ensureFateDeck({notify: true});
            await ensureFateDiscard({notify: true});
            await ensureConflictPile({notify: true});

            for (const actor of game.actors.filter(a => a.type === "character")) {
                await ensureActorCardStacks(actor, {notify: true});
            }

            await ensureFlipFateMacro({notify: true});
            await ensureTwistMacros({notify: true});
        } catch (error) {
            console.error(`${SYSTEM_ID} | Failed to prepare TTB system`, error);
            ui.notifications.error("Through the Breach | Failed to prepare system. Check console.");
        }
    }

    function actorCardStacksNeedSync(changes) {
        const flatChanges = foundry.utils.flattenObject(changes ?? {});

        return Object.keys(flatChanges).some((key) => {
            return key === "name" || key.startsWith("ownership");
        });
    }

    async function ensureActorCardStacks(actor, {notify = false} = {}) {
        await ensureActorTwistDeck(actor, {notify});
        await ensureActorTwistHand(actor, {notify});
        await ensureActorTwistDiscard(actor, {notify});

        await syncActorTwistDeckOwnership(actor);
        await syncActorTwistHandOwnership(actor);
        await syncActorTwistDiscardOwnership(actor);
    }

    Hooks.on("createActor", async (actor) => {
        if (!game.user.isGM) return;
        if (actor.type !== "character") return;

        try {
            await ensureActorCardStacks(actor, { notify: true });
        } catch (error) {
            console.error(`${SYSTEM_ID} | Failed to create actor card stacks`, error);
        }
    });

    function actorCardStacksNeedSync(changes) {
        const flat = foundry.utils.flattenObject(changes ?? {});
        return Object.keys(flat).some((key) => key === "name" || key.startsWith("ownership"));
    }

    Hooks.on("updateActor", async (actor, changes) => {
        if (!game.user.isGM) return;
        if (actor.type !== "character") return;
        if (!actorCardStacksNeedSync(changes)) return;

        try {
            await ensureActorCardStacks(actor);
        } catch (error) {
            console.error(`${SYSTEM_ID} | Failed to sync actor card stacks`, error);
        }
    });

    try {
        await setupFlipFateMacroForCurrentUser({notify: false});

        window.setTimeout(() => {
            setupFlipFateMacroForCurrentUser({notify: false});
        }, 2000);
    } catch (error) {
        console.error(`${SYSTEM_ID} | Failed to assign flip macro`, error);
    }
    try {
        await setupFlipFateMacroForCurrentUser({notify: false});
        await setupTwistMacrosForCurrentUser({notify: false});

        window.setTimeout(() => {
            setupFlipFateMacroForCurrentUser({notify: false});
            setupTwistMacrosForCurrentUser({notify: false});
        }, 2000);
    } catch (error) {
        console.error(`${SYSTEM_ID} | Failed to assign macros`, error);
    }
});