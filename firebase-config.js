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
    
    // Check if we're trying to save too frequently, unless it's a forced update
    if (now - lastUpdateTime < SAVE_THROTTLE && !window.forcePlayerOneUpdate) {
        console.log("Throttling Firebase update (too frequent)");
        return;
    }
    
    lastUpdateTime = now;
    
    if (!gameId) {
        console.log("No game ID, cannot save state");
        return;
    }
    
    // Skip saving if already updating from Firebase, unless it's a forced update
    if (isCurrentlyUpdating && !window.forcePlayerOneUpdate) {
        console.log("Currently updating from Firebase, save skipped");
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
            gameStarted: bothPlayersJoined || isForceUpdate, // Set as started when both players joined or forced
            forceUpdate: isForceUpdate, // Special flag for player 1
            version: gameStateVersion,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
        
        // Clear the force update flag
        window.forcePlayerOneUpdate = false;
        
        // Use the serializer to prepare safe data
        const safeData = prepareGameDataForSaving(gameData);
        
        // Update local timestamp expectation
        localGameTimestamp = now;
        
        console.log("Saving data to Firebase");
        
        firebase.database().ref('games/' + gameId).update(safeData)
            .then(() => {
                console.log("Game state saved successfully, version:", gameStateVersion);
                
                // If both players just joined, force UI update
                if (bothPlayersJoined && !gameStarted) {
                    gameStarted = true;
                    const waitingMessage = document.getElementById('waiting-message');
                    const playerJoin = document.getElementById('player-join');
                    const gameControls = document.getElementById('game-controls');
                    
                    if (waitingMessage) waitingMessage.classList.add('hidden');
                    if (playerJoin) playerJoin.classList.add('hidden');
                    if (gameControls) gameControls.classList.remove('hidden');
                    
                    // Update game status
                    gameStatus = player1Name + "'s turn to roll";
                    const gameStatusEl = document.getElementById('game-status');
                    if (gameStatusEl) gameStatusEl.textContent = gameStatus;
                    
                    // Enable roll button for player 1
                    if (playerRole === 'player1') {
                        const rollButton = document.getElementById('roll-button');
                        if (rollButton) rollButton.disabled = false;
                    }
                }
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
        
        // Check for force update flag
        const isForceUpdate = gameData.forceUpdate === true;
        
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
        if (playersChanged || isForceUpdate) {
            // Check if both players have joined
            if ((player1Name !== "Player 1" && player2Name !== "Player 2") || isForceUpdate) {
                console.log("Both players joined or force update received, updating UI");
                
                // Set game as started
                gameStarted = true;
                
                // Hide waiting message and show game controls
                const waitingMessage = document.getElementById('waiting-message');
                const playerJoin = document.getElementById('player-join');
                const gameControls = document.getElementById('game-controls');
                
                if (waitingMessage) waitingMessage.classList.add('hidden');
                if (playerJoin) playerJoin.classList.add('hidden');
                if (gameControls) gameControls.classList.remove('hidden');
                
                // Update game status
                gameStatus = player1Name + "'s turn to roll";
                const gameStatusEl = document.getElementById('game-status');
                if (gameStatusEl) gameStatusEl.textContent = gameStatus;
                
                // Enable roll button for player 1
                if (playerRole === 'player1') {
                    const rollButton = document.getElementById('roll-button');
                    if (rollButton) rollButton.disabled = false;
                }
            }
        }
        
        // Update game state if game has started
        if (gameData.gameStarted) {
            gameStarted = true;
            
            // Update game state variables safely
            if (gameData.board) board = gameData.board;
            if (gameData.whiteBar) whiteBar = gameData.whiteBar;
            if (gameData.blackBar) blackBar = gameData.blackBar;
            if (gameData.whiteBearOff) whiteBearOff = gameData.whiteBearOff;
            if (gameData.blackBearOff) blackBearOff = gameData.blackBearOff;
            if (gameData.currentPlayer) currentPlayer = gameData.currentPlayer;
            if (gameData.dice) dice = gameData.dice;
            if (gameData.diceRolled !== undefined) diceRolled = gameData.diceRolled;
            if (gameData.gameStatus) gameStatus = gameData.gameStatus;
            
            // Update UI directly
            if (typeof updateUIDirectly === 'function') {
                updateUIDirectly();
            }
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
