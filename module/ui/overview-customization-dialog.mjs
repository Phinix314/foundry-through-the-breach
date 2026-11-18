const {
    DialogV2
} = foundry.applications.api;

function parseInteger(value) {
    const parsed =
        Number.parseInt(value, 10);

    return Number.isFinite(parsed)
        ? parsed
        : 0;
}

export async function openOverviewModifierDialog({
                                                     label,
                                                     value
                                                 } = {}) {
    if (!label) {
        throw new Error(
            "A calculated value label is required."
        );
    }

    const safeLabel =
        foundry.utils.escapeHTML(label);

    const content = `
        <div class="ttb-overview-modifier-dialog">
            <label class="ttb-overview-customization-field">
                <span>Misc. modifier</span>

                <input
                    type="number"
                    name="miscModifier"
                    value="${Number(value ?? 0)}"
                    step="1"
                    autofocus
                >
            </label>

            <p>
                Added after the normal ${safeLabel}
                calculation.
            </p>
        </div>
    `;

    return DialogV2.input({
        window: {
            title: `Customize ${safeLabel}`
        },

        position: {
            width: 360
        },

        content,
        modal: true,
        rejectClose: false,

        ok: {
            label: "Save",
            icon: "fas fa-check",

            callback: (_event, button) =>
                parseInteger(
                    button.form.elements
                        .miscModifier
                        .value
                )
        }
    });
}

export async function openAddCharacteristicDialog() {
    const content = `
        <div class="ttb-add-characteristic-dialog">
            <label>
                <span>Characteristic</span>

                <input
                    type="text"
                    name="characteristic"
                    autocomplete="off"
                    autofocus
                >
            </label>
        </div>
    `;

    return DialogV2.input({
        window: {
            title: "Add Characteristic"
        },

        position: {
            width: 360
        },

        content,
        modal: true,
        rejectClose: false,

        ok: {
            label: "Add",
            icon: "fas fa-plus",

            callback: (_event, button) =>
                String(
                    button.form.elements
                        .characteristic
                        .value ?? ""
                ).trim()
        }
    });
}