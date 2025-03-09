// VERSION 10.1.0 - LOCAL TWO-PLAYER MODE
// firebase-config.js - Simplified for local gameplay

// Local Game State Manager
let gameState = null;

// Initialize game state
function initializeGameState() {
    // Display version in UI
    displayVersionBanner();
    
    gameState = {
        board: Array(24).fill().map(() => []),
        currentPlayer: 'player1',
        dice: [],
        diceRolled: false,
        whiteBar: [],
        blackBar: [],
        whiteBearOff: [],
        blackBearOff: [],
        gameStatus: 'Game ready to start. Player 1 to roll.',
        version: '10.1.0'
    };

    // Set up initial board position
    // White pieces
    gameState.board[0] = Array(2).fill().map(() => ({ color: 'white' }));
    gameState.board[11] = Array(5).fill().map(() => ({ color: 'white' }));
    gameState.board[16] = Array(3).fill().map(() => ({ color: 'white' }));
    gameState.board[18] = Array(5).fill().map(() => ({ color: 'white' }));

    // Black pieces
    gameState.board[23] = Array(2).fill().map(() => ({ color: 'black' }));
    gameState.board[12] = Array(5).fill().map(() => ({ color: 'black' }));
    gameState.board[7] = Array(3).fill().map(() => ({ color: 'black' }));
    gameState.board[5] = Array(5).fill().map(() => ({ color: 'black' }));

    // Set global variables from game state
    window.board = gameState.board;
    window.currentPlayer = gameState.currentPlayer;
    window.dice = gameState.dice;
    window.diceRolled = gameState.diceRolled;
    window.whiteBar = gameState.whiteBar;
    window.blackBar = gameState.blackBar;
    window.whiteBearOff = gameState.whiteBearOff;
    window.blackBearOff = gameState.blackBearOff;
    window.gameStatus = gameState.gameStatus;

    // Update UI
    if (typeof updatePlayerInfo === 'function') {
        updatePlayerInfo();
    }
    if (typeof updateDiceDisplay === 'function') {
        updateDiceDisplay();
    }
    if (typeof updateGameStatus === 'function') {
        updateGameStatus();
    }

    return gameState;
}

// Function to display version banner
function displayVersionBanner() {
    const versionBanner = document.createElement('div');
    versionBanner.id = 'version-banner';
    versionBanner.style.position = 'fixed';
    versionBanner.style.top = '10px';
    versionBanner.style.right = '10px';
    versionBanner.style.backgroundColor = '#2c3e50';
    versionBanner.style.color = 'white';
    versionBanner.style.padding = '5px 10px';
    versionBanner.style.borderRadius = '5px';
    versionBanner.style.zIndex = '1000';
    versionBanner.style.fontSize = '14px';
    versionBanner.textContent = 'Version 10.1.0 - Local Mode';
    document.body.appendChild(versionBanner);
}

// Save game state
function saveGameState() {
    // Update game state object
    gameState = {
        board: JSON.parse(JSON.stringify(board)),
        currentPlayer,
        dice: [...dice],
        diceRolled,
        whiteBar: [...whiteBar],
        blackBar: [...blackBar],
        whiteBearOff: [...whiteBearOff],
        blackBearOff: [...blackBearOff],
        gameStatus
    };
    
    // Store in localStorage
    try {
        localStorage.setItem('backgammonState', JSON.stringify(gameState));
        console.log('Game state saved locally');
    } catch (error) {
        console.error('Error saving game state:', error);
    }
}

// Load game state
function loadGameState() {
    try {
        const savedState = localStorage.getItem('backgammonState');
        if (savedState) {
            gameState = JSON.parse(savedState);
            
            // Update global variables
            board = gameState.board;
            currentPlayer = gameState.currentPlayer;
            dice = gameState.dice;
            diceRolled = gameState.diceRolled;
            whiteBar = gameState.whiteBar;
            blackBar = gameState.blackBar;
            whiteBearOff = gameState.whiteBearOff;
            blackBearOff = gameState.blackBearOff;
            gameStatus = gameState.gameStatus;
            
            console.log('Game state loaded from local storage');
        } else {
            initializeGameState();
            console.log('New game state initialized');
        }
    } catch (error) {
        console.error('Error loading game state:', error);
        initializeGameState();
    }
}

// Reset game
function resetGame() {
    localStorage.removeItem('backgammonState');
    initializeGameState();
    console.log('Game reset');
    return gameState;
}

// Export functions to window
window.saveGameState = saveGameState;
window.loadGameState = loadGameState;
window.resetGame = resetGame;
window.initializeGameState = initializeGameState;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    loadGameState();
});

