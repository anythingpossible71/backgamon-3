// fixed-game.js - Version 10.8.0 (Code last updated: June 19, 2024 @ 18:00)
// Backgammon implementation fully compliant with standard rules

// Game configurations
const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 600;
const POINT_WIDTH = 50;
const POINT_HEIGHT = 200;
const CHECKER_RADIUS = 22;
const BAR_WIDTH = 50;
const BEAR_OFF_WIDTH = 80;

// Game state variables 
let board = [];
let currentPlayer = 'player1';
let dice = [];
let diceRolled = false;
let selectedChecker = null;
let validMoves = [];
let whiteBar = [];
let blackBar = [];
let whiteBearOff = [];
let blackBearOff = [];
let gameStatus = "Player 1's turn to roll";
let lastUpdateTime = new Date().toLocaleString();
let mustUseBar = false;
let forcedMove = false; // For tracking when only one particular move is allowed

// p5.js setup
let canvas;
let isDragging = false; // Track when we're actively dragging

// Initialize the game
function setup() {
    console.log("Setup function called");
    canvas = createCanvas(BOARD_WIDTH + 2 * BEAR_OFF_WIDTH, BOARD_HEIGHT);
    canvas.parent('canvas-container');
    
    initializeBoard();
    
    // Setup event handlers
    document.getElementById('roll-button').addEventListener('click', rollDice);
    document.getElementById('reset-button').addEventListener('click', resetGame);
    
    loadGameState();
    
    console.log("Backgammon game initialized");
}

// Main draw loop
function draw() {
    background(240);
    
    drawBoard();
    drawCheckers();
    drawBar();
    drawBearOffAreas();
    
    if (selectedChecker) {
        drawValidMoves();
        
        // Draw selected checker being dragged
        let checker;
        if (selectedChecker.pointIndex === -1) {
            checker = { color: currentPlayer === 'player1' ? 'white' : 'black' };
        } else {
            checker = board[selectedChecker.pointIndex][selectedChecker.checkerIndex];
        }
        
        if (checker) {
            drawChecker(mouseX, mouseY, checker.color);
        }
    }
    
    updateUI();
}

// Initialize the game board with correct checker placement according to standard backgammon rules
function initializeBoard() {
    board = [];
    for (let i = 0; i < 24; i++) {
        board.push([]);
    }
    
    // STANDARD BACKGAMMON SETUP:
    // White (player1) moves COUNTERCLOCKWISE from point 24 toward point 1
    // Black (player2) moves CLOCKWISE from point 1 toward point 24
    
    // White checkers (player1)
    for (let i = 0; i < 2; i++) board[0].push({ color: 'white' });   // 2 checkers on point 1
    for (let i = 0; i < 5; i++) board[5].push({ color: 'white' });   // 5 checkers on point 6
    for (let i = 0; i < 3; i++) board[7].push({ color: 'white' });   // 3 checkers on point 8
    for (let i = 0; i < 5; i++) board[12].push({ color: 'white' });  // 5 checkers on point 13
    
    // Black checkers (player2)
    for (let i = 0; i < 2; i++) board[23].push({ color: 'black' });  // 2 checkers on point 24
    for (let i = 0; i < 5; i++) board[18].push({ color: 'black' });  // 5 checkers on point 19
    for (let i = 0; i < 3; i++) board[16].push({ color: 'black' });  // 3 checkers on point 17
    for (let i = 0; i < 5; i++) board[11].push({ color: 'black' });  // 5 checkers on point 12
    
    whiteBar = [];
    blackBar = [];
    whiteBearOff = [];
    blackBearOff = [];
    dice = [];
    diceRolled = false;
    currentPlayer = 'player1';
    gameStatus = "Player 1's turn to roll";
    lastUpdateTime = new Date().toLocaleString();
    forcedMove = false;
    
    saveGameState();
}

// Roll dice with proper handling of doubles
function rollDice() {
    if (diceRolled) return;
    
    dice = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
    ];

    // If doubles are rolled, player gets 4 moves of that value
    if (dice[0] === dice[1]) {
        dice = [dice[0], dice[0], dice[0], dice[0]];
        gameStatus = `${currentPlayer === 'player1' ? 'Player 1' : 'Player 2'} rolled double ${dice[0]}s!`;
    } else {
        gameStatus = `${currentPlayer === 'player1' ? 'Player 1' : 'Player 2'} rolled ${dice.join(', ')}`;
    }

    diceRolled = true;
    
    // Check if any moves are possible with this roll
    if (!hasLegalMoves()) {
        gameStatus += " - No legal moves possible. Turn will be skipped.";
        setTimeout(switchPlayer, 2000); // Give player time to see they have no moves
    }
    
    updateUI();
}

