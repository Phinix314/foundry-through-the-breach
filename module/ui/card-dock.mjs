import {
    getActorDockPresentation,
    getGlobalDockPresentation
} from "../cards/summary-state.mjs";

const SYSTEM_ID = "through-the-breach";
let hooksRegistered = false;

async function getDockData() {
    const actors = game.actors
        .filter((actor) => actor.type === "character")
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((actor) => getActorDockPresentation(actor, game.user));

    return {
        global: getGlobalDockPresentation(),
        actors
    };
}

async function onAction(event) {
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;
    const action = button.dataset.action;
    const actorUuid = button.dataset.actorUuid ?? null;

    try {
        switch (action) {
            case "open-popout":
                await game.throughTheBreach.openTtbCardDockPopout();
                break;

            case "flip-fate":
                await game.throughTheBreach.flipTopCardToConflict({});
                break;

            case "resolve-conflict":
                await game.throughTheBreach.resolveCurrentConflict({ chat: true });
                break;

            case "peek-fate-discard":
                await game.throughTheBreach.showPeekFateDiscard(3);
                break;

            case "draw-twist":
                await game.throughTheBreach.drawTwistCardsForActor(actorUuid, 1);
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
        console.error(`${SYSTEM_ID} | Dock action failed`, error);
        ui.notifications.error("TTB dock action failed. Check console.");
    }

    ui.players?.render?.(true);
    await game.throughTheBreach?.rerenderTtbCardDockPopout?.();
}

function activateDockListeners(root) {
    root.querySelectorAll("[data-action]").forEach((el) => {
        el.removeEventListener("click", onAction);
        el.addEventListener("click", onAction);
    });
}

function resolvePlayersElement(html) {
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return null;

    if (root.id === "players") return root;

    return root.querySelector("#players") ?? root;
}

export async function renderTtbCardDock(app, html) {
    try {
        const playersRoot = resolvePlayersElement(html);
        if (!playersRoot) {
            console.warn(`${SYSTEM_ID} | Could not resolve Players root element.`);
            return;
        }

        const data = await getDockData();
        console.log(`${SYSTEM_ID} | Rendering card dock`, data);

        const dockHtml = await foundry.applications.handlebars.renderTemplate(
            `systems/${SYSTEM_ID}/templates/ui/card-dock.hbs`,
            data
        );

        playersRoot.querySelector("#ttb-card-dock")?.remove();
        playersRoot.insertAdjacentHTML("afterbegin", dockHtml);

        const dock = playersRoot.querySelector("#ttb-card-dock");
        if (dock) activateDockListeners(dock);
    } catch (error) {
        console.error(`${SYSTEM_ID} | Failed to render card dock`, error);
    }
}

export function rerenderTtbCardDock() {
    ui.players?.render?.(true);
}

export function initializeTtbCardDock() {
    if (hooksRegistered) return;
    hooksRegistered = true;

    Hooks.on("renderPlayers", renderTtbCardDock);

    Hooks.on("ready", () => {
        console.log(`${SYSTEM_ID} | Initializing card dock rerender`);

        ui.players?.render?.(true);

        window.setTimeout(() => {
            ui.players?.render?.(true);
        }, 500);
    });
}