// firebase-config.js - Complete implementation
// This file handles Firebase database connection and game state synchronization
// Last updated: Test update for timestamp tracking

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

// Add update queue system
let updateQueue = [];
let isProcessingQueue = false;

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
    try {
        // Critical log to help with debugging
        console.log("SAVE STATE: Saving game state to Firebase", {
            forceUpdate: window.forcePlayerOneUpdate === true,
            debugClicked: window.debugButtonClicked === true,
            gameId: window.gameId,
            playerRole: window.playerRole,
            gameStateVersion: window.gameStateVersion || 0
        });
        
        // Don't save if Firebase isn't initialized or no game ID
        if (!firebase.database || !window.gameId) {
            console.error("SAVE ERROR: Firebase not initialized or no game ID");
            return false;
        }
        
        // NETWORK FIX: Check if we should use local storage instead
        const useLocalStorage = typeof window.shouldUseLocalStorage === 'function' && window.shouldUseLocalStorage();
        
        // NETWORK FIX: If we're using local storage, save to it first
        if (useLocalStorage && typeof window.saveStateToLocalStorage === 'function') {
            window.saveStateToLocalStorage();
        }
        
        // Create deep copies of all game state variables to avoid reference issues
        const boardCopy = [];
        if (Array.isArray(window.board)) {
            for (let i = 0; i < window.board.length; i++) {
                boardCopy[i] = [];
                if (Array.isArray(window.board[i])) {
                    for (let j = 0; j < window.board[i].length; j++) {
                        if (window.board[i][j] && window.board[i][j].color) {
                            boardCopy[i][j] = { color: window.board[i][j].color };
                        }
                    }
                }
            }
        }
        
        // Deep copy other arrays
        const whiteBarCopy = Array.isArray(window.whiteBar) ? 
            window.whiteBar.map(checker => ({ color: checker.color })) : [];
            
        const blackBarCopy = Array.isArray(window.blackBar) ? 
            window.blackBar.map(checker => ({ color: checker.color })) : [];
            
        const whiteBearOffCopy = Array.isArray(window.whiteBearOff) ? 
            window.whiteBearOff.map(checker => ({ color: checker.color })) : [];
            
        const blackBearOffCopy = Array.isArray(window.blackBearOff) ? 
            window.blackBearOff.map(checker => ({ color: checker.color })) : [];
            
        const diceCopy = Array.isArray(window.dice) ? [...window.dice] : [];
        
        // NETWORK FIX: Increment game state version
        if (typeof window.gameStateVersion === 'undefined') {
            window.gameStateVersion = 1;
        } else {
            window.gameStateVersion++;
        }
        
        // Prepare game data with deep copies
        const gameData = {
            board: boardCopy,
            whiteBar: whiteBarCopy,
            blackBar: blackBarCopy,
            whiteBearOff: whiteBearOffCopy,
            blackBearOff: blackBearOffCopy,
            currentPlayer: window.currentPlayer,
            dice: diceCopy,
            diceRolled: window.diceRolled === true,
            gameStatus: window.gameStatus,
            player1Name: window.player1Name,
            player2Name: window.player2Name,
            gameStarted: window.gameStarted === true,
            lastMoveBy: window.playerRole,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            gameStateVersion: window.gameStateVersion,
            forceUpdate: window.forcePlayerOneUpdate === true,
            debugButtonClicked: window.debugButtonClicked === true
        };
        
        // Save to Firebase with error handling
        return firebase.database().ref('games/' + window.gameId).update(gameData)
            .then(() => {
                console.log("SAVE SUCCESS: Game state saved to Firebase", { version: gameData.gameStateVersion });
                
                // Clear flags ONLY after successful save
                if (window.forcePlayerOneUpdate === true) {
                    console.log("SAVE: Clearing force update flag");
                    window.forcePlayerOneUpdate = false;
                }
                
                if (window.debugButtonClicked === true) {
                    console.log("SAVE: Clearing debug button flag");
                    window.debugButtonClicked = false;
                }
                
                return true;
            })
            .catch(error => {
                console.error("SAVE ERROR: Failed to save game state", error);
                
                // NETWORK FIX: If Firebase save fails, at least we have local storage
                if (useLocalStorage && typeof window.saveStateToLocalStorage === 'function') {
                    console.log("SAVE ERROR: Falling back to local storage");
                    window.saveStateToLocalStorage();
                }
                
                return false;
            });
    } catch (error) {
        console.error("SAVE ERROR: Exception in saveGameState", error);
        return false;
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

// Modified listenForGameChanges function
function listenForGameChanges(gameId) {
    console.log("Setting up listener for game changes:", gameId);
    
    if (!gameId) {
        console.log("No game ID, cannot listen for changes");
        return;
    }
    
    const database = initializeFirebase();
    if (!database) return;
    
    firebase.database().ref('games/' + gameId).on('value', (snapshot) => {
        try {
            const gameData = snapshot.val();
            if (!gameData) {
                console.log("No game data found for ID:", gameId);
                return;
            }
            
            // Add update to queue
            updateQueue.push(gameData);
            
            // Process queue if not already processing
            if (!isProcessingQueue) {
                processUpdateQueue();
            }
        } catch (error) {
            console.error("Error in Firebase listener:", error);
        }
    });
}

// New function to process updates sequentially
async function processUpdateQueue() {
    if (isProcessingQueue || updateQueue.length === 0) return;
    
    isProcessingQueue = true;
    
    try {
        while (updateQueue.length > 0) {
            const gameData = updateQueue[0];
            
            // Get current time for comparison
            const currentTime = Date.now();
            
            // Check if this update is worth processing
            const isNewerVersion = gameData.version > gameStateVersion;
            const isNewerTimestamp = gameData.timestamp > localGameTimestamp;
            
            if (isNewerVersion || isNewerTimestamp) {
                console.log("Processing Firebase update");
                
                // Update our tracking variables
                lastUpdateTime = currentTime;
                if (gameData.version) gameStateVersion = gameData.version;
                if (gameData.timestamp) localGameTimestamp = gameData.timestamp;
                
                // Process the update
                await processFirebaseUpdate(gameData);
                
                // Small delay to prevent overwhelming the client
                await new Promise(resolve => setTimeout(resolve, 50));
            } else {
                console.log("Ignoring Firebase update (not newer)");
            }
            
            // Remove processed update
            updateQueue.shift();
        }
    } catch (error) {
        console.error("Error processing update queue:", error);
    } finally {
        isProcessingQueue = false;
    }
}

// Process a Firebase update safely with lock prevention
function processFirebaseUpdate(gameData) {
    try {
        // Implement a locking mechanism to prevent concurrent updates
        if (window.isProcessingUpdate) {
            console.log("UPDATE: Already processing an update, queueing this one");
            window.pendingUpdate = gameData;
            return;
        }
        
        window.isProcessingUpdate = true;
        
        // Set a safety timeout to release the lock if something goes wrong
        const safetyTimeout = setTimeout(() => {
            console.warn("UPDATE WARNING: Safety timeout reached, releasing lock");
            window.isProcessingUpdate = false;
            
            // Process any pending updates
            if (window.pendingUpdate) {
                const pendingData = window.pendingUpdate;
                window.pendingUpdate = null;
                processFirebaseUpdate(pendingData);
            }
        }, 5000);
        
        // Log update details
        console.log("UPDATE: Processing Firebase update", {
            fromOtherPlayer: gameData.lastMoveBy && gameData.lastMoveBy !== window.playerRole,
            forceUpdate: gameData.forceUpdate === true,
            debugButtonClicked: gameData.debugButtonClicked === true,
            version: gameData.gameStateVersion
        });
        
        // CRITICAL FIX: Check if we have a locked board state that should be preserved
        const hasLockedState = window.lastBoardState && Date.now() - window.lastBoardState.timestamp < 5000;
        
        // NETWORK FIX: Check if we should use local storage instead of Firebase
        const useLocalStorage = typeof window.shouldUseLocalStorage === 'function' && window.shouldUseLocalStorage();
        
        // NETWORK FIX: Check if the incoming update is older than our local state
        const isOlderUpdate = gameData.gameStateVersion < (window.gameStateVersion || 0);
        
        // Update player names and game status immediately
        if (gameData.player1Name) window.player1Name = gameData.player1Name;
        if (gameData.player2Name) window.player2Name = gameData.player2Name;
        if (gameData.gameStatus) window.gameStatus = gameData.gameStatus;
        if (typeof gameData.gameStarted !== 'undefined') window.gameStarted = gameData.gameStarted;
        
        // Update UI elements that don't depend on the board
        if (typeof updatePlayerInfo === 'function') updatePlayerInfo();
        if (typeof updateGameStatus === 'function') updateGameStatus();
        
        // Check if this is an update from another player or a force update
        const isFromOtherPlayer = gameData.lastMoveBy && gameData.lastMoveBy !== window.playerRole;
        const isForceUpdate = gameData.forceUpdate === true;
        const isDebugButtonClicked = gameData.debugButtonClicked === true;
        
        // CRITICAL FIX: Only update the board if we don't have a locked state
        // or if the update is from the other player
        // NETWORK FIX: Also check if we should use local storage instead
        if ((!hasLockedState && !useLocalStorage && !isOlderUpdate) || 
            (isFromOtherPlayer && !useLocalStorage)) {
            console.log("UPDATE: Updating board state from Firebase");
            
            // Always update these game state variables
            if (Array.isArray(gameData.board)) window.board = gameData.board;
            if (Array.isArray(gameData.whiteBar)) window.whiteBar = gameData.whiteBar;
            if (Array.isArray(gameData.blackBar)) window.blackBar = gameData.blackBar;
            if (Array.isArray(gameData.whiteBearOff)) window.whiteBearOff = gameData.whiteBearOff;
            if (Array.isArray(gameData.blackBearOff)) window.blackBearOff = gameData.blackBearOff;
            if (typeof gameData.currentPlayer !== 'undefined') window.currentPlayer = gameData.currentPlayer;
            if (Array.isArray(gameData.dice)) window.dice = gameData.dice;
            if (typeof gameData.diceRolled !== 'undefined') window.diceRolled = gameData.diceRolled;
            if (typeof gameData.gameStateVersion !== 'undefined') window.gameStateVersion = gameData.gameStateVersion;
        } else {
            console.log("UPDATE: Ignoring board update due to locked state or local storage preference");
            
            // NETWORK FIX: If we're ignoring the update but it's from the other player,
            // we should force our state to Firebase to ensure consistency
            if (isFromOtherPlayer && (hasLockedState || useLocalStorage)) {
                console.log("UPDATE: Forcing our state to Firebase after ignoring update from other player");
                setTimeout(() => {
                    if (typeof window.forceSyncNow === 'function') {
                        window.forceSyncNow();
                    }
                }, 1000);
            }
        }
        
        // Update UI directly
        if (typeof updateDiceDisplay === 'function') updateDiceDisplay();
        if (typeof updatePlayerInfo === 'function') updatePlayerInfo();
        
        // Determine if we need to redraw the board
        let shouldRedrawBoard = isFromOtherPlayer || isForceUpdate || isDebugButtonClicked;
        
        // Always redraw if dice have been rolled
        if (Array.isArray(gameData.dice) && gameData.dice.length > 0) {
            shouldRedrawBoard = true;
        }
        
        // Redraw the board if needed
        if (shouldRedrawBoard && typeof redrawBoard === 'function') {
            console.log("UPDATE: Redrawing board due to update");
            redrawBoard();
        }
        
        // Check if both players have joined and start the game if needed
        if (gameData.player1Name && gameData.player1Name !== "Player 1" && 
            gameData.player2Name && gameData.player2Name !== "Player 2") {
            
            if (typeof checkAndStartGame === 'function') {
                console.log("UPDATE: Both players have joined, checking if game can start");
                checkAndStartGame();
            }
        }
        
        // CRITICAL FIX: If we have a locked state, check if we need to restore it
        if (hasLockedState && typeof window.checkForReversion === 'function') {
            console.log("UPDATE: Checking for reversion after Firebase update");
            window.checkForReversion();
        }
        
        // NETWORK FIX: If we're using local storage, try to load from it
        if (useLocalStorage && typeof window.loadStateFromLocalStorage === 'function') {
            console.log("UPDATE: Checking local storage after Firebase update");
            setTimeout(() => {
                window.loadStateFromLocalStorage();
            }, 500);
        }
        
        // Clear the safety timeout and release the lock
        clearTimeout(safetyTimeout);
        window.isProcessingUpdate = false;
        
        // Process any pending updates
        if (window.pendingUpdate) {
            const pendingData = window.pendingUpdate;
            window.pendingUpdate = null;
            processFirebaseUpdate(pendingData);
        }
        
        return true;
    } catch (error) {
        console.error("UPDATE ERROR: Exception in processFirebaseUpdate", error);
        window.isProcessingUpdate = false;
        return false;
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
    if (document.getElementById('player-join')) {
        document.getElementById('player-join').classList.add('hidden');
    }
    if (document.getElementById('game-controls')) {
        document.getElementById('game-controls').classList.remove('hidden');
    }
    
    // Update game status
    gameStatus = player1Name + "'s turn to roll";
    if (document.getElementById('game-status')) {
        document.getElementById('game-status').textContent = gameStatus;
    }
    
    // Enable roll button for player 1
    if (currentPlayer === 'player1' && playerRole === 'player1') {
        const rollButton = document.getElementById('roll-button');
        if (rollButton) rollButton.disabled = false;
    }
    
    // Save the state
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