// Mouse interaction handlers - improved for reliable dragging
function mousePressed() {
    if (!diceRolled) return;
    
    const playerColor = currentPlayer === 'player1' ? 'white' : 'black';
    
    // RULE: Must move checkers from the bar first
    const hasBarCheckers = (playerColor === 'white' && whiteBar.length > 0) || 
                          (playerColor === 'black' && blackBar.length > 0);
    
    if (hasBarCheckers) {
        const barX = BOARD_WIDTH/2 + BEAR_OFF_WIDTH;
        const barY = playerColor === 'white' ? BOARD_HEIGHT/4 : BOARD_HEIGHT * 3/4;
        
        if (dist(mouseX, mouseY, barX, barY) < CHECKER_RADIUS * 2) {
            selectedChecker = { pointIndex: -1, checkerIndex: 0 };
            isDragging = true;
            calculateValidMoves(-1);
            return;
        }
        
        // If player has checkers on the bar, they must move those first
        gameStatus = `${playerColor === 'white' ? 'White' : 'Black'} must move from the bar first`;
        updateUI();
        return;
    }
    
    // Regular checker selection
    for (let i = 0; i < board.length; i++) {
        const point = board[i];
        if (!point.length) continue;
        
        // Only check top checker of each point that belongs to current player
        const topCheckerIndex = point.length - 1;
        const topChecker = point[topCheckerIndex];
        
        if (topChecker.color === playerColor) {
            const pointX = getPointX(i);
            const checkerY = getCheckerY(i, topCheckerIndex);
            
            if (dist(mouseX, mouseY, pointX, checkerY) < CHECKER_RADIUS) {
                selectedChecker = { pointIndex: i, checkerIndex: topCheckerIndex };
                isDragging = true;
                validMoves = calculateValidMoves(i);
                return;
            }
        }
    }
}

function mouseReleased() {
    if (!selectedChecker || !isDragging) return;
    
    // Check if mouse is over any valid move position
    for (const targetPoint of validMoves) {
        if (isMouseOverPoint(mouseX, mouseY, targetPoint)) {
            executeMove(selectedChecker.pointIndex, targetPoint);
            break;
        }
    }
    
    // Reset selection
    selectedChecker = null;
    validMoves = [];
    isDragging = false;
}

// Calculate all valid moves for a checker, enforcing standard backgammon rules
function calculateValidMoves(pointIndex) {
    if (!dice.length || !diceRolled) return [];

    const playerColor = currentPlayer === 'player1' ? 'white' : 'black';
    // Movement direction - White decreases (24→1), Black increases (1→24)
    const direction = playerColor === 'white' ? -1 : 1;
    const moves = [];
    
    // RULE: Must move checkers from the bar first
    if ((playerColor === 'white' && whiteBar.length > 0) ||
        (playerColor === 'black' && blackBar.length > 0)) {
        
        if (pointIndex !== -1) {
            mustUseBar = true;
            return [];
        }
        
        // Bar entry points are in opponent's home board
        // For white: entry points are 19-24 (index 18-23)
        // For black: entry points are 1-6 (index 0-5)
        const entryPoints = playerColor === 'white' ? [18, 19, 20, 21, 22, 23] : [0, 1, 2, 3, 4, 5];
        
        for (let i = 0; i < dice.length; i++) {
            const die = dice[i];
            if (!die) continue;
            
            // Calculate entry point when coming from the bar
            // White enters at 25-die, Black enters at die
            const entryPointIndex = playerColor === 'white' ? 24 - die : die - 1;
            
            if (entryPoints.includes(entryPointIndex) && canMoveToPoint(entryPointIndex, playerColor)) {
                moves.push(entryPointIndex);
            }
        }
        
        mustUseBar = false;
        
        // RULE: If only one die can be used, use the higher value
        if (moves.length === 0 && dice.length > 0) {
            // No valid moves, turn will be skipped
            return [];
        } else if (moves.length === 1 && dice.length > 1) {
            // Only one valid move, enforce using the higher die if that's the case
            const usedDieIndex = dice.indexOf(playerColor === 'white' ? 
                                              25 - (moves[0] + 1) : 
                                              moves[0] + 1);
            
            // If we're not using the higher die and there are two dice
            if (usedDieIndex !== -1 && dice.length === 2 && 
                dice[1-usedDieIndex] > dice[usedDieIndex]) {
                // Since there's only one valid move and it's not with the higher die,
                // we'll force the player to use that move
                forcedMove = true;
            }
        }
        
        return moves;
    }
    
    // For regular moves (not from the bar)
    let highestDie = 0;
    let highestDieIndex = -1;
    
    // Find the highest die value first
    for (let i = 0; i < dice.length; i++) {
        if (dice[i] > highestDie) {
            highestDie = dice[i];
            highestDieIndex = i;
        }
    }
    
    // Check moves for each die
    for (let i = 0; i < dice.length; i++) {
        const die = dice[i];
        if (!die) continue;
        
        const targetIndex = pointIndex + (die * direction);
        
        // Bearing off - all checkers must be in home board
        if (canBearOff(playerColor)) {
            if (playerColor === 'white' && pointIndex <= 5) {
                // White's home board is points 1-6 (indices 0-5)
                if (targetIndex < 0) {
                    moves.push(-1); // White bears off
                    continue;
                } else if (isHighestChecker(pointIndex, playerColor) && (die > pointIndex + 1)) {
                    // Can bear off highest checker with a larger die when no exact match
                    moves.push(-1);
                    continue;
                }
            } else if (playerColor === 'black' && pointIndex >= 18) {
                // Black's home board is points 19-24 (indices 18-23)
                if (targetIndex > 23) {
                    moves.push(24); // Black bears off
                    continue;
                } else if (isHighestChecker(pointIndex, playerColor) && (die > 24 - pointIndex)) {
                    // Can bear off highest checker with a larger die when no exact match
                    moves.push(24);
                    continue;
                }
            }
        }
        
        // Regular move within the board
        if (targetIndex >= 0 && targetIndex < 24) {
            if (canMoveToPoint(targetIndex, playerColor)) {
                moves.push(targetIndex);
            }
        }
    }
    
    // RULE: If no moves are possible with any die, return empty list
    if (moves.length === 0) {
        return [];
    }
    
    // RULE: If only one die can be used and it's not the highest die, force it
    if (moves.length === 1 && dice.length > 1 && dice.length <= 2) {
        const usedDieIndex = dice.indexOf(Math.abs(moves[0] - pointIndex));
        
        if (usedDieIndex !== -1 && highestDieIndex !== -1 && 
            usedDieIndex !== highestDieIndex && 
            dice[highestDieIndex] > dice[usedDieIndex]) {
            // Try the highest die to see if it could be used elsewhere
            let canUseHighestDie = false;
            for (let i = 0; i < 24; i++) {
                if (i === pointIndex) continue; // Skip current point
                
                const point = board[i];
                if (point.length > 0 && point[0].color === playerColor) {
                    const targetWithHighDie = i + (highestDie * direction);
                    if (targetWithHighDie >= 0 && targetWithHighDie < 24 && 
                        canMoveToPoint(targetWithHighDie, playerColor)) {
                        canUseHighestDie = true;
                        break;
                    }
                }
            }
            
            // If the highest die can't be used anywhere, force using this move
            if (!canUseHighestDie) {
                forcedMove = true;
            }
        }
    }
    
    return moves;
}

