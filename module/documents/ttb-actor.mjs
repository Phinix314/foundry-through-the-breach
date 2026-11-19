export class TTBActor
    extends foundry.documents.Actor {

    async modifyTokenAttribute(
        attribute,
        value,
        isDelta = false,
        isBar = true
    ) {
        if (
            this.type !== "character" ||
            attribute !== "wounds" ||
            !isBar
        ) {
            return super.modifyTokenAttribute(
                attribute,
                value,
                isDelta,
                isBar
            );
        }

        const currentValue =
            Number(
                this.system.wounds?.value ?? 0
            );

        const maximumValue =
            Number(
                this.system.wounds?.max
            );

        let nextValue =
            isDelta
                ? currentValue + Number(value)
                : Number(value);

        if (!Number.isFinite(nextValue)) {
            return this;
        }

        /*
         * Healing cannot exceed Maximum Wounds,
         * but damage has no lower limit.
         */
        if (Number.isFinite(maximumValue)) {
            nextValue =
                Math.min(
                    nextValue,
                    maximumValue
                );
        }

        return this.update({
            "system.wounds.value":
            nextValue
        });
    }
}
