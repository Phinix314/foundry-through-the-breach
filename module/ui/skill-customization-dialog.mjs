const {
    DialogV2
} = foundry.applications.api;

const ASPECTS = Object.freeze({
    might: "Might",
    grace: "Grace",
    speed: "Speed",
    resilience: "Resilience",
    intellect: "Intellect",
    charm: "Charm",
    cunning: "Cunning",
    tenacity: "Tenacity"
});

const SUITS = Object.freeze({
    rams: "Rams",
    crows: "Crows",
    tomes: "Tomes",
    masks: "Masks"
});

function escapeHtml(value) {
    return foundry.utils.escapeHTML(
        String(value ?? "")
    );
}

function parseInteger(value, fallback = 0) {
    const parsed =
        Number.parseInt(value, 10);

    return Number.isFinite(parsed)
        ? parsed
        : fallback;
}

function formatFlipModifier(value) {
    if (value === 0) return "Straight";

    const symbol = value > 0
        ? "+"
        : "−";

    return symbol.repeat(Math.abs(value));
}

function renderAspectOptions(selectedAspect) {
    return Object.entries(ASPECTS)
        .map(([id, label]) => `
            <option
                value="${id}"
                ${id === selectedAspect
            ? "selected"
            : ""}
            >
                ${label}
            </option>
        `)
        .join("");
}

function renderSuitOptions(selectedSuits) {
    return Object.entries(SUITS)
        .map(([id, label]) => `
            <label>
                <input
                    type="checkbox"
                    name="inherentSuits"
                    value="${id}"
                    ${selectedSuits.includes(id)
            ? "checked"
            : ""}
                >
                <span>${label}</span>
            </label>
        `)
        .join("");
}

function normalizeTrigger(trigger = {}) {
    const source = trigger ?? {};

    return {
        id:
            source.id ||
            foundry.utils.randomID(),

        name:
            String(source.name ?? ""),

        description:
            String(source.description ?? ""),

        requiredSuits:
            Array.from(
                source.requiredSuits ?? []
            ).filter(
                suit =>
                    Object.hasOwn(SUITS, suit)
            )
    };
}

function renderTriggerSuitPickerOptions() {
    return Object.entries(SUITS)
        .map(([id, label]) => `
            <option value="${id}">
                ${label}
            </option>
        `)
        .join("");
}

function renderTriggerSuitChips(requiredSuits) {
    if (requiredSuits.length === 0) {
        return `
            <span class="ttb-skill-trigger-no-suits">
                At least one suit is required.
            </span>
        `;
    }

    return requiredSuits
        .map((suit, index) => `
            <span class="ttb-skill-test-suit-chip">
                ${escapeHtml(SUITS[suit])}

                <button
                    type="button"
                    data-remove-trigger-suit="${index}"
                    aria-label="Remove ${escapeHtml(
            SUITS[suit]
        )}"
                >
                    ×
                </button>
            </span>
        `)
        .join("");
}

async function openSkillTriggerDialog({
                                          trigger = null
                                      } = {}) {
    const workingTrigger =
        normalizeTrigger(trigger);

    const content = `
        <div class="ttb-skill-trigger-editor">
            <label class="ttb-skill-test-field">
                <span>Name</span>

                <input
                    type="text"
                    name="triggerName"
                    value="${escapeHtml(
        workingTrigger.name
    )}"
                    required
                    autofocus
                >
            </label>

            <div class="ttb-skill-test-field">
                <span>Required suits</span>

                <div
                    class="ttb-skill-trigger-suit-list"
                    data-trigger-suit-list
                >
                    ${renderTriggerSuitChips(
        workingTrigger.requiredSuits
    )}
                </div>

                <div class="ttb-skill-trigger-suit-picker">
                    <select data-trigger-suit-picker>
                        ${renderTriggerSuitPickerOptions()}
                    </select>

                    <button
                        type="button"
                        data-action="add-trigger-suit"
                    >
                        Add suit
                    </button>
                </div>
            </div>

            <label class="ttb-skill-test-field">
                <span>Description</span>

                <textarea
                    name="triggerDescription"
                    rows="5"
                >${escapeHtml(
        workingTrigger.description
    )}</textarea>
            </label>
        </div>
    `;

    return DialogV2.input({
        window: {
            title: trigger
                ? "Edit Trigger"
                : "Add Trigger"
        },

        position: {
            width: 460
        },

        content,
        modal: true,
        rejectClose: false,

        render: (_event, dialog) => {
            const root = dialog.element;

            if (!root) return;

            const nameInput =
                root.querySelector(
                    'input[name="triggerName"]'
                );

            const suitList =
                root.querySelector(
                    "[data-trigger-suit-list]"
                );

            const suitPicker =
                root.querySelector(
                    "[data-trigger-suit-picker]"
                );

            const saveButton =
                root.querySelector(
                    'button[data-action="ok"]'
                );

            const updateSaveState = () => {
                if (!saveButton) return;

                saveButton.disabled =
                    !nameInput?.value.trim() ||
                    workingTrigger
                        .requiredSuits
                        .length === 0;
            };

            const updateSuitList = () => {
                if (suitList) {
                    suitList.innerHTML =
                        renderTriggerSuitChips(
                            workingTrigger
                                .requiredSuits
                        );
                }

                updateSaveState();
            };

            nameInput?.addEventListener(
                "input",
                updateSaveState
            );

            root
                .querySelector(
                    '[data-action="add-trigger-suit"]'
                )
                ?.addEventListener(
                    "click",
                    () => {
                        const suit =
                            suitPicker?.value;

                        if (!Object.hasOwn(
                            SUITS,
                            suit
                        )) {
                            return;
                        }

                        workingTrigger
                            .requiredSuits
                            .push(suit);

                        updateSuitList();
                    }
                );

            root.addEventListener(
                "click",
                (event) => {
                    const button =
                        event.target.closest(
                            "[data-remove-trigger-suit]"
                        );

                    if (!button) return;

                    const index =
                        parseInteger(
                            button.dataset
                                .removeTriggerSuit,
                            -1
                        );

                    if (
                        index < 0 ||
                        index >=
                        workingTrigger
                            .requiredSuits
                            .length
                    ) {
                        return;
                    }

                    workingTrigger
                        .requiredSuits
                        .splice(index, 1);

                    updateSuitList();
                }
            );

            updateSuitList();
        },

        ok: {
            label: "Save Trigger",
            icon: "fas fa-check",

            callback: (_event, button) => {
                const form = button.form;

                return {
                    id: workingTrigger.id,

                    name:
                        form.elements
                            .triggerName
                            .value
                            .trim(),

                    description:
                        form.elements
                            .triggerDescription
                            .value
                            .trim(),

                    requiredSuits:
                        Array.from(
                            workingTrigger
                                .requiredSuits
                        )
                };
            }
        }
    });
}