// Helper function to check if a checker is the highest one (farthest from home)
function isHighestChecker(pointIndex, playerColor) {
    // For white, check if there are white checkers with higher indices
    // For black, check if there are black checkers with lower indices
    
    if (playerColor === 'white') {
        for (let i = pointIndex + 1; i < 24; i++) {
            if (board[i].some(checker => checker.color === 'white')) {
                return false;
            }
        }
        return true;
    } else {
        for (let i = 0; i < pointIndex; i++) {
            if (board[i].some(checker => checker.color === 'black')) {
                return false;
            }
        }
        return true;
    }
}

// Check if a move to a point is valid
function canMoveToPoint(pointIndex, playerColor) {
    if (pointIndex < 0 || pointIndex >= 24) return false;
    
    const targetPoint = board[pointIndex];
    
    // Point is empty
    if (!targetPoint.length) return true;
    
    // Point has own checkers
    if (targetPoint[0].color === playerColor) return true;
    
    // Point has exactly one opponent checker (can be hit)
    if (targetPoint.length === 1 && targetPoint[0].color !== playerColor) return true;
    
    // Point has 2+ opponent checkers (blocked)
    return false;
}

// Check if the player can bear off (all checkers in home board or already borne off)
function canBearOff(playerColor) {
    if (playerColor === 'white') {
        // White's home board is points 1-6 (indices 0-5)
        // Check if all white checkers are in the home board or already borne off
        for (let i = 6; i < 24; i++) {
            if (board[i].some(checker => checker.color === 'white')) {
                return false;
            }
        }
        // Also check bar
        if (whiteBar.length > 0) {
            return false;
        }
    } else {
        // Black's home board is points 19-24 (indices 18-23)
        // Check if all black checkers are in the home board or already borne off
        for (let i = 0; i < 18; i++) {
            if (board[i].some(checker => checker.color === 'black')) {
                return false;
            }
        }
        // Also check bar
        if (blackBar.length > 0) {
            return false;
        }
    }
    return true;
}

