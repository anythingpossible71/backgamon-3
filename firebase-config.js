// COMPLETE REWRITE - POLLING SOLUTION (v6.0.0)
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

// Global variables for game state management
let lastServerTimestamp = 0;
let isMyTurn = false;
let pollingIntervalId = null;
let isSaving = false;
let lastSyncResult = "No sync yet";

// CRITICAL FIX: No client IDs anymore
console.log("===== DIRECT SYNC SOLUTION =====");

// Generate a unique game ID
function generateUniqueId() {
  return Math.random().toString(36).substring(2, 9);
}

// ==========================================
// CRITICAL: BOARD VALIDATION & RESTORATION
// ==========================================

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

// Save game state to Firebase with timestamp
function saveGameState() {
  console.log("SAVE: Starting save operation");
  
  // Always save when called - no more concurrent protection
  try {
    // Ensure we have a game ID
    if (!gameId) {
      console.error("SAVE: No game ID, cannot save state");
      return;
    }
    
    // Force checking board data
    if (!hasBoardData(board)) {
      console.error("SAVE: Board is empty, initializing before save");
      if (typeof initializeBoard === 'function') {
        initializeBoard();
      } else {
        console.error("SAVE: Cannot initialize board, save aborted");
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
    
    // Create timestamp for this update
    const timestamp = Date.now();
    
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
      updatedBy: playerRole
    };
    
    console.log(`SAVE: Game data prepared, timestamp: ${timestamp}, dice: ${JSON.stringify(dice)}`);
    
    // Save to Firebase
    firebase.database().ref('games/' + gameId).set(gameData)
      .then(() => {
        console.log(`SAVE: Game saved successfully at ${timestamp}`);
        lastServerTimestamp = timestamp; // Update our last seen timestamp
        lastSyncResult = `SAVED at ${new Date().toLocaleTimeString()}`;
        
        // CRITICAL FIX: Force an immediate fetch after saving to confirm
        setTimeout(fetchLatestState, 300);
      })
      .catch((error) => {
        console.error(`SAVE: Error: ${error.message}`);
        lastSyncResult = `SAVE ERROR: ${error.message}`;
      });
  }
  catch (error) {
    console.error(`SAVE: Exception: ${error.message}`);
    lastSyncResult = `SAVE EXCEPTION: ${error.message}`;
  }
}

// Load initial game state (one time)
function loadGameState() {
  console.log("LOAD: Loading initial game state");
  
  if (!gameId) {
    console.error("LOAD: No game ID, cannot load state");
    return;
  }
  
  lastSyncResult = "Loading game...";
  fetchLatestState();
}

// ==========================================
// POLLING MECHANISM
// ==========================================

// Fetch the latest state from Firebase
function fetchLatestState() {
  firebase.database().ref('games/' + gameId).once('value')
    .then((snapshot) => {
      const gameData = snapshot.val();
      
      if (!gameData) {
        console.log("POLL: No game data found");
        lastSyncResult = "No game data found";
        return;
      }
      
      console.log(`POLL: State found, timestamp: ${gameData.timestamp}, dice: ${JSON.stringify(gameData.dice)}`);
      
      // Process the update regardless of timestamp
      processGameUpdate(gameData);
      
      // Update our last server timestamp
      if (gameData.timestamp > lastServerTimestamp) {
        lastServerTimestamp = gameData.timestamp;
      }
      
      lastSyncResult = `POLL SUCCESS at ${new Date().toLocaleTimeString()}`;
    })
    .catch((error) => {
      console.error(`POLL: Error fetching data: ${error.message}`);
      lastSyncResult = `POLL ERROR: ${error.message}`;
    });
}

// Process a game update
function processGameUpdate(gameData) {
  console.log(`PROCESS: Update from ${gameData.updatedBy} at ${gameData.timestamp}, dice: ${JSON.stringify(gameData.dice)}`);
  
  try {
    // Always update player names and game started
    if (gameData.player1Name) {
      player1Name = gameData.player1Name;
      document.getElementById('player1-name').textContent = player1Name;
    }
    
    if (gameData.player2Name) {
      player2Name = gameData.player2Name;
      document.getElementById('player2-name').textContent = player2Name;
    }
    
    // Update game started flag
    if (gameData.gameStarted) {
      gameStarted = true;
    }
    
    // CRITICAL FIX: Check if we're in the middle of our own turn
    const isMyOwnTurn = playerRole === currentPlayer && diceRolled;
    
    // CRITICAL: Only update if we're not in our own turn OR if the update is newer
    if (!isMyOwnTurn || gameData.timestamp > lastServerTimestamp) {
      console.log("PROCESS: Updating full game state");
      
      // Update all game state
      
      // Check if board data is valid
      if (gameData.board && hasBoardData(gameData.board)) {
        console.log("PROCESS: Updating board");
        board = JSON.parse(JSON.stringify(gameData.board));
      }
      
      // Update all other game state
      if (gameData.whiteBar) whiteBar = Array.isArray(gameData.whiteBar) ? [...gameData.whiteBar] : [];
      if (gameData.blackBar) blackBar = Array.isArray(gameData.blackBar) ? [...gameData.blackBar] : [];
      if (gameData.whiteBearOff) whiteBearOff = Array.isArray(gameData.whiteBearOff) ? [...gameData.whiteBearOff] : [];
      if (gameData.blackBearOff) blackBearOff = Array.isArray(gameData.blackBearOff) ? [...gameData.blackBearOff] : [];
      
      // CRITICAL: Always update dice and current player unless we're in our own turn
      if (!isMyOwnTurn) {
        if (gameData.currentPlayer) currentPlayer = gameData.currentPlayer;
        if (gameData.dice) dice = Array.isArray(gameData.dice) ? [...gameData.dice] : [];
        if (typeof gameData.diceRolled !== 'undefined') diceRolled = gameData.diceRolled;
      } else {
        console.log("PROCESS: Keeping our own dice and turn status");
      }
    } else {
      console.log("PROCESS: Not updating game state - we're in the middle of our turn");
    }
    
    // Always update game UI visibility
    updateGameVisibility();
    
    // Update turn status
    isMyTurn = playerRole === currentPlayer;
    console.log(`PROCESS: Is my turn? ${isMyTurn}`);
    
    // Update UI regardless
    updateGameUI();
    
    // Check for win condition
    if (typeof checkWinCondition === 'function') {
      checkWinCondition();
    }
    
    console.log("PROCESS: Update processed successfully");
  }
  catch (error) {
    console.error(`PROCESS: Error: ${error.message}`);
    lastSyncResult = `PROCESS ERROR: ${error.message}`;
  }
}

// Update game display
function updateGameUI() {
  // Update debug info with last sync result
  updateDebugInfo();
  
  // Force UI updates
  if (typeof updatePlayerInfo === 'function') updatePlayerInfo();
  if (typeof updateDiceDisplay === 'function') updateDiceDisplay();
  if (typeof updateGameStatus === 'function') updateGameStatus();
  
  // Force redraw the board
  if (typeof redraw === 'function') redraw();
  
  // Update roll button state
  updateRollButton();
}

// Update debug info
function updateDebugInfo() {
  const debugInfo = document.getElementById('debug-info');
  if (debugInfo && debugInfo.style.display === 'block') {
    debugInfo.innerHTML = `
      <strong>Game ID:</strong> ${gameId}<br>
      <strong>Player Role:</strong> ${playerRole}<br>
      <strong>Current Player:</strong> ${currentPlayer}<br>
      <strong>Dice:</strong> ${JSON.stringify(dice)}<br>
      <strong>Last Timestamp:</strong> ${lastServerTimestamp}<br>
      <strong>Is My Turn:</strong> ${isMyTurn}<br>
      <strong>Last Sync:</strong> ${lastSyncResult}<br>
    `;
  }
}

// Update roll button state
function updateRollButton() {
  const rollButton = document.getElementById('roll-button');
  if (!rollButton) return;
  
  if (isMyTurn && !diceRolled) {
    console.log("BUTTON: Enabling roll button - it's my turn");
    rollButton.disabled = false;
  } else {
    console.log("BUTTON: Disabling roll button - not my turn or already rolled");
    rollButton.disabled = true;
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
  console.log("POLL: Starting polling mechanism");
  
  // Stop any existing polling
  stopPolling();
  
  // Start new polling interval - FASTER POLLING (1 second)
  pollingIntervalId = setInterval(fetchLatestState, 1000); // Check every 1 second
  
  console.log("POLL: Polling mechanism started");
}

// Stop polling for game state
function stopPolling() {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
    console.log("POLL: Polling mechanism stopped");
  }
}

// Listen for game changes - this now starts the polling mechanism
function listenForGameChanges(gameId) {
  console.log(`POLL: Setting up polling for game ID: ${gameId}`);
  
  if (!gameId) {
    console.error("POLL: No game ID provided");
    return;
  }
  
  // Start polling mechanism
  startPolling();
}

// Force game to start
function forceStartGame() {
  console.log("FORCE: Game start initiated");
  
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
window.fetchLatestState = fetchLatestState; // Export manual refresh function