// FINAL APPROACH - Use Firebase with aggressive forced refresh
console.log("===== FINAL FIX: AUTO-REFRESH SOLUTION =====");

// Global variables
let lastSyncTimestamp = Date.now();
let lastSuccessfulSync = 0;
let pollingIntervalId = null;
let syncInProgress = false;
let lastSuccessfulSave = null;
let moveInProgress = false;

// Make updateSyncStatus available globally
window.updateSyncStatus = function(status, color) {
  const statusEl = document.getElementById('sync-status');
  if (statusEl) {
    statusEl.style.backgroundColor = color || '#34c759';
    statusEl.textContent = status;
    
    // Flash effect
    statusEl.style.opacity = "1";
    setTimeout(() => {
      statusEl.style.opacity = "0.7";
    }, 500);
  }
};

// Generate a unique game ID
function generateUniqueId() {
  return Math.random().toString(36).substring(2, 9);
}

// Validate that the board has checkers
function hasBoardData(boardData) {
  if (!boardData || !Array.isArray(boardData)) return false;
  
  for (let i = 0; i < boardData.length; i++) {
    if (Array.isArray(boardData[i]) && boardData[i].length > 0) {
      return true;
    }
  }
  return false;
}

// Helper function to validate moves
function validateMove(boardState) {
  // Basic validation - ensure we have the right number of checkers
  let totalCheckers = 0;
  for (let i = 0; i < 24; i++) {
    if (Array.isArray(boardState[i])) {
      totalCheckers += boardState[i].length;
    }
  }
  
  // Add checkers from bars and bear off
  totalCheckers += (whiteBar ? whiteBar.length : 0);
  totalCheckers += (blackBar ? blackBar.length : 0);
  totalCheckers += (whiteBearOff ? whiteBearOff.length : 0);
  totalCheckers += (blackBearOff ? blackBearOff.length : 0);
  
  return totalCheckers === 30; // Total number of checkers in a backgammon game
}

// Load game state
function loadGameState() {
  console.log("LOAD: Loading game state");
  window.updateSyncStatus("Loading...", "#007aff");
  
  if (!gameId) {
    console.error("LOAD: No game ID, cannot load state");
    window.updateSyncStatus("Error: No Game ID", "#ff3b30");
    return;
  }
  
  fetchLatestState();
}

// Fetch the latest state from Firebase
function fetchLatestState() {
  // Skip if sync in progress
  if (syncInProgress) {
    console.log("POLL: Skip - sync already in progress");
    return;
  }
  
  syncInProgress = true;
  
  firebase.database().ref('games/' + gameId).once('value')
    .then((snapshot) => {
      const gameData = snapshot.val();
      
      if (!gameData) {
        console.log("POLL: No game data found");
        window.updateSyncStatus("No Data Found", "#ff9500");
        syncInProgress = false;
        return;
      }
      
      // Process the update regardless of timestamp
      console.log(`POLL: Data found, timestamp: ${gameData.timestamp}, dice: ${JSON.stringify(gameData.dice)}`);
      processGameUpdate(gameData);
      
      // Update last sync timestamp if newer
      if (gameData.timestamp > lastSyncTimestamp) {
        lastSyncTimestamp = gameData.timestamp;
        lastSuccessfulSync = Date.now();
        window.updateSyncStatus("Updated ✓", "#34c759");
      } else {
        window.updateSyncStatus("No Updates", "#999999");
      }
      
      syncInProgress = false;
    })
    .catch((error) => {
      console.error(`POLL: Error: ${error.message}`);
      window.updateSyncStatus("Fetch Error!", "#ff3b30");
      syncInProgress = false;
    });
}

// Process game updates with extreme caution
function processGameUpdate(gameData) {
  console.log("PROCESS: Received update from", gameData.updatedBy);

  try {
    // Don't process updates while a move is in progress
    if (moveInProgress) {
      console.log("PROCESS: Move in progress, skipping update");
      return;
    }

    const isMyTurn = playerRole && currentPlayer === (playerRole === 'player1' ? 'player1' : 'player2');

    // Always accept our own updates
    if (gameData.updatedBy === playerRole) {
      console.log("PROCESS: Accepting our own update");
      updateGameStateFromData(gameData);
      return;
    }

    // If it's our turn, be very careful about accepting updates
    if (isMyTurn) {
      if (gameData.timestamp <= lastSyncTimestamp) {
        console.log("PROCESS: Rejecting older update during our turn");
        return;
      }
      
      // If we have dice rolled, don't accept updates unless they're much newer
      if (diceRolled && gameData.timestamp < lastSyncTimestamp + 5000) {
        console.log("PROCESS: Rejecting update during our turn with dice rolled");
        return;
      }
    }

    // For all other cases, accept the update if it's newer
    if (gameData.timestamp > lastSyncTimestamp) {
      console.log("PROCESS: Accepting newer update");
      updateGameStateFromData(gameData);
    }

    // Update UI
    updateGameUI();
  }
  catch (error) {
    console.error("PROCESS: Error processing update:", error);
  }
}

