import {
    TTB_SKILL_DEFINITIONS
} from "./skill-catalog.mjs";

const {
    SchemaField,
    ArrayField,
    NumberField,
    StringField,
    BooleanField
} = foundry.data.fields;

function textField(initial = "") {
    return new StringField({
        required: false,
        blank: true,
        initial
    });
}

function numberField(initial = 0) {
    return new NumberField({
        required: true,
        integer: true,
        initial
    });
}

function makeRows(count, factory) {
    return Array.from({ length: count }, () => factory());
}

function skillRow(definition) {
    return {
        id: definition.id,
        name: definition.name,
        category: definition.category,
        rating: 0,
        aspect: definition.aspect,

        manualActingValueModifier: 0,
        inherentFlipModifier: 0,

        inherentSuits: [],
        triggers: []
    };
}

function attackRow() {
    return {
        name: "",
        av: "",
        range: "",
        damage: "",
        special: "",
        capacity: "",
        reload: "",
        tn: "",
        triggers: ""
    };
}

function noteRow() {
    return {
        name: "",
        description: ""
    };
}

function equipmentRow() {
    return {
        name: "",
        notes: ""
    };
}

function destinyRow(label = "") {
    return {
        label,
        text: "",
        card: "",
        checked: false
    };
}

function numeric(value) {
    const number = Number(value ?? 0);

    return Number.isFinite(number)
        ? number
        : 0;
}

function findSkill(system, skillId) {
    return Array.from(system.skills ?? []).find(
        skill => skill.id === skillId
    );
}

function skillRating(system, skillId) {
    return numeric(
        findSkill(system, skillId)?.rating
    );
}

function skillSuits(system, skillId) {
    return Array.from(
        findSkill(system, skillId)
            ?.inherentSuits ?? []
    );
}

function finishCalculation({
                               base,
                               manualModifier,
                               expression,
                               suits = []
                           }) {
    const manual =
        numeric(manualModifier);

    const value =
        base + manual;

    const manualText =
        manual === 0
            ? ""
            : manual > 0
                ? ` + Manual ${manual}`
                : ` - Manual ${Math.abs(manual)}`;

    return {
        value,
        base,
        manualModifier: manual,
        suits,
        tooltip:
            `${expression}${manualText} = ${value}`
    };
}

export function calculateCharacterDerivedValues(
    system
) {
    const speed =
        numeric(system.aspects?.speed);

    const resilience =
        numeric(system.aspects?.resilience);

    const tenacity =
        numeric(system.aspects?.tenacity);

    const evade =
        skillRating(system, "evade");

    const centering =
        skillRating(system, "centering");

    const notice =
        skillRating(system, "notice");

    const toughness =
        skillRating(system, "toughness");

    /*
     * If Skill and Aspect are equal, prefer the Skill.
     * This allows its inherent suit to carry into the
     * Derived Aspect.
     */
    const defenseUsesEvade =
        evade >= speed;

    const defenseSource =
        defenseUsesEvade
            ? evade
            : speed;

    const defense =
        finishCalculation({
            base: 2 + defenseSource,

            manualModifier:
            system.activeValues
                ?.defense
                ?.manualModifier,

            expression:
                defenseUsesEvade
                    ? `2 + Evade ${evade}`
                    : `2 + Speed ${speed}`,

            suits:
                defenseUsesEvade
                    ? skillSuits(
                        system,
                        "evade"
                    )
                    : []
        });

    const willpowerUsesCentering =
        centering >= tenacity;

    const willpowerSource =
        willpowerUsesCentering
            ? centering
            : tenacity;

    const willpower =
        finishCalculation({
            base: 2 + willpowerSource,

            manualModifier:
            system.activeValues
                ?.willpower
                ?.manualModifier,

            expression:
                willpowerUsesCentering
                    ? `2 + Centering ${centering}`
                    : `2 + Tenacity ${tenacity}`,

            suits:
                willpowerUsesCentering
                    ? skillSuits(
                        system,
                        "centering"
                    )
                    : []
        });

    const initiative =
        finishCalculation({
            base:
                speed +
                notice,

            manualModifier:
            system.activeValues
                ?.initiative
                ?.manualModifier,

            expression:
                `Speed ${speed} + Notice ${notice}`,

            suits:
                skillSuits(
                    system,
                    "notice"
                )
        });

    const resilienceContribution =
        resilience > 0
            ? Math.ceil(
                resilience / 2
            )
            : 0;

    const wounds =
        finishCalculation({
            base:
                4 +
                toughness +
                resilienceContribution,

            manualModifier:
            system.wounds
                ?.manualMaximumModifier,

            expression:
                `4 + Toughness ${toughness}` +
                ` + Resilience ${resilienceContribution}`
        });

    const halfSpeed =
        Math.ceil(speed / 2);

    const walk =
        finishCalculation({
            base:
                4 +
                halfSpeed,

            manualModifier:
            system.movement
                ?.walk
                ?.manualModifier,

            expression:
                `4 + half Speed ${halfSpeed}`
        });

    const generatedCharge =
        finishCalculation({
            base:
                4 +
                speed,

            manualModifier:
            system.movement
                ?.charge
                ?.manualModifier,

            expression:
                `4 + Speed ${speed}`
        });

    const chargeValue =
        Math.max(
            generatedCharge.value,
            walk.value
        );

    const charge = {
        ...generatedCharge,
        value: chargeValue,

        tooltip:
            generatedCharge.value < walk.value
                ? `${generatedCharge.tooltip};` +
                ` raised to Walk ${walk.value}`
                : generatedCharge.tooltip
    };

    const height =
        finishCalculation({
            base: 2,

            manualModifier:
            system.movement
                ?.height
                ?.manualModifier,

            expression:
                "Base Height 2"
        });

    return {
        defense,
        willpower,
        initiative,

        wounds: {
            ...wounds,
            max: wounds.value
        },

        walk,
        charge,
        height
    };
}

