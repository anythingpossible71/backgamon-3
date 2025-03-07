// game-logic.js (Part 1) - Complete implementation
// This file handles game mechanics, moves, and rules
// Last synchronized: Version check - March 7, 2025

// Variables to prevent rapid actions
let isRolling = false;
let lastRollTime = 0;
let lastSaveTime = 0;
let lastMouseEvent = 0;
const ROLL_COOLDOWN = 1000; // 1 second between rolls
const SAVE_COOLDOWN = 2000; // 2 seconds between saves
const MOUSE_COOLDOWN = 100; // 100ms between mouse events

// Add a sync lock to prevent concurrent syncs
let isSyncing = false;
let syncAttempts = 0;
const MAX_SYNC_ATTEMPTS = 3;

// BREAKTHROUGH: Add a forced sync queue to ensure critical game state changes are always saved
let forceSyncQueue = [];
let lastSyncTime = 0;
const SYNC_INTERVAL = 500; // 500ms between forced syncs

// CRITICAL FIX: Add move locking to prevent reversion
let lockedMoves = [];
let lastBoardState = null;
let moveReversionTimeout = null;

// Add turn acknowledgment system
let turnAcknowledged = false;
let lastTurnTimestamp = 0;
const TURN_TIMEOUT = 30000; // 30 seconds max per turn

// Mouse interaction functions with throttling
function mousePressed() {
    // Throttle to prevent rapid clicks
    const currentTime = performance.now();
    if (currentTime - lastMouseEvent < MOUSE_COOLDOWN) {
        return; // Skip if too soon after last event
    }
    lastMouseEvent = currentTime;
    
    try {
        // Only allow player to interact if it's their turn
        if (!canPlayerMove()) {
            console.log("Cannot move - not your turn");
            return;
        }
        
        if (!diceRolled) {
            console.log("Dice not rolled yet");
            return;
        }
        
        if (mouseY > BOARD_HEIGHT) {
            console.log("Mouse outside board area");
            return;
        }
        
        let playerColor = currentPlayer === 'player1' ? 'white' : 'black';
        
        // Check if player has checkers on the bar
        if ((playerColor === 'white' && whiteBar && whiteBar.length > 0) || 
            (playerColor === 'black' && blackBar && blackBar.length > 0)) {
            
            let barX = BOARD_WIDTH / 2 + BEAR_OFF_WIDTH;
            let barY = playerColor === 'white' ? BOARD_HEIGHT / 4 : BOARD_HEIGHT * 3/4;
            
            if (dist(mouseX, mouseY, barX, barY) < CHECKER_RADIUS * 2) {
                selectedChecker = { pointIndex: -1, checkerIndex: 0 };
                calculateValidMoves(-1, dice);
                console.log("Selected checker from bar");
                return;
            }
            
            console.log("Must move from bar");
            return;  // Must move from bar
        }
        
        // Check if a checker was clicked
        for (let i = 0; i < board.length; i++) {
            if (!board[i]) continue; // Skip if point is undefined
            
            let point = board[i];
            let pointX = getPointX(i);
            
            for (let j = 0; j < point.length; j++) {
                let checker = point[j];
                if (checker.color === playerColor) {
                    let checkerY = getCheckerY(i, j);
                    
                    if (dist(mouseX, mouseY, pointX, checkerY) < CHECKER_RADIUS) {
                        selectedChecker = { pointIndex: i, checkerIndex: j };
                        calculateValidMoves(i, dice);
                        console.log("Selected checker at point", { point: i, checker: j });
                        return;
                    }
                }
            }
        }
        
        console.log("No checker selected");
    } catch (error) {
        console.error("Error in mousePressed:", error);
    }
}

function mouseReleased() {
    // Throttle to prevent rapid clicks
    const currentTime = performance.now();
    if (currentTime - lastMouseEvent < MOUSE_COOLDOWN) {
        return;
    }
    lastMouseEvent = currentTime;
    
    try {
        if (!canPlayerMove()) {
            selectedChecker = null;
            validMoves = [];
            combinedMoves = [];
            return;
        }
        
        // Check if game state has changed
        firebase.database().ref('games/' + window.backgammonGame.gameId).once('value')
            .then((snapshot) => {
                const serverData = snapshot.val();
                if (serverData && serverData.version > gameStateVersion) {
                    console.log("Game state has changed, reloading...");
                    loadGameState();
                    return;
                }
                
                // Continue with move if state hasn't changed
                executeMove();
            })
            .catch((error) => {
                console.error("Error checking game state:", error);
            });
        
        // If a checker was selected and moved
        if (selectedChecker !== null) {
            // ... existing code ...
            
            // BREAKTHROUGH: Force sync after any move
            queueForceSync("move_completed");
        }
    } catch (error) {
        console.error("Error in mouseReleased:", error);
    }
}