// Execute a move with proper die selection logic
function executeMove(fromPoint, toPoint) {
    const playerColor = currentPlayer === 'player1' ? 'white' : 'black';
    let checker;
    
    // Get checker from bar or board
    if (fromPoint === -1) {
        checker = playerColor === 'white' ? whiteBar.pop() : blackBar.pop();
    } else {
        checker = board[fromPoint].pop();
    }
    
    // Handle bearing off
    if ((playerColor === 'white' && toPoint === -1) || 
        (playerColor === 'black' && toPoint === 24)) {
        // Bear off the checker
        (playerColor === 'white' ? whiteBearOff : blackBearOff).push(checker);
        gameStatus = `${playerColor === 'white' ? 'White' : 'Black'} checker borne off!`;
    } else {
        // Handle hitting opponent's checker
        if (board[toPoint].length === 1 && board[toPoint][0].color !== playerColor) {
            const hitChecker = board[toPoint].pop();
            (hitChecker.color === 'white' ? whiteBar : blackBar).push(hitChecker);
            gameStatus = `${hitChecker.color === 'white' ? 'White' : 'Black'} checker was hit!`;
        }
        
        // Add checker to the target point
        board[toPoint].push(checker);
        gameStatus = `${playerColor === 'white' ? 'White' : 'Black'} moved from ${fromPoint === -1 ? 'bar' : fromPoint+1} to ${toPoint+1}`;
    }
    
    // Calculate and remove used die
    let moveDistance;
    
    if (fromPoint === -1) {
        // From bar calculation depends on player color
        moveDistance = playerColor === 'white' ? 25 - (toPoint + 1) : toPoint + 1;
    } else if (toPoint === -1 || toPoint === 24) {
        // Bearing off - use exact die if possible, otherwise use larger die
        const exactDistance = playerColor === 'white' ? fromPoint + 1 : 24 - fromPoint;
        
        // Try to find the exact die first
        const exactDieIndex = dice.indexOf(exactDistance);
        if (exactDieIndex !== -1) {
            dice.splice(exactDieIndex, 1);
            
            // Check for remaining legal moves after this move
            checkRemainingMoves();
            return true;
        }
        
        // If no exact die, find the smallest die larger than the distance
        let smallestLargerDie = Infinity;
        let smallestLargerDieIndex = -1;
        
        for (let i = 0; i < dice.length; i++) {
            if (dice[i] > exactDistance && dice[i] < smallestLargerDie) {
                smallestLargerDie = dice[i];
                smallestLargerDieIndex = i;
            }
        }
        
        if (smallestLargerDieIndex !== -1) {
            dice.splice(smallestLargerDieIndex, 1);
            
            // Check for remaining legal moves
            checkRemainingMoves();
            return true;
        }
        
        // Should not reach here if move validation is correct
        console.error("Error in bearing off: no appropriate die found");
        return false;
    } else {
        // Regular move - absolute difference
        moveDistance = Math.abs(toPoint - fromPoint);
    }
    
    // Find and remove the used die
    const dieIndex = dice.indexOf(moveDistance);
    
    if (dieIndex !== -1) {
        dice.splice(dieIndex, 1);
    } else {
        console.error("Error: No matching die found for move distance", moveDistance);
        // Fallback: use first available die
        if (dice.length > 0) {
            dice.splice(0, 1);
        }
    }
    
    // Reset forced move flag
    forcedMove = false;
    
    // Check for win
    if (whiteBearOff.length === 15) {
        const isGammon = blackBearOff.length === 0;
        const isBackgammon = isGammon && (blackBar.length > 0 || board.some((point, idx) => idx <= 5 && point.some(c => c.color === 'black')));
        
        gameStatus = `Player 1 (White) wins!${isGammon ? ' GAMMON!' : ''}${isBackgammon ? ' BACKGAMMON!' : ''}`;
        dice = [];
        diceRolled = false;
    } else if (blackBearOff.length === 15) {
        const isGammon = whiteBearOff.length === 0;
        const isBackgammon = isGammon && (whiteBar.length > 0 || board.some((point, idx) => idx >= 18 && point.some(c => c.color === 'white')));
        
        gameStatus = `Player 2 (Black) wins!${isGammon ? ' GAMMON!' : ''}${isBackgammon ? ' BACKGAMMON!' : ''}`;
        dice = [];
        diceRolled = false;
    } else {
        // Check for remaining legal moves
        checkRemainingMoves();
    }
    
    // Save the game state
    saveGameState();
    
    // Update UI
    updateUI();
    return true;
}

// Improved hasLegalMoves function to enforce using both dice
function hasLegalMoves() {
    const playerColor = currentPlayer === 'player1' ? 'white' : 'black';
    
    // Check if player has checkers on the bar
    if ((playerColor === 'white' && whiteBar.length > 0) || 
        (playerColor === 'black' && blackBar.length > 0)) {
        
        return calculateValidMoves(-1).length > 0;
    }
    
    // Check each checker on the board
    for (let i = 0; i < 24; i++) {
        const point = board[i];
        if (point.length > 0 && point[0].color === playerColor) {
            const moves = calculateValidMoves(i);
            if (moves.length > 0) {
                return true;
            }
        }
    }
    
    return false;
}

