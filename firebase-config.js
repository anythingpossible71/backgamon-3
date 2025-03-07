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
    const now = Date.now();
    
    // Always save if forcePlayerOneUpdate is true
    if (window.forcePlayerOneUpdate !== true) {
        // Check if we're trying to save too frequently
        if (now - lastUpdateTime < SAVE_THROTTLE) {
            console.log("Throttling Firebase update (too frequent)");
            return;
        }
        
        // Skip saving if already updating from Firebase
        if (isCurrentlyUpdating) {
            console.log("Currently updating from Firebase, save skipped");
            return;
        }
    } else {
        console.log("CRITICAL: Force update flag set, bypassing all throttling");
    }
    
    lastUpdateTime = now;
    
    if (!gameId) {
        console.log("No gameId found, cannot save state");
        return;
    }
    
    try {
        console.log("Saving game state for game:", gameId);
        
        // Increment version number for this update
        gameStateVersion++;
        
        // Check if both players have joined
        const bothPlayersJoined = player1Name !== "Player 1" && player2Name !== "Player 2";
        
        // Check if this is a forced update from player 2 joining
        const isForceUpdate = window.forcePlayerOneUpdate === true;
        const isMoveCompleted = window.moveCompleted === true;
        const isDiceRolled = window.diceRolled === true;
        
        // Debug the board state before saving
        console.log("Board state before saving:", JSON.stringify(board));
        console.log("Dice before saving:", JSON.stringify(dice));
        
        // Create a deep copy of the board to avoid reference issues
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
        
        // Create deep copies of other arrays
        const whiteBarCopy = [];
        if (whiteBar && Array.isArray(whiteBar)) {
            for (let i = 0; i < whiteBar.length; i++) {
                whiteBarCopy.push({ color: 'white' });
            }
        }
        
        const blackBarCopy = [];
        if (blackBar && Array.isArray(blackBar)) {
            for (let i = 0; i < blackBar.length; i++) {
                blackBarCopy.push({ color: 'black' });
            }
        }
        
        const whiteBearOffCopy = [];
        if (whiteBearOff && Array.isArray(whiteBearOff)) {
            for (let i = 0; i < whiteBearOff.length; i++) {
                whiteBearOffCopy.push({ color: 'white' });
            }
        }
        
        const blackBearOffCopy = [];
        if (blackBearOff && Array.isArray(blackBearOff)) {
            for (let i = 0; i < blackBearOff.length; i++) {
                blackBearOffCopy.push({ color: 'black' });
            }
        }
        
        // Make a copy of dice
        const diceCopy = dice ? [...dice] : [];
        
        const gameData = {
            board: boardCopy,
            whiteBar: whiteBarCopy,
            blackBar: blackBarCopy,
            whiteBearOff: whiteBearOffCopy,
            blackBearOff: blackBearOffCopy,
            currentPlayer: currentPlayer,
            dice: diceCopy,
            diceRolled: diceRolled,
            gameStatus: gameStatus,
            player1Name: player1Name,
            player2Name: player2Name,
            gameStarted: true, // Always set as started when saving
            forceUpdate: isForceUpdate, // Special flag for player 1
            moveCompleted: isMoveCompleted, // Flag for move completion
            diceRolled: isDiceRolled, // Flag for dice roll
            version: gameStateVersion,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            lastMoveBy: playerRole, // Add who made the last move
            debugButtonClicked: true // Add flag to indicate debug button was clicked
        };
        
        // Debug the game data
        console.log("Game data prepared for Firebase:", JSON.stringify(gameData.board));
        console.log("Dice data prepared for Firebase:", JSON.stringify(gameData.dice));
        
        // Update local timestamp expectation
        localGameTimestamp = now;
        
        console.log("Saving data to Firebase");
        
        // Use set instead of update to ensure complete replacement
        firebase.database().ref('games/' + gameId).set(gameData)
            .then(() => {
                console.log("Game state saved successfully, version:", gameStateVersion);
                
                // Clear the flags AFTER successful save
                window.forcePlayerOneUpdate = false;
                window.moveCompleted = false;
                window.diceRolled = false;
                
                // Force a redraw after saving
                if (typeof redrawBoard === 'function') {
                    redrawBoard();
                }
                
                // Update UI directly
                if (typeof updateUIDirectly === 'function') {
                    updateUIDirectly();
                }
                
                // Verify the save was successful
                setTimeout(() => {
                    firebase.database().ref('games/' + gameId).once('value')
                        .then((snapshot) => {
                            const serverData = snapshot.val();
                            if (!serverData || !serverData.board) {
                                console.error("Failed to save game state to server");
                                
                                // Try again
                                window.forcePlayerOneUpdate = true;
                                saveGameState();
                                return;
                            }
                            
                            console.log("Server board state verified");
                        })
                        .catch((error) => {
                            console.error("Error verifying game state save:", error);
                        });
                }, 500);
            })
            .catch((error) => {
                console.error("Error saving game state:", error);
                // Decrement version on failure
                gameStateVersion--;
                
                // Try again after a delay
                setTimeout(() => {
                    window.forcePlayerOneUpdate = true;
                    saveGameState();
                }, 1000);
            });
    } catch (error) {
        console.error("Error preparing game state for saving:", error);
        // Decrement version on failure
        gameStateVersion--;
        
        // Try again after a delay
        setTimeout(() => {
            window.forcePlayerOneUpdate = true;
            saveGameState();
        }, 1000);
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
    // If already updating, queue this update
    if (isCurrentlyUpdating) {
        console.log("Already processing an update, queueing this one");
        pendingUpdate = gameData;
        return;
    }
    
    // Set updating flag
    isCurrentlyUpdating = true;
    
    // Set a safety timeout to release the lock if update takes too long
    const safetyTimeout = setTimeout(() => {
        console.warn("Firebase update took too long, releasing lock");
        isCurrentlyUpdating = false;
        
        // Process pending update if one exists
        if (pendingUpdate) {
            const tempUpdate = pendingUpdate;
            pendingUpdate = null;
            setTimeout(() => {
                processFirebaseUpdate(tempUpdate);
            }, 100);
        }
    }, UPDATE_TIMEOUT);
    
    try {
        console.log("Processing Firebase update", gameData);
        
        // Check for special flags
        const isForceUpdate = gameData.forceUpdate === true;
        const isMoveCompleted = gameData.moveCompleted === true;
        const isDiceRolled = gameData.diceRolled === true;
        const isDebugButtonClicked = gameData.debugButtonClicked === true;
        
        // Check if this update is from the other player
        const isFromOtherPlayer = gameData.lastMoveBy && gameData.lastMoveBy !== playerRole;
        
        console.log("Update from other player:", isFromOtherPlayer, 
                   "Force update:", isForceUpdate, 
                   "Move completed:", isMoveCompleted,
                   "Dice rolled:", isDiceRolled,
                   "Debug button clicked:", isDebugButtonClicked);
        
        // Update player names and trigger UI updates immediately
        let playersChanged = false;
        
        if (gameData.player1Name && gameData.player1Name !== player1Name) {
            player1Name = gameData.player1Name;
            const p1NameEl = document.getElementById('player1-name');
            if (p1NameEl) p1NameEl.textContent = player1Name;
            playersChanged = true;
        }
        
        if (gameData.player2Name && gameData.player2Name !== player2Name) {
            player2Name = gameData.player2Name;
            const p2NameEl = document.getElementById('player2-name');
            if (p2NameEl) p2NameEl.textContent = player2Name;
            playersChanged = true;
        }
        
        // If players changed or force update, update game state
        if (playersChanged || isForceUpdate || isDebugButtonClicked) {
            // Check if both players have joined
            if ((player1Name !== "Player 1" && player2Name !== "Player 2") || isForceUpdate || isDebugButtonClicked) {
                console.log("Both players joined or force update received, updating UI");
                
                // Set game as started
                gameStarted = true;
                
                // Only hide waiting message and show game controls if both players have joined
                if (player1Name !== "Player 1" && player2Name !== "Player 2") {
                    console.log("Both players have joined, showing game controls");
                    
                    const waitingMessage = document.getElementById('waiting-message');
                    const playerJoin = document.getElementById('player-join');
                    const gameControls = document.getElementById('game-controls');
                    
                    if (waitingMessage) waitingMessage.classList.add('hidden');
                    if (playerJoin) playerJoin.classList.add('hidden');
                    if (gameControls) gameControls.classList.remove('hidden');
                } else if (playerRole === "player1" && player2Name === "Player 2") {
                    // Player 1 is waiting for player 2
                    console.log("Player 1 is waiting for player 2 to join");
                    
                    const waitingMessage = document.getElementById('waiting-message');
                    const playerJoin = document.getElementById('player-join');
                    const nameEntry = document.getElementById('name-entry');
                    const gameControls = document.getElementById('game-controls');
                    
                    if (waitingMessage) waitingMessage.classList.remove('hidden');
                    if (playerJoin) playerJoin.classList.remove('hidden');
                    if (nameEntry) nameEntry.classList.add('hidden');
                    if (gameControls) gameControls.classList.add('hidden');
                }
                
                // Update game status
                gameStatus = gameData.gameStatus || (player1Name + "'s turn to roll");
                const gameStatusEl = document.getElementById('game-status');
                if (gameStatusEl) gameStatusEl.textContent = gameStatus;
                
                // Enable roll button for player 1
                if (playerRole === 'player1' && currentPlayer === 'player1') {
                    const rollButton = document.getElementById('roll-button');
                    if (rollButton) rollButton.disabled = false;
                }
            }
        }
        
        // Always update game state variables to ensure synchronization
        // Pay special attention to board updates from other players
        if (gameData.board) {
            console.log("Updating board from Firebase, from other player:", isFromOtherPlayer);
            console.log("Board data received:", JSON.stringify(gameData.board));
            
            // Deep copy the board to avoid reference issues
            board = [];
            for (let i = 0; i < 24; i++) {
                board[i] = [];
                if (gameData.board[i] && gameData.board[i].length > 0) {
                    for (let j = 0; j < gameData.board[i].length; j++) {
                        if (gameData.board[i][j] && gameData.board[i][j].color) {
                            board[i].push({ color: gameData.board[i][j].color });
                        }
                    }
                }
            }
        }
        
        // Update other game state variables
        if (gameData.whiteBar) {
            whiteBar = [];
            for (let i = 0; i < gameData.whiteBar.length; i++) {
                whiteBar.push({ color: 'white' });
            }
        } else {
            whiteBar = [];
        }
        
        if (gameData.blackBar) {
            blackBar = [];
            for (let i = 0; i < gameData.blackBar.length; i++) {
                blackBar.push({ color: 'black' });
            }
        } else {
            blackBar = [];
        }
        
        if (gameData.whiteBearOff) {
            whiteBearOff = [];
            for (let i = 0; i < gameData.whiteBearOff.length; i++) {
                whiteBearOff.push({ color: 'white' });
            }
        } else {
            whiteBearOff = [];
        }
        
        if (gameData.blackBearOff) {
            blackBearOff = [];
            for (let i = 0; i < gameData.blackBearOff.length; i++) {
                blackBearOff.push({ color: 'black' });
            }
        } else {
            blackBearOff = [];
        }
        
        // Special handling for dice updates
        if (gameData.dice) {
            console.log("Updating dice from Firebase:", JSON.stringify(gameData.dice));
            dice = Array.isArray(gameData.dice) ? [...gameData.dice] : [];
            
            // Update dice display
            const dice1El = document.getElementById('dice1');
            const dice2El = document.getElementById('dice2');
            
            if (dice1El && dice.length > 0) {
                dice1El.textContent = dice[0];
            }
            
            if (dice2El && dice.length > 1) {
                dice2El.textContent = dice[1];
            }
        }
        
        if (gameData.diceRolled !== undefined) {
            console.log("Updating diceRolled from Firebase:", gameData.diceRolled);
            diceRolled = gameData.diceRolled;
        }
        
        if (gameData.currentPlayer) {
            console.log("Updating currentPlayer from Firebase:", gameData.currentPlayer);
            currentPlayer = gameData.currentPlayer;
        }
        
        if (gameData.gameStatus) {
            console.log("Updating gameStatus from Firebase:", gameData.gameStatus);
            gameStatus = gameData.gameStatus;
            
            // Update game status display
            const gameStatusEl = document.getElementById('game-status');
            if (gameStatusEl) gameStatusEl.textContent = gameStatus;
        }
        
        if (gameData.gameStarted) gameStarted = gameData.gameStarted;
        
        // Update UI directly
        if (typeof updateUIDirectly === 'function') {
            updateUIDirectly();
        }
        
        // If this was a move from the other player or dice were rolled or debug button was clicked, redraw the board
        if ((isFromOtherPlayer || isMoveCompleted || isDiceRolled || isDebugButtonClicked) && typeof redrawBoard === 'function') {
            console.log("Redrawing board after update");
            redrawBoard();
            
            // Force a second redraw after a short delay to ensure it's visible
            setTimeout(() => {
                redrawBoard();
                console.log("Forced second redraw after update");
                
                // Update UI again
                if (typeof updateUIDirectly === 'function') {
                    updateUIDirectly();
                }
                
                // If this was a debug button click, simulate a debug button click on this side too
                if (isDebugButtonClicked && typeof window.simulateDebugButtonClick === 'function') {
                    console.log("Simulating debug button click in response to remote debug button click");
                    window.simulateDebugButtonClick();
                }
            }, 500);
        }
        
    } catch (error) {
        console.error("Error updating game from Firebase:", error);
    } finally {
        // Always clear timeout and release lock
        clearTimeout(safetyTimeout);
        isCurrentlyUpdating = false;
        
        // Process pending update if one exists
        if (pendingUpdate) {
            const tempUpdate = pendingUpdate;
            pendingUpdate = null;
            setTimeout(() => {
                processFirebaseUpdate(tempUpdate);
            }, 100);
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
