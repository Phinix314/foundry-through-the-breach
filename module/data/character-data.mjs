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
        inherentSuits: [],
        triggers: ""
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

export class TTBCharacterData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            fatedName: textField(),
            playerName: textField(),
            allegiance: textField(),

            pursuits: textField(),
            currentPursuit: textField(),
            characteristics: textField(),

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

            derived: new SchemaField({
                defense: textField(),
                armor: textField(),
                willpower: textField(),
                wounds: textField(),
                walk: textField(),
                charge: textField(),
                initiative: textField(),
                height: textField()
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

                    inherentSuits: new ArrayField(
                        textField(),
                        {
                            initial: () => []
                        }
                    ),

                    triggers: textField()
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
}