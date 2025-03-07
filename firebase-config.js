// FINAL FIX VERSION 8.0.0 - AUTO-REFRESH SOLUTION
// firebase-config.js

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDxzet1iGv7p-8mfRi9tNfJvdEdPmkzdk",
  authDomain: "backgammon-multiplayer.firebaseapp.com",
  projectId: "backgammon-multiplayer",
  storageBucket: "backgammon-multiplayer.firebasestorage.app",
  messagingSenderId: "1044672583667",
  appId: "1:1044672583667:web:dd3a7443903685f38e486",
  databaseURL: "https://backgammon-multiplayer-default-rtdb.firebaseio.com"
};

// Initialize Firebase
if (firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase initialized");
}

// FINAL APPROACH - Use Firebase with aggressive forced refresh
console.log("===== FINAL FIX: AUTO-REFRESH SOLUTION =====");

// Global variables
let lastSyncTimestamp = Date.now();
let lastSuccessfulSync = 0;
let pollingIntervalId = null;
let syncInProgress = false;

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

// FINAL VERSION: Save game state - Extremely aggressive
function saveGameState() {
  console.log("SAVE: Starting AUTO-REFRESH save");
  window.updateSyncStatus("Saving...", "#ff9500");
  
  try {
    // Ensure we have a game ID
    if (!gameId) {
      console.error("SAVE: No game ID, cannot save state");
      window.updateSyncStatus("Error: No Game ID", "#ff3b30");
      return;
    }
    
    // Validate board data
    if (!hasBoardData(board)) {
      console.error("SAVE: Board is empty, initializing before save");
      window.updateSyncStatus("Fixing empty board", "#ff9500");
      
      if (typeof initializeBoard === 'function') {
        initializeBoard();
      } else {
        console.error("SAVE: Cannot initialize board, save aborted");
        window.updateSyncStatus("Error: Empty Board", "#ff3b30");
        return;
      }
    }
    
    // Create a clean copy of the board
    const boardCopy = [];
    for (let i = 0; i < board.length; i++) {
      boardCopy[i] = [];
      if (board[i] && Array.isArray(board[i])) {
        for (let j = 0; j < board[i].length; j++) {
          if (board[i][j] && board[i][j].color) {
            boardCopy[i].push({ color: board[i][j].color });
          }
        }
      }
    }
    
    // Create a random salt for each save to ensure Firebase detects changes
    const salt = Math.random().toString(36).substring(2, 9);
    
    // Create timestamp for this update
    const timestamp = Date.now();
    lastSyncTimestamp = timestamp;
    
    // Create game state object
    const gameData = {
      board: boardCopy,
      whiteBar: [...whiteBar],
      blackBar: [...blackBar],
      whiteBearOff: [...whiteBearOff],
      blackBearOff: [...blackBearOff],
      currentPlayer: currentPlayer,
      dice: [...dice],
      diceRolled: diceRolled,
      player1Name: player1Name,
      player2Name: player2Name,
      gameStarted: gameStarted,
      timestamp: timestamp,
      updatedBy: playerRole,
      salt: salt // Add random value to ensure Firebase detects the change
    };
    
    console.log(`SAVE: Game data prepared, timestamp: ${timestamp}, dice: ${JSON.stringify(dice)}`);
    
    // Save to Firebase
    firebase.database().ref('games/' + gameId).set(gameData)
      .then(() => {
        console.log(`SAVE: Game saved successfully at ${timestamp}`);
        lastSuccessfulSync = timestamp;
        window.updateSyncStatus("Saved ✓", "#34c759");
        
        // Force an immediate UI update and redraw
        updateGameUI();
        if (typeof redraw === 'function') {
          redraw();
        }
      })
      .catch((error) => {
        console.error(`SAVE: Error: ${error.message}`);
        window.updateSyncStatus("Save Error!", "#ff3b30");
      });
  }
  catch (error) {
    console.error(`SAVE: Exception: ${error.message}`);
    window.updateSyncStatus("Save Exception!", "#ff3b30");
  }
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
  console.log(`PROCESS: Update from ${gameData.updatedBy}, timestamp: ${gameData.timestamp}`);
  
  try {
    // Always update player names
    if (gameData.player1Name && gameData.player1Name !== "Player 1") {
      player1Name = gameData.player1Name;
      document.getElementById('player1-name').textContent = player1Name;
    }
    
    if (gameData.player2Name && gameData.player2Name !== "Player 2") {
      player2Name = gameData.player2Name;
      document.getElementById('player2-name').textContent = player2Name;
    }
    
    // Update game started flag
    if (gameData.gameStarted) {
      gameStarted = true;
    }
    
    // CRITICAL DECISION: When to apply the update
    
    // CASE 1: It's not our turn - always apply updates
    const isMyTurn = playerRole === currentPlayer;
    if (!isMyTurn) {
      console.log("PROCESS: Not our turn, applying update");
      updateGameStateFromData(gameData);
    } 
    // CASE 2: It's our turn but we haven't rolled yet - apply updates
    else if (isMyTurn && !diceRolled) {
      console.log("PROCESS: Our turn but dice not rolled yet, applying update");
      updateGameStateFromData(gameData);
    }
    // CASE 3: It's our turn and we've rolled - be very careful
    else if (isMyTurn && diceRolled) {
      // Only update if from another player AND board has changed in an expected way
      if (gameData.updatedBy !== playerRole) {
        console.log("PROCESS: Update during our turn from other player - checking carefully");
        
        // Only accept if clearly newer
        if (gameData.timestamp > lastSyncTimestamp + 5000) { // Must be at least 5 seconds newer
          console.log("PROCESS: Update is significantly newer, accepting with caution");
          updateGameStateFromData(gameData);
        } else {
          console.log("PROCESS: Update too close to our last state, preserving our turn");
        }
      } else {
        console.log("PROCESS: Own update during our turn - reinforcing our state");
      }
    }
    
    // Always update game UI and visibility
    updateGameVisibility();
    updateGameUI();
    
    // Check for win condition
    if (typeof checkWinCondition === 'function') {
      checkWinCondition();
    }
  }
  catch (error) {
    console.error(`PROCESS: Error: ${error.message}`);
    window.updateSyncStatus("Process Error!", "#ff3b30");
  }
}

