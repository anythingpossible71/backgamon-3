// firebase-config.js - Complete implementation
// This file handles Firebase database connection and game state synchronization

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

// Generate a unique client ID for this browser session
window.clientId = generateUniqueClientId();
console.log("Generated unique client ID:", window.clientId);

// Variables to prevent Firebase update loops
let isCurrentlyUpdating = false;
let pendingUpdate = null;
let gameStateVersion = 0;
let localGameTimestamp = 0;
let lastUpdateTime = 0;

// Constants for Firebase operations
const UPDATE_TIMEOUT = 5000; // Force release update lock after 5 seconds
const UPDATE_BACKOFF_TIME = 2000; // Wait 2 seconds before accepting further updates
const SAVE_THROTTLE = 3000; // Minimum time between saves
const MOVE_LOCK_DURATION = 10000; // 10 seconds lock after a move

// Track the last player who made a move
let lastMoveBy = null;
let lastMoveTime = 0;
let processingUpdateCount = 0;

// Generate a unique client ID for this browser session
function generateUniqueClientId() {
    return 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Initialize Firebase connection
function initializeFirebase() {
    try {
        console.log("Initializing Firebase connection");
        
        // Check if Firebase is already initialized
        if (firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
            console.log("Firebase initialized successfully");
        } else {
            console.log("Firebase already initialized");
        }
        
        return firebase.database();
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        return null;
    }
}

// Generate a unique ID for a new game
function generateUniqueId() {
    return Math.random().toString(36).substr(2, 9);
}

// Prepare game data for saving to Firebase
function prepareGameDataForSaving(gameData) {
    try {
        if (!gameData) gameData = {};
        
        // Create a copy of the board state to avoid modifying the original
        if (board) {
            gameData.board = [];
            
            // Copy board state
            for (let i = 0; i < board.length; i++) {
                if (!gameData.board[i]) gameData.board[i] = [];
                
                if (board[i] && board[i].length > 0) {
                    gameData.board[i] = [];
                    for (let j = 0; j < board[i].length; j++) {
                        if (board[i][j]) {
                            gameData.board[i].push({
                                color: board[i][j].color
                            });
                        }
                    }
                }
            }
        }
        
        // Copy other game state
        gameData.player1Name = player1Name;
        gameData.player2Name = player2Name;
        gameData.currentPlayer = currentPlayer;
        gameData.dice = dice ? [...dice] : [];
        gameData.diceRolled = diceRolled;
        gameData.gameStatus = gameStatus;
        gameData.whiteBar = whiteBar ? [...whiteBar] : [];
        gameData.blackBar = blackBar ? [...blackBar] : [];
        gameData.whiteBearOff = whiteBearOff ? [...whiteBearOff] : [];
        gameData.blackBearOff = blackBearOff ? [...blackBearOff] : [];
        
        return gameData;
    } catch (error) {
        console.error("Error preparing game data:", error);
        return null;
    }
}

// Save game state to Firebase
function saveGameState(forceUpdate = false) {
    console.log("Saving game state to Firebase");
    
    try {
        // Initialize Firebase if not already done
        const database = initializeFirebase();
        if (!database) return;
        
        // Make sure we have a game ID
        if (!gameId) {
            console.error("No game ID found, cannot save state");
            return;
        }
        
        // Prepare game data
        let gameData = {};
        
        // Increment version number
        gameStateVersion++;
        
        // Add complete game data
        gameData = prepareGameDataForSaving(gameData);
        
        if (gameData) {
            // Add metadata
            gameData.gameId = gameId;
            gameData.gameStarted = gameStarted;
            gameData.timestamp = Date.now();
            gameData.lastPlayerMoved = playerRole;
            gameData.version = gameStateVersion;
            gameData.forceUpdate = forceUpdate === true;

            // CRITICAL: Add client ID to identify the origin of this update
            gameData.originClientId = window.clientId;
            
            // Save to Firebase
            firebase.database().ref('games/' + gameId).set(gameData)
                .then(() => {
                    console.log("Game state saved successfully");
                    // Update local timestamp
                    localGameTimestamp = gameData.timestamp;
                })
                .catch((error) => {
                    console.error("Error saving game state:", error);
                });
        }
    } catch (error) {
        console.error("Error preparing game state for saving:", error);
    }
}

// Load existing game state from Firebase
function loadGameState() {
    console.log("Loading game state for game:", gameId);
    
    if (!gameId) {
        console.log("No game ID, cannot load state");
        return;
    }
    
    // Initialize Firebase if not already done
    const database = initializeFirebase();
    if (!database) return;
    
    firebase.database().ref('games/' + gameId).once('value')
        .then((snapshot) => {
            const gameData = snapshot.val();
            if (!gameData) {
                console.log("No game data found for ID:", gameId);
                return;
            }
            
            console.log("Loaded initial game data");
            
            // Store the version and timestamp
            if (gameData.version) gameStateVersion = gameData.version;
            if (gameData.timestamp) localGameTimestamp = gameData.timestamp;
            
            // Process the update safely
            processFirebaseUpdate(gameData);
        })
        .catch((error) => {
            console.error("Error loading game state:", error);
        });
}

// Listen for game state changes with loop prevention
function listenForGameChanges(gameId) {
    console.log("Setting up listener for game changes:", gameId);
    
    if (!gameId) {
        console.log("No game ID, cannot listen for changes");
        return;
    }
    
    // Initialize Firebase if not already done
    const database = initializeFirebase();
    if (!database) return;
    
    firebase.database().ref('games/' + gameId).on('value', (snapshot) => {
        try {
            const gameData = snapshot.val();
            if (!gameData) {
                console.log("No game data found for ID:", gameId);
                return;
            }
            
            // Process the update
            processFirebaseUpdate(gameData);
            
        } catch (error) {
            console.error("Error in Firebase listener:", error);
        }
    });
    
    console.log("Firebase listener established");
}

// Process a Firebase update safely - COMPLETELY REDESIGNED
function processFirebaseUpdate(gameData) {
    console.log("===== FIREBASE UPDATE RECEIVED =====");
    
    // CRITICAL: Check if this update originated from this client
    if (gameData.originClientId === window.clientId) {
        console.log("IGNORING UPDATE: This update originated from this client");
        return; // Don't process our own updates coming back to us
    }
    
    console.log("Processing update from client:", gameData.originClientId);
    
    // Simple critical section to prevent concurrent updates
    if (isCurrentlyUpdating) {
        console.log("Already processing an update, will queue this one");
        pendingUpdate = gameData;
        return;
    }
    
    isCurrentlyUpdating = true;
    
    try {
        // Log key info about this update
        console.log("Update info:", {
            from: gameData.lastPlayerMoved,
            clientRole: playerRole,
            moveTime: new Date(gameData.timestamp).toLocaleTimeString(),
            version: gameData.version
        });
        
        // Always update player names
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
        
        // Make sure game board is visible
        if (player1Name !== "Player 1" && player2Name !== "Player 2") {
            document.getElementById('game-controls').classList.remove('hidden');
            
            if (playerRole === "player1") {
                document.getElementById('player-join').classList.remove('hidden');
                document.getElementById('waiting-message').classList.remove('hidden');
            } else {
                document.getElementById('player-join').classList.add('hidden');
            }
        }
        
        // Update game state
        if (gameData.board) {
            // Deep copy the board
            board = JSON.parse(JSON.stringify(gameData.board));
        }
        
        if (gameData.currentPlayer) {
            currentPlayer = gameData.currentPlayer;
        }
        
        if (gameData.dice) {
            dice = Array.isArray(gameData.dice) ? [...gameData.dice] : [];
        }
        
        if (typeof gameData.diceRolled !== 'undefined') {
            diceRolled = gameData.diceRolled;
        }
        
        if (gameData.gameStatus) {
            gameStatus = gameData.gameStatus;
        }
        
        if (gameData.whiteBar) whiteBar = Array.isArray(gameData.whiteBar) ? [...gameData.whiteBar] : [];
        if (gameData.blackBar) blackBar = Array.isArray(gameData.blackBar) ? [...gameData.blackBar] : [];
        if (gameData.whiteBearOff) whiteBearOff = Array.isArray(gameData.whiteBearOff) ? [...gameData.whiteBearOff] : [];
        if (gameData.blackBearOff) blackBearOff = Array.isArray(gameData.blackBearOff) ? [...gameData.blackBearOff] : [];
        
        // Store metadata
        if (gameData.version && gameData.version > gameStateVersion) {
            gameStateVersion = gameData.version;
        }
        
        if (gameData.timestamp && gameData.timestamp > localGameTimestamp) {
            localGameTimestamp = gameData.timestamp;
        }
        
        // Update UI
        if (typeof updatePlayerInfo === 'function') updatePlayerInfo();
        if (typeof updateDiceDisplay === 'function') updateDiceDisplay();
        if (typeof updateGameStatus === 'function') updateGameStatus();
        
        // Force redraw
        if (typeof redraw === 'function') redraw();
        
        // Check for game start condition
        if (player1Name !== "Player 1" && player2Name !== "Player 2") {
            gameStarted = true;
            
            // Update roll button for player 1
            if (currentPlayer === "player1" && playerRole === "player1") {
                const rollButton = document.getElementById('roll-button');
                if (rollButton) rollButton.disabled = false;
            }
        }
        
        console.log("Firebase update processed successfully");
        
    } catch (error) {
        console.error("Error processing Firebase update:", error);
    } finally {
        // Always release the critical section
        isCurrentlyUpdating = false;
        
        // Process any pending updates
        if (pendingUpdate) {
            const nextUpdate = pendingUpdate;
            pendingUpdate = null;
            setTimeout(() => {
                processFirebaseUpdate(nextUpdate);
            }, 100);
        }
    }
}

// Force the game to start
function forceStartGame() {
    console.log("Forcing game to start");
    
    gameStarted = true;
    if (typeof saveGameState === 'function') {
        saveGameState();
    }
}

// Make these functions globally accessible
window.generateUniqueId = generateUniqueId;
window.prepareGameDataForSaving = prepareGameDataForSaving;
window.saveGameState = saveGameState;
window.loadGameState = loadGameState;
window.listenForGameChanges = listenForGameChanges;
window.processFirebaseUpdate = processFirebaseUpdate;
window.forceStartGame = forceStartGame;
window.initializeFirebase = initializeFirebase;

// Initialize Firebase when the script loads
initializeFirebase();

console.log("Firebase configuration loaded successfully");