// Game mechanics functions
function rollDice() {
    // Skip if already rolling or on cooldown
    const currentTime = performance.now();
    if (isRolling || currentTime - lastRollTime < ROLL_COOLDOWN) {
        console.log("Roll in progress or cooldown active, ignoring request");
        return;
    }
    
    isRolling = true;
    lastRollTime = currentTime;
    
    try {
        console.log("Roll dice called. diceRolled=", diceRolled, 
                    "canPlayerMove=", canPlayerMove(), 
                    "playerRole=", playerRole, 
                    "currentPlayer=", currentPlayer);
                    
        if (diceRolled) {
            console.log("Dice already rolled, ignoring");
            isRolling = false;
            return;
        }
        
        if (whiteBearOff && whiteBearOff.length === 15 || 
            blackBearOff && blackBearOff.length === 15) {
            console.log("Game already won, ignoring dice roll");
            isRolling = false;
            return;
        }
        
        if (!canPlayerMove()) {
            console.log("Not your turn, ignoring dice roll");
            isRolling = false;
            return;
        }
        
        console.log("Rolling dice for player:", currentPlayer);
        
        const die1 = Math.floor(Math.random() * 6) + 1;
        const die2 = Math.floor(Math.random() * 6) + 1;
        
        if (die1 === die2) {
            // For doubles, we get 4 moves
            dice = [die1, die1, die1, die1];
        } else {
            dice = [die1, die2];
        }
        
        diceRolled = true;
        
        // Update the dice display directly
        const dice1El = document.getElementById('dice1');
        const dice2El = document.getElementById('dice2');
        const rollButton = document.getElementById('roll-button');
        
        if (dice1El) dice1El.textContent = die1;
        if (dice2El) dice2El.textContent = die2;
        if (rollButton) rollButton.disabled = true;
        
        gameStatus = currentPlayer === 'player1' ? 
            player1Name + " rolled " + die1 + " and " + die2 + "!" :
            player2Name + " rolled " + die1 + " and " + die2 + "!";
        
        const gameStatusEl = document.getElementById('game-status');
        if (gameStatusEl) gameStatusEl.textContent = gameStatus;
        
        // CRITICAL: Simulate debug button click to force synchronization
        simulateDebugButtonClick();
        
        // Force immediate save to Firebase to ensure dice are synchronized
        window.forcePlayerOneUpdate = true;
        window.diceRolled = true;
        
        if (typeof window.saveGameState === 'function') {
            console.log("Forcing immediate save after dice roll");
            window.saveGameState();
            
            // Double-check save with a slight delay
            setTimeout(() => {
                console.log("Double-checking dice roll save");
                window.saveGameState();
                
                // Force a redraw to ensure dice are visible
                if (typeof redrawBoard === 'function') {
                    redrawBoard();
                }
                
                // Simulate debug button click again after delay
                simulateDebugButtonClick();
                
                // Verify the dice roll was saved correctly
                firebase.database().ref('games/' + window.gameId).once('value')
                    .then((snapshot) => {
                        const serverData = snapshot.val();
                        if (!serverData || !serverData.dice || !Array.isArray(serverData.dice)) {
                            console.error("Failed to save dice roll to server");
                            return;
                        }
                        
                        console.log("Server dice state:", JSON.stringify(serverData.dice));
                        
                        // Check if server dice match our local dice
                        let diceMatch = true;
                        if (serverData.dice.length !== dice.length) {
                            diceMatch = false;
                        } else {
                            for (let i = 0; i < dice.length; i++) {
                                if (serverData.dice[i] !== dice[i]) {
                                    diceMatch = false;
                                    break;
                                }
                            }
                        }
                        
                        if (!diceMatch) {
                            console.error("Server dice don't match local dice, retrying save");
                            window.saveGameState();
                            
                            // Simulate debug button click again
                            simulateDebugButtonClick();
                        } else {
                            console.log("Dice roll successfully saved to server");
                        }
                    })
                    .catch((error) => {
                        console.error("Error verifying dice roll save:", error);
                    });
            }, 500);
        }
        
        // Use a timeout to check for legal moves after UI updates
        setTimeout(() => {
            try {
                // Check if there are legal moves
                if (!hasLegalMoves()) {
                    gameStatus = "No legal moves available. Switching players...";
                    
                    if (gameStatusEl) gameStatusEl.textContent = gameStatus;
                    
                    // Auto switch player after short delay
                    setTimeout(() => {
                        switchPlayer();
                    }, 2000);
                } else {
                    // Force another save to ensure dice and legal moves are synchronized
                    window.forcePlayerOneUpdate = true;
                    if (typeof window.saveGameState === 'function') {
                        window.saveGameState();
                        
                        // Simulate debug button click again
                        simulateDebugButtonClick();
                    }
                }
            } catch (error) {
                console.error("Error checking for legal moves:", error);
            } finally {
                isRolling = false;
            }
        }, 1000);
        
        // BREAKTHROUGH: Force sync after dice roll
        queueForceSync("dice_rolled");
    } catch (error) {
        console.error("Error in rollDice:", error);
        isRolling = false;
    }
}

// Throttled version of saveGameState to prevent rapid Firebase updates
function saveGameStateThrottled() {
    const currentTime = performance.now();
    
    // Force immediate save for moves to ensure they're synchronized
    if (typeof window.saveGameState === 'function') {
        // Set a flag to force the update through
        window.forcePlayerOneUpdate = true;
        window.saveGameState();
        console.log("Forced game state save for move synchronization");
    }
}

// game-logic.js (Part 3) - Game state functions

function switchPlayer() {
    try {
        if (!gameStarted) return;
        
        // Save the current state before switching
        const previousPlayer = currentPlayer;
        
        // Switch the current player
        currentPlayer = currentPlayer === 'player1' ? 'player2' : 'player1';
        
        // Reset turn-related variables
        dice = [];
        diceRolled = false;
        selectedChecker = null;
        validMoves = [];
        combinedMoves = [];
        turnAcknowledged = false;
        lastTurnTimestamp = Date.now();
        
        // Update game status
        gameStatus = (currentPlayer === 'player1' ? player1Name : player2Name) + "'s turn";
        
        // CRITICAL: Simulate debug button click to force synchronization
        simulateDebugButtonClick();
        
        // Force immediate save to Firebase
        window.forcePlayerOneUpdate = true;
        saveGameState();
        
        console.log("Switched player from", previousPlayer, "to", currentPlayer);
        
        // Save again after a delay
        setTimeout(() => {
            window.forcePlayerOneUpdate = true;
            saveGameState();
            
            // Simulate debug button click again
            simulateDebugButtonClick();
        }, 500);
        
        // Start turn timeout monitor
        monitorTurnTimeout();
        
        // BREAKTHROUGH: Force sync after player switch
        queueForceSync("player_switched");
    } catch (error) {
        console.error("Error in switchPlayer:", error);
    }
}