// Update game state from data
function updateGameStateFromData(gameData) {
  // Update board if valid
  if (gameData.board && hasBoardData(gameData.board)) {
    board = JSON.parse(JSON.stringify(gameData.board));
  }
  
  // Update all other game state
  if (gameData.whiteBar) whiteBar = Array.isArray(gameData.whiteBar) ? [...gameData.whiteBar] : [];
  if (gameData.blackBar) blackBar = Array.isArray(gameData.blackBar) ? [...gameData.blackBar] : [];
  if (gameData.whiteBearOff) whiteBearOff = Array.isArray(gameData.whiteBearOff) ? [...gameData.whiteBearOff] : [];
  if (gameData.blackBearOff) blackBearOff = Array.isArray(gameData.blackBearOff) ? [...gameData.blackBearOff] : [];
  
  if (gameData.currentPlayer) currentPlayer = gameData.currentPlayer;
  if (gameData.dice) dice = Array.isArray(gameData.dice) ? [...gameData.dice] : [];
  if (typeof gameData.diceRolled !== 'undefined') diceRolled = gameData.diceRolled;
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
      <strong>VERSION:</strong> 8.0.0 AUTO-REFRESH FIX<br>
      <strong>Game ID:</strong> ${gameId}<br>
      <strong>Player Role:</strong> ${playerRole}<br>
      <strong>Current Player:</strong> ${currentPlayer}<br>
      <strong>Dice:</strong> ${JSON.stringify(dice)}<br>
      <strong>Last Sync:</strong> ${new Date(lastSyncTimestamp).toLocaleTimeString()}<br>
      <strong>Sync Age:</strong> ${Math.floor(syncAge/1000)}s (${syncStatus})<br>
      <strong>Is My Turn:</strong> ${playerRole === currentPlayer}<br>
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
  console.log("POLL: Starting AUTO-REFRESH polling");
  
  // Stop any existing polling
  stopPolling();
  
  // Start new polling interval
  pollingIntervalId = setInterval(fetchLatestState, 2000); // Check every 2 seconds
  
  console.log("POLL: AUTO-REFRESH polling started");
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
