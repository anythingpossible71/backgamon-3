// COMPLETE REWRITE - MINIMAL SOLUTION
// firebase-config.js - v4.0.0 MINIMAL

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

// Unique client ID - generated once per browser session
window.clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
console.log("MINIMAL: Client ID generated:", window.clientId);

// Generate a unique game ID
function generateUniqueId() {
  return Math.random().toString(36).substring(2, 9);
}

// Save game state to Firebase (SIMPLIFIED)
function saveGameState() {
  console.log("MINIMAL: Saving game state...");
  
  // Ensure we have a game ID
  if (!gameId) {
    console.error("No game ID, cannot save state");
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
      clientId: window.clientId
    };
    
    console.log("MINIMAL: Saving with client ID:", window.clientId);
    
    // Save to Firebase
    firebase.database().ref('games/' + gameId).set(gameData)
      .then(() => {
        console.log("MINIMAL: Game saved successfully");
      })
      .catch((error) => {
        console.error("MINIMAL: Error saving game:", error);
      });
  }
  catch (error) {
    console.error("MINIMAL: Error in saveGameState:", error);
  }
}

// Load game state initially
function loadGameState() {
  console.log("MINIMAL: Loading initial game state...");
  
  if (!gameId) {
    console.error("No game ID, cannot load state");
    return;
  }
  
  firebase.database().ref('games/' + gameId).once('value')
    .then((snapshot) => {
      const gameData = snapshot.val();
      if (!gameData) {
        console.log("No existing game data found");
        return;
      }
      
      console.log("MINIMAL: Initial game data loaded");
      updateGameFromFirebase(gameData);
    })
    .catch((error) => {
      console.error("MINIMAL: Error loading game:", error);
    });
}

// Listen for game changes
function listenForGameChanges(gameId) {
  console.log("MINIMAL: Setting up listener for game changes");
  
  if (!gameId) {
    console.error("No game ID, cannot listen for changes");
    return;
  }
  
  firebase.database().ref('games/' + gameId).on('value', (snapshot) => {
    const gameData = snapshot.val();
    
    if (!gameData) {
      console.log("MINIMAL: No game data in update");
      return;
    }
    
    // Process the update
    updateGameFromFirebase(gameData);
  });
  
  console.log("MINIMAL: Firebase listener established");
}

// Unified function to update game from Firebase
function updateGameFromFirebase(gameData) {
  console.log("MINIMAL: Processing update from Firebase");
  
  // MOST CRITICAL LINE: Skip updates from our own client
  if (gameData.clientId === window.clientId) {
    console.log("MINIMAL: IGNORING update from our own client:", window.clientId);
    return;
  }
  
  console.log("MINIMAL: Update from client:", gameData.clientId, "Our client:", window.clientId);
  
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
    
    // Update board state
    if (gameData.board) {
      board = JSON.parse(JSON.stringify(gameData.board));
    }
    
    // Update all other game state
    if (gameData.currentPlayer) currentPlayer = gameData.currentPlayer;
    if (gameData.dice) dice = Array.isArray(gameData.dice) ? [...gameData.dice] : [];
    if (typeof gameData.diceRolled !== 'undefined') diceRolled = gameData.diceRolled;
    
    if (gameData.whiteBar) whiteBar = Array.isArray(gameData.whiteBar) ? [...gameData.whiteBar] : [];
    if (gameData.blackBar) blackBar = Array.isArray(gameData.blackBar) ? [...gameData.blackBar] : [];
    if (gameData.whiteBearOff) whiteBearOff = Array.isArray(gameData.whiteBearOff) ? [...gameData.whiteBearOff] : [];
    if (gameData.blackBearOff) blackBearOff = Array.isArray(gameData.blackBearOff) ? [...gameData.blackBearOff] : [];
    
    // Update UI
    if (typeof updatePlayerInfo === 'function') updatePlayerInfo();
    if (typeof updateDiceDisplay === 'function') updateDiceDisplay();
    if (typeof updateGameStatus === 'function') updateGameStatus();
    
    // Force redraw
    if (typeof redraw === 'function') redraw();
    
    console.log("MINIMAL: Update processed successfully");
  }
  catch (error) {
    console.error("MINIMAL: Error processing update:", error);
  }
}

// Force game to start
function forceStartGame() {
  console.log("MINIMAL: Forcing game to start");
  
  gameStarted = true;
  saveGameState();
}

// Define processFirebaseUpdate for compatibility, but just redirect to our simplified function
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
