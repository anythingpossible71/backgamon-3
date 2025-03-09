// game-logic.js - Version 10.0.0
// This file handles game mechanics, moves, and rules
// Local Two-Player Mode

// Variables to prevent rapid actions
let isRolling = false;
let lastRollTime = 0;
let lastSaveTime = 0;
let lastMouseEvent = 0;
const ROLL_COOLDOWN = 1000; // 1 second between rolls
const SAVE_COOLDOWN = 2000; // 2 seconds between saves
const MOUSE_COOLDOWN = 100; // 100ms between mouse events

// Add global variables for move locking mechanism
let isMoveLocked = false;
let lockedBoardState = null;
let lockTimeout = null;
let revertCheckInterval = null;
const LOCK_DURATION = 10000; // 10 seconds lock after moves

// Game state variables
let selectedChecker = null;
let validMoves = [];
let combinedMoves = [];

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
        return; // Skip if too soon after last event
    }
    lastMouseEvent = currentTime;
    
    try {
        if (!selectedChecker) {
            console.log("No checker selected");
            return;
        }
        
        // Check for win condition
        if ((whiteBearOff && whiteBearOff.length === 15) || 
            (blackBearOff && blackBearOff.length === 15)) {
            console.log("Game already won");
            selectedChecker = null;
            validMoves = [];
            return;
        }
        
        let fromPoint = selectedChecker.pointIndex;
        let playerColor = currentPlayer === 'player1' ? 'white' : 'black';
        
        // Check if mouse is over a valid move point
        for (let i = 0; i < validMoves.length; i++) {
            const toPoint = validMoves[i];
            
            // Handle bearing off
            if ((playerColor === 'white' && toPoint === 24) || 
                (playerColor === 'black' && toPoint === -1)) {
                
                // Check if mouse is over bear-off area
                const bearOffX = playerColor === 'white' ? 
                    BOARD_WIDTH + BEAR_OFF_WIDTH + BEAR_OFF_WIDTH/2 : 
                    BEAR_OFF_WIDTH/2;
                const bearOffY = BOARD_HEIGHT/2;
                
                if (dist(mouseX, mouseY, bearOffX, bearOffY) < CHECKER_RADIUS * 2) {
                    if (executeMove(fromPoint, toPoint)) {
                        // Check if all dice are used
                        let allDiceUsed = true;
                        for (let j = 0; j < dice.length; j++) {
                            if (!dice[j].used) {
                                allDiceUsed = false;
                                break;
                            }
                        }
                        
                        // If all dice are used, switch player
                        if (allDiceUsed) {
                            setTimeout(() => {
                                switchPlayer();
                            }, 500);
                        }
                        
                        // Check for win
                        if ((playerColor === 'white' && whiteBearOff.length === 15) || 
                            (playerColor === 'black' && blackBearOff.length === 15)) {
                            gameStatus = (playerColor === 'white' ? 'Player 1' : 'Player 2') + " wins!";
                            if (typeof updateGameStatus === 'function') {
                                updateGameStatus();
                            }
                        }
                        
                        // Update UI
                        if (typeof updatePlayerInfo === 'function') {
                            updatePlayerInfo();
                        }
                        
                        // Save game state
                        saveGameStateThrottled();
                    }
                    
                    selectedChecker = null;
                    validMoves = [];
                    return;
                }
            }
            
            // Handle regular move
            if (toPoint >= 0 && toPoint < 24) {
                const pointX = getPointX(toPoint);
                const pointY = getPointY(toPoint);
                const checkerCount = board[toPoint] ? board[toPoint].length : 0;
                const checkerY = getCheckerY(toPoint, checkerCount);
                
                if (dist(mouseX, mouseY, pointX, checkerY) < CHECKER_RADIUS * 2) {
                    if (executeMove(fromPoint, toPoint)) {
                        // Check if all dice are used
                        let allDiceUsed = true;
                        for (let j = 0; j < dice.length; j++) {
                            if (!dice[j].used) {
                                allDiceUsed = false;
                                break;
                            }
                        }
                        
                        // If all dice are used, switch player
                        if (allDiceUsed) {
                            setTimeout(() => {
                                switchPlayer();
                            }, 500);
                        }
                        
                        // Update UI
                        if (typeof updatePlayerInfo === 'function') {
                            updatePlayerInfo();
                        }
                        
                        // Save game state
                        saveGameStateThrottled();
                    }
                    
                    selectedChecker = null;
                    validMoves = [];
                    return;
                }
            }
        }
        
        // If we get here, no valid move was made
        selectedChecker = null;
        validMoves = [];
        
    } catch (error) {
        console.error("Error in mouseReleased:", error);
        selectedChecker = null;
        validMoves = [];
    }
}