export class TTBCharacterData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            station: textField(),

            experience: new NumberField({
                required: true,
                nullable: false,
                integer: true,
                min: 0,
                initial: 0
            }),

            destinySteps: new NumberField({
                required: true,
                nullable: false,
                integer: true,
                min: 0,
                max: 5,
                initial: 0
            }),

            currentPursuit: textField(),

            characteristics: new ArrayField(
                textField(),
                {
                    initial: () => [
                        "Living",
                        "Fated"
                    ]
                }
            ),

            aspects: new SchemaField({
                might: numberField(0),
                grace: numberField(0),
                speed: numberField(0),
                resilience: numberField(0),
                intellect: numberField(0),
                charm: numberField(0),
                cunning: numberField(0),
                tenacity: numberField(0)
            }),

            activeValues: new SchemaField({
                defense: new SchemaField({
                    value: numberField(2),
                    manualModifier: numberField(0)
                }),

                willpower: new SchemaField({
                    value: numberField(2),
                    manualModifier: numberField(0)
                }),

                initiative: new SchemaField({
                    value: numberField(0),
                    manualModifier: numberField(0)
                })
            }),

            wounds: new SchemaField({
                value: numberField(4),
                max: numberField(4),
                manualMaximumModifier: numberField(0)
            }),

            movement: new SchemaField({
                walk: new SchemaField({
                    value: numberField(4),
                    manualModifier: numberField(0)
                }),

                charge: new SchemaField({
                    value: numberField(4),
                    manualModifier: numberField(0)
                }),

                height: new SchemaField({
                    value: numberField(2),
                    manualModifier: numberField(0)
                })
            }),

            armor: new SchemaField({
                value: new NumberField({
                    required: true,
                    nullable: false,
                    integer: true,
                    min: 0,
                    max: 3,
                    initial: 0
                })
            }),

            attacks: new ArrayField(
                new SchemaField({
                    name: textField(),
                    av: textField(),
                    range: textField(),
                    damage: textField(),
                    special: textField(),
                    capacity: textField(),
                    reload: textField(),
                    tn: textField(),
                    triggers: textField()
                }),
                {
                    initial: () => makeRows(2, attackRow)
                }
            ),

            skills: new ArrayField(
                new SchemaField({
                    id: textField(),
                    name: textField(),
                    category: textField(),

                    rating: new NumberField({
                        required: true,
                        nullable: false,
                        integer: true,
                        min: 0,
                        max: 5,
                        initial: 0
                    }),

                    aspect: textField(),

                    manualActingValueModifier:
                        numberField(0),

                    inherentFlipModifier:
                        numberField(0),

                    inherentSuits: new ArrayField(
                        textField(),
                        {
                            initial: () => []
                        }
                    ),

                    triggers: new ArrayField(
                        new SchemaField({
                            id: textField(),
                            name: textField(),

                            requiredSuits: new ArrayField(
                                textField(),
                                {
                                    initial: () => []
                                }
                            ),

                            description: textField()
                        }),
                        {
                            initial: () => []
                        }
                    )
                }),
                {
                    initial: () =>
                        TTB_SKILL_DEFINITIONS.map(
                            (definition) => skillRow(definition)
                        )
                }
            ),

            talents: new ArrayField(
                new SchemaField({
                    name: textField(),
                    description: textField()
                }),
                {
                    initial: () => makeRows(20, noteRow)
                }
            ),

            equipment: new ArrayField(
                new SchemaField({
                    name: textField(),
                    notes: textField()
                }),
                {
                    initial: () => makeRows(12, equipmentRow)
                }
            ),

            scrip: textField(),

            grimoire: new SchemaField({
                magia: textField(),
                immuto: textField(),
                special: textField()
            }),

            destiny: new ArrayField(
                new SchemaField({
                    label: textField(),
                    text: textField(),
                    card: textField(),
                    checked: new BooleanField({ required: true, initial: false })
                }),
                {
                    initial: () => [
                        destinyRow("Allegiance Destiny"),
                        destinyRow("Body Destiny"),
                        destinyRow("Root Destiny"),
                        destinyRow("Mind Destiny"),
                        destinyRow("Endeavor Destiny")
                    ]
                }
            ),

            twistDeck: new SchemaField({
                masks: textField(),
                tomes: textField(),
                rams: textField(),
                crows: textField()
            })
        };
    }

    prepareDerivedData() {
        const calculated =
            calculateCharacterDerivedValues(this);

        this.activeValues.defense.value =
            calculated.defense.value;

        this.activeValues.willpower.value =
            calculated.willpower.value;

        this.activeValues.initiative.value =
            calculated.initiative.value;

        this.wounds.max =
            calculated.wounds.max;

        this.movement.walk.value =
            calculated.walk.value;

        this.movement.charge.value =
            calculated.charge.value;

        this.movement.height.value =
            calculated.height.value;
    }
}