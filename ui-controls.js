// Join an existing game
function joinGame() {
    if (playerRole !== "spectator" || !gameId) return;
    
    guestName = document.getElementById('join-name-input').value || 'Player 2';
    
    // Set player role to guest
    playerRole = "guest";
    
    // Update UI
    document.getElementById('player2-name').innerText = guestName + " (Black)";
    
    // Show/hide appropriate UI sections
    document.getElementById('join-game-ui').style.display = 'none';
    document.getElementById('game-controls-ui').style.display = 'block';
    
    // Make player 2 card active if it's their turn
    if (currentPlayer === 'player2') {
        document.getElementById('player2-card').classList.add('active');
    }
    
    // Update game status
    gameStatus = currentPlayer === 'player1' ? 
        hostName + "'s turn" : guestName + "'s turn";
    updateGameStatus();
    
    // Update Firebase with guest joining
    // firebase.database().ref('games/' + gameId).update({ guestName: guestName });
    
    // Enable auto-roll for the first player
    if (currentPlayer === 'player1' && !diceRolled) {
        // In a real game, we'd wait for the host to roll
        // But for demo purposes, we can enable the roll button
        document.getElementById('roll-button').disabled = false;
    }
}

// Copy game URL to clipboard
function copyGameUrl() {
    const gameUrl = document.getElementById('game-url');
    gameUrl.select();
    document.execCommand('copy');
    
    // Show feedback (could be improved with a toast notification)
    const button = document.getElementById('copy-url-button');
    const originalText = button.innerText;
    button.innerText = 'Copied!';
    setTimeout(() => {
        button.innerText = originalText;
    }, 2000);
}

// Update UI displays
function updateDiceDisplay() {
    // Update dice UI
    const dice1El = document.getElementById('dice1');
    const dice2El = document.getElementById('dice2');
    
    if (dice.length >= 1) {
        dice1El.innerText = dice[0];
    } else {
        dice1El.innerText = '-';
    }
    
    if (dice.length >= 2) {
        dice2El.innerText = dice[1];
    } else {
        dice2El.innerText = '-';
    }
    
    // Disable roll button if dice are already rolled
    document.getElementById('roll-button').disabled = diceRolled || !canPlayerMove();
}

function updatePlayerInfo() {
    // Update player name displays
    if (hostName) {
        document.getElementById('player1-name').innerText = hostName + " (White)";
    }
    
    if (guestName) {
        document.getElementById('player2-name').innerText = guestName + " (Black)";
    }
    
    // Update bar and off counts
    document.getElementById('player1-bar').innerText = whiteBar.length;
    document.getElementById('player1-off').innerText = whiteBearOff.length;
    document.getElementById('player2-bar').innerText = blackBar.length;
    document.getElementById('player2-off').innerText = blackBearOff.length;
    
    // Highlight active player
    if (currentPlayer === 'player1') {
        document.getElementById('player1-card').classList.add('active');
        document.getElementById('player2-card').classList.remove('active');
    } else {
        document.getElementById('player1-card').classList.remove('active');
        document.getElementById('player2-card').classList.add('active');
    }
    
    // Enable/disable roll button based on whose turn it is
    document.getElementById('roll-button').disabled = diceRolled || !canPlayerMove();
}

function updateGameStatus() {
    document.getElementById('game-status').innerText = gameStatus;
    
    // Special styling for win messages
    if (gameStatus.includes("wins")) {
        document.getElementById('game-status').style.color = '#ff6600';
        document.getElementById('game-status').style.fontWeight = 'bold';
    } else {
        document.getElementById('game-status').style.color = '';
        document.getElementById('game-status').style.fontWeight = '';
    }
}
