# Versions
- 0.0.0  initial boot
- 0.0.1  actor data model
- 0.0.2  basic Fate Deck creation
- 0.0.3  flip button
- 0.0.4  player Decks.
- 0.0.5  Flips, Cheat and Discards.
- 0.0.6  Card Docks / Improved Card Display.
  - 0.0.6.1 First implementation of card dock
  - 0.0.6.2 GM Assignment Macro
  - 0.0.6.3 card dock pop out
  - 0.0.6.4 Improved Card Dock and have unique for fate/players.
  - 0.0.6.5 Improve Privacy of Decks / Unflipped Cards.
  - 0.0.6.6 Improved Card behaivior: Player can Discard Cards and Reshuffle Deck even if its not empty. (Resolved over GM Socket)
  - 0.0.6.7 Added Card Images for both chat and card docks. Also sligthly improved visiual display in the card-dock.
- 0.0.7 Conflict.
  - 0.0.7.0 Basic Conflict logic in the backend.
  - 0.0.7.1 Created visual selection for conflict resolution. Added Black Joker Logic
  - 0.0.7.2 Improved UI regarding pos/neg flips. Included Red Joker Logic & suit selection.
  - 0.0.7.3 Integrated cheating cards into a conflict and resolving them afterwards. 
  - 0.0.7.4 Resolving Conflict and posting in Chat. Added sprites for suits. 
  - 0.0.7.5Added GM socket arbitration to enforce one active structured Challenge Duel at a time.
- 0.0.8 Improved Charackter Sheet
  - 0.0.8.1 Started reworking Characktersheet. Updated Skill Tab with all non magic skills as well as calculating AV.
    - 0.0.8.1.1 Implemented Skill Test Action with dialog, allowing selectoin of TN and situational modfiierers.
    - 0.0.8.1.2 Connected Skill Test dialog with structured conflicts. Small visual updates. Fixed inconsistent naming of values/suits. 
    - 0.0.8.1.3 Applied negative flip cheat policy, fixed couple bugs and added structured conflict requireing just suits without tn.
    - 0.0.8.1.4 Added Suit requirements for SKill tests as well as display in the card choice window
    - 0.0.8.1.5 Added ability to customize skills in ragards to inherent flip/av/suit modifier as well as changing used aspect.
    - 0.0.8.1.6 Added ability to add Triggers in the customize skill window.
    - 0.0.8.1.7 Added Skill Trigger creation, suit-requirement detection, and available-trigger display in chat.
    - 0.0.8.1.8 Creating initial Trigger Decleration/Resolve. Timing and autmatic effect are left out. 
  - 0.0.8.2 Rework of the Main Tab as well as the consistent header. 
  - 
- 0.1.0  first usable table prototype
  

# Untracked Tasks
- improved charackter sheet.
  - Ability to pop out/Improve Talents.
  - Create/Update Fatedeck from Characktersheet.
  - Display Defense/Willpower as well as Armor and Wounds in the combat tab. 
  - Initiative flip


# Untracked Ideas
- Items
- Charackter Creation
- Persuits
- npc data model
- - Undo Button
- Tokens and Conditions

# Quality of Life
- If not enough cards to draw/flip automatically shuffle deck. 
- When adding cards to player have example of each of the 4 suits. 
- Currently there are two Conflict Types which seem similar but are diffrent and should probably be entangled
  - Conflict via the Card Docks
  - Conflict via Commands esp. through the charackter sheet.
- Indicate that a card has been cheated rather then selected more clearly in the chat window
- Indicate AV Suits same as TN suits in selecting card dialog as in 0.0.8.1.4

# Refractoring 
- Replace user-facing “Conflict” terminology with “Challenge Duel” or “Duel”.
  - Internal activeConflict naming can remain temporarily to avoid a risky broad refactor.
- Visual Design of Charackter Sheet
  - Skill Tables!

# Known Issues:
- delete player decks of deleted charackters
- Set TN sometimes maintains into the next duel. 
- Resolve Conflict macro of GM does not clear structured Conflicts.

# Recomendations: