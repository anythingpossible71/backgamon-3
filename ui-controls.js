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
    const dice1El = document.getElementById('dice1');
    const dice2El = document.getElementById('dice2');
    const rollButton = document.getElementById('roll-button');
    
    if (dice && dice.length > 0) {
        dice1El.textContent = dice[0];
        dice2El.textContent = dice.length > 1 ? dice[1] : '-';
    } else {
        dice1El.textContent = '-';
        dice2El.textContent = '-';
    }
    
    // Enable roll button only when it's a player's turn and they haven't rolled
    if (rollButton) {
        rollButton.disabled = diceRolled;
    }
}

function updatePlayerInfo() {
    const player1Card = document.getElementById('player1-card');
    const player2Card = document.getElementById('player2-card');
    const player1Bar = document.getElementById('player1-bar');
    const player1Off = document.getElementById('player1-off');
    const player2Bar = document.getElementById('player2-bar');
    const player2Off = document.getElementById('player2-off');
    
    // Update active player highlighting
    if (currentPlayer === 'player1') {
        player1Card.classList.add('active');
        player2Card.classList.remove('active');
    } else {
        player1Card.classList.remove('active');
        player2Card.classList.add('active');
    }
    
    // Update stats
    if (player1Bar) player1Bar.textContent = whiteBar ? whiteBar.length : 0;
    if (player1Off) player1Off.textContent = whiteBearOff ? whiteBearOff.length : 0;
    if (player2Bar) player2Bar.textContent = blackBar ? blackBar.length : 0;
    if (player2Off) player2Off.textContent = blackBearOff ? blackBearOff.length : 0;
}

function updateGameStatus(status) {
    const statusEl = document.getElementById('game-status');
    if (statusEl) {
        if (status) {
            gameStatus = status;
        }
        statusEl.textContent = gameStatus;
    }
}

// Initialize UI controls
document.addEventListener('DOMContentLoaded', () => {
    // Set up roll button
    const rollButton = document.getElementById('roll-button');
    if (rollButton) {
        rollButton.addEventListener('click', () => {
            if (typeof rollDice === 'function') {
                rollDice();
            }
        });
    }
    
    // Set up reset button
    const resetButton = document.getElementById('reset-button');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset the game?')) {
                if (typeof resetGame === 'function') {
                    resetGame();
                    updatePlayerInfo();
                    updateDiceDisplay();
                    updateGameStatus('Game reset. Player 1 to roll.');
                }
            }
        });
    }
    
    // Initial UI update
    updatePlayerInfo();
    updateDiceDisplay();
});

// Export functions to window
window.updatePlayerInfo = updatePlayerInfo;
window.updateDiceDisplay = updateDiceDisplay;
window.updateGameStatus = updateGameStatus;
