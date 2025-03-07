// EMERGENCY FIX - VERSION 7.0.0 - BYPASSING FIREBASE
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

// ENTIRELY NEW APPROACH - LOCAL STORAGE FIRST, FIREBASE SECOND
console.log("===== EMERGENCY FIX - LOCAL STORAGE FIRST =====");

// Global variables
let lastSyncTimestamp = Date.now();
let pollingIntervalId = null;
let localStoragePrefix = 'bg_';
let syncInProgress = false;

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

// Get local storage key for this game
function getLocalStorageKey() {
  return `${localStoragePrefix}${gameId}`;
}

// CRITICAL CHANGE: Save game to LOCAL STORAGE FIRST, then to Firebase
function saveGameState() {
  console.log("SAVE: Starting emergency local-first save");
  
  try {
    // Ensure we have a game ID
    if (!gameId) {
      console.error("SAVE: No game ID, cannot save state");
      return;
    }
    
    // Validate board data
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
      updatedBy: playerRole
    };
    
    // CRITICAL CHANGE: SAVE TO LOCAL STORAGE FIRST
    try {
      const localStorageKey = getLocalStorageKey();
      localStorage.setItem(localStorageKey, JSON.stringify(gameData));
      console.log(`LOCAL SAVE: Game saved to localStorage with key ${localStorageKey}`);
      
      // Update UI immediately
      updateGameUI();
    } catch (localError) {
      console.error(`LOCAL SAVE ERROR: ${localError.message}`);
    }
    
    // Then save to Firebase in the background
    firebase.database().ref('games/' + gameId).set(gameData)
      .then(() => {
        console.log(`FIREBASE: Game saved successfully at ${timestamp}`);
      })
      .catch((error) => {
        console.error(`FIREBASE ERROR: ${error.message}`);
      });
  }
  catch (error) {
    console.error(`SAVE: Exception: ${error.message}`);
  }
}

// CRITICAL CHANGE: Load from LOCAL STORAGE FIRST, then from Firebase
function loadGameState() {
  console.log("LOAD: Emergency local-first load");
  
  if (!gameId) {
    console.error("LOAD: No game ID, cannot load state");
    return;
  }
  
  // Try local storage first
  try {
    const localStorageKey = getLocalStorageKey();
    const localData = localStorage.getItem(localStorageKey);
    
    if (localData) {
      const gameData = JSON.parse(localData);
      console.log("LOCAL LOAD: Found data in localStorage:", gameData);
      
      // Process game update from local storage
      processGameUpdate(gameData, true);
      
      // Store the timestamp
      if (gameData.timestamp) {
        lastSyncTimestamp = gameData.timestamp;
      }
    }
  } catch (localError) {
    console.error(`LOCAL LOAD ERROR: ${localError.message}`);
  }
  
  // Then check Firebase for any newer updates
  fetchLatestState();
}

// CRITICAL CHANGE: Simplified fetch function that favors local data
function fetchLatestState() {
  // Prevent concurrent syncs
  if (syncInProgress) {
    console.log("POLL: Sync already in progress, skipping");
    return;
  }
  
  syncInProgress = true;
  
  firebase.database().ref('games/' + gameId).once('value')
    .then((snapshot) => {
      const gameData = snapshot.val();
      
      if (!gameData) {
        console.log("POLL: No game data found in Firebase");
        syncInProgress = false;
        return;
      }
      
      // Only update if the Firebase data is newer
      if (gameData.timestamp > lastSyncTimestamp) {
        console.log(`POLL: Newer data in Firebase (${gameData.timestamp} > ${lastSyncTimestamp})`);
        
        // Process the update
        processGameUpdate(gameData, false);
        
        // Update timestamp
        lastSyncTimestamp = gameData.timestamp;
        
        // Save to local storage
        try {
          const localStorageKey = getLocalStorageKey();
          localStorage.setItem(localStorageKey, JSON.stringify(gameData));
          console.log(`LOCAL SAVE: Updated localStorage with newer Firebase data`);
        } catch (localError) {
          console.error(`LOCAL SAVE ERROR: ${localError.message}`);
        }
      } else {
        console.log(`POLL: No newer data in Firebase (${gameData.timestamp} <= ${lastSyncTimestamp})`);
      }
      
      syncInProgress = false;
    })
    .catch((error) => {
      console.error(`POLL ERROR: ${error.message}`);
      syncInProgress = false;
    });
}