function calculateValidMoves(pointIndex, dice) {
    try {
        validMoves = [];
        combinedMoves = [];
        
        if (!dice || dice.length === 0) return;
        
        let playerColor = currentPlayer === 'player1' ? 'white' : 'black';
        let direction = currentPlayer === 'player1' ? 1 : -1;
        
        console.log("Calculating valid moves for point", pointIndex, "with dice", dice);
        
        // Handle moves from the bar
        if ((playerColor === 'white' && whiteBar && whiteBar.length > 0) || 
            (playerColor === 'black' && blackBar && blackBar.length > 0)) {
            
            if (pointIndex !== -1) {
                console.log("Must move from bar first");
                return;
            } else {
                for (let i = 0; i < dice.length; i++) {
                    let die = dice[i];
                    let entryPoint;
                    
                    if (playerColor === 'white') {
                        entryPoint = die - 1;
                    } else {
                        entryPoint = 24 - die;
                    }
                    
                    if (entryPoint >= 0 && entryPoint < 24) {
                        if (board[entryPoint].length === 0 || 
                            board[entryPoint][0].color === playerColor ||
                            (board[entryPoint].length === 1 && board[entryPoint][0].color !== playerColor)) {
                            validMoves.push(entryPoint);
                            console.log("Valid bar entry point:", entryPoint);
                        }
                    }
                }
            }
            return;
        }
        
        // Check if player can bear off
        let canBearOff = canPlayerBearOff(playerColor);
        console.log("Can player bear off:", canBearOff);
        
        // Process each die
        for (let i = 0; i < dice.length; i++) {
            let die = dice[i];
            let targetIndex = pointIndex + (die * direction);
            
            // Check for bearing off
            if (canBearOff) {
                if (playerColor === 'white') {
                    if (pointIndex >= 18) { // Only allow bearing off from home board
                        if (targetIndex >= 24 || (die > 24 - pointIndex && isValidBearOff(pointIndex, die, playerColor))) {
                            if (!validMoves.includes(24)) {
                                validMoves.push(24); // Special target index for bearing off
                                console.log("Valid bearing off move for white");
                            }
                            continue;
                        }
                    }
                } else { // Black player
                    if (pointIndex <= 5) { // Only allow bearing off from home board
                        if (targetIndex < 0 || (die > pointIndex + 1 && isValidBearOff(pointIndex, die, playerColor))) {
                            if (!validMoves.includes(-1)) {
                                validMoves.push(-1); // Special target index for bearing off
                                console.log("Valid bearing off move for black");
                            }
                            continue;
                        }
                    }
                }
            }
            
            // Normal move within the board
            if (targetIndex >= 0 && targetIndex < 24) {
                let targetPoint = board[targetIndex];
                
                if (targetPoint.length === 0 ||
                    (targetPoint.length > 0 && targetPoint[0].color === playerColor) ||
                    (targetPoint.length === 1 && targetPoint[0].color !== playerColor)) {
                    if (!validMoves.includes(targetIndex)) {
                        validMoves.push(targetIndex);
                        console.log("Valid normal move to point:", targetIndex);
                    }
                }
            }
        }
        
        // Calculate combined moves (using multiple dice)
        if (dice.length >= 2) {
            // Create an array of unique dice values
            let uniqueDice = [...new Set(dice)];
            
            if (uniqueDice.length >= 2) {
                // Test all combinations of two different dice
                for (let d1 = 0; d1 < uniqueDice.length; d1++) {
                    for (let d2 = 0; d2 < uniqueDice.length; d2++) {
                        if (d1 === d2) continue; // Skip same die
                        
                        let die1 = uniqueDice[d1];
                        let die2 = uniqueDice[d2];
                        
                        // Try die1 then die2
                        let intermediateIndex = pointIndex + (die1 * direction);
                        if (intermediateIndex >= 0 && intermediateIndex < 24) {
                            if (board[intermediateIndex].length === 0 ||
                                board[intermediateIndex][0].color === playerColor) {
                                
                                let finalIndex = intermediateIndex + (die2 * direction);
                                
                                // Check if this is a valid move
                                if (finalIndex >= 0 && finalIndex < 24) {
                                    if (board[finalIndex].length === 0 ||
                                        board[finalIndex][0].color === playerColor ||
                                        (board[finalIndex].length === 1 && board[finalIndex][0].color !== playerColor)) {
                                        let alreadyAdded = combinedMoves.some(move => move.targetIndex === finalIndex);
                                        if (!alreadyAdded) {
                                            combinedMoves.push({
                                                targetIndex: finalIndex,
                                                die1: die1,
                                                die2: die2
                                            });
                                            console.log("Valid combined move to point:", finalIndex);
                                        }
                                    }
                                } else if (canBearOff && 
                                        ((playerColor === 'white' && finalIndex >= 24) || 
                                        (playerColor === 'black' && finalIndex < 0))) {
                                    // Valid bearing off with combined dice
                                    if (isValidBearOff(intermediateIndex, die2, playerColor)) {
                                        let bearOffTarget = playerColor === 'white' ? 24 : -1;
                                        let alreadyAdded = combinedMoves.some(move => move.targetIndex === bearOffTarget);
                                        if (!alreadyAdded) {
                                            combinedMoves.push({
                                                targetIndex: bearOffTarget,
                                                die1: die1,
                                                die2: die2
                                            });
                                            console.log("Valid combined bearing off move");
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        console.log("Valid moves calculated:", { normal: validMoves, combined: combinedMoves });
    } catch (error) {
        console.error("Error in calculateValidMoves:", error);
        validMoves = [];
        combinedMoves = [];
    }
}
    // game-logic.js (Part 4) - Helper functions

function isValidBearOff(pointIndex, die, playerColor) {
    try {
        console.log("Checking if bearing off is valid for point", pointIndex, "with die", die);
        
        // For white players (home board is 18-23)
        if (playerColor === 'white') {
            // Case 1: Exact roll (e.g., position 20 with die 4 = 24)
            if (pointIndex + die === 24) {
                console.log("Exact die roll for bearing off white");
                return true;
            }
            
            // Case 2: Roll is higher than needed
            if (die > 24 - pointIndex) {
                // Verify this is the highest piece
                for (let i = 23; i > pointIndex; i--) {
                    if (board[i] && board[i].length > 0 && board[i][0].color === 'white') {
                        // Not the highest piece, can't use larger die
                        console.log("Not the highest white piece, can't bear off with larger die");
                        return false;
                    }
                }
                console.log("This is the highest white piece, can bear off with larger die");
                return true; // This is the highest piece, can use larger die
            }
            return false;
        } 
        // For black players (home board is 0-5)
        else {
            // Case 1: Exact roll (e.g., position 3 with die 4 = -1)
            if (pointIndex - die === -1) {
                console.log("Exact die roll for bearing off black");
                return true;
            }
            
            // Case 2: Roll is higher than needed
            if (die > pointIndex + 1) {
                // Verify this is the highest piece
                for (let i = 0; i < pointIndex; i++) {
                    if (board[i] && board[i].length > 0 && board[i][0].color === 'black') {
                        // Not the highest piece, can't use larger die
                        console.log("Not the highest black piece, can't bear off with larger die");
                        return false;
                    }
                }
                console.log("This is the highest black piece, can bear off with larger die");
                return true; // This is the highest piece, can use larger die
            }
            return false;
        }
    } catch (error) {
        console.error("Error in isValidBearOff:", error);
        return false;
    }
}

function canPlayerBearOff(playerColor) {
    try {
        let checkersOutside = 0;
        
        if (!board || !Array.isArray(board)) {
            return false;
        }
        
        if (playerColor === 'white') {
            // White checkers must all be in home board (points 18-23)
            for (let i = 0; i < 18; i++) {
                if (!board[i]) continue;
                for (let j = 0; j < board[i].length; j++) {
                    if (board[i][j].color === 'white') {
                        checkersOutside++;
                    }
                }
            }
            checkersOutside += whiteBar ? whiteBar.length : 0;
        } else {
            // Black checkers must all be in home board (points 0-5)
            for (let i = 6; i < 24; i++) {
                if (!board[i]) continue;
                for (let j = 0; j < board[i].length; j++) {
                    if (board[i][j].color === 'black') {
                        checkersOutside++;
                    }
                }
            }
            checkersOutside += blackBar ? blackBar.length : 0;
        }
        
        console.log("Checkers outside home board:", checkersOutside);
        return checkersOutside === 0;
    } catch (error) {
        console.error("Error in canPlayerBearOff:", error);
        return false;
    }
}

function hasLegalMoves() {
    try {
        // Safety checks for critical data structures
        if (!dice || !Array.isArray(dice) || dice.length === 0) {
            console.log("No dice available, can't check for legal moves");
            return false;
        }
        
        if (!board || !Array.isArray(board)) {
            console.error("Board is missing or not valid");
            return false;
        }
        
        let playerColor = currentPlayer === 'player1' ? 'white' : 'black';
        console.log("Checking if player has legal moves. Color:", playerColor);
        
        // Check if player has checkers on the bar
        if ((playerColor === 'white' && whiteBar && whiteBar.length > 0) || 
            (playerColor === 'black' && blackBar && blackBar.length > 0)) {
            
            for (let i = 0; i < dice.length; i++) {
                let die = dice[i];
                let entryPoint = playerColor === 'white' ? die - 1 : 24 - die;
                
                if (entryPoint >= 0 && entryPoint < 24 && board[entryPoint]) { // Add board[entryPoint] check
                    if (board[entryPoint].length === 0 || 
                        (board[entryPoint][0] && board[entryPoint][0].color === playerColor) ||
                        (board[entryPoint].length === 1 && board[entryPoint][0] && board[entryPoint][0].color !== playerColor)) {
                        console.log("Legal move from bar found");
                        return true;
                    }
                }
            }
            
            console.log("No legal moves from bar");
            return false;
        }
        
        // Safety check each board point before accessing
        for (let i = 0; i < 24; i++) {
            if (!board[i]) {
                console.log("Board point", i, "is undefined, fixing");
                board[i] = [];
            }
        }
        
        // Check for bearing off
        let canBearOff = canPlayerBearOff(playerColor);
        if (canBearOff) {
            console.log("Player can bear off, checking for legal bearing off moves");
            if (playerColor === 'white') {
                for (let i = 18; i <= 23; i++) {
                    if (!board[i]) continue;
                    for (let j = 0; j < board[i].length; j++) {
                        if (board[i][j] && board[i][j].color === 'white') {
                            for (let k = 0; k < dice.length; k++) {
                                if (isValidBearOff(i, dice[k], playerColor)) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            } else {
                for (let i = 0; i <= 5; i++) {
                    if (!board[i]) continue;
                    for (let j = 0; j < board[i].length; j++) {
                        if (board[i][j] && board[i][j].color === 'black') {
                            for (let k = 0; k < dice.length; k++) {
                                if (isValidBearOff(i, dice[k], playerColor)) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Check for regular moves
        for (let i = 0; i < 24; i++) {
            if (!board[i]) continue;
            for (let j = 0; j < board[i].length; j++) {
                if (board[i][j] && board[i][j].color === playerColor) {
                    for (let k = 0; k < dice.length; k++) {
                        let die = dice[k];
                        let direction = playerColor === 'white' ? 1 : -1;
                        let targetIndex = i + (die * direction);
                        
                        if (targetIndex >= 0 && targetIndex < 24 && board[targetIndex]) { // Add board[targetIndex] check
                            if (board[targetIndex].length === 0 || 
                                (board[targetIndex][0] && board[targetIndex][0].color === playerColor) ||
                                (board[targetIndex].length === 1 && board[targetIndex][0] && board[targetIndex][0].color !== playerColor)) {
                                console.log("Legal regular move found from point", i, "to", targetIndex);
                                return true;
                            }
                        }
                    }
                }
            }
        }
        
        console.log("No legal moves found");
        return false;
    } catch (error) {
        console.error("Error in hasLegalMoves:", error);
        // If there's an error, assume there are no legal moves
        return false;
    }
}// game-logic.js (Part 5) - Final helper functions

function checkWinCondition() {
    try {
        if (whiteBearOff && whiteBearOff.length === 15) {
            gameStatus = player1Name + " (White) wins the game!";
            diceRolled = false;
            dice = [];
            selectedChecker = null;
            validMoves = [];
            combinedMoves = [];
            
            console.log("White wins the game!");
            updateUIDirectly();
            
            // Save final game state
            saveGameStateThrottled();
            
            return true;
        } 
        else if (blackBearOff && blackBearOff.length === 15) {
            gameStatus = player2Name + " (Black) wins the game!";
            diceRolled = false;
            dice = [];
            selectedChecker = null;
            validMoves = [];
            combinedMoves = [];
            
            console.log("Black wins the game!");
            updateUIDirectly();
            
            // Save final game state
            saveGameStateThrottled();
            
            return true;
        }
        return false;
    } catch (error) {
        console.error("Error in checkWinCondition:", error);
        return false;
    }
}

// Check if current player can move
function canPlayerMove() {
    try {
        if (!gameStarted) return false;
        
        const playerRole = window.backgammonGame.playerRole;
        if (playerRole === 'spectator') return false;
        
        // Check if it's this player's turn
        if ((playerRole === 'player1' && currentPlayer !== 'player1') ||
            (playerRole === 'player2' && currentPlayer !== 'player2')) {
            return false;
        }
        
        // Acknowledge turn when player attempts to move
        if (!turnAcknowledged) {
            turnAcknowledged = true;
            lastTurnTimestamp = Date.now();
        }
        
        return true;
    } catch (error) {
        console.error("Error in canPlayerMove:", error);
        return false;
    }
}

// Update UI elements directly without causing loops
function updateUIDirectly() {
    try {
        // Update player info
        const player1Bar = document.getElementById('player1-bar');
        const player1Off = document.getElementById('player1-off');
        const player2Bar = document.getElementById('player2-bar');
        const player2Off = document.getElementById('player2-off');
        const player1Card = document.getElementById('player1-card');
        const player2Card = document.getElementById('player2-card');
        const gameStatusEl = document.getElementById('game-status');
        const rollButton = document.getElementById('roll-button');
        const dice1El = document.getElementById('dice1');
        const dice2El = document.getElementById('dice2');
        
        // Update bar and off counts
        if (player1Bar) player1Bar.textContent = whiteBar ? whiteBar.length : 0;
        if (player1Off) player1Off.textContent = whiteBearOff ? whiteBearOff.length : 0;
        if (player2Bar) player2Bar.textContent = blackBar ? blackBar.length : 0;
        if (player2Off) player2Off.textContent = blackBearOff ? blackBearOff.length : 0;
        
        // Highlight active player
        if (player1Card && player2Card) {
            if (currentPlayer === 'player1') {
                player1Card.classList.add('active');
                player2Card.classList.remove('active');
            } else {
                player1Card.classList.remove('active');
                player2Card.classList.add('active');
            }
        }
        
        // Update game status
        if (gameStatusEl && gameStatus) gameStatusEl.textContent = gameStatus;
        
        // Update dice display
        if (dice1El) {
            dice1El.textContent = dice && dice.length > 0 ? dice[0] : '-';
        }
        
        if (dice2El) {
            dice2El.textContent = dice && dice.length > 1 ? dice[1] : '-';
        }
        
        // Update roll button state
        if (rollButton) {
            const canMove = (playerRole === "player1" && currentPlayer === "player1") || 
                           (playerRole === "player2" && currentPlayer === "player2");
            rollButton.disabled = diceRolled || !canMove;
        }
    } catch (error) {
        console.error("Error in updateUIDirectly:", error);
    }
}

// Debug function to log board state
function debugBoard() {
    console.log("===== BOARD STATE =====");
    
    console.log("White Bar:", whiteBar ? whiteBar.length : 0);
    console.log("White Bear Off:", whiteBearOff ? whiteBearOff.length : 0);
    
    if (board) {
        for (let i = 0; i < 24; i++) {
            if (!board[i] || board[i].length === 0) continue;
            
            let point = board[i];
            let whiteCount = 0;
            let blackCount = 0;
            
            for (let j = 0; j < point.length; j++) {
                if (point[j].color === 'white') {
                    whiteCount++;
                } else {
                    blackCount++;
                }
            }
            
            if (whiteCount > 0) {
                console.log(`Point ${i}: ${whiteCount} white`);
            }
            if (blackCount > 0) {
                console.log(`Point ${i}: ${blackCount} black`);
            }
        }
    }
    
    console.log("Black Bar:", blackBar ? blackBar.length : 0);
    console.log("Black Bear Off:", blackBearOff ? blackBearOff.length : 0);
    console.log("=======================");
}

// Add event listeners for mouse interactions
function addMouseListeners() {
    // Store the original p5.js mouse event handlers if they exist
    if (typeof window.mousePressed === 'function' && !window.originalMousePressed) {
        window.originalMousePressed = window.mousePressed;
    }
    
    if (typeof window.mouseReleased === 'function' && !window.originalMouseReleased) {
        window.originalMouseReleased = window.mouseReleased;
    }
    
    // Replace with our safer versions
    window.mousePressed = mousePressed;
    window.mouseReleased = mouseReleased;
    
    console.log("Mouse event listeners safely replaced");
}

// Export functions to global scope
window.rollDice = rollDice;
window.switchPlayer = switchPlayer;
window.calculateValidMoves = calculateValidMoves;
window.isValidBearOff = isValidBearOff;
window.canPlayerBearOff = canPlayerBearOff;
window.hasLegalMoves = hasLegalMoves;
window.checkWinCondition = checkWinCondition;
window.canPlayerMove = canPlayerMove;
window.updateUIDirectly = updateUIDirectly;
window.debugBoard = debugBoard;
window.saveGameStateThrottled = saveGameStateThrottled;
window.addMouseListeners = addMouseListeners;

// Initialize mouse listeners
addMouseListeners();

// Log that the game logic has been loaded
console.log("Game logic loaded successfully");

// New function to monitor turn timeouts
function monitorTurnTimeout() {
    setTimeout(() => {
        const currentTime = Date.now();
        if (!turnAcknowledged && (currentTime - lastTurnTimestamp > TURN_TIMEOUT)) {
            console.log("Turn timeout - forcing switch");
            switchPlayer();
        }
    }, TURN_TIMEOUT);
}

// New function to execute move after state verification
function executeMove() {
    if (!selectedChecker) return;
    
    // Ensure we have a valid gameId
    if (!window.gameId) {
        console.error("No gameId found, cannot execute move");
        return;
    }
    
    // Check for win condition
    if ((whiteBearOff && whiteBearOff.length === 15) || 
        (blackBearOff && blackBearOff.length === 15)) {
        console.log("Game already won");
        selectedChecker = null;
        validMoves = [];
        combinedMoves = [];
        return;
    }
    
    let moved = false;
    let playerColor = currentPlayer === 'player1' ? 'white' : 'black';
    
    // Store original board state for rollback if needed
    const originalBoard = JSON.parse(JSON.stringify(board));
    const originalWhiteBar = JSON.parse(JSON.stringify(whiteBar || []));
    const originalBlackBar = JSON.parse(JSON.stringify(blackBar || []));
    const originalWhiteBearOff = JSON.parse(JSON.stringify(whiteBearOff || []));
    const originalBlackBearOff = JSON.parse(JSON.stringify(blackBearOff || []));
    const originalDice = JSON.parse(JSON.stringify(dice || []));
    
    console.log("Original board state:", JSON.stringify(originalBoard));
    
    // Check valid moves (including combined moves)
    let allPossibleMoves = [...validMoves];
    let combinedMoveIndices = [];
    
    // Add combined move target indices
    for (let i = 0; i < combinedMoves.length; i++) {
        allPossibleMoves.push(combinedMoves[i].targetIndex);
        combinedMoveIndices.push(allPossibleMoves.length - 1);
    }
    
    console.log("Checking possible moves:", { validMoves: validMoves, combinedMoves: combinedMoves });
    
    for (let i = 0; i < allPossibleMoves.length; i++) {
        const pointIndex = allPossibleMoves[i];
        const isCombinedMove = combinedMoveIndices.includes(i);
        
        // Handle bearing off
        if ((playerColor === 'white' && pointIndex === 24) || 
            (playerColor === 'black' && pointIndex === -1)) {
            
            let checker;
            
            if (selectedChecker.pointIndex === -1) {
                checker = playerColor === 'white' ? whiteBar.pop() : blackBar.pop();
                console.log("Taking checker from bar for bearing off");
            } else {
                checker = board[selectedChecker.pointIndex].splice(selectedChecker.checkerIndex, 1)[0];
                console.log("Taking checker from point for bearing off:", selectedChecker.pointIndex);
            }
            
            if (playerColor === 'white') {
                whiteBearOff.push(checker);
                console.log("White checker borne off, total:", whiteBearOff.length);
                
                if (whiteBearOff.length === 15) {
                    gameStatus = player1Name + " wins the game!";
                    dice = [];
                    diceRolled = false;
                    selectedChecker = null;
                    validMoves = [];
                    combinedMoves = [];
                    moved = true;
                    
                    console.log("White wins the game!");
                    // Save final game state
                    window.forcePlayerOneUpdate = true;
                    saveGameState();
                    break;
                } else {
                    gameStatus = 'White checker borne off!';
                }
            } else {
                blackBearOff.push(checker);
                console.log("Black checker borne off, total:", blackBearOff.length);
                
                if (blackBearOff.length === 15) {
                    gameStatus = player2Name + " wins the game!";
                    dice = [];
                    diceRolled = false;
                    selectedChecker = null;
                    validMoves = [];
                    combinedMoves = [];
                    moved = true;
                    
                    console.log("Black wins the game!");
                    // Save final game state
                    window.forcePlayerOneUpdate = true;
                    saveGameState();
                    break;
                } else {
                    gameStatus = 'Black checker borne off!';
                }
            }
            
            // Handle dice removal
            if (isCombinedMove) {
                // Use both dice for combined move
                let combinedMove = combinedMoves[i - validMoves.length];
                // Remove the specific dice used
                let dieIndex1 = dice.indexOf(combinedMove.die1);
                if (dieIndex1 !== -1) dice.splice(dieIndex1, 1);
                
                let dieIndex2 = dice.indexOf(combinedMove.die2);
                if (dieIndex2 !== -1) dice.splice(dieIndex2, 1);
                
                console.log("Used combined dice:", combinedMove.die1, combinedMove.die2);
            } else {
                // Remove one die
                if (dice.length > 0) {
                    dice.splice(0, 1);
                    console.log("Used one die for bearing off, remaining dice:", dice);
                }
            }
            
            moved = true;
            break;
        }
        
        // Normal move within the board
        let pointX = getPointX(pointIndex);
        let pointY = getPointY(pointIndex);
        let pointTop = pointIndex < 12 ? pointY - POINT_HEIGHT : pointY;
        let pointBottom = pointIndex < 12 ? pointY : pointY + POINT_HEIGHT;
        
        if (mouseX >= pointX - POINT_WIDTH/2 && mouseX <= pointX + POINT_WIDTH/2 &&
            mouseY >= pointTop && mouseY <= pointBottom) {
            
            let checker;
            
            if (selectedChecker.pointIndex === -1) {
                checker = playerColor === 'white' ? whiteBar.pop() : blackBar.pop();
                console.log("Moving checker from bar to point:", pointIndex);
            } else {
                checker = board[selectedChecker.pointIndex].splice(selectedChecker.checkerIndex, 1)[0];
                console.log("Moving checker from point", selectedChecker.pointIndex, "to point", pointIndex);
            }
            
            // Check if hitting opponent's checker
            if (board[pointIndex].length === 1 && board[pointIndex][0].color !== checker.color) {
                let hitChecker = board[pointIndex].pop();
                if (hitChecker.color === 'white') {
                    whiteBar.push(hitChecker);
                    gameStatus = "White checker was hit!";
                    console.log("White checker was hit and moved to bar");
                } else {
                    blackBar.push(hitChecker);
                    gameStatus = "Black checker was hit!";
                    console.log("Black checker was hit and moved to bar");
                }
            }
            
            board[pointIndex].push(checker);
            
            // Handle dice removal for normal moves
            if (isCombinedMove) {
                // Use both dice for combined move
                let combinedMove = combinedMoves[i - validMoves.length];
                // Remove the specific dice used
                let dieIndex1 = dice.indexOf(combinedMove.die1);
                if (dieIndex1 !== -1) dice.splice(dieIndex1, 1);
                
                let dieIndex2 = dice.indexOf(combinedMove.die2);
                if (dieIndex2 !== -1) dice.splice(dieIndex2, 1);
                
                console.log("Used combined dice:", combinedMove.die1, combinedMove.die2);
            } else {
                // Remove one die
                if (dice.length > 0) {
                    // Calculate which die was used
                    let die;
                    if (selectedChecker.pointIndex === -1) {
                        // From bar
                        die = playerColor === 'white' ? pointIndex + 1 : 24 - pointIndex;
                    } else {
                        // Normal move
                        die = Math.abs(pointIndex - selectedChecker.pointIndex);
                    }
                    
                    // Find and remove the die that was used
                    let dieIndex = dice.indexOf(die);
                    if (dieIndex !== -1) {
                        dice.splice(dieIndex, 1);
                        console.log("Used die:", die);
                    } else {
                        // If exact die not found, use first available die
                        console.log("No exact die match, using first available die:", dice[0]);
                        dice.splice(0, 1);
                    }
                    
                    console.log("Remaining dice:", dice);
                }
            }
            
            moved = true;
            
            if (gameStatus.indexOf("checker was hit") === -1 && 
                gameStatus.indexOf("borne off") === -1) {
                gameStatus = currentPlayer === 'player1' ? 
                    player1Name + ' made a move!' : player2Name + ' made a move!';
            }
            
            break;
        }
    }
    
    if (!moved && selectedChecker.pointIndex !== -1) {
        gameStatus = "Invalid move! Try again.";
        console.log("Invalid move attempted");
    }
    
    // Check for win or end of turn
    if (moved) {
        console.log("Move completed, checking game state");
        console.log("New board state:", JSON.stringify(board));
        
        // Update UI directly to prevent loops
        updateUIDirectly();
        
        // CRITICAL: Simulate debug button click to force synchronization
        simulateDebugButtonClick();
        
        // Force immediate save to ensure move is synchronized
        window.forcePlayerOneUpdate = true;
        window.moveCompleted = true;
        
        // Direct Firebase save without throttling
        if (typeof window.saveGameState === 'function') {
            console.log("Forcing immediate save after move");
            window.saveGameState();
            
            // Force a redraw
            if (typeof redrawBoard === 'function') {
                redrawBoard();
            }
            
            // Save again after a delay to ensure it's properly saved
            setTimeout(() => {
                console.log("Saving again after delay");
                window.saveGameState();
                
                // Simulate debug button click again after delay
                simulateDebugButtonClick();
                
                // Force another redraw
                if (typeof redrawBoard === 'function') {
                    redrawBoard();
                }
                
                // Check if there are any more legal moves
                if (dice.length === 0 || !hasLegalMoves()) {
                    // Switch player
                    switchPlayer();
                }
            }, 1000);
        }
    } else {
        // If move failed, roll back to original state
        console.log("Move failed, rolling back to original state");
        board = JSON.parse(JSON.stringify(originalBoard));
        whiteBar = JSON.parse(JSON.stringify(originalWhiteBar));
        blackBar = JSON.parse(JSON.stringify(originalBlackBar));
        whiteBearOff = JSON.parse(JSON.stringify(originalWhiteBearOff));
        blackBearOff = JSON.parse(JSON.stringify(originalBlackBearOff));
        dice = JSON.parse(JSON.stringify(originalDice));
        
        // Force redraw
        if (typeof redrawBoard === 'function') {
            redrawBoard();
        }
    }
    
    selectedChecker = null;
    validMoves = [];
    combinedMoves = [];
}

// Simulate debug button click to force synchronization
function simulateDebugButtonClick() {
    console.log("SIMULATING DEBUG BUTTON CLICK");
    window.debugButtonClicked = true;
    window.forcePlayerOneUpdate = true;
    forceSyncNow();
}

// BREAKTHROUGH: Add a function to force immediate synchronization
function forceSyncNow() {
    console.log("FORCE SYNC NOW: Immediate synchronization requested");
    window.forcePlayerOneUpdate = true;
    window.debugButtonClicked = true;
    saveGameStateWithVerification();
}

// CRITICAL FIX: Function to lock the current board state after a move
function lockCurrentBoardState(reason) {
    console.log("MOVE LOCK: Locking current board state", reason);
    
    // Create a deep copy of the current board
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
    
    // Create deep copies of other game state
    const whiteBarCopy = Array.isArray(window.whiteBar) ? 
        window.whiteBar.map(checker => ({ color: checker.color })) : [];
        
    const blackBarCopy = Array.isArray(window.blackBar) ? 
        window.blackBar.map(checker => ({ color: checker.color })) : [];
        
    const whiteBearOffCopy = Array.isArray(window.whiteBearOff) ? 
        window.whiteBearOff.map(checker => ({ color: checker.color })) : [];
        
    const blackBearOffCopy = Array.isArray(window.blackBearOff) ? 
        window.blackBearOff.map(checker => ({ color: checker.color })) : [];
    
    // Store the locked state
    lastBoardState = {
        board: boardCopy,
        whiteBar: whiteBarCopy,
        blackBar: blackBarCopy,
        whiteBearOff: whiteBearOffCopy,
        blackBearOff: blackBearOffCopy,
        currentPlayer: window.currentPlayer,
        dice: [...window.dice],
        timestamp: Date.now(),
        reason: reason
    };
    
    // Set up reversion prevention
    if (moveReversionTimeout) {
        clearTimeout(moveReversionTimeout);
    }
    
    moveReversionTimeout = setTimeout(checkForReversion, 1000);
}

// CRITICAL FIX: Function to check if the board has reverted and fix it
function checkForReversion() {
    if (!lastBoardState) return;
    
    console.log("MOVE LOCK: Checking for reversion");
    
    // Check if the board has reverted
    let hasReverted = false;
    
    // Compare board states
    if (Array.isArray(window.board) && Array.isArray(lastBoardState.board)) {
        for (let i = 0; i < Math.min(window.board.length, lastBoardState.board.length); i++) {
            const currentPoint = window.board[i];
            const lockedPoint = lastBoardState.board[i];
            
            if (currentPoint.length !== lockedPoint.length) {
                hasReverted = true;
                break;
            }
            
            for (let j = 0; j < currentPoint.length; j++) {
                if (currentPoint[j].color !== lockedPoint[j].color) {
                    hasReverted = true;
                    break;
                }
            }
            
            if (hasReverted) break;
        }
    }
    
    // Also check bars and bear-offs
    if (!hasReverted) {
        if (window.whiteBar.length !== lastBoardState.whiteBar.length ||
            window.blackBar.length !== lastBoardState.blackBar.length ||
            window.whiteBearOff.length !== lastBoardState.whiteBearOff.length ||
            window.blackBearOff.length !== lastBoardState.blackBearOff.length) {
            hasReverted = true;
        }
    }
    
    // If the board has reverted, restore it
    if (hasReverted) {
        console.log("MOVE LOCK: Board has reverted, restoring locked state");
        
        // Restore the board
        window.board = lastBoardState.board;
        window.whiteBar = lastBoardState.whiteBar;
        window.blackBar = lastBoardState.blackBar;
        window.whiteBearOff = lastBoardState.whiteBearOff;
        window.blackBearOff = lastBoardState.blackBearOff;
        window.currentPlayer = lastBoardState.currentPlayer;
        window.dice = [...lastBoardState.dice];
        
        // Force a redraw
        if (typeof redrawBoard === 'function') {
            redrawBoard();
        }
        
        // Force a save to Firebase
        window.forcePlayerOneUpdate = true;
        window.debugButtonClicked = true;
        forceSyncNow();
        
        // Schedule another check
        moveReversionTimeout = setTimeout(checkForReversion, 1000);
    } else {
        console.log("MOVE LOCK: No reversion detected");
        
        // Schedule another check just to be safe
        moveReversionTimeout = setTimeout(checkForReversion, 1000);
    }
}

// CRITICAL FIX: Override executeMove to lock the board state after a move
const originalExecuteMove = window.executeMove || function() {};
window.executeMove = function(fromPoint, toPoint) {
    const result = originalExecuteMove.apply(this, arguments);
    
    if (result) {
        console.log("Move executed, locking board state");
        lockCurrentBoardState("move_executed");
        
        // Also force a sync
        window.forcePlayerOneUpdate = true;
        window.debugButtonClicked = true;
        forceSyncNow();
    }
    
    return result;
};

// CRITICAL FIX: Override rollDice to lock the board state after rolling
const originalRollDice = window.rollDice || function() {};
window.rollDice = function() {
    const result = originalRollDice.apply(this, arguments);
    
    console.log("Dice rolled, locking board state");
    lockCurrentBoardState("dice_rolled");
    
    // Also force a sync
    window.forcePlayerOneUpdate = true;
    window.debugButtonClicked = true;
    forceSyncNow();
    
    return result;
};

// CRITICAL FIX: Override switchPlayer to lock the board state after switching
const originalSwitchPlayer = window.switchPlayer || function() {};
window.switchPlayer = function() {
    const result = originalSwitchPlayer.apply(this, arguments);
    
    console.log("Player switched, locking board state");
    lockCurrentBoardState("player_switched");
    
    // Also force a sync
    window.forcePlayerOneUpdate = true;
    window.debugButtonClicked = true;
    forceSyncNow();
    
    return result;
};

// BREAKTHROUGH: Process the sync queue periodically
function processForceSyncQueue() {
    if (forceSyncQueue.length > 0 && !isSyncing && Date.now() - lastSyncTime > SYNC_INTERVAL) {
        isSyncing = true;
        lastSyncTime = Date.now();
        
        const syncItem = forceSyncQueue.shift();
        console.log("FORCE SYNC: Processing queued sync", syncItem);
        
        // Always set force update flag to true for queued syncs
        window.forcePlayerOneUpdate = true;
        window.debugButtonClicked = true; // This flag seems to help with synchronization
        
        // Call save with verification
        saveGameStateWithVerification(() => {
            isSyncing = false;
            // Process next item in queue if available
            setTimeout(processForceSyncQueue, 100);
        });
    }
}

// Set up periodic processing of the sync queue
setInterval(processForceSyncQueue, 200);

// BREAKTHROUGH: Enhanced save with verification
function saveGameStateWithVerification(callback) {
    if (typeof saveGameState !== 'function') {
        console.error("saveGameState function not available");
        if (callback) callback(false);
        return;
    }
    
    // Save current state for verification
    const currentBoard = JSON.stringify(window.board);
    const currentDice = JSON.stringify(window.dice);
    const currentPlayer = window.currentPlayer;
    
    console.log("FORCE SYNC: Saving game state with verification");
    
    // Force update flags
    window.forcePlayerOneUpdate = true;
    window.debugButtonClicked = true;
    
    // Call the original save function
    saveGameState();
    
    // Verify the save after a short delay
    setTimeout(() => {
        // Load the game state from Firebase to verify
        if (typeof firebase !== 'undefined' && firebase.database && window.gameId) {
            firebase.database().ref('games/' + window.gameId).once('value')
                .then((snapshot) => {
                    const savedData = snapshot.val();
                    if (!savedData) {
                        console.error("SYNC ERROR: No data found in Firebase");
                        retrySync(callback);
                        return;
                    }
                    
                    // Verify critical game state elements
                    const savedBoard = JSON.stringify(savedData.board);
                    const savedDice = JSON.stringify(savedData.dice);
                    const savedPlayer = savedData.currentPlayer;
                    
                    if (savedBoard !== currentBoard || savedDice !== currentDice || savedPlayer !== currentPlayer) {
                        console.error("SYNC ERROR: Verification failed, data mismatch");
                        console.log("Local:", { board: currentBoard, dice: currentDice, player: currentPlayer });
                        console.log("Saved:", { board: savedBoard, dice: savedDice, player: savedPlayer });
                        retrySync(callback);
                    } else {
                        console.log("SYNC SUCCESS: Verification passed");
                        syncAttempts = 0;
                        if (callback) callback(true);
                    }
                })
                .catch((error) => {
                    console.error("SYNC ERROR: Firebase read error", error);
                    retrySync(callback);
                });
        } else {
            console.warn("SYNC WARNING: Firebase not available for verification");
            if (callback) callback(false);
        }
    }, 1000);
}

// BREAKTHROUGH: Retry sync if verification fails
function retrySync(callback) {
    syncAttempts++;
    if (syncAttempts < MAX_SYNC_ATTEMPTS) {
        console.log(`SYNC RETRY: Attempt ${syncAttempts} of ${MAX_SYNC_ATTEMPTS}`);
        setTimeout(() => {
            saveGameStateWithVerification(callback);
        }, 1000);
    } else {
        console.error("SYNC FAILED: Max retry attempts reached");
        syncAttempts = 0;
        if (callback) callback(false);
    }
}

// BREAKTHROUGH: Queue a forced sync
function queueForceSync(reason) {
    forceSyncQueue.push({
        reason: reason,
        timestamp: Date.now()
    });
    
    // Process immediately if possible
    processForceSyncQueue();
}
