import { getActorDockPresentation, getGlobalDockPresentation } from "../cards/summary-state.mjs";

const SYSTEM_ID = "through-the-breach";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

let dockPopoutInstance = null;
let dockPopoutClosing = false;

function visibleActorPresentations() {
    const actors = game.actors
        .filter((actor) => actor.type === "character")
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((actor) => getActorDockPresentation(actor, game.user));

    if (game.user.isGM) return actors;
    return actors.filter((actor) => actor.ownsPrivate);
}

function buildDockTabs() {
    const actorDocks = visibleActorPresentations();

    return [
        { key: "fate", label: "Fate", type: "fate" },
        ...actorDocks.map((actor) => ({
            key: `actor:${actor.actorUuid}`,
            label: actor.actorName,
            type: "actor",
            actor
        }))
    ];
}

function buildActivePresentation(cards, actorUuid = null) {
    const chronologicalCards = cards ?? [];

    const visibleCards = chronologicalCards.slice(-4).reverse();
    const overflowCards = chronologicalCards.slice(0, -4);
    const overflowTopCard = overflowCards.length ? overflowCards[overflowCards.length - 1] : null;
    const hiddenUnderTopCount = Math.max(overflowCards.length - 1, 0);

    return {
        totalCount: chronologicalCards.length,
        visibleCards,
        overflowCards,
        overflowCount: overflowCards.length,
        overflowTopCard,
        hiddenUnderTopCount,
        showOverflowBadge: hiddenUnderTopCount > 0,
        actorUuid,
        allCards: [...chronologicalCards].reverse()
    };
}

function buildSelectedDock(selectedKey) {
    const global = getGlobalDockPresentation();
    const actorDocks = visibleActorPresentations();

    if (selectedKey === "fate") {
        return {
            key: "fate",
            type: "fate",
            label: "Fate Dock",
            controls: [
                { action: "flip-fate-one", label: "Flip 1" },
                { action: "flip-fate-two", label: "Flip 2" },
                { action: "resolve-conflict", label: "Resolve" },
                { action: "reshuffle-fate", label: "Reshuffle" }
            ],
            source: {
                title: "Fate Deck",
                count: global.fateDeck.count,
                hasCards: global.fateDeck.count > 0
            },
            active: buildActivePresentation(global.conflict.cards ?? [], null),
            discard: {
                title: "Fate Discard",
                count: global.fateDiscard.count,
                topCard: global.fateDiscard.cards?.[0] ?? null,
                action: "peek-fate-discard",
                actionLabel: "Peek"
            }
        };
    }

    const actor = actorDocks.find((a) => `actor:${a.actorUuid}` === selectedKey) ?? actorDocks[0];

    if (!actor) {
        return {
            key: "fate",
            type: "fate",
            label: "Fate Dock",
            controls: [
                { action: "flip-fate-one", label: "Flip 1" },
                { action: "flip-fate-two", label: "Flip 2" },
                { action: "resolve-conflict", label: "Resolve" },
                { action: "reshuffle-fate", label: "Reshuffle" }
            ],
            source: {
                title: "Fate Deck",
                count: global.fateDeck.count,
                hasCards: global.fateDeck.count > 0
            },
            active: buildActivePresentation(global.conflict.cards ?? [], null),
            discard: {
                title: "Fate Discard",
                count: global.fateDiscard.count,
                topCard: global.fateDiscard.cards?.[0] ?? null,
                action: "peek-fate-discard",
                actionLabel: "Peek"
            }
        };
    }

    return {
        key: `actor:${actor.actorUuid}`,
        type: "actor",
        label: `${actor.actorName} Dock`,
        actorUuid: actor.actorUuid,
        controls: [
            { action: "draw-twist-one", label: "Draw 1", actorUuid: actor.actorUuid },
            { action: "draw-twist-two", label: "Draw 2", actorUuid: actor.actorUuid },
            { action: "reshuffle-actor", label: "Reshuffle", actorUuid: actor.actorUuid },
            { action: "close-popout", label: "Close" }
        ],
        source: {
            title: "Twist Deck",
            count: actor.twistDeck.count,
            hasCards: actor.twistDeck.count > 0,
            actorUuid: actor.actorUuid
        },
        active: buildActivePresentation(actor.hand.cards ?? [], actor.actorUuid),
        discard: {
            title: "Twist Discard",
            count: actor.twistDiscard.count,
            topCard: actor.twistDiscard.cards?.[0] ?? null,
            action: "peek-twist-discard",
            actionLabel: "Peek",
            actorUuid: actor.actorUuid
        }
    };
}

function renderActiveCardListHtml(cards, actorUuid = null) {
    if (!cards.length) {
        return `<p>No cards in the active zone.</p>`;
    }

    return `
        <div class="ttb-active-popup-list">
            ${cards.map((card) => `
                <div class="ttb-active-popup-card">
                    <div class="ttb-active-popup-card__info">
                        <strong>${foundry.utils.escapeHTML(card.name)}</strong><br/>
                        <span>${foundry.utils.escapeHTML(String(card.value))} ${foundry.utils.escapeHTML(card.suitLabel)}</span>
                    </div>
                    ${actorUuid ? `
                        <button
                            type="button"
                            class="ttb-active-popup-cheat"
                            data-card-id="${card.id}"
                            data-actor-uuid="${actorUuid}"
                        >
                            Cheat
                        </button>
                    ` : ""}
                </div>
            `).join("")}
        </div>
    `;
}