// Game mechanics functions
function executeMove(fromPoint, toPoint) {
    try {
        console.log("Executing move from", fromPoint, "to", toPoint);
        
        let playerColor = currentPlayer === 'player1' ? 'white' : 'black';
        let direction = playerColor === 'white' ? 1 : -1;
        
        // Handle bearing off
        if ((playerColor === 'white' && toPoint === 24) || 
            (playerColor === 'black' && toPoint === -1)) {
            
            // Get the checker
            let checker;
            if (fromPoint === -1) {
                // Moving from bar
                checker = playerColor === 'white' ? whiteBar.pop() : blackBar.pop();
            } else {
                // Moving from a point
                checker = board[fromPoint].pop();
            }
            
            // Add to bear off area
            if (playerColor === 'white') {
                whiteBearOff.push(checker);
            } else {
                blackBearOff.push(checker);
            }
            
            // Mark the appropriate die as used
            let dieValue = Math.abs(toPoint - fromPoint);
            for (let i = 0; i < dice.length; i++) {
                if (!dice[i].used && dice[i].value >= dieValue) {
                    dice[i].used = true;
                    break;
                }
            }
            
            console.log("Checker borne off");
            return true;
        }
        
        // Handle moving from bar
        if (fromPoint === -1) {
            let checker;
            if (playerColor === 'white') {
                checker = whiteBar.pop();
            } else {
                checker = blackBar.pop();
            }
            
            // Check if there's an opponent's checker
            if (board[toPoint].length === 1 && board[toPoint][0].color !== playerColor) {
                let opponentChecker = board[toPoint].pop();
                if (opponentChecker.color === 'white') {
                    whiteBar.push(opponentChecker);
                } else {
                    blackBar.push(opponentChecker);
                }
                console.log("Opponent's checker sent to bar");
            }
            
            // Add checker to target point
            board[toPoint].push(checker);
            
            // Mark the appropriate die as used
            let dieValue = playerColor === 'white' ? toPoint + 1 : 24 - toPoint;
            for (let i = 0; i < dice.length; i++) {
                if (!dice[i].used && dice[i].value === dieValue) {
                    dice[i].used = true;
                    break;
                }
            }
            
            console.log("Moved from bar to", toPoint);
            return true;
        }
        
        // Regular move
        let checker = board[fromPoint].pop();
        
        // Check if there's an opponent's checker
        if (board[toPoint].length === 1 && board[toPoint][0].color !== playerColor) {
            let opponentChecker = board[toPoint].pop();
            if (opponentChecker.color === 'white') {
                whiteBar.push(opponentChecker);
            } else {
                blackBar.push(opponentChecker);
            }
            console.log("Opponent's checker sent to bar");
        }
        
        // Add checker to target point
        board[toPoint].push(checker);
        
        // Mark the appropriate die as used
        let dieValue = Math.abs(toPoint - fromPoint);
        for (let i = 0; i < dice.length; i++) {
            if (!dice[i].used && dice[i].value === dieValue) {
                dice[i].used = true;
                break;
            }
        }
        
        console.log("Moved from", fromPoint, "to", toPoint);
        return true;
    } catch (error) {
        console.error("Error executing move:", error);
        return false;
    }
}

// Helper function to validate moves
function isValidMove(fromPoint, toPoint) {
    // Basic validation
    if (fromPoint < -1 || fromPoint > 24 || toPoint < -1 || toPoint > 24) {
        return false;
    }
    
    // Validate direction based on current player
    const direction = currentPlayer === 'player1' ? 1 : -1;
    if (toPoint !== -1 && toPoint !== 24) { // Skip direction check for bearing off
        if (Math.sign(toPoint - fromPoint) !== direction) {
            return false;
        }
    }
    
    // Validate distance matches available dice
    const moveDistance = Math.abs(toPoint - fromPoint);
    return dice.includes(moveDistance);
}

