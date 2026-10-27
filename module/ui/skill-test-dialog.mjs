const {
    DialogV2
} = foundry.applications.api;

const SUITS = Object.freeze({
    rams: "Rams",
    crows: "Crows",
    tomes: "Tomes",
    masks: "Masks"
});

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatFlipModifier(value) {
    if (value === 0) return "Straight";

    const symbol = value > 0
        ? "+"
        : "−";

    return symbol.repeat(Math.abs(value));
}

function parseInteger(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);

    return Number.isFinite(parsed)
        ? parsed
        : fallback;
}

export async function openSkillTestDialog({
                                              skill,
                                              actingValue
                                          }) {
    const rank = Number(skill.rating ?? 0);

    const aspectId =
        String(skill.aspect ?? "").toLowerCase();

    const aspectLabel = aspectId
        ? (
            aspectId.charAt(0).toUpperCase() +
            aspectId.slice(1)
        )
        : "Aspect";

    const suppliedActingValue =
        Number(actingValue);

    const resolvedActingValue =
        Number.isFinite(suppliedActingValue)
            ? suppliedActingValue
            : rank;

    /*
     * Acting Value is already calculated by the
     * character sheet as Rank + Aspect.
     */
    const aspectValue =
        resolvedActingValue - rank;

    const selectedSuits = {
        tn: [],
        situational: []
    };

    const content = `
        <div class="ttb-skill-test-dialog">
            <div class="ttb-skill-test-summary">
    <div class="ttb-skill-test-title-row">
        <strong class="ttb-skill-test-name">
            ${escapeHtml(skill.name)}
        </strong>

        <span
            class="ttb-skill-test-av"
            title="Rank ${rank} + ${escapeHtml(aspectLabel)} ${aspectValue}"
        >
            AV ${resolvedActingValue}
        </span>
    </div>
</div>

<section class="ttb-skill-test-section">
    <h3>Target Number</h3>

    <div class="ttb-skill-test-target-fields">
        <label class="ttb-skill-test-field">
            <span>TN</span>

            <input
                type="number"
                name="tn"
                placeholder="—"
                step="1"
                aria-label="Target Number"
            >
        </label>

        <div class="ttb-skill-test-field">
            <span>Suit</span>

            <div class="ttb-skill-test-suit-builder">
                <div
                    class="ttb-skill-test-suit-list"
                    data-suit-list="tn"
                ></div>

                <select
                    data-suit-picker="tn"
                    aria-label="Add required suit"
                >
                    <option value="">
                        + Required suit
                    </option>
                    <option value="rams">Rams</option>
                    <option value="crows">Crows</option>
                    <option value="tomes">Tomes</option>
                    <option value="masks">Masks</option>
                </select>
            </div>
        </div>
    </div>
</section>

            <section class="ttb-skill-test-section">
                <h3>Situational modifiers</h3>

                <div class="ttb-skill-test-modifier-grid">
                    <label class="ttb-skill-test-field">
                        <span>AV modifier</span>

                        <input
                            type="number"
                            name="numericModifier"
                            value="0"
                            step="1"
                        >
                    </label>

                    <div class="ttb-skill-test-field">
                        <span>Flip</span>

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
                                name="flipModifier"
                                value="0"
                            >
                        </div>
                    </div>

                    <div class="ttb-skill-test-field">
                        <span>Suit</span>

                        <div class="ttb-skill-test-suit-builder">
                            <div
                                class="ttb-skill-test-suit-list"
                                data-suit-list="situational"
                            ></div>

                            <select
                                data-suit-picker="situational"
                                aria-label="Add situational suit"
                            >
                                <option value="">+ Suit</option>
                                <option value="rams">Rams</option>
                                <option value="crows">Crows</option>
                                <option value="tomes">Tomes</option>
                                <option value="masks">Masks</option>
                            </select>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    `;

    return DialogV2.input({
        window: {
            title: `${skill.name} Test`
        },

        position: {
            width: 560
        },

        content,

        modal: true,
        rejectClose: false,

        render: (_event, dialog) => {
            const root = dialog.element;

            if (!root) return;

            const flipInput = root.querySelector(
                'input[name="flipModifier"]'
            );

            const flipDisplay = root.querySelector(
                "[data-flip-display]"
            );

            const updateFlipDisplay = () => {
                const value = parseInteger(
                    flipInput?.value,
                    0
                );

                if (flipDisplay) {
                    flipDisplay.textContent =
                        formatFlipModifier(value);
                }
            };

            root
                .querySelectorAll("[data-flip-delta]")
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
                                    button.dataset.flipDelta,
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

            const renderSuitList = (kind) => {
                const list = root.querySelector(
                    `[data-suit-list="${kind}"]`
                );

                if (!list) return;

                list.replaceChildren();

                for (
                    const suit of selectedSuits[kind]
                    ) {
                    const chip =
                        document.createElement("button");

                    chip.type = "button";

                    chip.className =
                        "ttb-skill-test-suit-chip";

                    chip.dataset.suitKind = kind;
                    chip.dataset.suitValue = suit;

                    chip.textContent =
                        `${SUITS[suit]} ×`;

                    chip.title =
                        `Remove ${SUITS[suit]}`;

                    chip.addEventListener(
                        "click",
                        () => {
                            const index =
                                selectedSuits[
                                    kind
                                    ].indexOf(suit);

                            if (index < 0) return;

                            selectedSuits[
                                kind
                                ].splice(index, 1);

                            renderSuitList(kind);
                        }
                    );

                    list.append(chip);
                }
            };

            root
                .querySelectorAll("[data-suit-picker]")
                .forEach((picker) => {
                    picker.addEventListener(
                        "change",
                        () => {
                            const kind =
                                picker.dataset.suitPicker;

                            const suit =
                                picker.value;

                            if (
                                !selectedSuits[kind] ||
                                !SUITS[suit]
                            ) {
                                picker.value = "";
                                return;
                            }

                            selectedSuits[
                                kind
                                ].push(suit);

                            picker.value = "";

                            renderSuitList(kind);
                        }
                    );
                });

            updateFlipDisplay();
            renderSuitList("tn");
            renderSuitList("situational");
        },

        ok: {
            label: "Continue",
            icon: "fas fa-check",

            callback: (_event, button) => {
                const form = button.form;

                const tnRaw =
                    form.elements.tn.value.trim();

                const tn = tnRaw === ""
                    ? null
                    : parseInteger(tnRaw);

                return {
                    tn,

                    tnSuits: [
                        ...selectedSuits.tn
                    ],

                    numericModifier:
                        parseInteger(
                            form.elements
                                .numericModifier
                                .value,
                            0
                        ),

                    flipModifier:
                        parseInteger(
                            form.elements
                                .flipModifier
                                .value,
                            0
                        ),

                    situationalSuits: [
                        ...selectedSuits.situational
                    ]
                };
            }
        }
    });
}