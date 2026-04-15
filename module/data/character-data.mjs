const { SchemaField, NumberField, StringField } = foundry.data.fields;

export class TTBCharacterData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        return {
            ancestry: new StringField({ required: false, blank: true, initial: "" }),
            pursuit: new StringField({ required: false, blank: true, initial: "" }),
            fate: new StringField({ required: false, blank: true, initial: "" }),

            aspects: new SchemaField({
                might: new NumberField({ required: true, integer: true, initial: 0 }),
                grace: new NumberField({ required: true, integer: true, initial: 0 }),
                speed: new NumberField({ required: true, integer: true, initial: 0 }),
                resilience: new NumberField({ required: true, integer: true, initial: 0 }),
                intellect: new NumberField({ required: true, integer: true, initial: 0 }),
                charm: new NumberField({ required: true, integer: true, initial: 0 }),
                cunning: new NumberField({ required: true, integer: true, initial: 0 }),
                tenacity: new NumberField({ required: true, integer: true, initial: 0 })
            }),

            wounds: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
            destiny: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
            fortune: new NumberField({ required: true, integer: true, min: 0, initial: 0 })
        };
    }
}