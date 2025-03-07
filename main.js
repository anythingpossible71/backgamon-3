// Main application code
console.log("Main.js loaded");

// Self-executing function for debugging
(function() {
  console.log("Main.js self-executing function ran");
  
  // Check if setupUIControls exists
  if (typeof setupUIControls === 'function') {
    console.log("setupUIControls function exists");
  } else {
    console.error("setupUIControls function is not defined");
    
    // Define the function if it doesn't exist
    window.setupUIControls = function() {
      console.log("Fallback setupUIControls function called");
      
      // Create Game button
      document.getElementById('create-game-button').addEventListener('click', createNewGame);
      
      // Join Game button
      document.getElementById('join-game-button').addEventListener('click', joinGame);
      
      // Roll Dice button
      document.getElementById('roll-button').addEventListener('click', rollDice);
      
      // Copy URL button
      document.getElementById('copy-url-button').addEventListener('click', copyGameUrl);
      
      // Initially hide certain UI elements
      document.getElementById('join-game-ui').style.display = 'none';
      document.getElementById('game-controls-ui').style.display = 'none';
    };
  }
})();

// p5.js setup
function setup() {
  console.log("Setup function called");
  
  // Create canvas and append to container
  const canvas = createCanvas(BOARD_WIDTH + 2 * BEAR_OFF_WIDTH, BOARD_HEIGHT);
  canvas.parent('canvas-container');
  
  // Initialize game
  initializeBoard();
  
  // Check URL for game ID (for joining a game)
  const urlParams = new URLSearchParams(window.location.search);
  const urlGameId = urlParams.get('game');
  
  if (urlGameId) {
    // Join existing game flow
    gameId = urlGameId;
    document.getElementById('game-url').value = window.location.href;
    document.getElementById('create-game-ui').style.display = 'none';
    document.getElementById('join-game-ui').style.display = 'block';
    
    // In a real implementation, we would fetch the game state from Firebase here
    // For now, just initialize a new game
    playerRole = "spectator";
    gameStatus = "Join this game to play";
  }
  
  // Setup UI controls and event listeners
  try {
    setupUIControls();
    console.log("UI controls set up successfully");
  } catch (e) {
    console.error("Error setting up UI controls:", e);
  }
  
  // Update initial UI state
  try {
    updatePlayerInfo();
    updateDiceDisplay();
    updateGameStatus();
    console.log("UI state updated successfully");
  } catch (e) {
    console.error("Error updating UI state:", e);
  }
  
  console.log("Backgammon game initialized");
}

function draw() {
  background(240);
  
  if (gameId) {
    // Game in progress - draw game elements
    drawBoard();
    drawCheckers();
    drawBar();
    drawBearOffAreas();
    
    // Only show valid moves if it's the current player's turn
    if (selectedChecker && canPlayerMove()) {
      drawValidMoves();
    }
    
    // Draw selected checker being dragged
    if (selectedChecker) {
      let checker;
      
      if (selectedChecker.pointIndex === -1) {
        checker = { color: currentPlayer === 'player1' ? 'white' : 'black' };
      } else {
        checker = board[selectedChecker.pointIndex][selectedChecker.checkerIndex];
      }
      
      if (checker) {
        drawChecker(mouseX, mouseY, checker.color);
      }
    }
  } else {
    // Welcome screen
    background(101, 67, 33); // Brown background
    
    // Draw title
    fill(245, 245, 220);
    textSize(36);
    textAlign(CENTER, CENTER);
    text("Shareable Backgammon", width/2, height/4);
    
    textSize(18);
    text("Create a game to get started", width/2, height/4 + 50);
  }
}