function renderTriggerSuitIcons(requiredSuits) {
    return requiredSuits
        .map(suit => `
            <span
                class="
                    ttb-conflict-suit
                    ttb-conflict-suit--${suit}
                "
                title="${escapeHtml(SUITS[suit])}"
                aria-label="${escapeHtml(SUITS[suit])}"
            ></span>
        `)
        .join("");
}

function renderSkillTriggerList(triggers) {
    if (triggers.length === 0) {
        return `
            <p class="ttb-skill-trigger-empty">
                No triggers have been added.
            </p>
        `;
    }

    return triggers
        .map((trigger, index) => {
            const suits =
                trigger.requiredSuits
                    .map(suit => SUITS[suit])
                    .join(", ");

            return `
                <article class="ttb-skill-trigger-entry">
                    <div class="ttb-skill-trigger-content">
                        <div class="ttb-skill-trigger-suits">
                            ${renderTriggerSuitIcons(
                trigger.requiredSuits
            )}
                        </div>

                        <div class="ttb-skill-trigger-body">
                            <strong>
                                ${escapeHtml(trigger.name)}
                            </strong>

                            <p>
                                ${escapeHtml(
                trigger.description
            )}
                            </p>
                        </div>
                    </div>

                    <div class="ttb-skill-trigger-actions">
                        <button
                            type="button"
                            data-edit-trigger="${index}"
                        >
                            <i class="fas fa-pen"></i>
                            Edit
                        </button>

                        <button
                            type="button"
                            data-remove-trigger="${index}"
                        >
                            <i class="fas fa-trash"></i>
                            Remove
                        </button>
                    </div>
                </article>
            `;
        })
        .join("");
}

