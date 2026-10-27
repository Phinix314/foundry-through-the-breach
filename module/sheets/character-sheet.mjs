import {
    TTB_SKILL_CATEGORIES
} from "../data/skill-catalog.mjs";

import {
    openSkillTestDialog
} from "../ui/skill-test-dialog.mjs";

const SYSTEM_ID = "through-the-breach";

const ActorSheetV1 =
    foundry.appv1.sheets.ActorSheet;

const ASPECT_LABELS = {
    might: "Might",
    grace: "Grace",
    speed: "Speed",
    resilience: "Resilience",
    intellect: "Intellect",
    charm: "Charm",
    cunning: "Cunning",
    tenacity: "Tenacity"
};

const SKILL_COLUMN_LAYOUT = [
    {
        id: "knowledge",
        categories: [
            "academic",
            "expertise",
            "crafting"
        ]
    },
    {
        id: "action",
        categories: [
            "social",
            "training",
            "closeCombat",
            "rangedCombat"
        ]
    }
];

function rowData(array, count, fallback = {}) {
    return Array.from({length: count}, (_, index) => ({
        index,
        data: array?.[index] ?? fallback
    }));
}

function prepareSkillRows(skills, aspects) {
    return Array.from(skills ?? []).map(
        (skill, index) => {
            const rating =
                Number(skill.rating ?? 0);

            const aspectValue =
                Number(
                    aspects?.[skill.aspect] ?? 0
                );

            return {
                index,

                data: {
                    ...skill,
                    rating,
                    aspectValue,
                    aspectLabel:
                        ASPECT_LABELS[skill.aspect] ??
                        skill.aspect,
                    av: rating + aspectValue
                }
            };
        }
    );
}

function groupSkillRows(skillRows) {
    return Object.entries(
        TTB_SKILL_CATEGORIES
    ).map(([id, label]) => ({
        id,
        label,

        skills: skillRows.filter(
            (row) =>
                row.data.category === id
        )
    }));
}

function buildSkillColumns(skillGroups) {
    const groupsById = new Map(
        skillGroups.map(
            group => [group.id, group]
        )
    );

    return SKILL_COLUMN_LAYOUT.map(
        column => ({
            id: column.id,

            groups: column.categories
                .map(
                    category =>
                        groupsById.get(category)
                )
                .filter(Boolean)
        })
    );
}

export class TTBCharacterSheet extends ActorSheetV1 {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: [SYSTEM_ID, "sheet", "actor", "ttb-character-sheet"],
            template: `systems/${SYSTEM_ID}/templates/actor/character-sheet.hbs`,
            width: 900,
            height: 760,
            left: 120,
            top: 80,
            resizable: true,
            submitOnChange: true,
            closeOnSubmit: false,
            tabs: [
                {
                    navSelector: ".sheet-tabs",
                    contentSelector: ".sheet-body",
                    initial: "main"
                }
            ]
        });
    }

    async getData(options = {}) {
        console.log("TTB | getData start", this.actor.name);

        const context = await super.getData(options);
        const system = this.actor.system ?? {};

        context.system = system;

        const skillRows = prepareSkillRows(
            system.skills,
            system.aspects
        );

        const skillGroups =
            groupSkillRows(skillRows);

        context.skillGroups = skillGroups;

        context.skillColumns =
            buildSkillColumns(skillGroups);

        context.rows = {
            attacks: rowData(system.attacks, 2, {}),
            skills: skillRows,
            talents: rowData(system.talents, 20, {}),
            equipment: rowData(system.equipment, 12, {}),
            destiny: rowData(system.destiny, 5, {})
        };

        console.log("TTB | getData done", context);

        return context;
    }

    async _onSkillTest(event) {
        event.preventDefault();

        const skillId =
            event.currentTarget.dataset.skillId;

        const skill =
            this.actor.system.skills.find(
                candidate =>
                    candidate.id === skillId
            );

        if (!skill) {
            ui.notifications.error(
                `Skill could not be found: ${skillId}`
            );
            return;
        }

        const aspectValue =
            Number(
                this.actor.system.aspects?.[
                    skill.aspect
                    ] ?? 0
            );

        const actingValue =
            Number(skill.rating ?? 0) +
            aspectValue;

        const testOptions =
            await openSkillTestDialog({
                skill,
                actingValue,

                aspectLabel:
                    ASPECT_LABELS[skill.aspect] ??
                    skill.aspect,

                aspectValue
            });

        if (!testOptions) {
            return;
        }

        console.log(
            "through-the-breach | Skill test configured",
            {
                actor: this.actor,
                skill,
                actingValue,
                ...testOptions
            }
        );

        ui.notifications.info(
            `${skill.name} test configured.`
        );
    }

    activateListeners(html) {
        super.activateListeners(html);

        const root = html[0] ?? html;

        root
            .querySelectorAll(
                '[data-action="test-skill"]'
            )
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    (event) =>
                        this._onSkillTest(event)
                );
            });

        this.collapsedSkillCategories ??=
            new Set();

        this.rankedOnlySkillCategories ??=
            new Set();

        /*
         * Restore and remember collapsed categories.
         */
        root
            .querySelectorAll(
                "details[data-skill-category]"
            )
            .forEach((details) => {
                const category =
                    details.dataset.skillCategory;

                details.open =
                    !this.collapsedSkillCategories
                        .has(category);

                details.addEventListener(
                    "toggle",
                    () => {
                        if (details.open) {
                            this.collapsedSkillCategories
                                .delete(category);
                        } else {
                            this.collapsedSkillCategories
                                .add(category);
                        }
                    }
                );
            });

        /*
         * Apply one category's Ranked-only filter.
         */
        const applyCategoryFilter = (
            category
        ) => {
            const rankedOnly =
                this.rankedOnlySkillCategories
                    .has(category);

            root
                .querySelectorAll(
                    "tr[data-skill-category-row]"
                )
                .forEach((row) => {
                    if (
                        row.dataset
                            .skillCategoryRow !==
                        category
                    ) {
                        return;
                    }

                    row.hidden =
                        rankedOnly &&
                        Number(
                            row.dataset.skillRating
                        ) === 0;
                });

            const button =
                root.querySelector(
                    `[data-skill-category-filter="${category}"]`
                );

            if (!button) return;

            button.setAttribute(
                "aria-checked",
                String(rankedOnly)
            );

            button.title = rankedOnly
                ? "Show all Skills in this category"
                : "Hide Rank 0 Skills in this category";

            const icon =
                button.querySelector("i");

            icon?.classList.toggle(
                "fa-square",
                !rankedOnly
            );

            icon?.classList.toggle(
                "fa-square-check",
                rankedOnly
            );
        };

        /*
         * Category-specific Ranked-only controls.
         */
        root
            .querySelectorAll(
                "[data-skill-category-filter]"
            )
            .forEach((button) => {
                const category =
                    button.dataset
                        .skillCategoryFilter;

                button.addEventListener(
                    "click",
                    (event) => {
                        /*
                         * Do not let this click also
                         * collapse the <details>.
                         */
                        event.preventDefault();
                        event.stopPropagation();

                        if (
                            this.rankedOnlySkillCategories
                                .has(category)
                        ) {
                            this.rankedOnlySkillCategories
                                .delete(category);
                        } else {
                            this.rankedOnlySkillCategories
                                .add(category);
                        }

                        applyCategoryFilter(
                            category
                        );
                    }
                );

                applyCategoryFilter(category);
            });
    }

    setPosition(position = {}) {
        const result = super.setPosition(position);
        console.log("TTB | setPosition", this.position);
        return result;
    }
}