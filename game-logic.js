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
        if (!canPlayerMove()) {
            console.log("Cannot move - not your turn");
            selectedChecker = null;
            validMoves = [];
            combinedMoves = [];
            return;
        }
        
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
            combinedMoves = [];
            return;
        }
        
        let moved = false;
        let playerColor = currentPlayer === 'player1' ? 'white' : 'black';
        
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
                        saveGameStateThrottled();
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
                        saveGameStateThrottled();
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
            
            // Update UI directly to prevent loops
            updateUIDirectly();
            
            // Check win condition
            if ((playerColor === 'white' && whiteBearOff.length === 15) ||
                (playerColor === 'black' && blackBearOff.length === 15)) {
                checkWinCondition();
            } else if (dice.length === 0 || !hasLegalMoves()) {
                // Switch player
                switchPlayer();
            }
            
            // Save game state after move
            saveGameStateThrottled();
        }
        
        selectedChecker = null;
        validMoves = [];
        combinedMoves = [];
        
    } catch (error) {
        console.error("Error in mouseReleased:", error);
        selectedChecker = null;
        validMoves = [];
        combinedMoves = [];
    }
}

// Game mechanics functions
function executeMove(fromPoint, toPoint) {
    console.log("Executing move from", fromPoint, "to", toPoint);
    
    try {
        // Set move in progress flag
        window.moveInProgress = true;
        
        // Store previous state before any changes
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

        // Make the move
        const checker = removeChecker(fromPoint);
        if (!checker) {
            console.error("No checker found at point", fromPoint);
            window.moveInProgress = false;
            return false;
        }
        
        // Add checker to new position
        addChecker(toPoint, checker.color);
        
        // Find and remove the used dice value
        const moveDistance = Math.abs(fromPoint - toPoint);
        const diceIndex = dice.indexOf(moveDistance);
        if (diceIndex !== -1) {
            dice.splice(diceIndex, 1);
        }
        
        // Log the move details
        console.log("Move completed: ", {
            from: fromPoint,
            to: toPoint,
            color: checker.color,
            remainingDice: [...dice]
        });

        // Force immediate UI updates
        updateUIDirectly();
        
        // CRITICAL: Save state immediately after move
        if (typeof window.saveGameState === 'function') {
            console.log("MOVE: Immediate save after move");
            window.saveGameState();
            
            // Additional saves with increasing delays
            setTimeout(() => {
                if (typeof window.saveGameState === 'function') {
                    console.log("MOVE: Second save after move");
                    window.saveGameState();
                }
            }, 500);
        }

        // If no more moves possible, switch player after a delay
        if (dice.length === 0 || !hasLegalMoves()) {
            setTimeout(() => {
                if (typeof switchPlayer === 'function') {
                    switchPlayer();
                }
                window.moveInProgress = false;
            }, 1000);
        } else {
            // Clear move in progress after a short delay
            setTimeout(() => {
                window.moveInProgress = false;
            }, 500);
        }
        
        return true;
    } catch (error) {
        console.error("Error executing move:", error);
        window.moveInProgress = false;
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
    console.log("Switching player");
    
    // Set move in progress during player switch
    window.moveInProgress = true;
    
    // Reset dice
    dice = [];
    diceRolled = false;
    
    // Switch current player
    currentPlayer = currentPlayer === 'player1' ? 'player2' : 'player1';
    
    // Force UI updates
    updateUIDirectly();
    
    // CRITICAL: Save state immediately after player switch
    if (typeof window.saveGameState === 'function') {
        console.log("SWITCH: Immediate save after player switch");
        window.saveGameState();
        
        // Additional save after a delay
        setTimeout(() => {
            if (typeof window.saveGameState === 'function') {
                console.log("SWITCH: Delayed save after player switch");
                window.saveGameState();
                window.moveInProgress = false;
            }
        }, 500);
    } else {
        window.moveInProgress = false;
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
        console.log("Can player move check:", { playerRole: playerRole, currentPlayer: currentPlayer });
        
        if (typeof playerRole === 'undefined') return false;
        if (playerRole === "spectator") return false;
        if (playerRole === "player1" && currentPlayer === "player1") return true;
        if (playerRole === "player2" && currentPlayer === "player2") return true;
        
        return false;
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
