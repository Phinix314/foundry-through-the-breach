export const TTB_SKILL_CATEGORIES = {
    academic: "Academic",
    social: "Social",
    closeCombat: "Close Combat",
    rangedCombat: "Ranged Combat",
    expertise: "Expertise",
    crafting: "Crafting",
    training: "Training"
};

export const TTB_SKILL_DEFINITIONS = [
    // Academic
    { id: "bureaucracy", name: "Bureaucracy", category: "academic", aspect: "cunning" },
    { id: "engineering", name: "Engineering", category: "academic", aspect: "intellect" },
    { id: "history", name: "History", category: "academic", aspect: "intellect" },
    { id: "literacy", name: "Literacy", category: "academic", aspect: "intellect" },
    { id: "mathematics", name: "Mathematics", category: "academic", aspect: "intellect" },
    { id: "music", name: "Music", category: "academic", aspect: "charm" },

    // Social
    { id: "barter", name: "Barter", category: "social", aspect: "tenacity" },
    { id: "bewitch", name: "Bewitch", category: "social", aspect: "charm" },
    { id: "convince", name: "Convince", category: "social", aspect: "intellect" },
    { id: "deceive", name: "Deceive", category: "social", aspect: "cunning" },
    { id: "intimidate", name: "Intimidate", category: "social", aspect: "tenacity" },
    { id: "leadership", name: "Leadership", category: "social", aspect: "charm" },
    { id: "scrutiny", name: "Scrutiny", category: "social", aspect: "cunning" },

    // Close Combat
    { id: "flexible", name: "Flexible", category: "closeCombat", aspect: "grace" },
    { id: "grappling", name: "Grappling", category: "closeCombat", aspect: "speed" },
    { id: "heavyMelee", name: "Heavy Melee", category: "closeCombat", aspect: "might" },
    { id: "martialArts", name: "Martial Arts", category: "closeCombat", aspect: "speed" },
    { id: "melee", name: "Melee", category: "closeCombat", aspect: "might" },
    { id: "pneumatic", name: "Pneumatic", category: "closeCombat", aspect: "might" },
    { id: "pugilism", name: "Pugilism", category: "closeCombat", aspect: "might" },

    // Ranged Combat
    { id: "archery", name: "Archery", category: "rangedCombat", aspect: "grace" },
    { id: "heavyGuns", name: "Heavy Guns", category: "rangedCombat", aspect: "might" },
    { id: "longArms", name: "Long Arms", category: "rangedCombat", aspect: "intellect" },
    { id: "pistol", name: "Pistol", category: "rangedCombat", aspect: "grace" },
    { id: "shotgun", name: "Shotgun", category: "rangedCombat", aspect: "grace" },
    { id: "thrown", name: "Thrown", category: "rangedCombat", aspect: "grace" },

    // Expertise
    { id: "doctor", name: "Doctor", category: "expertise", aspect: "intellect" },
    { id: "forgery", name: "Forgery", category: "expertise", aspect: "cunning" },
    { id: "gambling", name: "Gambling", category: "expertise", aspect: "cunning" },
    { id: "husbandry", name: "Husbandry", category: "expertise", aspect: "charm" },
    { id: "lockPicking", name: "Lock Picking", category: "expertise", aspect: "grace" },
    { id: "notice", name: "Notice", category: "expertise", aspect: "cunning" },
    { id: "track", name: "Track", category: "expertise", aspect: "cunning" },
    { id: "wilderness", name: "Wilderness", category: "expertise", aspect: "cunning" },

    // Crafting
    { id: "alchemistry", name: "Alchemistry", category: "crafting", aspect: "intellect" },
    { id: "art", name: "Art", category: "crafting", aspect: "cunning" },
    { id: "artefacting", name: "Artefacting", category: "crafting", aspect: "intellect" },
    { id: "blacksmithing", name: "Blacksmithing", category: "crafting", aspect: "intellect" },
    { id: "explosives", name: "Explosives", category: "crafting", aspect: "charm" },
    { id: "culinary", name: "Culinary", category: "crafting", aspect: "intellect" },
    { id: "homesteading", name: "Homesteading", category: "crafting", aspect: "tenacity" },
    { id: "printing", name: "Printing", category: "crafting", aspect: "intellect" },
    { id: "stitching", name: "Stitching", category: "crafting", aspect: "tenacity" },

    // Training
    { id: "acrobatics", name: "Acrobatics", category: "training", aspect: "grace" },
    { id: "athletics", name: "Athletics", category: "training", aspect: "might" },
    { id: "carouse", name: "Carouse", category: "training", aspect: "resilience" },
    { id: "centering", name: "Centering", category: "training", aspect: "tenacity" },
    { id: "evade", name: "Evade", category: "training", aspect: "speed" },
    { id: "pickPocket", name: "Pick Pocket", category: "training", aspect: "speed" },
    { id: "stealth", name: "Stealth", category: "training", aspect: "cunning" },
    { id: "toughness", name: "Toughness", category: "training", aspect: "resilience" }
];