// Helper function to count checker moves between board states
function countCheckerMoves(oldBoard, newBoard) {
  let moveCount = 0;
  for (let i = 0; i < 24; i++) {
    if (Array.isArray(oldBoard[i]) && Array.isArray(newBoard[i])) {
      moveCount += newBoard[i].length - oldBoard[i].length;
    }

  }
  return moveCount;
}

// Update game state from data
function updateGameStateFromData(gameData) {
  // Update board state
  board = JSON.parse(JSON.stringify(gameData.board));
  whiteBar = Array.isArray(gameData.whiteBar) ? [...gameData.whiteBar] : [];
  blackBar = Array.isArray(gameData.blackBar) ? [...gameData.blackBar] : [];
  whiteBearOff = Array.isArray(gameData.whiteBearOff) ? [...gameData.whiteBearOff] : [];
  blackBearOff = Array.isArray(gameData.blackBearOff) ? [...gameData.blackBearOff] : [];
  
  // Update game state
  currentPlayer = gameData.currentPlayer;
  dice = Array.isArray(gameData.dice) ? [...gameData.dice] : [];
  diceRolled = gameData.diceRolled;
  
  // Update timestamp
  lastSyncTimestamp = gameData.timestamp;
  lastSuccessfulSync = Date.now();
}

// Update game display
function updateGameUI() {
  // Update debug info
  updateDebugInfo();
  
  // Force UI updates
  if (typeof updatePlayerInfo === 'function') updatePlayerInfo();
  if (typeof updateDiceDisplay === 'function') updateDiceDisplay();
  if (typeof updateGameStatus === 'function') updateGameStatus();
  
  // Force redraw the board
  if (typeof redraw === 'function') redraw();
}

// Update debug info
function updateDebugInfo() {
  const debugInfo = document.getElementById('debug-info');
  if (debugInfo && debugInfo.style.display === 'block') {
    const syncAge = Date.now() - lastSuccessfulSync;
    const syncStatus = syncAge < 10000 ? "GOOD" : syncAge < 30000 ? "STALE" : "OLD";
    
    debugInfo.innerHTML = `
      <strong>VERSION:</strong> 10.1.0 LOCAL MODE<br>
      <strong>Current Player:</strong> ${currentPlayer}<br>
      <strong>Dice:</strong> ${JSON.stringify(dice)}<br>
      <strong>Board Status:</strong> ${hasBoardData(board) ? "HAS PIECES" : "EMPTY!"}<br>
    `;
  }
}

// Update game UI visibility
function updateGameVisibility() {
  if (player1Name !== "Player 1" && player2Name !== "Player 2") {
    // Both players have joined
    document.getElementById('game-controls').classList.remove('hidden');
    
    if (playerRole === "player1") {
      document.getElementById('player-join').classList.remove('hidden');
      document.getElementById('waiting-message').classList.remove('hidden');
    } else {
      document.getElementById('player-join').classList.add('hidden');
    }
  }
}

// Start polling for game state
function startPolling() {
  console.log("Starting game state polling");
  stopPolling();
  pollingIntervalId = setInterval(fetchLatestState, 1000); // Poll every second
}

// Stop polling for game state
function stopPolling() {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
    console.log("POLL: Polling stopped");
  }
}

// Listen for game changes
function listenForGameChanges(gameId) {
  console.log(`POLL: Setting up polling for game ID: ${gameId}`);
  
  if (!gameId) {
    console.error("POLL: No game ID provided");
    return;
  }
  
  // Start polling
  startPolling();
}

// Force game to start
function forceStartGame() {
  console.log("FORCE: Game start initiated");
  window.updateSyncStatus("Starting Game", "#007aff");
  
  gameStarted = true;
  saveGameState();
}

// Legacy function for compatibility
function processFirebaseUpdate(gameData) {
  processGameUpdate(gameData);
}

// Export functions
window.generateUniqueId = generateUniqueId;
window.saveGameState = saveGameState;
window.loadGameState = loadGameState;
window.listenForGameChanges = listenForGameChanges;
window.processFirebaseUpdate = processFirebaseUpdate;
window.forceStartGame = forceStartGame;
window.fetchLatestState = fetchLatestState;