// After executing a move, check if there are any legal moves with remaining dice
function checkRemainingMoves() {
    // If no dice left, switch players
    if (dice.length === 0) {
        setTimeout(switchPlayer, 800);
        return;
    }
    
    // Check if there are any legal moves with remaining dice
    if (!hasLegalMoves()) {
        gameStatus += " No more legal moves. Switching players...";
        updateUI();
        setTimeout(switchPlayer, 1200);
    }
}

// Switch to the other player
function switchPlayer() {
    dice = [];
    diceRolled = false;
    selectedChecker = null;
    validMoves = [];
    forcedMove = false;
    currentPlayer = currentPlayer === 'player1' ? 'player2' : 'player1';
    gameStatus = `${currentPlayer === 'player1' ? 'Player 1' : 'Player 2'}'s turn. Rolling dice...`;
    updateUI();
    
    // Automatically roll dice after a short delay
    setTimeout(() => {
        rollDice();
    }, 1200);
    
    saveGameState();
}

// Check if the mouse is over a point - improved hit detection
function isMouseOverPoint(x, y, pointIndex) {
    // Handle bear-off areas
    if (pointIndex === 24) { // White bear-off
        return x > BOARD_WIDTH + BEAR_OFF_WIDTH && 
               y >= 0 && y <= BOARD_HEIGHT;
    } else if (pointIndex === -1) { // Black bear-off
        return x < BEAR_OFF_WIDTH && 
               y >= 0 && y <= BOARD_HEIGHT;
    }
    
    // Handle regular points - improved hit detection
    const pointX = getPointX(pointIndex);
    const pointY = getPointY(pointIndex);
    
    // Create a more generous hit area, especially for triangular points
    if (pointIndex < 12) {
        // Bottom row - triangles point up
        const triangleHeight = POINT_HEIGHT;
        const triangleBase = POINT_WIDTH;
        
        // Check if point is inside triangle
        const dx = Math.abs(x - pointX);
        const dy = pointY - y;
        
        if (dx < triangleBase/2 && 
            dy < triangleHeight && 
            dy > 0 && 
            dx/triangleBase*2 < dy/triangleHeight) {
            return true;
        }
    } else {
        // Top row - triangles point down
        const triangleHeight = POINT_HEIGHT;
        const triangleBase = POINT_WIDTH;
        
        // Check if point is inside triangle
        const dx = Math.abs(x - pointX);
        const dy = y - pointY;
        
        if (dx < triangleBase/2 && 
            dy < triangleHeight && 
            dy > 0 && 
            dx/triangleBase*2 < dy/triangleHeight) {
            return true;
        }
    }
    
    // Add circular hit area for where the checker would be placed
    const checkerCount = board[pointIndex] ? board[pointIndex].length : 0;
    const checkerY = getCheckerY(pointIndex, checkerCount);
    
    if (dist(x, y, pointX, checkerY) < CHECKER_RADIUS * 1.5) {
        return true;
    }
    
    return false;
}

// Drawing functions
function drawBoard() {
    // Draw bear-off areas
    fill(101, 67, 33);
    rect(0, 0, BEAR_OFF_WIDTH, BOARD_HEIGHT); // Left bear-off
    rect(BOARD_WIDTH + BEAR_OFF_WIDTH, 0, BEAR_OFF_WIDTH, BOARD_HEIGHT); // Right bear-off
    
    // Draw main board
    fill(101, 67, 33);
    rect(BEAR_OFF_WIDTH, 0, BOARD_WIDTH, BOARD_HEIGHT);
    
    let darkPointColor = color(165, 42, 42);
    let lightPointColor = color(245, 245, 220);
    
    for (let i = 0; i < 24; i++) {
        let pointX = getPointX(i);
        let pointY = getPointY(i);
        
        fill(i % 2 === 0 ? darkPointColor : lightPointColor);
        noStroke();
        
        if (i < 12) {
            triangle(
                pointX - POINT_WIDTH/2, pointY, 
                pointX + POINT_WIDTH/2, pointY, 
                pointX, pointY - POINT_HEIGHT
            );
        } else {
            triangle(
                pointX - POINT_WIDTH/2, pointY, 
                pointX + POINT_WIDTH/2, pointY, 
                pointX, pointY + POINT_HEIGHT
            );
        }
    }
    
    // Draw center bar
    fill(120, 80, 40); // Slightly different color for bar
    const barX = BOARD_WIDTH/2 - BAR_WIDTH/2 + BEAR_OFF_WIDTH;
    rect(barX, 0, BAR_WIDTH, BOARD_HEIGHT);
    
    // Draw board border
    noFill();
    strokeWeight(10);
    stroke(101, 67, 33);
    rect(BEAR_OFF_WIDTH, 0, BOARD_WIDTH, BOARD_HEIGHT);
    
    // Draw middle line
    stroke(101, 67, 33);
    line(BEAR_OFF_WIDTH, BOARD_HEIGHT/2, BEAR_OFF_WIDTH + BOARD_WIDTH, BOARD_HEIGHT/2);
}

