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
                    selectedSuits
                };
            }
        }
    });
}