// Helper function to validate game state
function validateGameState() {
    // Count total checkers
    let totalCheckers = 0;
    
    // Count checkers on board
    for (let i = 0; i < 24; i++) {
        if (Array.isArray(board[i])) {
            totalCheckers += board[i].length;
        }
    }
    
    // Add checkers from bars and bear off
    totalCheckers += (whiteBar ? whiteBar.length : 0);
    totalCheckers += (blackBar ? blackBar.length : 0);
    totalCheckers += (whiteBearOff ? whiteBearOff.length : 0);
    totalCheckers += (blackBearOff ? blackBearOff.length : 0);
    
    // Validate total checkers
    if (totalCheckers !== 30) {
        console.error("Invalid checker count:", totalCheckers);
        return false;
    }
    
    return true;
}

// CRITICAL: Function to check for and restore board state if reversion detected
function checkAndRestoreBoardState() {
    if (!isMoveLocked || !lockedBoardState) return;
    
    try {
        // Compare current board with locked board
        const currentBoardJSON = JSON.stringify(board);
        const lockedBoardJSON = JSON.stringify(lockedBoardState.board);
        
        if (currentBoardJSON !== lockedBoardJSON) {
            console.log("CRITICAL: Board state reversion detected, restoring locked state");
            
            // Restore from locked state
            board = JSON.parse(JSON.stringify(lockedBoardState.board));
            whiteBar = [...lockedBoardState.whiteBar];
            blackBar = [...lockedBoardState.blackBar];
            whiteBearOff = [...lockedBoardState.whiteBearOff];
            blackBearOff = [...lockedBoardState.blackBearOff];
            dice = [...lockedBoardState.dice];
            diceRolled = lockedBoardState.diceRolled;
            currentPlayer = lockedBoardState.currentPlayer;
            
            // Force redraw
            if (typeof redraw === 'function') {
                redraw();
            }
            
            // Force save our state back to Firebase
            if (typeof saveGameState === 'function') {
                console.log("FORCE SAVING restored state to Firebase");
                saveGameState();
            }
        }
    } catch (error) {
        console.error("Error in checkAndRestoreBoardState:", error);
    }
}

// Start continuous reversion check
function startReversionCheck() {
    // Clear any existing interval
    if (revertCheckInterval) {
        clearInterval(revertCheckInterval);
    }
    
    // Set up a new interval to check every second
    revertCheckInterval = setInterval(() => {
        checkAndRestoreBoardState();
    }, 1000);
    
    // Clear the interval after the lock duration
    setTimeout(() => {
        if (revertCheckInterval) {
            clearInterval(revertCheckInterval);
            revertCheckInterval = null;
        }
    }, LOCK_DURATION);
}

// Roll dice with reliable state management
function rollDice() {
    console.log("Rolling dice");
    
    // Prevent rapid rolling
    const now = Date.now();
    if (now - lastRollTime < ROLL_COOLDOWN) {
        console.log("Roll cooldown in effect");
        return;
    }
    lastRollTime = now;
    
    if (diceRolled) {
        console.log("Dice already rolled");
        return;
    }
    
    // Generate random dice values
    dice = [
        { value: Math.floor(Math.random() * 6) + 1, used: false },
        { value: Math.floor(Math.random() * 6) + 1, used: false }
    ];
    
    // Check for doubles
    if (dice[0].value === dice[1].value) {
        console.log("Doubles rolled!");
        dice = [
            { value: dice[0].value, used: false },
            { value: dice[0].value, used: false },
            { value: dice[0].value, used: false },
            { value: dice[0].value, used: false }
        ];
    }
    
    diceRolled = true;
    
    // Update game status
    const player = currentPlayer === 'player1' ? 'Player 1' : 'Player 2';
    const diceValues = dice.map(d => d.value).join(', ');
    gameStatus = `${player} rolled ${diceValues}!`;
    
    console.log("Dice rolled:", dice.map(d => d.value));
    
    // Update UI
    if (typeof updateDiceDisplay === 'function') {
        updateDiceDisplay();
    }
    if (typeof updateGameStatus === 'function') {
        updateGameStatus();
    }
    
    // Save game state
    saveGameStateThrottled();
}

function switchPlayer() {
    try {
        console.log("Switching player from", currentPlayer);
        
        // Reset dice
        dice = [];
        diceRolled = false;
        
        // Switch player
        currentPlayer = currentPlayer === 'player1' ? 'player2' : 'player1';
        
        // Update game status
        gameStatus = (currentPlayer === 'player1' ? 'Player 1' : 'Player 2') + "'s turn to roll.";
        
        console.log("Switched to", currentPlayer);
        
        // Update UI
        if (typeof updatePlayerInfo === 'function') {
            updatePlayerInfo();
        }
        if (typeof updateDiceDisplay === 'function') {
            updateDiceDisplay();
        }
        if (typeof updateGameStatus === 'function') {
            updateGameStatus();
        }
        
        // Save game state
        saveGameStateThrottled();
        
        return true;
    } catch (error) {
        console.error("Error switching player:", error);
        return false;
    }
}

