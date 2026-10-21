# foundry-through-the-breach
First attempt at implementing a foundry game system for wyrds through the breach pen and paper. 

# Credit
## Fate Deck
I am using the Fatedeck created by Christopher Reid. You can see them [here](https://therivetcounter.blogspot.com/2015/12/choose-your-fate.html?lr=1792578374455). 

## AI Usage Disclaimer.
This Project is primarily created by a Human. AI tools were however utilized to implement specific functions,particularly regarding to style and css.
It has also been used to help learn and understand Java Script for this Project.
All AI-generated code has been reviewed, tested, and implemented for production  by me to ensure logic accuracy and security similar to a fully human implemented Project.

# Security Notice
## Card Secrecy 
This module is Using Foundries card system for handling flips. 
The Permissions are automatically setup such that the player can not see other peoples Hands nor the unflipped Decks. 
The GM can do so, through the Card Stacks. It is therefore recommended to not use these and instead just use the card dock system. 
**HOWEVER** Players can use console or API calls to see all cards and decks including the Order cards are in. 
As this is intended for a non-competetive game this is currently accepted as a shortcomming. 
In the future the drawing of cards could be changed fundamentally to be all handled over the gm client, rather then the player clients themselves.