// CRITICAL CHANGE: Process updates with improved logic
function processGameUpdate(gameData, fromLocal) {
  const source = fromLocal ? "LOCAL STORAGE" : "FIREBASE";
  console.log(`PROCESS: Update from ${source}, player: ${gameData.updatedBy}, time: ${gameData.timestamp}, dice: ${JSON.stringify(gameData.dice)}`);
  
  try {
    // Always update player names and game started
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
    
    // CRITICAL DECISION POINT: When to apply the update
    
    // CASE 1: It's not our turn - always apply updates
    if (playerRole !== gameData.currentPlayer) {
      console.log("PROCESS: Not our turn, applying update");
      
      // Update all game state
      updateGameStateFromData(gameData);
    }
    // CASE 2: It's our turn but we haven't rolled yet - apply updates
    else if (playerRole === gameData.currentPlayer && !diceRolled) {
      console.log("PROCESS: Our turn but dice not rolled yet, applying update");
      
      // Update all game state
      updateGameStateFromData(gameData);
    }
    // CASE 3: It's our turn and we've rolled - only update if explicitly from other player and valid
    else if (playerRole === gameData.currentPlayer && diceRolled) {
      if (gameData.updatedBy !== playerRole) {
        console.log("PROCESS: Incoming update from other player during our turn - checking validity");
        
        // Only accept if the other player has the most up-to-date board state
        if (gameData.timestamp > lastSyncTimestamp) {
          console.log("PROCESS: Update is newer, cautiously applying");
          updateGameStateFromData(gameData);
        } else {
          console.log("PROCESS: Rejecting update - it would overwrite our turn");
        }
      } else {
        console.log("PROCESS: Update is from us during our turn - reinforcing our state");
      }
    }
    
    // Always update UI visibility
    updateGameVisibility();
    
    // Update turn status
    const isMyTurn = playerRole === currentPlayer;
    console.log(`PROCESS: Is my turn? ${isMyTurn}`);
    
    // Update UI
    updateGameUI();
    
    // Check for win condition
    if (typeof checkWinCondition === 'function') {
      checkWinCondition();
    }
    
    console.log("PROCESS: Update processed successfully");
  }
  catch (error) {
    console.error(`PROCESS ERROR: ${error.message}`);
  }
}

// Helper to update game state from data
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
  
  // Update roll button state
  updateRollButton();
}

// Update debug info
function updateDebugInfo() {
  const debugInfo = document.getElementById('debug-info');
  if (debugInfo && debugInfo.style.display === 'block') {
    debugInfo.innerHTML = `
      <strong>VERSION:</strong> 7.0.0 EMERGENCY FIX<br>
      <strong>Game ID:</strong> ${gameId}<br>
      <strong>Player Role:</strong> ${playerRole}<br>
      <strong>Current Player:</strong> ${currentPlayer}<br>
      <strong>Dice:</strong> ${JSON.stringify(dice)}<br>
      <strong>Last Sync Time:</strong> ${new Date(lastSyncTimestamp).toLocaleTimeString()}<br>
      <strong>Is My Turn:</strong> ${playerRole === currentPlayer}<br>
      <strong>Storage:</strong> LOCAL FIRST + Firebase Backup<br>
    `;
  }
}

// Update roll button state
function updateRollButton() {
  const rollButton = document.getElementById('roll-button');
  if (!rollButton) return;
  
  const isMyTurn = playerRole === currentPlayer;
  
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

// Start polling
function startPolling() {
  console.log("POLL: Starting emergency polling");
  
  // Stop any existing polling
  stopPolling();
  
  // Start new polling interval - MUCH faster polling (500ms)
  pollingIntervalId = setInterval(fetchLatestState, 500);
  
  console.log("POLL: Emergency polling started");
}

// Stop polling
function stopPolling() {
  if (pollingIntervalId) {
    clearInterval(pollingIntervalId);
    pollingIntervalId = null;
    console.log("POLL: Polling stopped");
  }
}

// Listen for game changes (starts polling)
function listenForGameChanges(gameId) {
  console.log(`POLL: Setting up emergency polling for game ID: ${gameId}`);
  
  if (!gameId) {
    console.error("POLL: No game ID provided");
    return;
  }
  
  // Set local storage prefix with game ID
  localStoragePrefix = `bg_${gameId}_`;
  
  // Start polling
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
  processGameUpdate(gameData, false);
}

// Export functions to window object
window.generateUniqueId = generateUniqueId;
window.saveGameState = saveGameState;
window.loadGameState = loadGameState;
window.listenForGameChanges = listenForGameChanges;
window.processFirebaseUpdate = processFirebaseUpdate;
window.forceStartGame = forceStartGame;
window.fetchLatestState = fetchLatestState;
