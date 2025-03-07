// COMPLETE REWRITE - MANUAL SYNC SOLUTION (v5.0.0)
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

// Unique client ID - will be changed for manual saves
window.clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
console.log("Initial client ID generated:", window.clientId);

// Global save counter for debugging
let saveCounter = 0;

// Generate a unique game ID
function generateUniqueId() {
  return Math.random().toString(36).substring(2, 9);
}

// Save game state to Firebase with detailed errors
function saveGameState() {
  // Increment save counter
  saveCounter++;
  const currentSaveNumber = saveCounter;
  
  console.log(`SAVE #${currentSaveNumber}: Starting save with client ID ${window.clientId}`);
  
  // Ensure we have a game ID
  if (!gameId) {
    console.error(`SAVE #${currentSaveNumber}: No game ID, cannot save state`);
    return;
  }
  
  try {
    // Create a clean copy of the board
    const boardCopy = [];
    if (board && Array.isArray(board)) {
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
    }
    
    // Create a simple game state object with minimal data
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
      
      // Critical fields for sync
      timestamp: Date.now(),
      lastUpdatedBy: playerRole,
      clientId: window.clientId,
      saveNumber: currentSaveNumber
    };
    
    console.log(`SAVE #${currentSaveNumber}: Prepared state for saving`);
    
    // Save to Firebase with detailed errors
    firebase.database().ref('games/' + gameId).set(gameData)
      .then(() => {
        console.log(`SAVE #${currentSaveNumber}: Game saved successfully`);
      })
      .catch((error) => {
        console.error(`SAVE #${currentSaveNumber}: Firebase error:`, error.code, error.message);
        console.error(`SAVE #${currentSaveNumber}: Full error:`, error);
      });
  }
  catch (error) {
    console.error(`SAVE #${currentSaveNumber}: Exception in saveGameState:`, error);
  }
}

// Load game state initially
function loadGameState() {
  console.log("LOAD: Fetching game state from Firebase");
  
  if (!gameId) {
    console.error("LOAD: No game ID, cannot load state");
    return;
  }
  
  firebase.database().ref('games/' + gameId).once('value')
    .then((snapshot) => {
      const gameData = snapshot.val();
      if (!gameData) {
        console.log("LOAD: No existing game data found");
        return;
      }
      
      console.log(`LOAD: Got game data (save #${gameData.saveNumber || 'unknown'})`);
      updateGameFromFirebase(gameData);
    })
    .catch((error) => {
      console.error("LOAD: Firebase error:", error.code, error.message);
      console.error("LOAD: Full error:", error);
    });
}

// Listen for game changes
function listenForGameChanges(gameId) {
  console.log("LISTEN: Setting up game changes listener");
  
  if (!gameId) {
    console.error("LISTEN: No game ID, cannot listen for changes");
    return;
  }
  
  firebase.database().ref('games/' + gameId).on('value', (snapshot) => {
    try {
      const gameData = snapshot.val();
      
      if (!gameData) {
        console.log("LISTEN: No game data in update");
        return;
      }
      
      console.log(`LISTEN: Received update (save #${gameData.saveNumber || 'unknown'})`);
      updateGameFromFirebase(gameData);
    }
    catch (error) {
      console.error("LISTEN: Error processing update:", error);
    }
  }, (error) => {
    console.error("LISTEN: Firebase error:", error.code, error.message);
    console.error("LISTEN: Full error:", error);
  });
  
  console.log("LISTEN: Firebase listener established");
}

// Process a Firebase update
function updateGameFromFirebase(gameData) {
  const saveNumber = gameData.saveNumber || 'unknown';
  console.log(`UPDATE #${saveNumber}: Processing update from Firebase`);
  
  // Skip updates from our own client
  if (gameData.clientId === window.clientId && !gameData.clientId.startsWith('manual_')) {
    console.log(`UPDATE #${saveNumber}: Ignoring update from our own client`);
    return;
  }
  
  console.log(`UPDATE #${saveNumber}: Update from client: ${gameData.clientId}, our ID: ${window.clientId}`);
  
  try {
    // Update player names
    if (gameData.player1Name) {
      player1Name = gameData.player1Name;
      document.getElementById('player1-name').textContent = player1Name;
    }
    
    if (gameData.player2Name) {
      player2Name = gameData.player2Name;
      document.getElementById('player2-name').textContent = player2Name;
    }
    
    // Update game started status
    if (gameData.gameStarted) {
      gameStarted = true;
    }
    
    // Update game controls visibility
    if (player1Name !== "Player 1" && player2Name !== "Player 2") {
      document.getElementById('game-controls').classList.remove('hidden');
      
      if (playerRole === "player1") {
        document.getElementById('player-join').classList.remove('hidden');
        document.getElementById('waiting-message').classList.remove('hidden');
      } else {
        document.getElementById('player-join').classList.add('hidden');
      }
    }
    
    // Update key game state
    if (gameData.board) {
      board = JSON.parse(JSON.stringify(gameData.board));
    }
    
    if (gameData.currentPlayer) currentPlayer = gameData.currentPlayer;
    if (gameData.dice) dice = Array.isArray(gameData.dice) ? [...gameData.dice] : [];
    if (typeof gameData.diceRolled !== 'undefined') diceRolled = gameData.diceRolled;
    
    if (gameData.whiteBar) whiteBar = Array.isArray(gameData.whiteBar) ? [...gameData.whiteBar] : [];
    if (gameData.blackBar) blackBar = Array.isArray(gameData.blackBar) ? [...gameData.blackBar] : [];
    if (gameData.whiteBearOff) whiteBearOff = Array.isArray(gameData.whiteBearOff) ? [...gameData.whiteBearOff] : [];
    if (gameData.blackBearOff) blackBearOff = Array.isArray(gameData.blackBearOff) ? [...gameData.blackBearOff] : [];
    
    // Update UI
    if (typeof updatePlayerInfo === 'function') {
      console.log(`UPDATE #${saveNumber}: Updating player info UI`);
      updatePlayerInfo();
    }
    
    if (typeof updateDiceDisplay === 'function') {
      console.log(`UPDATE #${saveNumber}: Updating dice display UI`);
      updateDiceDisplay();
    }
    
    if (typeof updateGameStatus === 'function') {
      console.log(`UPDATE #${saveNumber}: Updating game status UI`);
      updateGameStatus();
    }
    
    // Force redraw
    if (typeof redraw === 'function') {
      console.log(`UPDATE #${saveNumber}: Forcing board redraw`);
      redraw();
    }
    
    // Enable roll button if it's this player's turn
    if (playerRole === currentPlayer) {
      console.log(`UPDATE #${saveNumber}: It's now this player's turn, enabling roll button`);
      const rollButton = document.getElementById('roll-button');
      if (rollButton && !diceRolled) {
        rollButton.disabled = false;
      }
    }
    
    console.log(`UPDATE #${saveNumber}: Update processed successfully`);
  }
  catch (error) {
    console.error(`UPDATE #${saveNumber}: Error processing update:`, error);
  }
}

// Force game to start
function forceStartGame() {
  console.log("FORCE: Starting game");
  
  gameStarted = true;
  saveGameState();
}

// Define processFirebaseUpdate for compatibility with older code
function processFirebaseUpdate(gameData) {
  updateGameFromFirebase(gameData);
}

// Export functions
window.generateUniqueId = generateUniqueId;
window.saveGameState = saveGameState;
window.loadGameState = loadGameState;
window.listenForGameChanges = listenForGameChanges;
window.processFirebaseUpdate = processFirebaseUpdate;
window.forceStartGame = forceStartGame;
