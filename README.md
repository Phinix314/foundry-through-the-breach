# foundry-through-the-breach
First attempt at implementing a foundry game system for wyrds through the breach pen and paper. 

# Security Notice

## Card Secrecy 
This module is Using Foundries card system for handling flips. 
The Permissions are automatically setup such that the player can not see other peoples Hands nor the unflipped Decks. 
The GM can do so, through the Card Stacks. It is therefore recommended to not use these and instead just use the card dock system. 
**HOWEVER** Players can use console or API calls to see all cards and decks including the Order cards are in. 
As this is intended for a non-competetive game this is currently accepted as a shortcomming. 
In the future the drawing of cards could be changed fundamentally to be all handled over the gm client, rather then the player clients themselves.