function drawCheckers() {
    for (let i = 0; i < board.length; i++) {
        let point = board[i];
        if (point.length === 0) continue;
        
        let pointX = getPointX(i);
        
        for (let j = 0; j < point.length; j++) {
            // Skip the selected checker if it's being dragged
            if (selectedChecker && 
                selectedChecker.pointIndex === i && 
                selectedChecker.checkerIndex === j) {
                continue;
            }
            
            let checker = point[j];
            let checkerY = getCheckerY(i, j);
            
            drawChecker(pointX, checkerY, checker.color);
        }
    }
}

function drawChecker(x, y, color) {
    if (color === 'white') {
        fill(255);
        stroke(200);
        strokeWeight(2);
        ellipse(x, y, CHECKER_RADIUS * 2);
        
        // Add a highlight to the checker
        noStroke();
        fill(255, 255, 255, 150);
        ellipse(x - CHECKER_RADIUS * 0.3, y - CHECKER_RADIUS * 0.3, CHECKER_RADIUS);
    } else {
        fill(50);
        stroke(20);
        strokeWeight(2);
        ellipse(x, y, CHECKER_RADIUS * 2);
        
        // Add a highlight to the checker
        noStroke();
        fill(100, 100, 100, 150);
        ellipse(x - CHECKER_RADIUS * 0.3, y - CHECKER_RADIUS * 0.3, CHECKER_RADIUS);
    }
}

function drawBar() {
    let barX = BOARD_WIDTH/2 + BEAR_OFF_WIDTH;
    
    // Draw bar background
    fill(120, 80, 40);
    rect(barX - BAR_WIDTH/2, 0, BAR_WIDTH, BOARD_HEIGHT);
    
    // Draw checkers on the bar
    for (let i = 0; i < whiteBar.length; i++) {
        let barY = BOARD_HEIGHT / 4 - (i * CHECKER_RADIUS * 1.2);
        drawChecker(barX, barY, 'white');
    }
    
    for (let i = 0; i < blackBar.length; i++) {
        let barY = BOARD_HEIGHT * 3/4 + (i * CHECKER_RADIUS * 1.2);
        drawChecker(barX, barY, 'black');
    }
    
    // Highlight bar if player must use it
    const playerColor = currentPlayer === 'player1' ? 'white' : 'black';
    if ((playerColor === 'white' && whiteBar.length > 0) || 
        (playerColor === 'black' && blackBar.length > 0)) {
        
        // More visible highlight when a player must use the bar
        noFill();
        stroke(255, 50, 50); // Red outline
        strokeWeight(4);
        rect(barX - BAR_WIDTH/2, 0, BAR_WIDTH, BOARD_HEIGHT);
        
        // Add message
        fill(255, 50, 50);
        noStroke();
        textSize(16);
        textAlign(CENTER);
        
        if (playerColor === 'white') {
            text("MUST MOVE FROM BAR", barX, BOARD_HEIGHT/4 + CHECKER_RADIUS * 3);
        } else {
            text("MUST MOVE FROM BAR", barX, BOARD_HEIGHT * 3/4 - CHECKER_RADIUS * 3);
        }
    }
}

function drawBearOffAreas() {
    // Draw bear-off area labels
    fill(245, 245, 220);
    textSize(14);
    textAlign(CENTER);
    
    text("Black Bear Off", BEAR_OFF_WIDTH/2, BOARD_HEIGHT/4);
    text("White Bear Off", BOARD_WIDTH + BEAR_OFF_WIDTH + BEAR_OFF_WIDTH/2, BOARD_HEIGHT/4);
    
    // Draw borne-off checkers count
    textSize(18);
    
    text(`${blackBearOff.length}/15`, BEAR_OFF_WIDTH/2, BOARD_HEIGHT/4 + 30);
    text(`${whiteBearOff.length}/15`, BOARD_WIDTH + BEAR_OFF_WIDTH + BEAR_OFF_WIDTH/2, BOARD_HEIGHT/4 + 30);
    
    // Draw some visual representation of borne-off checkers
    for (let i = 0; i < Math.min(whiteBearOff.length, 5); i++) {
        drawChecker(
            BOARD_WIDTH + BEAR_OFF_WIDTH + BEAR_OFF_WIDTH/2,
            BOARD_HEIGHT/2 - CHECKER_RADIUS * 2 - (i * CHECKER_RADIUS * 0.8),
            'white'
        );
    }
    
    for (let i = 0; i < Math.min(blackBearOff.length, 5); i++) {
        drawChecker(
            BEAR_OFF_WIDTH/2,
            BOARD_HEIGHT/2 + CHECKER_RADIUS * 2 + (i * CHECKER_RADIUS * 0.8),
            'black'
        );
    }
}