export async function openSkillCustomizationDialog({
                                                       skill
                                                   } = {}) {
    if (!skill) {
        throw new Error(
            "A skill is required for customization."
        );
    }

    const inherentSuits =
        Array.from(skill.inherentSuits ?? []);

    const triggers =
        Array.from(skill.triggers ?? [])
            .map(trigger =>
                normalizeTrigger(trigger)
            )
            .filter(trigger =>
                trigger.name.trim() ||
                trigger.description.trim() ||
                trigger.requiredSuits.length > 0
            );

    const content = `
        <div class="ttb-skill-customization-dialog">
            <div class="ttb-skill-customization-grid">
                <label class="ttb-skill-test-field">
                    <span>Aspect</span>

                    <select name="aspect">
                        ${renderAspectOptions(
        skill.aspect
    )}
                    </select>
                </label>

                <label class="ttb-skill-test-field">
                    <span>Manual modifier</span>

                    <input
                        type="number"
                        name="manualActingValueModifier"
                        value="${Number(
        skill.manualActingValueModifier
        ?? 0
    )}"
                        step="1"
                    >
                </label>

                <div class="ttb-skill-test-field">
                    <span>Inherent flip modifier</span>

                    <div class="ttb-skill-test-flip-control">
                        <button
                            type="button"
                            data-flip-delta="-1"
                            aria-label="Add one negative flip"
                        >
                            −
                        </button>

                        <button
                            type="button"
                            data-action="reset-flip"
                            title="Reset to a straight flip"
                        >
                            <span data-flip-display>
                                Straight
                            </span>
                        </button>

                        <button
                            type="button"
                            data-flip-delta="1"
                            aria-label="Add one positive flip"
                        >
                            +
                        </button>

                        <input
                            type="hidden"
                            name="inherentFlipModifier"
                            value="${Number(
        skill.inherentFlipModifier
        ?? 0
    )}"
                        >
                    </div>
                </div>

                <div class="ttb-skill-test-field">
                    <span>Inherent suits</span>

                    <div class="ttb-skill-customization-suits">
                        ${renderSuitOptions(
        inherentSuits
    )}
                    </div>
                </div>
            </div>
                        <section class="ttb-skill-customization-triggers">
                <div class="ttb-skill-trigger-section-heading">
                    <strong>Triggers</strong>

                    <button
                        type="button"
                        data-action="add-trigger"
                    >
                        <i class="fas fa-plus"></i>
                        Add Trigger
                    </button>
                </div>

                <div data-trigger-list>
                    ${renderSkillTriggerList(triggers)}
                </div>
            </section>
        </div>
    `;

    return DialogV2.input({
        window: {
            title: `Customize ${escapeHtml(
                skill.name
            )}`
        },

        position: {
            width: 520
        },

        content,
        modal: true,
        rejectClose: false,

        render: (_event, dialog) => {
            const root = dialog.element;

            if (!root) return;

            const flipInput =
                root.querySelector(
                    'input[name="inherentFlipModifier"]'
                );

            const flipDisplay =
                root.querySelector(
                    "[data-flip-display]"
                );

            const triggerList =
                root.querySelector(
                    "[data-trigger-list]"
                );

            const updateTriggerList = () => {
                if (!triggerList) return;

                triggerList.innerHTML =
                    renderSkillTriggerList(
                        triggers
                    );
            };

            root
                .querySelector(
                    '[data-action="add-trigger"]'
                )
                ?.addEventListener(
                    "click",
                    async () => {
                        const trigger =
                            await openSkillTriggerDialog();

                        if (!trigger) return;

                        triggers.push(trigger);
                        updateTriggerList();
                    }
                );

            triggerList?.addEventListener(
                "click",
                async (event) => {
                    const editButton =
                        event.target.closest(
                            "[data-edit-trigger]"
                        );

                    if (editButton) {
                        const index =
                            parseInteger(
                                editButton.dataset
                                    .editTrigger,
                                -1
                            );

                        if (!triggers[index]) return;

                        const editedTrigger =
                            await openSkillTriggerDialog({
                                trigger:
                                    triggers[index]
                            });

                        if (!editedTrigger) return;

                        triggers[index] =
                            editedTrigger;

                        updateTriggerList();
                        return;
                    }

                    const removeButton =
                        event.target.closest(
                            "[data-remove-trigger]"
                        );

                    if (!removeButton) return;

                    const index =
                        parseInteger(
                            removeButton.dataset
                                .removeTrigger,
                            -1
                        );

                    if (!triggers[index]) return;

                    triggers.splice(index, 1);
                    updateTriggerList();
                }
            );

            const updateFlipDisplay = () => {
                const value =
                    parseInteger(
                        flipInput?.value,
                        0
                    );

                if (flipDisplay) {
                    flipDisplay.textContent =
                        formatFlipModifier(value);
                }
            };

            root
                .querySelectorAll(
                    "[data-flip-delta]"
                )
                .forEach((button) => {
                    button.addEventListener(
                        "click",
                        () => {
                            if (!flipInput) return;

                            const current =
                                parseInteger(
                                    flipInput.value,
                                    0
                                );

                            const delta =
                                parseInteger(
                                    button.dataset
                                        .flipDelta,
                                    0
                                );

                            flipInput.value =
                                String(current + delta);

                            updateFlipDisplay();
                        }
                    );
                });

            root
                .querySelector(
                    '[data-action="reset-flip"]'
                )
                ?.addEventListener(
                    "click",
                    () => {
                        if (!flipInput) return;

                        flipInput.value = "0";
                        updateFlipDisplay();
                    }
                );

            updateFlipDisplay();
        },

        ok: {
            label: "Save",
            icon: "fas fa-check",

            callback: (_event, button) => {
                const form = button.form;

                const selectedSuits = [
                    ...form.querySelectorAll(
                        'input[name="inherentSuits"]:checked'
                    )
                ].map((input) => input.value);

                return {
                    aspect:
                    form.elements.aspect.value,

                    manualActingValueModifier:
                        parseInteger(
                            form.elements
                                .manualActingValueModifier
                                .value,
                            0
                        ),

                    inherentFlipModifier:
                        parseInteger(
                            form.elements
                                .inherentFlipModifier
                                .value,
                            0
                        ),

                    inherentSuits:
                    selectedSuits,

                    triggers:
                        triggers.map(trigger =>
                            normalizeTrigger(trigger)
                        )
                };
            }
        }
    });
}