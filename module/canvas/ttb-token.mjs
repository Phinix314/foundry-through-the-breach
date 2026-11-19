// Arbitrary negative Max Value since its the highest Critical Effect Table.
const NEGATIVE_WOUNDS_BAR_MAX = 21;

export class TTBToken
    extends foundry.canvas.placeables.Token {

    _drawBar(index, bar, data) {
        if (data.attribute !== "wounds") {
            return super._drawBar(
                index,
                bar,
                data
            );
        }

        const value =
            Number(data.value);

        const maximum =
            Math.max(
                Number(data.max),
                1
            );

        const negative =
            value < 0;

        const displayMaximum =
            negative
                ? NEGATIVE_WOUNDS_BAR_MAX
                : maximum;

        const percentage =
            Math.clamp(
                Math.abs(value),
                0,
                displayMaximum
            ) / displayMaximum;

        const {
            width,
            height
        } = this.document.getSize();

        const scale =
            canvas.dimensions.uiScale;

        const barWidth =
            width;

        const barHeight =
            8 *
            (
                this.document.height >= 2
                    ? 1.5
                    : 1
            ) *
            scale;

        const color =
            negative
                ? 0xb3261e
                : 0x2f9e44;

        bar.clear();

        bar.lineStyle(
            scale,
            0x000000,
            1
        );

        bar
            .beginFill(
                0x000000,
                0.5
            )
            .drawRoundedRect(
                0,
                0,
                barWidth,
                barHeight,
                3 * scale
            );

        bar
            .beginFill(
                color,
                1
            )
            .drawRoundedRect(
                0,
                0,
                percentage * barWidth,
                barHeight,
                2 * scale
            );

        const positionY =
            index === 0
                ? height - barHeight
                : 0;

        bar.position.set(
            0,
            positionY
        );
    }

    _refreshState() {
        super._refreshState();

        /*
         * OWNER normally means visible only to owners.
         * For TTB Wounds bars it instead means:
         *
         * - always visible to owners;
         * - visible to everyone else while hovering.
         */
        if (
            this.document.displayBars ===
            CONST.TOKEN_DISPLAY_MODES.OWNER &&
            !this.document.isSecret &&
            this.actor
        ) {
            this.bars.visible =
                this.isOwner ||
                this.hover ||
                this.layer.highlightObjects;
        }
    }
}