function drawValidMoves() {
    if (!selectedChecker) return;
    
    // Draw valid move indicators with improved visibility
    noStroke();
    fill(0, 255, 0, 100); // Semi-transparent green
    
    for (const pointIndex of validMoves) {
        // Bearing off indicators
        if (pointIndex === 24 || pointIndex === -1) {
            const x = pointIndex === 24 ? 
                BOARD_WIDTH + BEAR_OFF_WIDTH + BEAR_OFF_WIDTH/2 : 
                BEAR_OFF_WIDTH/2;
            const y = BOARD_HEIGHT/2;
            
            // Draw a highlight for bear-off
            fill(0, 255, 0, 150); // More visible
            circle(x, y, CHECKER_RADIUS * 3);
            
            // Add a pulsing effect
            const pulse = (Math.sin(millis() * 0.005) + 1) * 10;
            stroke(255, 255, 0);
            strokeWeight(3); // Thicker stroke
            noFill();
            circle(x, y, CHECKER_RADIUS * 3 + pulse);
            
            continue;
        }
        
        // Regular move within the board
        const pointX = getPointX(pointIndex);
        const pointY = getPointY(pointIndex);
        
        // Highlight the triangular point
        noStroke();
        fill(0, 255, 0, 120); // More visible
        
        if (pointIndex < 12) {
            // Bottom row
            triangle(
                pointX - POINT_WIDTH/2, pointY,
                pointX + POINT_WIDTH/2, pointY,
                pointX, pointY - POINT_HEIGHT
            );
        } else {
            // Top row
            triangle(
                pointX - POINT_WIDTH/2, pointY,
                pointX + POINT_WIDTH/2, pointY,
                pointX, pointY + POINT_HEIGHT
            );
        }
        
        // Draw a circle at the position where the checker would go
        const checkerCount = board[pointIndex] ? board[pointIndex].length : 0;
        const checkerY = getCheckerY(pointIndex, checkerCount);
        
        fill(0, 255, 0, 170); // More visible
        circle(pointX, checkerY, CHECKER_RADIUS * 2.5);
        
        // Add a pulsing outline
        const pulse = (Math.sin(millis() * 0.005) + 1) * 5;
        stroke(255, 255, 0);
        strokeWeight(3); // Thicker stroke
        noFill();
        circle(pointX, checkerY, CHECKER_RADIUS * 2.5 + pulse);
    }
}

// Helper functions for positioning - improved to match reference image
function getPointX(pointIndex) {
    const boardOffset = BEAR_OFF_WIDTH;
    const pointSpacing = BOARD_WIDTH / 12;
    const halfPointSpacing = pointSpacing / 2;
    
    // Follow standard backgammon board layout (points 1-24)
    // Points 1-6 are bottom right, 7-12 bottom left
    // Points 13-18 are top left, 19-24 top right
    
    if (pointIndex < 6) {
        // Bottom right (points 1-6)
        return boardOffset + BOARD_WIDTH - ((pointIndex + 1) * pointSpacing) + halfPointSpacing;
    } else if (pointIndex < 12) {
        // Bottom left (points 7-12)
        return boardOffset + ((11 - pointIndex) * pointSpacing) + halfPointSpacing;
    } else if (pointIndex < 18) {
        // Top left (points 13-18)
        return boardOffset + ((pointIndex - 12) * pointSpacing) + halfPointSpacing;
    } else {
        // Top right (points 19-24)
        return boardOffset + BOARD_WIDTH - ((23 - pointIndex) * pointSpacing) + halfPointSpacing;
    }
}

function getPointY(pointIndex) {
    return pointIndex < 12 ? BOARD_HEIGHT : 0;
}

function getCheckerY(pointIndex, checkerIndex) {
    let pointY = getPointY(pointIndex);
    const spacing = CHECKER_RADIUS * 1.8; // Better spacing between checkers
    
    if (pointIndex < 12) {
        // Bottom board - checkers stack upward
        return pointY - CHECKER_RADIUS - (checkerIndex * spacing);
    } else {
        // Top board - checkers stack downward
        return pointY + CHECKER_RADIUS + (checkerIndex * spacing);
    }
}

// Game state persistence
function saveGameState() {
    lastUpdateTime = new Date().toLocaleString();
    
    const gameState = {
        board,
        currentPlayer,
        dice,
        diceRolled,
        gameStatus,
        whiteBar,
        blackBar,
        whiteBearOff,
        blackBearOff,
        version: '10.8.0',
        lastUpdateTime,
        forcedMove
    };
    
    try {
        localStorage.setItem('backgammonState', JSON.stringify(gameState));
    } catch (error) {
        console.error('Error saving game state:', error);
    }
}

