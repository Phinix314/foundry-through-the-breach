import{
    getActiveConflictSelectionPresentation,
    selectActiveConflictCard
} from "../cards/active-conflict.mjs";

const {
    ApplicationV2,
    HandlebarsApplicationMixin
} = foundry.applications.api;

let selectionWindow = null;

export class TTBActiveConflictSelection
    extends HandlebarsApplicationMixin(ApplicationV2) {

    static DEFAULT_OPTIONS = {
        id: "ttb-active-conflict-selection",
        tag: "section",
        classes: [
            "through-the-breach",
            "ttb-active-conflict-selection-app"
        ],
        position: {
            width: 820,
            height: 620
        },
        window: {
            title: "Choose Fate Card",
            resizable: true
        }
    };

    static PARTS = {
        content: {
            template:
                "systems/through-the-breach/templates/ui/active-conflict-selection.hbs"
        }
    };

    constructor(conflictId, defaultSelection, options = {}) {
        super(options);

        this.conflictId = conflictId;
        this.selectedSelection = defaultSelection;
    }

    async _prepareContext() {
        const presentation =
            await getActiveConflictSelectionPresentation();

        if (presentation.conflictId !== this.conflictId) {
            throw new Error(
                "The active conflict changed while its selection window was open."
            );
        }

        const selected = this.selectedSelection
            ?? presentation.defaultSelection;

        const prepareCards = (cards) =>
            cards.map((card) => ({
                ...card,
                selected:
                    card.source === selected?.source &&
                    card.id === selected?.cardId
            }));

        return {
            selection: {
                ...presentation,
                fateCards: prepareCards(
                    presentation.fateCards
                ),
                handCards: prepareCards(
                    presentation.handCards
                )
            },

            hasHandCards:
                presentation.handCards.length > 0
        };
    }

    _onRender(context, options) {
        super._onRender?.(context, options);

        const root = this.element?.matches?.(
            "#ttb-active-conflict-selection"
        )
            ? this.element
            : this.element?.querySelector(
                "#ttb-active-conflict-selection"
            );

        if (!root) return;

        /*
         * Card buttons:
         * Clicking one changes the locally highlighted selection.
         */
        root
            .querySelectorAll("[data-selection-source]")
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    async (event) => {
                        const target = event.currentTarget;

                        if (target.disabled) return;

                        this.selectedSelection = {
                            source:
                            target.dataset.selectionSource,
                            cardId:
                            target.dataset.cardId
                        };

                        await this.render();
                    }
                );
            });

        /*
         * Confirm button:
         * Validate and store the currently highlighted selection.
         */
        const confirmButton = root.querySelector(
            '[data-action="confirm-selection"]'
        );

        confirmButton?.addEventListener(
            "click",
            async () => {
                if (!this.selectedSelection) {
                    ui.notifications.warn(
                        "Select a card before confirming."
                    );
                    return;
                }

                confirmButton.disabled = true;

                try {
                    await selectActiveConflictCard({
                        conflictId: this.conflictId,
                        source:
                        this.selectedSelection.source,
                        cardId:
                        this.selectedSelection.cardId
                    });

                    ui.notifications.info(
                        "Fate card selection confirmed."
                    );

                    await this.close();
                } catch (error) {
                    console.error(
                        "through-the-breach | Conflict selection failed",
                        error
                    );

                    ui.notifications.error(error.message);
                    confirmButton.disabled = false;
                }
            }
        );
    }

    async close(options = {}) {
        if (selectionWindow === this) {
            selectionWindow = null;
        }

        return super.close(options);
    }
}

export async function openActiveConflictSelectionWindow() {
    const presentation =
        await getActiveConflictSelectionPresentation();

    if (
        selectionWindow &&
        selectionWindow.conflictId !== presentation.conflictId
    ) {
        await selectionWindow.close();
    }

    if (!selectionWindow) {
        selectionWindow =
            new TTBActiveConflictSelection(
                presentation.conflictId,
                presentation.defaultSelection
            );
    }

    await selectionWindow.render(true);

    return selectionWindow;
}