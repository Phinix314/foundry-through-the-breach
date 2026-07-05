import { getActorDockPresentation, getGlobalDockPresentation } from "../cards/summary-state.mjs";

const SYSTEM_ID = "through-the-breach";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const dockPopoutInstances = new Map();
const dockPopoutClosing = new Set();

function visibleActorPresentations() {
    const actors = game.actors
        .filter((actor) => actor.type === "character")
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((actor) => getActorDockPresentation(actor, game.user));

    if (game.user.isGM) return actors;
    return actors.filter((actor) => actor.ownsPrivate);
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

function buildDockDefinition(dockKey = "fate") {
    const global = getGlobalDockPresentation();
    const actorDocks = visibleActorPresentations();

    if (dockKey === "fate") {
        return {
            key: "fate",
            type: "fate",
            label: "Fate Dock",
            controls: [
                { action: "flip-fate-one", label: "Flip 1" },
                { action: "flip-fate-two", label: "Flip 2" },
                { action: "resolve-conflict", label: "Resolve" },
                { action: "reshuffle-fate", label: "Reshuffle" },
                { action: "close-popout", label: "Close", dockKey: "fate" }
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

    const actor = actorDocks.find((a) => `actor:${a.actorUuid}` === dockKey);
    if (!actor) {
        return {
            key: "fate",
            type: "fate",
            label: "Fate Dock",
            controls: [
                { action: "flip-fate-one", label: "Flip 1" },
                { action: "flip-fate-two", label: "Flip 2" },
                { action: "resolve-conflict", label: "Resolve" },
                { action: "reshuffle-fate", label: "Reshuffle" },
                { action: "close-popout", label: "Close", dockKey: "fate" }
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
            { action: "close-popout", label: "Close", dockKey: `actor:${actor.actorUuid}` }
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
    const dockKey = button.dataset.dockKey ?? "fate";

    try {
        switch (action) {
            case "close-popout":
                await closeTtbCardDockPopout(dockKey);
                return;

            case "open-active-overflow": {
                const dock = buildDockDefinition(dockKey);
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

export class TTBCardDockPopout extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        tag: "section",
        classes: ["through-the-breach", "ttb-card-dock-popout-app"],
        position: {
            width: 980,
            height: 760
        },
        window: {
            resizable: true
        }
    };

    static PARTS = {
        content: {
            template: `systems/${SYSTEM_ID}/templates/ui/card-dock-popout.hbs`
        }
    };

    constructor(dockKey = "fate", options = {}) {
        const safeDockKey = String(dockKey).replace(/[^a-zA-Z0-9_-]/g, "-");

        const mergedOptions = foundry.utils.mergeObject(
            {
                id: `ttb-card-dock-popout-${safeDockKey}`,
                window: {
                    title: buildDockDefinition(dockKey).label,
                    resizable: true
                }
            },
            options,
            { inplace: false }
        );

        super(mergedOptions);

        this.dockKey = dockKey;
    }

    get title() {
        return buildDockDefinition(this.dockKey).label;
    }

    async close(options = {}) {
        dockPopoutClosing.add(this.dockKey);
        dockPopoutInstances.delete(this.dockKey);

        try {
            return await super.close(options);
        } finally {
            dockPopoutClosing.delete(this.dockKey);
        }
    }

    async _prepareContext(_options) {
        return {
            dock: buildDockDefinition(this.dockKey)
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

export async function openTtbCardDockPopout(dockKey = "fate") {
    let instance = dockPopoutInstances.get(dockKey);

    if (!instance) {
        instance = new TTBCardDockPopout(dockKey);
        dockPopoutInstances.set(dockKey, instance);
    }

    await instance.render(true);
    return instance;
}

export async function closeTtbCardDockPopout(dockKey = "fate") {
    const instance = dockPopoutInstances.get(dockKey);
    if (!instance) return null;

    await instance.close();
    return null;
}

export async function rerenderTtbCardDockPopout(dockKey = null) {
    if (dockKey) {
        if (dockPopoutClosing.has(dockKey)) return null;

        const instance = dockPopoutInstances.get(dockKey);
        if (!instance || !instance.rendered) return null;

        await instance.render();
        return instance;
    }

    for (const [key, instance] of dockPopoutInstances.entries()) {
        if (dockPopoutClosing.has(key)) continue;
        if (!instance?.rendered) continue;
        await instance.render();
    }

    return null;
}

export function isTtbCardDockPopoutOpen(dockKey = "fate") {
    const instance = dockPopoutInstances.get(dockKey);
    return !!instance?.rendered;
}