// Throttled version of saveGameState to prevent rapid Firebase updates
function saveGameStateThrottled() {
    const currentTime = performance.now();
    if (currentTime - lastSaveTime < SAVE_COOLDOWN) {
        console.log("Throttling game state save (too recent)");
        return;
    }
    
    lastSaveTime = currentTime;
    if (typeof window.saveGameState === 'function') {
        window.saveGameState();
    }
}

// game-logic.js (Part 3) - Game state functions

function calculateValidMoves(pointIndex, dice) {
    try {
        console.log("Calculating valid moves from point:", pointIndex);
        
        // Reset valid moves
        validMoves = [];
        combinedMoves = [];
        
        if (!dice || dice.length === 0) {
            console.log("No dice available");
            return;
        }
        
        let playerColor = currentPlayer === 'player1' ? 'white' : 'black';
        let direction = playerColor === 'white' ? 1 : -1;
        
        // Check if player can bear off
        let canBearOff = canPlayerBearOff(playerColor);
        
        // Calculate valid moves for each die
        for (let i = 0; i < dice.length; i++) {
            let die = dice[i];
            
            // Skip used dice
            if (die.used) continue;
            
            let targetIndex = pointIndex + (die.value * direction);
            
            // Check for bearing off
            if (canBearOff) {
                if (playerColor === 'white') {
                    if (pointIndex >= 18) { // Only allow bearing off from home board
                        if (targetIndex >= 24 || (die.value > 24 - pointIndex && isValidBearOff(pointIndex, die.value, playerColor))) {
                            if (!validMoves.includes(24)) {
                                validMoves.push(24); // Special target index for bearing off
                                console.log("Valid bearing off move for white");
                            }
                            continue;
                        }
                    }
                } else { // Black player
                    if (pointIndex <= 5) { // Only allow bearing off from home board
                        if (targetIndex < 0 || (die.value > pointIndex + 1 && isValidBearOff(pointIndex, die.value, playerColor))) {
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
        
        console.log("Valid moves calculated:", validMoves);
        return validMoves;
    } catch (error) {
        console.error("Error calculating valid moves:", error);
        return [];
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
                let entryPoint = playerColor === 'white' ? die.value - 1 : 24 - die.value;
                
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
                        let targetIndex = i + (die.value * direction);
                        
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
}

// game-logic.js (Part 5) - Final helper functions

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
        console.log("Can player move check:", { currentPlayer: currentPlayer });
        
        // In local mode, always allow the current player to move
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
            dice1El.textContent = dice && dice.length > 0 ? dice[0].value : '-';
        }
        
        if (dice2El) {
            dice2El.textContent = dice && dice.length > 1 ? dice[1].value : '-';
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

// Function to display the version name on the screen
function displayVersionName() {
    const versionName = "Version 10.0.0 - Local Mode";
    const versionElement = document.createElement('div');
    versionElement.id = 'version-name';
    versionElement.style.position = 'absolute';
    versionElement.style.top = '10px';
    versionElement.style.right = '10px';
    versionElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    versionElement.style.color = 'white';
    versionElement.style.padding = '8px 15px';
    versionElement.style.borderRadius = '5px';
    versionElement.style.fontWeight = 'bold';
    versionElement.style.zIndex = '1000';
    versionElement.textContent = versionName;
    
    // Remove any existing version display
    const existingVersion = document.getElementById('version-name');
    if (existingVersion) {
        existingVersion.remove();
    }
    
    document.body.appendChild(versionElement);
}

// Remove the automatic event listener to avoid duplicate version displays
// The version is already displayed by firebase-config.js's displayVersionBanner function
// window.addEventListener('DOMContentLoaded', displayVersionName);

// Expose functions to window object
window.mousePressed = mousePressed;
window.mouseReleased = mouseReleased;
window.canPlayerMove = canPlayerMove;
window.calculateValidMoves = calculateValidMoves;
window.isValidMove = isValidMove;
window.executeMove = executeMove;
window.dist = dist;

// Helper function to calculate distance between two points
function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1));
}