async function openActiveOverflowDialog(dock) {
    const actorUuid = dock.active.actorUuid ?? null;
    const content = renderActiveCardListHtml(dock.active.allCards, actorUuid);

    const dialog = new Dialog({
        title: `${dock.label} - Active Cards`,
        content,
        buttons: {
            close: {
                label: "Close"
            }
        },
        default: "close"
    });

    dialog.render(true);

    if (actorUuid) {
        Hooks.once("renderDialog", (_app, html) => {
            html.find(".ttb-active-popup-cheat").on("click", async (event) => {
                const cardId = event.currentTarget.dataset.cardId;
                const targetActorUuid = event.currentTarget.dataset.actorUuid;

                try {
                    await game.throughTheBreach.cheatFateCardFromActorHand(targetActorUuid, cardId);
                    dialog.close();
                    await rerenderTtbCardDockPopout();
                } catch (error) {
                    console.error(`${SYSTEM_ID} | Active popup cheat failed`, error);
                    ui.notifications.error("TTB active popup cheat failed. Check console.");
                }
            });
        });
    }
}

async function handleAction(event) {
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;
    const action = button.dataset.action;
    const actorUuid = button.dataset.actorUuid ?? null;

    try {
        switch (action) {
            case "select-dock": {
                dockPopoutInstance?.setSelectedDock(button.dataset.dockKey);
                await rerenderTtbCardDockPopout();
                return;
            }

            case "close-popout":
                await dockPopoutInstance?.close();
                return;

            case "open-active-overflow": {
                const dock = buildSelectedDock(dockPopoutInstance?.selectedDockKey ?? "fate");
                await openActiveOverflowDialog(dock);
                return;
            }

            case "flip-fate-one":
                await game.throughTheBreach.flipTopCardToConflict({});
                break;

            case "flip-fate-two":
                await game.throughTheBreach.flipTopCardToConflict({});
                await game.throughTheBreach.flipTopCardToConflict({});
                break;

            case "draw-twist-one":
                await game.throughTheBreach.drawTwistCardsForActor(actorUuid, 1);
                break;

            case "draw-twist-two":
                await game.throughTheBreach.drawTwistCardsForActor(actorUuid, 2);
                break;

            case "resolve-conflict":
                await game.throughTheBreach.resolveCurrentConflict({ chat: true });
                break;

            case "reshuffle-fate": {
                const didRecycle = await game.throughTheBreach.recycleFateDeckIfEmpty({ notify: true });
                if (!didRecycle) {
                    ui.notifications.warn("Fate Deck can only be reshuffled from discard when the deck is empty.");
                }
                break;
            }

            case "reshuffle-actor": {
                const didRecycle = await game.throughTheBreach.recycleActorTwistDeckIfEmpty(actorUuid, { notify: true });
                if (!didRecycle) {
                    ui.notifications.warn("Twist Deck can only be reshuffled from discard when the deck is empty.");
                }
                break;
            }

            case "peek-fate-discard":
                await game.throughTheBreach.showPeekFateDiscard(3);
                break;

            case "peek-twist-discard":
                await game.throughTheBreach.showPeekActorTwistDiscard(actorUuid, 3);
                break;

            case "cheat-card": {
                const cardId = button.dataset.cardId;
                await game.throughTheBreach.cheatFateCardFromActorHand(actorUuid, cardId);
                break;
            }

            default:
                break;
        }
    } catch (error) {
        console.error(`${SYSTEM_ID} | Popout action failed`, error);
        ui.notifications.error("TTB popout action failed. Check console.");
    }

    ui.players?.render?.(true);
    await rerenderTtbCardDockPopout();
}

export async function openTtbCardDockPopout() {
    if (!dockPopoutInstance) {
        dockPopoutInstance = new TTBCardDockPopout();
    }

    await dockPopoutInstance.render(true);
    return dockPopoutInstance;
}

export async function rerenderTtbCardDockPopout() {
    if (dockPopoutClosing) return null;
    if (!dockPopoutInstance) return null;
    if (!dockPopoutInstance.rendered) return null;

    await dockPopoutInstance.render();
    return dockPopoutInstance;
}

export function isTtbCardDockPopoutOpen() {
    return !!dockPopoutInstance?.rendered;
}

export class TTBCardDockPopout extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "ttb-card-dock-popout",
        tag: "section",
        classes: ["through-the-breach", "ttb-card-dock-popout-app"],
        position: {
            width: 980,
            height: 760
        },
        window: {
            title: "Through the Breach Card Dock",
            resizable: true
        }
    };

    static PARTS = {
        content: {
            template: `systems/${SYSTEM_ID}/templates/ui/card-dock-popout.hbs`
        }
    };

    constructor(options = {}) {
        super(options);
        this.selectedDockKey = "fate";
    }

    setSelectedDock(key) {
        this.selectedDockKey = key || "fate";
    }

    async _preClose(options) {
        dockPopoutClosing = true;
        dockPopoutInstance = null;
        if (super._preClose) return super._preClose(options);
    }

    _onClose(options) {
        if (super._onClose) super._onClose(options);
        dockPopoutClosing = false;
    }

    async _prepareContext(_options) {
        const tabs = buildDockTabs();

        const validKeys = new Set(tabs.map((tab) => tab.key));
        if (!validKeys.has(this.selectedDockKey)) {
            this.selectedDockKey = "fate";
        }

        return {
            tabs: tabs.map((tab) => ({
                ...tab,
                active: tab.key === this.selectedDockKey
            })),
            dock: buildSelectedDock(this.selectedDockKey)
        };
    }

    _onRender(_context, _options) {
        super._onRender?.(_context, _options);

        const root = this.element;
        if (!root) return;

        root.querySelectorAll("[data-action]").forEach((el) => {
            el.removeEventListener("click", handleAction);
            el.addEventListener("click", handleAction);
        });
    }
}