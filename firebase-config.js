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

// Save game state to Firebase with throttling
function saveGameState() {
    const now = Date.now();
    
    // Check if we're trying to save too frequently
    if (now - lastUpdateTime < SAVE_THROTTLE) {
        console.log("Throttling Firebase update (too frequent)");
        return;
    }
    
    lastUpdateTime = now;
    
    if (!gameId) {
        console.log("No game ID, cannot save state");
        return;
    }
    
    // Skip saving if already updating from Firebase
    if (isCurrentlyUpdating) {
        console.log("Currently updating from Firebase, save skipped");
        return;
    }
    
    try {
        console.log("Saving game state for game:", gameId);
        
        // Increment version number for this update
        gameStateVersion++;
        
        const gameData = {
            board: board,
            whiteBar: whiteBar,
            blackBar: blackBar,
            whiteBearOff: whiteBearOff,
            blackBearOff: blackBearOff,
            currentPlayer: currentPlayer,
            dice: dice,
            diceRolled: diceRolled,
            gameStatus: gameStatus,
            player1Name: player1Name,
            player2Name: player2Name,
            gameStarted: gameStarted,
            version: gameStateVersion,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        // Use the serializer to prepare safe data
        const safeData = prepareGameDataForSaving(gameData);
        
        // Update local timestamp expectation
        localGameTimestamp = now;
        
        console.log("Saving data to Firebase");
        
        firebase.database().ref('games/' + gameId).update(safeData)
            .then(() => {
                console.log("Game state saved successfully, version:", gameStateVersion);
            })
            .catch((error) => {
                console.error("Error saving game state:", error);
                // Decrement version on failure
                gameStateVersion--;
            });
    } catch (error) {
        console.error("Error preparing game state for saving:", error);
        // Decrement version on failure
        gameStateVersion--;
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

// Process a Firebase update safely with lock prevention
function processFirebaseUpdate(gameData) {
    console.log("Processing Firebase update with data:", gameData);
    
    try {
        // CRITICAL: Always update player names and game state
        if (gameData.player1Name) {
            player1Name = gameData.player1Name;
            document.getElementById('player1-name').textContent = player1Name;
        }
        if (gameData.player2Name) {
            player2Name = gameData.player2Name;
            document.getElementById('player2-name').textContent = player2Name;
        }
        
        // Update game started state
        if (gameData.gameStarted) {
            gameStarted = true;
            // Show game controls when game is started
            document.getElementById('game-controls').classList.remove('hidden');
            document.getElementById('player-join').classList.add('hidden');
        }

        // CRITICAL: Always accept game state updates
        if (gameData.board) {
            console.log("Updating board state");
            board = JSON.parse(JSON.stringify(gameData.board)); // Deep copy
        }
        if (gameData.currentPlayer) {
            console.log("Updating current player to:", gameData.currentPlayer);
            currentPlayer = gameData.currentPlayer;
        }
        if (gameData.dice) {
            console.log("Updating dice to:", gameData.dice);
            dice = [...gameData.dice];
        }
        if (gameData.diceRolled !== undefined) {
            console.log("Updating diceRolled to:", gameData.diceRolled);
            diceRolled = gameData.diceRolled;
        }
        if (gameData.gameStatus) {
            console.log("Updating game status to:", gameData.gameStatus);
            gameStatus = gameData.gameStatus;
        }
        if (gameData.whiteBar) whiteBar = [...gameData.whiteBar];
        if (gameData.blackBar) blackBar = [...gameData.blackBar];
        if (gameData.whiteBearOff) whiteBearOff = [...gameData.whiteBearOff];
        if (gameData.blackBearOff) blackBearOff = [...gameData.blackBearOff];

        // Force UI update
        if (typeof updatePlayerInfo === 'function') updatePlayerInfo();
        if (typeof updateDiceDisplay === 'function') updateDiceDisplay();
        if (typeof updateGameStatus === 'function') updateGameStatus();
        
        // Force redraw of the board
        if (typeof redraw === 'function') redraw();
        
        // Check if both players have joined and start game if needed
        if (player1Name !== "Player 1" && player2Name !== "Player 2") {
            if (typeof forceStartGame === 'function') {
                forceStartGame();
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
