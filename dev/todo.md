close popup  
export async function rerenderTtbCardDockPopout() {
if (!dockPopoutInstance) return null;
if (!dockPopoutInstance.rendered) return null;

    await dockPopoutInstance.render();
    return dockPopoutInstance;
}

player discard hand card


reshuffle non empty decks:
The Button to reshuffle should force a reshuffle even if the deck is not empty. In that case all cards from the discard and remaining cards from the deck get shuffled together and placed back on the deck stack. Cards in the active zone do not. 