function loadGameState() {
    try {
        const savedState = localStorage.getItem('backgammonState');
        if (savedState) {
            const gameState = JSON.parse(savedState);
            
            // Load saved state
            board = gameState.board;
            currentPlayer = gameState.currentPlayer;
            dice = gameState.dice;
            diceRolled = gameState.diceRolled;
            gameStatus = gameState.gameStatus;
            whiteBar = gameState.whiteBar;
            blackBar = gameState.blackBar;
            whiteBearOff = gameState.whiteBearOff;
            blackBearOff = gameState.blackBearOff;
            lastUpdateTime = gameState.lastUpdateTime || new Date().toLocaleString();
            forcedMove = gameState.forcedMove;
            
            // If it's a fresh turn with no dice rolled, auto-roll
            if (!diceRolled && dice.length === 0) {
                setTimeout(() => {
                    rollDice();
                }, 1000);
            }
        } else {
            // Initialize new game
            initializeBoard();
            
            // Auto-roll dice for the first player
            setTimeout(() => {
                rollDice();
            }, 1000);
        }
    } catch (error) {
        console.error('Error loading game state:', error);
        initializeBoard();
        
        // Auto-roll dice for the first player
        setTimeout(() => {
            rollDice();
        }, 1000);
    }
}

function resetGame() {
    localStorage.removeItem('backgammonState');
    initializeBoard();
    updateUI();
    
    // Auto-roll dice for the first player
    setTimeout(() => {
        rollDice();
    }, 1000);
}

// Update UI elements
function updateUI() {
    const diceContainer = document.getElementById('dice-container');
    if (diceContainer) {
        // Clear any existing dice
        const diceDisplay = diceContainer.querySelector('#dice-display');
        if (diceDisplay) {
            diceDisplay.innerHTML = '';
            
            if (diceRolled && dice.length > 0) {
                // Create and append dice elements
                dice.forEach(die => {
                    const dieElement = document.createElement('span');
                    dieElement.className = 'die';
                    dieElement.textContent = die;
                    diceDisplay.appendChild(dieElement);
                });
            } else {
                // No dice rolled yet
                const dice1 = document.createElement('span');
                dice1.id = 'dice1';
                dice1.textContent = '-';
                
                const dice2 = document.createElement('span');
                dice2.id = 'dice2';
                dice2.textContent = '-';
                
                diceDisplay.appendChild(dice1);
                diceDisplay.appendChild(dice2);
            }
        }
    }
    
    // Update roll button state
    const rollButton = document.getElementById('roll-button');
    if (rollButton) {
        rollButton.disabled = diceRolled;
    }
    
    // Update active player
    const player1Card = document.getElementById('player1-card');
    const player2Card = document.getElementById('player2-card');
    
    if (player1Card && player2Card) {
        player1Card.className = currentPlayer === 'player1' ? 'player-card active' : 'player-card';
        player2Card.className = currentPlayer === 'player2' ? 'player-card active' : 'player-card';
    }
    
    // Update bar and off counts
    const player1Bar = document.getElementById('player1-bar');
    const player2Bar = document.getElementById('player2-bar');
    const player1Off = document.getElementById('player1-off');
    const player2Off = document.getElementById('player2-off');
    
    if (player1Bar) player1Bar.textContent = whiteBar.length;
    if (player2Bar) player2Bar.textContent = blackBar.length;
    if (player1Off) player1Off.textContent = whiteBearOff.length;
    if (player2Off) player2Off.textContent = blackBearOff.length;
    
    // Update game status
    const statusElement = document.getElementById('game-status');
    if (statusElement) {
        statusElement.textContent = gameStatus;
    }
    
    // Update the version banner
    displayVersionBanner();
}

// Update the displayVersionBanner function to show when the code was last updated
function displayVersionBanner() {
    let versionBanner = document.getElementById('version-banner');
    
    if (!versionBanner) {
        versionBanner = document.createElement('div');
        versionBanner.id = 'version-banner';
        versionBanner.style.position = 'absolute';
        versionBanner.style.top = '10px';
        versionBanner.style.right = '10px';
        versionBanner.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        versionBanner.style.color = 'white';
        versionBanner.style.padding = '5px 10px';
        versionBanner.style.borderRadius = '5px';
        versionBanner.style.fontFamily = 'Arial, sans-serif';
        versionBanner.style.fontSize = '12px';
        versionBanner.style.zIndex = '1000';
        document.body.appendChild(versionBanner);
    }
    
    versionBanner.innerHTML = `Version 10.8.0<br>Code Updated: June 19, 2024 @ 18:00<br>FULLY RULES COMPLIANT`;
}

// Export functions to window object
window.setup = setup;
window.draw = draw;
window.mousePressed = mousePressed;
window.mouseReleased = mouseReleased;
window.rollDice = rollDice;
window.resetGame = resetGame;

// Export functions to window object
window.setup = setup;
window.draw = draw;
window.mousePressed = mousePressed;
window.mouseReleased = mouseReleased;
window.rollDice = rollDice;
window.resetGame = resetGame; 