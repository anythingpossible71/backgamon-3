// In a new file shared-state.js
window.backgammonGame = {
    gameId: null,
    playerRole: "spectator",
    player1Name: "Player 1",
    player2Name: "Player 2",
    gameStarted: false,
    // Add other shared variables
};

// Then in all other files, refer to them as:
window.backgammonGame.gameId = "some_value";