// Just in case these functions aren't defined in ui-controls.js
if (typeof createNewGame !== 'function') {
  window.createNewGame = function() {
    console.log("Fallback createNewGame function called");
    hostName = document.getElementById('player-name-input').value || 'Player 1';
    
    // Generate a unique game ID
    gameId = generateUniqueId();
    
    // Set player role to host
    playerRole = "host";
    
    // Update UI
    document.getElementById('player1-name').innerText = hostName + " (White)";
    document.getElementById('player2-name').innerText = "Waiting for opponent... (Black)";
    
    // Update URL with game ID
    const newUrl = window.location.origin + window.location.pathname + '?game=' + gameId;
    window.history.pushState({}, '', newUrl);
    
    // Update game URL display
    document.getElementById('game-url').value = newUrl;
    
    // Show/hide appropriate UI sections
    document.getElementById('create-game-ui').style.display = 'none';
    document.getElementById('join-game-ui').style.display = 'block';
    document.getElementById('game-controls-ui').style.display = 'block';
    
    // Make player 1 card active
    document.getElementById('player1-card').classList.add('active');
    
    gameStatus = "Waiting for opponent...";
    updateGameStatus();
    
    // Save initial game state to Firebase
    saveGameState();
  };
}

if (typeof joinGame !== 'function') {
  window.joinGame = function() {
    console.log("Fallback joinGame function called");
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
  };
}

if (typeof copyGameUrl !== 'function') {
  window.copyGameUrl = function() {
    console.log("Fallback copyGameUrl function called");
    const gameUrl = document.getElementById('game-url');
    gameUrl.select();
    document.execCommand('copy');
    
    // Show feedback
    const button = document.getElementById('copy-url-button');
    const originalText = button.innerText;
    button.innerText = 'Copied!';
    setTimeout(() => {
      button.innerText = originalText;
    }, 2000);
  };
}

if (typeof updateDiceDisplay !== 'function') {
  window.updateDiceDisplay = function() {
    console.log("Fallback updateDiceDisplay function called");
    // Update dice UI
    const dice1El = document.getElementById('dice1');
    const dice2El = document.getElementById('dice2');
    
    if (dice && dice.length >= 1) {
      dice1El.innerText = dice[0];
    } else {
      dice1El.innerText = '-';
    }
    
    if (dice && dice.length >= 2) {
      dice2El.innerText = dice[1];
    } else {
      dice2El.innerText = '-';
    }
    
    // Disable roll button if dice are already rolled
    if (document.getElementById('roll-button')) {
      document.getElementById('roll-button').disabled = diceRolled || !canPlayerMove();
    }
  };
}

if (typeof updatePlayerInfo !== 'function') {
  window.updatePlayerInfo = function() {
    console.log("Fallback updatePlayerInfo function called");
    // Update player name displays
    if (hostName) {
      document.getElementById('player1-name').innerText = hostName + " (White)";
    }
    
    if (guestName) {
      document.getElementById('player2-name').innerText = guestName + " (Black)";
    }
    
    // Update bar and off counts
    document.getElementById('player1-bar').innerText = whiteBar ? whiteBar.length : '0';
    document.getElementById('player1-off').innerText = whiteBearOff ? whiteBearOff.length : '0';
    document.getElementById('player2-bar').innerText = blackBar ? blackBar.length : '0';
    document.getElementById('player2-off').innerText = blackBearOff ? blackBearOff.length : '0';
    
    // Highlight active player
    if (currentPlayer === 'player1') {
      document.getElementById('player1-card').classList.add('active');
      document.getElementById('player2-card').classList.remove('active');
    } else {
      document.getElementById('player1-card').classList.remove('active');
      document.getElementById('player2-card').classList.add('active');
    }
    
    // Enable/disable roll button based on whose turn it is
    if (document.getElementById('roll-button')) {
      document.getElementById('roll-button').disabled = diceRolled || !canPlayerMove();
    }
  };
}

if (typeof updateGameStatus !== 'function') {
  window.updateGameStatus = function() {
    console.log("Fallback updateGameStatus function called");
    document.getElementById('game-status').innerText = gameStatus || "Waiting for game to start...";
    
    // Special styling for win messages
    if (gameStatus && gameStatus.includes("wins")) {
      document.getElementById('game-status').style.color = '#ff6600';
      document.getElementById('game-status').style.fontWeight = 'bold';
    } else {
      document.getElementById('game-status').style.color = '';
      document.getElementById('game-status').style.fontWeight = '';
    }
  };
}

// Event handling for browser window
window.onload = function() {
  // Additional initialization if needed
  console.log("Backgammon game loaded");
};

console.log("Main.js fully loaded");
