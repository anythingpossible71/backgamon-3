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
const MOVE_LOCK_DURATION = 10000; // 10 seconds lock after a move

// Track the last player who made a move
let lastMoveBy = null;
let lastMoveTime = 0;
let processingUpdateCount = 0;

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
function saveGameState(forceUpdate = false) {
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
            lastPlayerMoved: playerRole,
            version: gameStateVersion,
            lastUpdateBy: lastMoveBy
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
        
        if (forceUpdate) {
            console.log("Force update completed, resetting game state");
            gameStarted = false;
            currentPlayer = null;
            dice = [];
            diceRolled = false;
            gameStatus = null;
            player1Name = "Player 1";
            player2Name = "Player 2";
            board = [];
            whiteBar = [];
            blackBar = [];
            whiteBearOff = [];
            blackBearOff = [];
            gameStateVersion = 0;
            localGameTimestamp = 0;
            lastMoveBy = null;
            lastMoveTime = 0;
            processingUpdateCount = 0;
            pendingUpdate = null;
            window.isProcessingUpdate = false;
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
    // CRITICAL: Prevent concurrent updates
    if (window.isProcessingUpdate) {
        console.log("BLOCKED: Already processing an update, queueing this one");
        pendingUpdate = gameData;
        return;
    }
    
    // Set processing flag with safety timeout
    window.isProcessingUpdate = true;
    processingUpdateCount++;
    const currentUpdateCount = processingUpdateCount;
    
    // Safety timeout to release lock if something goes wrong
    setTimeout(() => {
        if (window.isProcessingUpdate && currentUpdateCount === processingUpdateCount) {
            console.log("WARNING: Forcing release of update lock after timeout");
            window.isProcessingUpdate = false;
            
            // Process any pending updates
            if (pendingUpdate) {
                const update = pendingUpdate;
                pendingUpdate = null;
                setTimeout(() => processFirebaseUpdate(update), 100);
            }
        }
    }, 5000);
    
    try {
        console.log("PROCESSING UPDATE:", {
            clientIP: window.clientIP || "unknown",
            playerRole: playerRole,
            currentPlayer: currentPlayer,
            updateFrom: gameData.lastUpdateBy || "unknown",
            serverVersion: gameData.version,
            localVersion: gameStateVersion,
            isMoveLocked: window.isMoveLocked || false,
            timeSinceLastMove: Date.now() - lastMoveTime
        });
        
        // CRITICAL: Store current state before any updates
        const previousState = {
            board: JSON.parse(JSON.stringify(board)),
            whiteBar: [...whiteBar],
            blackBar: [...blackBar],
            whiteBearOff: [...whiteBearOff],
            blackBearOff: [...blackBearOff],
            dice: [...dice],
            diceRolled: diceRolled,
            currentPlayer: currentPlayer
        };
        
        // CRITICAL: Check if we should reject this update
        const isFromOtherPlayer = gameData.lastUpdateBy && gameData.lastUpdateBy !== playerRole;
        const isForceUpdate = gameData.forceUpdate === true;
        const isOlderVersion = gameData.version < gameStateVersion;
        const isMoveLocked = window.isMoveLocked === true;
        
        // CRITICAL: Always update player names and game status
        if (gameData.player1Name) {
            player1Name = gameData.player1Name;
            document.getElementById('player1-name').textContent = player1Name;
        }
        
        if (gameData.player2Name) {
            player2Name = gameData.player2Name;
            document.getElementById('player2-name').textContent = player2Name;
        }
        
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
        
        // CRITICAL: Decide if we should update the board state
        let shouldUpdateBoard = true;
        
        // Don't update if we have a locked move and this is our turn
        if (isMoveLocked && playerRole === currentPlayer && !isForceUpdate) {
            console.log("BLOCKED: Not updating board because moves are locked and it's our turn");
            shouldUpdateBoard = false;
        }
        
        // Don't update if this is an older version (unless forced)
        if (isOlderVersion && !isForceUpdate) {
            console.log("BLOCKED: Not updating board because this is an older version");
            shouldUpdateBoard = false;
        }
        
        // CRITICAL: Special case - always accept dice rolls from the other player
        const isOtherPlayerRoll = isFromOtherPlayer && 
                                 gameData.dice && 
                                 gameData.dice.length > 0 && 
                                 gameData.diceRolled === true;
        
        if (isOtherPlayerRoll) {
            console.log("ACCEPTING: Dice roll from other player");
            dice = Array.isArray(gameData.dice) ? [...gameData.dice] : [];
            diceRolled = gameData.diceRolled;
            shouldUpdateBoard = true;
        }
        
        // Update board state if we decided to
        if (shouldUpdateBoard) {
            console.log("Updating board state");
            
            // Update board
            if (gameData.board) {
                board = JSON.parse(JSON.stringify(gameData.board));
            }
            
            // Update other game state
            if (gameData.currentPlayer) currentPlayer = gameData.currentPlayer;
            if (gameData.gameStatus) gameStatus = gameData.gameStatus;
            if (gameData.dice) dice = Array.isArray(gameData.dice) ? [...gameData.dice] : [];
            if (typeof gameData.diceRolled !== 'undefined') diceRolled = gameData.diceRolled;
            if (gameData.whiteBar) whiteBar = Array.isArray(gameData.whiteBar) ? [...gameData.whiteBar] : [];
            if (gameData.blackBar) blackBar = Array.isArray(gameData.blackBar) ? [...gameData.blackBar] : [];
            if (gameData.whiteBearOff) whiteBearOff = Array.isArray(gameData.whiteBearOff) ? [...gameData.whiteBearOff] : [];
            if (gameData.blackBearOff) blackBearOff = Array.isArray(gameData.blackBearOff) ? [...gameData.blackBearOff] : [];
            
            // Update version tracking
            if (gameData.version) gameStateVersion = gameData.version;
            if (gameData.timestamp) localGameTimestamp = gameData.timestamp;
            if (gameData.lastUpdateBy) lastMoveBy = gameData.lastUpdateBy;
        } else {
            // If we didn't update the board, force our state back to Firebase
            setTimeout(() => {
                if (typeof saveGameState === 'function') {
                    console.log("FORCE SAVING our state back to Firebase");
                    saveGameState(true); // Force update
                }
            }, 500);
        }
        
        // ALWAYS force UI updates
        if (typeof updatePlayerInfo === 'function') updatePlayerInfo();
        if (typeof updateDiceDisplay === 'function') updateDiceDisplay();
        if (typeof updateGameStatus === 'function') updateGameStatus();
        
        // CRITICAL: Force a redraw to update the board
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
        
        // CRITICAL: Check if the board state has reverted after update
        if (window.lockedBoardState && shouldUpdateBoard) {
            setTimeout(() => {
                const currentBoardJSON = JSON.stringify(board);
                const lockedBoardJSON = JSON.stringify(window.lockedBoardState.board);
                
                // If we're the current player and our locked state doesn't match current state
                if (playerRole === currentPlayer && 
                    currentBoardJSON !== lockedBoardJSON && 
                    window.isMoveLocked) {
                    
                    console.log("CRITICAL: Board state reverted after update, restoring locked state");
                    
                    // Restore from locked state
                    board = JSON.parse(JSON.stringify(window.lockedBoardState.board));
                    whiteBar = [...window.lockedBoardState.whiteBar];
                    blackBar = [...window.lockedBoardState.blackBar];
                    whiteBearOff = [...window.lockedBoardState.whiteBearOff];
                    blackBearOff = [...window.lockedBoardState.blackBearOff];
                    dice = [...window.lockedBoardState.dice];
                    diceRolled = window.lockedBoardState.diceRolled;
                    currentPlayer = window.lockedBoardState.currentPlayer;
                    
                    // Force redraw
                    if (typeof redraw === 'function') redraw();
                    
                    // Force save our state back to Firebase
                    setTimeout(() => {
                        if (typeof saveGameState === 'function') {
                            console.log("FORCE SAVING restored state to Firebase");
                            saveGameState(true); // Force update
                        }
                    }, 100);
                }
            }, 200);
        }
        
        console.log("Firebase update processed successfully");
    } catch (error) {
        console.error("Error processing Firebase update:", error);
    } finally {
        // Always release the processing lock
        window.isProcessingUpdate = false;
        
        // Process any pending updates
        if (pendingUpdate) {
            const update = pendingUpdate;
            pendingUpdate = null;
            setTimeout(() => processFirebaseUpdate(update), 100);
        }
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
