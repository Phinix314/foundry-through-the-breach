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
- 0.0.8 Improved Charackter Sheet
- 0.1.0  first usable table prototype


# Untracked:
- Persuits
- npc data model
- Skills
- Items
- Charackter Creation
- improved charackter sheet.
  - Autmatic Calculations of Derived Values. 
  - Create/Update Fatedeck from Characktersheet.
  - Link Aspect and Skills
  - Ability to pop out/Improve Talents.
- Improved Display of current conflict. 
  - Select which card was used whne resolving the conflict. 
- Undo Button
- Card Display in Chat / Multiple Cards.

# Quality of Life
- If not enough cards to draw/flip automatically shuffle deck. 
- When adding cards to player have example of each of the 4 suits. 
- Currently there are two Conflict Types which seem similar but are diffrent and should probably be entangled
  - Conflict via the Card Docks
  - Conflict via Commands esp. through the charackter sheet.
- Indicate that a card has been cheated rather then selected more clearly in the chat window

# Known Issues:
- delete player decks of deleted charackters
- Consider naming convention of Popout in regards to same named Module. Possibly integrate it in core.

# Recomendations: