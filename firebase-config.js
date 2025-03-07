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

// Generate a unique game ID
function generateUniqueId() {
    return 'game_' + Math.random().toString(36).substr(2, 9);
}

// Function to prepare data for Firebase (preventing circular references)
function prepareGameDataForSaving(gameData) {
    try {
        // Create a deep copy without circular references
        const safeData = {};
        
        // Handle the board specially - convert to a simple format
        if (gameData.board) {
            safeData.board = [];
            for (let i = 0; i < gameData.board.length; i++) {
                const point = gameData.board[i] || [];
                safeData.board[i] = [];
                for (let j = 0; j < point.length; j++) {
                    // Only store the color of each checker
                    safeData.board[i].push({
                        color: point[j].color
                    });
                }
            }
        }
        
        // Copy other properties directly
        for (const key in gameData) {
            if (key !== 'board') {
                safeData[key] = gameData[key];
            }
        }
        
        return safeData;
    } catch (error) {
        console.error("Error preparing game data for saving:", error);
        return {};
    }
}

// Save game state to Firebase
function saveGameState() {
    console.log("Saving game state to Firebase");
    
    if (!gameId) {
        console.error("No game ID, cannot save state");
        return;
    }
    
    try {
        // CRITICAL: Use the locked board state if it exists and is locked
        let boardToSave = board;
        let whiteBarToSave = whiteBar;
        let blackBarToSave = blackBar;
        let whiteBearOffToSave = whiteBearOff;
        let blackBearOffToSave = blackBearOff;
        let diceToSave = dice;
        let diceRolledToSave = diceRolled;
        let currentPlayerToSave = currentPlayer;
        
        if (typeof window.isMoveLocked !== 'undefined' && 
            window.isMoveLocked && 
            window.lockedBoardState) {
            console.log("CRITICAL: Using locked board state for saving");
            boardToSave = window.lockedBoardState.board;
            whiteBarToSave = window.lockedBoardState.whiteBar;
            blackBarToSave = window.lockedBoardState.blackBar;
            whiteBearOffToSave = window.lockedBoardState.whiteBearOff;
            blackBearOffToSave = window.lockedBoardState.blackBearOff;
            diceToSave = window.lockedBoardState.dice;
            diceRolledToSave = window.lockedBoardState.diceRolled;
            currentPlayerToSave = window.lockedBoardState.currentPlayer;
        }
        
        // Create a clean game state object with deep copies
        const gameData = {
            board: JSON.parse(JSON.stringify(boardToSave)),
            whiteBar: [...whiteBarToSave],
            blackBar: [...blackBarToSave],
            whiteBearOff: [...whiteBearOffToSave],
            blackBearOff: [...blackBearOffToSave],
            currentPlayer: currentPlayerToSave,
            dice: [...diceToSave],
            diceRolled: diceRolledToSave,
            gameStatus: gameStatus,
            player1Name: player1Name,
            player2Name: player2Name,
            gameStarted: gameStarted,
            timestamp: Date.now(),
            lastPlayerMoved: playerRole // Add this to track which player made the last move
        };
        
        console.log("Saving data to Firebase:", gameData);
        
        // Use set instead of update to ensure complete data replacement
        firebase.database().ref('games/' + gameId).set(gameData)
            .then(() => {
                console.log("Game state saved successfully");
            })
            .catch((error) => {
                console.error("Error saving game state:", error);
            });
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
            
            // Get current time for comparison
            const currentTime = Date.now();
            
            // Check if this update is worth processing
            const isNewerVersion = gameData.version > gameStateVersion;
            const isNewerTimestamp = gameData.timestamp > localGameTimestamp;
            const hasEnoughTimePassed = currentTime - lastUpdateTime > UPDATE_BACKOFF_TIME;
            
            // Log update information for debugging
            console.log("Received Firebase update:", { 
                serverVersion: gameData.version, 
                localVersion: gameStateVersion,
                serverTimestamp: gameData.timestamp,
                localTimestamp: localGameTimestamp,
                timeSinceLastUpdate: currentTime - lastUpdateTime
            });
            
            // Only process update if it's newer or enough time has passed
            if ((isNewerVersion || isNewerTimestamp) && hasEnoughTimePassed) {
                console.log("Processing Firebase update");
                
                // Update our tracking variables
                lastUpdateTime = currentTime;
                if (gameData.version) gameStateVersion = gameData.version;
                if (gameData.timestamp) localGameTimestamp = gameData.timestamp;
                
                // Process the update
                processFirebaseUpdate(gameData);
            } else {
                console.log("Ignoring Firebase update (not newer or too frequent)");
            }
        } catch (error) {
            console.error("Error in Firebase listener:", error);
        }
    });
    
    console.log("Firebase listener established");
}

