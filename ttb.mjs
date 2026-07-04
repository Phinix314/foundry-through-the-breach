import {
    syncActorCardSummary,
    syncAllActorCardSummaries
} from "./module/cards/summary-state.mjs";

import {
    initializeTtbCardDock,
    rerenderTtbCardDock
} from "./module/ui/card-dock.mjs";

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
    ensureDiscardMacros,
    setupDiscardMacrosForCurrentUser
} from "./module/macros/discard-macros.mjs";
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

import {
    resolveCurrentConflict,
    getTopDiscardCards,
    peekFateDiscard,
    peekActorTwistDiscard,
    showPeekFateDiscard,
    showPeekActorTwistDiscard
} from "./module/cards/conflict-resolution.mjs";

import {
    ensureResolveConflictMacro,
    setupResolveConflictMacroForCurrentUser
} from "./module/macros/conflict-macros.mjs";
import {
    recycleFateDeckIfEmpty,
    recycleActorTwistDeckIfEmpty,
    prepareFateDeckForDraw,
    prepareActorTwistDeckForDraw,
    announceActorTwistDraw,
} from "./module/cards/deck-recycling.mjs";
import {
    ensureGmDeckToolsMacro,
    setupGmDeckToolsMacroForCurrentUser,
    openAssignTwistDeckDialogFromApi
} from "./module/macros/gm-deck-tools.mjs";

const SYSTEM_ID = "through-the-breach";

async function ensureActorCardStacks(actor, { notify = false } = {}) {
    await ensureActorTwistDeck(actor, { notify });
    await ensureActorTwistHand(actor, { notify });
    await ensureActorTwistDiscard(actor, { notify });

    await syncActorTwistDeckOwnership(actor);
    await syncActorTwistHandOwnership(actor);
    await syncActorTwistDiscardOwnership(actor);

    await syncActorCardSummary(actor);
}

function actorCardStacksNeedSync(changes) {
    const flat = foundry.utils.flattenObject(changes ?? {});
    return Object.keys(flat).some((key) => key === "name" || key.startsWith("ownership"));
}

Hooks.once("init", () => {
    console.log(`${SYSTEM_ID} | init`);

    CONFIG.Actor.dataModels.character = TTBCharacterData;

    Actors.registerSheet(SYSTEM_ID, TTBCharacterSheet, {
        types: ["character"],
        makeDefault: true
    });

    initializeTtbCardDock();
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

        ensureGmDeckToolsMacro,
        setupGmDeckToolsMacroForCurrentUser,
        openAssignTwistDeckDialog: openAssignTwistDeckDialogFromApi,

        resolveCurrentConflict,
        getTopDiscardCards,
        peekFateDiscard,
        peekActorTwistDiscard,
        showPeekFateDiscard,
        showPeekActorTwistDiscard,

        recycleFateDeckIfEmpty,
        recycleActorTwistDeckIfEmpty,
        prepareFateDeckForDraw,
        prepareActorTwistDeckForDraw,
        announceActorTwistDraw,

        ensureFlipFateMacro,
        setupFlipFateMacroForCurrentUser,

        ensureTwistMacros,
        setupTwistMacrosForCurrentUser,

        ensureResolveConflictMacro,
        setupResolveConflictMacroForCurrentUser,

        ensureDiscardMacros,
        setupDiscardMacrosForCurrentUser,

        syncActorCardSummary,
        syncAllActorCardSummaries,
        rerenderTtbCardDock,

        flipTopCardToConflict,
        drawTwistCardsForActor,
        cheatFateCardFromActorHand,
        openCheatFateDialogForActor,

        ensureActorTwistDecks,
        getActorTwistDeck,
        addFateCardsToActorDeck,
        setActorDeckComposition,
        syncActorTwistDeckOwnership,
        listFateCardIds
    };

    if (game.user.isGM) {
        try {
            await ensureFateDeck({ notify: true });
            await ensureFateDiscard({ notify: true });
            await ensureConflictPile({ notify: true });

            for (const actor of game.actors.filter((a) => a.type === "character")) {
                await ensureActorCardStacks(actor, { notify: true });
            }

            await syncAllActorCardSummaries();
            await rerenderTtbCardDock();

            await ensureFlipFateMacro({ notify: true });
            await ensureTwistMacros({ notify: true });
            await ensureResolveConflictMacro({ notify: true });
            await ensureDiscardMacros({ notify: true });
            await ensureGmDeckToolsMacro({ notify: true });
        } catch (error) {
            console.error(`${SYSTEM_ID} | Failed to prepare TTB system`, error);
            ui.notifications.error("Through the Breach | Failed to prepare system. Check console.");
        }
    }

    try {
        await setupFlipFateMacroForCurrentUser({ notify: false });
        await setupTwistMacrosForCurrentUser({ notify: false });
        await setupResolveConflictMacroForCurrentUser({ notify: false });
        await setupDiscardMacrosForCurrentUser({ notify: false });
        await setupGmDeckToolsMacroForCurrentUser({ notify: false });

        window.setTimeout(() => {
            setupFlipFateMacroForCurrentUser({ notify: false });
            setupTwistMacrosForCurrentUser({ notify: false });
            setupResolveConflictMacroForCurrentUser({ notify: false });
            setupDiscardMacrosForCurrentUser({ notify: false });
            setupGmDeckToolsMacroForCurrentUser({ notify: false });
        }, 2000);
    } catch (error) {
        console.error(`${SYSTEM_ID} | Failed to assign macros`, error);
    }
});

Hooks.on("createActor", async (actor) => {
    if (!game.user.isGM) return;
    if (actor.type !== "character") return;

    try {
        await ensureActorCardStacks(actor, { notify: true });
        await rerenderTtbCardDock();
    } catch (error) {
        console.error(`${SYSTEM_ID} | Failed to create actor card stacks`, error);
    }
});

Hooks.on("updateActor", async (actor, changes) => {
    if (!game.user.isGM) return;
    if (actor.type !== "character") return;
    if (!actorCardStacksNeedSync(changes)) return;

    try {
        await ensureActorCardStacks(actor);
        await rerenderTtbCardDock();
    } catch (error) {
        console.error(`${SYSTEM_ID} | Failed to sync actor card stacks`, error);
    }
});