// Process a Firebase update safely
function processFirebaseUpdate(gameData) {
    console.log("CRITICAL: Processing Firebase update with data:", gameData);
    
    // CRITICAL: If moves are locked, check if we should block this update
    if (typeof window.isMoveLocked !== 'undefined' && window.isMoveLocked) {
        console.log("WARNING: Received Firebase update while moves are locked");
        
        // If this player made the move, we should ignore incoming board updates
        // But still update player names and other non-board state
        if (playerRole === currentPlayer) {
            console.log("BLOCKING board update because this player has a locked move");
            
            // We'll only update player names and game status, not the board
            if (gameData.player1Name) {
                player1Name = gameData.player1Name;
                document.getElementById('player1-name').textContent = player1Name;
            }
            
            if (gameData.player2Name) {
                player2Name = gameData.player2Name;
                document.getElementById('player2-name').textContent = player2Name;
            }
            
            // Make sure locked state is saved back to Firebase
            setTimeout(() => {
                if (typeof saveGameState === 'function') {
                    console.log("SAVING locked state back to Firebase");
                    saveGameState();
                }
            }, 100);
            
            return;
        }
    }
    
    try {
        // CRITICAL: Always update player info first
        if (gameData.player1Name && gameData.player1Name !== "Player 1") {
            console.log("Setting Player 1 name to:", gameData.player1Name);
            player1Name = gameData.player1Name;
            document.getElementById('player1-name').textContent = player1Name;
        }
        
        if (gameData.player2Name && gameData.player2Name !== "Player 2") {
            console.log("Setting Player 2 name to:", gameData.player2Name);
            player2Name = gameData.player2Name;
            document.getElementById('player2-name').textContent = player2Name;
        }
        
        // Update other game state
        if (gameData.gameStarted) {
            console.log("Setting game started");
            gameStarted = true;
        }
        
        // Make sure game board is visible
        if (player1Name !== "Player 1" && player2Name !== "Player 2") {
            console.log("Both players present, ensuring board visibility");
            document.getElementById('game-controls').classList.remove('hidden');
            
            // CRITICAL: For Player 1, keep the waiting message visible
            if (playerRole === "player1") {
                document.getElementById('player-join').classList.remove('hidden');
                document.getElementById('waiting-message').classList.remove('hidden');
            } else {
                // Only hide for Player 2
                document.getElementById('player-join').classList.add('hidden');
            }
        }

        // CRITICAL: Force updating game state for other player's moves
        // Player 2 needs to see Player 1's moves and vice versa
        if ((playerRole === "player2" && gameData.currentPlayer === "player1") ||
            (playerRole === "player1" && gameData.currentPlayer === "player2")) {
            console.log("IMPORTANT: Accepting board update from other player");
            
            // Always update dice for other player's turn
            if (gameData.dice) {
                console.log("Setting dice to:", gameData.dice);
                dice = Array.isArray(gameData.dice) ? [...gameData.dice] : [];
            }
            
            if (typeof gameData.diceRolled !== 'undefined') {
                console.log("Setting diceRolled to:", gameData.diceRolled);
                diceRolled = gameData.diceRolled;
            }
        }
        
        // Update board state
        if (gameData.board) {
            console.log("Updating board data");
            // Deep copy to prevent reference issues
            board = JSON.parse(JSON.stringify(gameData.board));
        }
        
        if (gameData.currentPlayer) {
            console.log("Setting current player to:", gameData.currentPlayer);
            currentPlayer = gameData.currentPlayer;
        }
        
        if (gameData.gameStatus) {
            console.log("Setting game status to:", gameData.gameStatus);
            gameStatus = gameData.gameStatus;
        }
        
        if (gameData.whiteBar) whiteBar = Array.isArray(gameData.whiteBar) ? [...gameData.whiteBar] : [];
        if (gameData.blackBar) blackBar = Array.isArray(gameData.blackBar) ? [...gameData.blackBar] : [];
        if (gameData.whiteBearOff) whiteBearOff = Array.isArray(gameData.whiteBearOff) ? [...gameData.whiteBearOff] : [];
        if (gameData.blackBearOff) blackBearOff = Array.isArray(gameData.blackBearOff) ? [...gameData.blackBearOff] : [];

        // ALWAYS force UI updates
        if (typeof updatePlayerInfo === 'function') {
            console.log("Forcing player info update");
            updatePlayerInfo();
        }
        
        if (typeof updateDiceDisplay === 'function') {
            console.log("Forcing dice display update");
            updateDiceDisplay();
        }
        
        if (typeof updateGameStatus === 'function') {
            console.log("Forcing game status update");
            updateGameStatus();
        }
        
        // CRITICAL: Force a redraw to update the board
        if (typeof redraw === 'function') {
            console.log("Forcing board redraw");
            redraw();
        }
        
        // Check for game start condition
        if (player1Name !== "Player 1" && player2Name !== "Player 2") {
            console.log("Both players joined, game can start");
            gameStarted = true;
            
            // Update roll button for player 1
            if (currentPlayer === "player1" && playerRole === "player1") {
                console.log("Enabling roll button for Player 1");
                const rollButton = document.getElementById('roll-button');
                if (rollButton) rollButton.disabled = false;
            }
        }
        
        console.log("Firebase update processed successfully");
    } catch (error) {
        console.error("Error processing Firebase update:", error);
    }
}

// Force game to start when both players have joined
function forceStartGame() {
    console.log("Force starting the game with players:", player1Name, player2Name);
    
    // Ensure we have a board
    if (!board || board.length === 0) {
        if (typeof initializeBoard === 'function') {
            initializeBoard();
        }
    }
    
    // Set game state
    gameStarted = true;
    currentPlayer = 'player1';
    
    // Update UI
    document.getElementById('player-join').classList.add('hidden');
    document.getElementById('waiting-message').classList.add('hidden');
    document.getElementById('game-controls').classList.remove('hidden');
    
    // Update game status
    gameStatus = player1Name + "'s turn to roll";
    
    // Enable roll button for player 1
    if (currentPlayer === 'player1' && playerRole === 'player1') {
        const rollButton = document.getElementById('roll-button');
        if (rollButton) rollButton.disabled = false;
    }
    
    // Save the state immediately
    saveGameState();
    
    console.log("Game forcefully started");
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
