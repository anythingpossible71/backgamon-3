// fixed-game.js - Version 10.13.1 (Code last updated: June 20, 2024 @ 22:00)
// Backgammon implementation with SVG SPECIFICATIONS

// Game configurations - exact SVG specifications
const BOARD_WIDTH = 1032;
const BOARD_HEIGHT = 789;
const INNER_BOARD_X = 38;
const INNER_BOARD_Y = 38;
const INNER_BOARD_WIDTH = 857;
const INNER_BOARD_HEIGHT = 716;
const CENTER_BAR_X = 427;
const CENTER_BAR_WIDTH = 80;
const BEARING_OFF_X = 895;
const BEARING_OFF_WIDTH = 68;
const BEARING_OFF_HEIGHT = 347;
const BEARING_OFF_DIVIDER_HEIGHT = 21; // Gap between top and bottom bearing-off areas
const CHECKER_RADIUS = 29.5; // Exact 59px diameter
const CHECKER_INNER_RADIUS = 21.1; // Exact inner circle radius
const TRIANGLE_HEIGHT = 297; // Height of triangular points

// Colors from SVG specifications
const BOARD_OUTER = '#552200';
const BOARD_INNER = '#CC8F54';
const LIGHT_POINT = '#F5F0E1';
const DARK_POINT = '#964917';
const CENTER_BAR_COLOR = '#552200';
const WHITE_CHECKER_OUTER = '#DEDEDE';
const BLACK_CHECKER_OUTER = '#2E2E2E';
const BEAR_OFF_HIGHLIGHT = 'rgba(144, 238, 144, 0.5)'; // Light green with transparency

// Gradient stops for bearing off areas
const BEAR_OFF_GRADIENT = [
    { stop: 0.165, color: '#CC8F54' },
    { stop: 0.735, color: '#A87645' },
    { stop: 1, color: '#66482A' }
];

// White checker gradient
const WHITE_CHECKER_GRADIENT = [
    { stop: 0, color: '#FFFFFF' },
    { stop: 0.48, color: '#F1ECEC' },
    { stop: 1, color: '#999999' }
];

// Black checker gradient
const BLACK_CHECKER_GRADIENT = [
    { stop: 0, color: '#565656' },
    { stop: 0.305, color: '#444343' },
    { stop: 0.545, color: '#000000' }
];

// Inner highlight gradients
const WHITE_INNER_GRADIENT = [
    { stop: 0, color: '#FFFFFF' },
    { stop: 0.425, color: '#FFFFFF' },
    { stop: 0.835, color: '#999999' }
];

const BLACK_INNER_GRADIENT = [
    { stop: 0, color: '#8C8C8C' },
    { stop: 0.345, color: '#5A5A5A' },
    { stop: 0.68, color: '#000000' }
];

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

// Add a gameOver flag to the global variables
let gameOver = false;

// Initialize the game
function setup() {
    console.log("Setup function called");
    canvas = createCanvas(BOARD_WIDTH + 2 * BEARING_OFF_WIDTH, BOARD_HEIGHT);
    canvas.parent('canvas-container');
    
    initializeBoard();
    
    // Setup event handlers
    document.getElementById('roll-button').addEventListener('click', rollDice);
    document.getElementById('reset-button').addEventListener('click', resetGame);
    
    // Add a simulate end game button
    const simulateButton = document.createElement('button');
    simulateButton.id = 'simulate-button';
    simulateButton.textContent = 'Simulate End Game';
    simulateButton.style.marginLeft = '10px';
    simulateButton.addEventListener('click', simulateEndGame);
    
    // Add the button after the reset button
    const resetButton = document.getElementById('reset-button');
    if (resetButton && resetButton.parentNode) {
        resetButton.parentNode.insertBefore(simulateButton, resetButton.nextSibling);
    }
    
    loadGameState();
    
    console.log("Backgammon game initialized");
}

// Main draw loop
function draw() {
    background(240);
    
    drawBoard();
    drawTriangularPoints();
    drawBar();
    drawBearOffAreas();
    drawCheckers();
    drawDice();
    
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
    displayVersionBanner();
}

// Initialize the game board with correct checker placement according to standard backgammon rules
function initializeBoard() {
    board = [];
    for (let i = 0; i < 24; i++) {
        board.push([]);
    }
    
    // STANDARD BACKGAMMON SETUP - CORRECTED:
    // White (player1) moves COUNTERCLOCKWISE from point 24 toward point 1
    // Black (player2) moves CLOCKWISE from point 1 toward point 24
    
    // White checkers (player1) - CORRECTED PLACEMENT
    for (let i = 0; i < 2; i++) board[23].push({ color: 'white' });  // 2 checkers on point 24
    for (let i = 0; i < 5; i++) board[12].push({ color: 'white' });  // 5 checkers on point 13
    for (let i = 0; i < 3; i++) board[7].push({ color: 'white' });   // 3 checkers on point 8
    for (let i = 0; i < 5; i++) board[5].push({ color: 'white' });   // 5 checkers on point 6
    
    // Black checkers (player2) - CORRECTED PLACEMENT
    for (let i = 0; i < 2; i++) board[0].push({ color: 'black' });   // 2 checkers on point 1
    for (let i = 0; i < 5; i++) board[11].push({ color: 'black' });  // 5 checkers on point 12
    for (let i = 0; i < 3; i++) board[16].push({ color: 'black' });  // 3 checkers on point 17
    for (let i = 0; i < 5; i++) board[18].push({ color: 'black' });  // 5 checkers on point 19
    
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
        const barX = CENTER_BAR_X + BEARING_OFF_WIDTH;
        const barY = playerColor === 'white' ? BOARD_HEIGHT/4 : BOARD_HEIGHT * 3/4;
        
        // Expand the click area for bar checkers to make them easier to select
        if (dist(mouseX, mouseY, barX, barY) < CHECKER_RADIUS * 2.5) {
            selectedChecker = { pointIndex: -1, checkerIndex: 0 };
            isDragging = true;
            validMoves = calculateValidMoves(-1); // Immediately calculate valid moves for bar
            console.log("Selected checker from bar. Valid moves:", validMoves);
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
            
            // Debug info to diagnose bar entry issues
            console.log(`Checking bar entry for ${playerColor} with die ${die} to point ${entryPointIndex+1}`);
            console.log(`Can move to point: ${canMoveToPoint(entryPointIndex, playerColor)}`);
            
            if (entryPoints.includes(entryPointIndex) && canMoveToPoint(entryPointIndex, playerColor)) {
                moves.push(entryPointIndex);
            }
        }
        
        mustUseBar = false;
        
        // If no valid moves from bar, indicate in the UI
        if (moves.length === 0) {
            gameStatus = `No valid moves from the bar for ${playerColor === 'white' ? 'White' : 'Black'}`;
            updateUI();
        }
        
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
                // Calculate distance for exact dice match
                const exactDistanceToHome = pointIndex + 1; // +1 because indices are 0-based
                
                if (die === exactDistanceToHome) {
                    // EXACT match - can bear off
                    moves.push(-1); // White bears off to LEFT side
                    continue;
                } else if (die > exactDistanceToHome && isHighestChecker(pointIndex, playerColor)) {
                    // ONLY the highest checker can bear off with a larger die
                    moves.push(-1);
                    continue;
                }
            } else if (playerColor === 'black' && pointIndex >= 18) {
                // Black's home board is points 19-24 (indices 18-23)
                // Calculate distance for exact dice match
                const exactDistanceToHome = 24 - pointIndex; // Distance from current point to home
                
                if (die === exactDistanceToHome) {
                    // EXACT match - can bear off
                    moves.push(24); // Black bears off to RIGHT side
                    continue;
                } else if (die > exactDistanceToHome && isHighestChecker(pointIndex, playerColor)) {
                    // ONLY the highest checker can bear off with a larger die
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
    
    // Special debug for bar re-entry moves
    console.log(`Checking point ${pointIndex+1}: Empty=${!targetPoint.length}, Same color=${targetPoint.length > 0 && targetPoint[0].color === playerColor}, Single opponent=${targetPoint.length === 1 && targetPoint[0].color !== playerColor}`);
    
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
    // Check if the game is over
    checkGameEnd();
    if (gameOver) {
        return; // Don't switch player if game is over
    }
    
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
    // Handle bear-off areas - CORRECTED to match proper sides
    if (pointIndex === 24) { // Black bear-off - RIGHT side
        return x > CENTER_BAR_X + BEARING_OFF_WIDTH && 
               y >= 0 && y <= BOARD_HEIGHT;
    } else if (pointIndex === -1) { // White bear-off - LEFT side
        return x < BEARING_OFF_X && 
               y >= 0 && y <= BOARD_HEIGHT;
    }
    
    // Handle regular points - improved hit detection
    const pointX = getPointX(pointIndex);
    const pointY = getPointY(pointIndex);
    
    // Create a more generous hit area, especially for triangular points
    if (pointIndex < 12) {
        // Bottom row - triangles point up
        const triangleHeight = TRIANGLE_HEIGHT;
        const triangleBase = INNER_BOARD_WIDTH;
        
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
        const triangleHeight = TRIANGLE_HEIGHT;
        const triangleBase = INNER_BOARD_WIDTH;
        
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
    // Draw outer board (dark brown)
    fill(BOARD_OUTER);
    noStroke();
    rect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    
    // Draw inner board (lighter brown)
    fill(BOARD_INNER);
    rect(INNER_BOARD_X, INNER_BOARD_Y, INNER_BOARD_WIDTH, INNER_BOARD_HEIGHT);
}

function drawCheckers() {
    // Draw checkers for each point
    for (let i = 0; i < 24; i++) {
        const pointX = getPointX(i);
        const pointY = i < 12 ? INNER_BOARD_Y + INNER_BOARD_HEIGHT : INNER_BOARD_Y;
        const direction = i < 12 ? 1 : -1; // Down for bottom row, up for top row
        
        for (let j = 0; j < board[i].length; j++) {
            const checker = board[i][j];
            const offset = j * (CHECKER_RADIUS * 1.5) * direction;
            const checkerY = pointY + offset + (CHECKER_RADIUS * direction);
            
            drawChecker(pointX, checkerY, checker.color);
            
            // Add visual indicator for draggable checkers
            if (diceRolled && 
                !gameOver && 
                ((currentPlayer === 'player1' && checker.color === 'white') || 
                 (currentPlayer === 'player2' && checker.color === 'black')) && 
                j === board[i].length - 1 && 
                isLegalMoveStart(i)) {
                
                // Only highlight if this is a legal move start
                noFill();
                stroke(0, 255, 0, 150); // Semi-transparent green
                strokeWeight(2);
                ellipse(pointX, checkerY, CHECKER_RADIUS * 2.2);
                
                // Add pulsing effect to highlight draggable checker
                const pulse = (Math.sin(millis() * 0.005) + 1) * 5;
                stroke(255, 255, 0, 150); // Semi-transparent yellow
                ellipse(pointX, checkerY, CHECKER_RADIUS * 2.2 + pulse);
            }
        }
    }
}

function drawChecker(x, y, color) {
    if (color === 'white') {
        fill(WHITE_CHECKER_OUTER);
        stroke(BLACK_CHECKER_OUTER);
        strokeWeight(2);
        ellipse(x, y, CHECKER_RADIUS * 2);
        
        // Add a highlight to the checker
        noStroke();
        fill(WHITE_INNER_GRADIENT);
        ellipse(x - CHECKER_INNER_RADIUS * 0.3, y - CHECKER_INNER_RADIUS * 0.3, CHECKER_INNER_RADIUS);
    } else {
        fill(BLACK_CHECKER_OUTER);
        stroke(WHITE_CHECKER_OUTER);
        strokeWeight(2);
        ellipse(x, y, CHECKER_RADIUS * 2);
        
        // Add a highlight to the checker
        noStroke();
        fill(BLACK_INNER_GRADIENT);
        ellipse(x - CHECKER_INNER_RADIUS * 0.3, y - CHECKER_INNER_RADIUS * 0.3, CHECKER_INNER_RADIUS);
    }
}

function drawBar() {
    // Draw center bar
    fill(CENTER_BAR_COLOR);
    rect(CENTER_BAR_X, INNER_BOARD_Y, CENTER_BAR_WIDTH, INNER_BOARD_HEIGHT);
    
    // Draw checkers on the bar
    const barCenterX = CENTER_BAR_X + CENTER_BAR_WIDTH / 2;
    
    // Draw white checkers on the bar
    for (let i = 0; i < whiteBar.length; i++) {
        const y = INNER_BOARD_Y + INNER_BOARD_HEIGHT / 4 + i * (CHECKER_RADIUS * 2 + 5);
        drawChecker(barCenterX, y, 'white');
    }
    
    // Draw black checkers on the bar
    for (let i = 0; i < blackBar.length; i++) {
        const y = INNER_BOARD_Y + INNER_BOARD_HEIGHT * 3/4 - i * (CHECKER_RADIUS * 2 + 5);
        drawChecker(barCenterX, y, 'black');
    }
    
    // Highlight the bar if the current player has checkers on it
    if ((currentPlayer === 'player1' && whiteBar.length > 0) || 
        (currentPlayer === 'player2' && blackBar.length > 0)) {
        
        // Highlight the bar
        noFill();
        stroke(255, 50, 50); // Red outline
        strokeWeight(4);
        rect(CENTER_BAR_X, INNER_BOARD_Y, CENTER_BAR_WIDTH, INNER_BOARD_HEIGHT);
        
        // Add message
        fill(255);
        textSize(14);
        textAlign(CENTER);
        text("Must use bar first!", barCenterX, INNER_BOARD_HEIGHT / 2);
    }
}

function drawBearOffAreas() {
    // Draw bearing-off areas with gradient
    drawingContext.fillStyle = createGradient(
        BEARING_OFF_X, INNER_BOARD_Y, 
        BEARING_OFF_WIDTH, 0, 
        BEAR_OFF_GRADIENT
    );
    rect(BEARING_OFF_X, INNER_BOARD_Y, BEARING_OFF_WIDTH, BEARING_OFF_HEIGHT);
    
    drawingContext.fillStyle = createGradient(
        BEARING_OFF_X, INNER_BOARD_Y + BEARING_OFF_HEIGHT + BEARING_OFF_DIVIDER_HEIGHT, 
        BEARING_OFF_WIDTH, 0, 
        BEAR_OFF_GRADIENT
    );
    rect(BEARING_OFF_X, INNER_BOARD_Y + BEARING_OFF_HEIGHT + BEARING_OFF_DIVIDER_HEIGHT, 
         BEARING_OFF_WIDTH, BEARING_OFF_HEIGHT);
    
    // Draw bear-off area labels
    fill(255);
    textSize(16);
    textAlign(CENTER);
    
    // Black bear-off (top)
    text("BLACK", BEARING_OFF_X + BEARING_OFF_WIDTH/2, INNER_BOARD_Y + 30);
    text("BEAR OFF", BEARING_OFF_X + BEARING_OFF_WIDTH/2, INNER_BOARD_Y + 50);
    text(`${blackBearOff.length}/15`, BEARING_OFF_X + BEARING_OFF_WIDTH/2, INNER_BOARD_Y + 80);
    
    // White bear-off (bottom)
    text("WHITE", BEARING_OFF_X + BEARING_OFF_WIDTH/2, 
         INNER_BOARD_Y + BEARING_OFF_HEIGHT + BEARING_OFF_DIVIDER_HEIGHT + 30);
    text("BEAR OFF", BEARING_OFF_X + BEARING_OFF_WIDTH/2, 
         INNER_BOARD_Y + BEARING_OFF_HEIGHT + BEARING_OFF_DIVIDER_HEIGHT + 50);
    text(`${whiteBearOff.length}/15`, BEARING_OFF_X + BEARING_OFF_WIDTH/2, 
         INNER_BOARD_Y + BEARING_OFF_HEIGHT + BEARING_OFF_DIVIDER_HEIGHT + 80);
    
    // Highlight the appropriate bear-off area if it's the current player's turn
    if (canBearOff(currentPlayer === 'player1' ? 'white' : 'black')) {
        noFill();
        stroke(BEAR_OFF_HIGHLIGHT);
        strokeWeight(2);
        
        if (currentPlayer === 'player2') {
            // Highlight black bear-off (top)
            rect(BEARING_OFF_X, INNER_BOARD_Y, BEARING_OFF_WIDTH, BEARING_OFF_HEIGHT);
        } else {
            // Highlight white bear-off (bottom)
            rect(BEARING_OFF_X, INNER_BOARD_Y + BEARING_OFF_HEIGHT + BEARING_OFF_DIVIDER_HEIGHT, 
                 BEARING_OFF_WIDTH, BEARING_OFF_HEIGHT);
        }
        
        noStroke();
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
                CENTER_BAR_X + BEARING_OFF_WIDTH + BEARING_OFF_WIDTH/2 : 
                BEARING_OFF_X/2;
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
                pointX - INNER_BOARD_WIDTH/2, pointY,
                pointX + INNER_BOARD_WIDTH/2, pointY,
                pointX, pointY - TRIANGLE_HEIGHT
            );
        } else {
            // Top row
            triangle(
                pointX - INNER_BOARD_WIDTH/2, pointY,
                pointX + INNER_BOARD_WIDTH/2, pointY,
                pointX, pointY + TRIANGLE_HEIGHT
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
    const boardOffset = BEARING_OFF_X;
    const pointSpacing = INNER_BOARD_WIDTH / 12;
    const halfPointSpacing = pointSpacing / 2;
    
    // Follow standard backgammon board layout (points 1-24)
    // Points 1-6 are bottom right, 7-12 bottom left
    // Points 13-18 are top left, 19-24 top right
    
    if (pointIndex < 6) {
        // Bottom right (points 1-6)
        return boardOffset + INNER_BOARD_WIDTH - ((pointIndex + 1) * pointSpacing) + halfPointSpacing;
    } else if (pointIndex < 12) {
        // Bottom left (points 7-12)
        return boardOffset + ((11 - pointIndex) * pointSpacing) + halfPointSpacing;
    } else if (pointIndex < 18) {
        // Top left (points 13-18)
        return boardOffset + ((pointIndex - 12) * pointSpacing) + halfPointSpacing;
    } else {
        // Top right (points 19-24)
        return boardOffset + INNER_BOARD_WIDTH - ((23 - pointIndex) * pointSpacing) + halfPointSpacing;
    }
}

function getPointY(pointIndex) {
    return pointIndex < 12 ? INNER_BOARD_HEIGHT : 0;
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
        version: '10.13.1',
        lastUpdateTime,
        forcedMove,
        gameOver
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
            
            // Load the board state
            board = gameState.board || [];
            currentPlayer = gameState.currentPlayer || 'player1';
            dice = gameState.dice || [];
            diceRolled = gameState.diceRolled || false;
            gameStatus = gameState.gameStatus || "Player 1's turn to roll";
            whiteBar = gameState.whiteBar || [];
            blackBar = gameState.blackBar || [];
            whiteBearOff = gameState.whiteBearOff || [];
            blackBearOff = gameState.blackBearOff || [];
            lastUpdateTime = gameState.lastUpdateTime || new Date().toLocaleString();
            forcedMove = gameState.forcedMove || false;
            gameOver = gameState.gameOver || false;
            
            // If we're loading an older version without gameOver flag,
            // check if game should be over
            if (gameState.version !== '10.13.1') {
                checkGameEnd();
            }
            
            updateUI();
        } else {
            // No saved state, initialize a new game
            initializeBoard();
        }
    } catch (error) {
        console.error('Error loading game state:', error);
        initializeBoard();
    }
    
    // Display version banner upon load
    displayVersionBanner();
}

function resetGame() {
    localStorage.removeItem('backgammonState');
    initializeBoard();
    gameOver = false;
    updateUI();
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
    // Create or get the version banner element
    let versionBanner = document.getElementById('version-banner');
    if (!versionBanner) {
        versionBanner = document.createElement('div');
        versionBanner.id = 'version-banner';
        versionBanner.style.position = 'fixed';
        versionBanner.style.top = '0';
        versionBanner.style.left = '0';
        versionBanner.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        versionBanner.style.color = '#fff';
        versionBanner.style.padding = '5px 10px';
        versionBanner.style.fontSize = '12px';
        versionBanner.style.fontFamily = 'monospace';
        versionBanner.style.zIndex = '1000';
        document.body.appendChild(versionBanner);
    }
    
    versionBanner.innerHTML = `Version 10.13.1<br>Code Updated: June 20, 2024 @ 22:00<br>SVG SPECIFICATIONS IMPLEMENTATION`;
}

// New function to check if the game is over
function checkGameEnd() {
    // Check if either player has borne off all 15 checkers
    if (whiteBearOff.length === 15) {
        gameStatus = "GAME OVER - White wins!";
        gameOver = true;
        updateUI();
        
        // Show a victory message
        setTimeout(() => {
            alert("Game Over - White (Player 1) wins!");
        }, 100);
        return true;
    }
    
    if (blackBearOff.length === 15) {
        gameStatus = "GAME OVER - Black wins!";
        gameOver = true;
        updateUI();
        
        // Show a victory message
        setTimeout(() => {
            alert("Game Over - Black (Player 2) wins!");
        }, 100);
        return true;
    }
    
    return false;
}

// Add a simulate end game function
function simulateEndGame() {
    // Clear current board
    board = [];
    for (let i = 0; i < 24; i++) {
        board.push([]);
    }
    
    // Clear bar and bear-off areas
    whiteBar = [];
    blackBar = [];
    whiteBearOff = [];
    blackBearOff = [];
    
    // Place white checkers in their home board (points 1-6)
    for (let i = 0; i < 5; i++) board[0].push({ color: 'white' });  // 5 on point 1
    for (let i = 0; i < 5; i++) board[1].push({ color: 'white' });  // 5 on point 2
    for (let i = 0; i < 5; i++) board[2].push({ color: 'white' });  // 5 on point 3
    
    // Place black checkers in their home board (points 19-24)
    for (let i = 0; i < 5; i++) board[18].push({ color: 'black' });  // 5 on point 19
    for (let i = 0; i < 5; i++) board[19].push({ color: 'black' });  // 5 on point 20
    for (let i = 0; i < 5; i++) board[20].push({ color: 'black' });  // 5 on point 21
    
    // Reset game state
    dice = [];
    diceRolled = false;
    selectedChecker = null;
    validMoves = [];
    forcedMove = false;
    currentPlayer = 'player1';  // White goes first
    gameStatus = "End Game Simulation - Player 1's turn to roll";
    gameOver = false;
    
    // Save and update
    saveGameState();
    updateUI();
}

// Export functions to window object
window.setup = setup;
window.draw = draw;
window.mousePressed = mousePressed;
window.mouseReleased = mouseReleased;
window.rollDice = rollDice;
window.resetGame = resetGame;

// Create a linear gradient
function createGradient(x, y, w, h, stops) {
    const ctx = drawingContext;
    const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
    
    for (const stop of stops) {
        gradient.addColorStop(stop.stop, stop.color);
    }
    
    return gradient;
}

// Get color from gradient at specific position
function getColorFromGradient(t, stops) {
    // Find the stops that t is between
    let startStop = stops[0];
    let endStop = stops[stops.length - 1];
    
    for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i].stop && t <= stops[i+1].stop) {
            startStop = stops[i];
            endStop = stops[i+1];
            break;
        }
    }
    
    // Normalize t between the two stops
    const normalizedT = (t - startStop.stop) / (endStop.stop - startStop.stop);
    
    // Interpolate colors
    const startColor = color(startStop.color);
    const endColor = color(endStop.color);
    
    return lerpColor(startColor, endColor, normalizedT);
}

// Create a radial gradient
function createRadialGradient(x, y, radius, stops) {
    const ctx = drawingContext;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    
    for (const stop of stops) {
        gradient.addColorStop(stop.stop, stop.color);
    }
    
    return gradient;
}

// Draw the triangular points
function drawTriangularPoints() {
    // Top Left Points (13-18) - Dark/Light alternating
    fill(DARK_POINT);
    triangle(38, 38, 98, 38, 68, 335); // Point 13
    
    fill(LIGHT_POINT);
    triangle(98, 38, 158, 38, 128, 335); // Point 14
    
    fill(DARK_POINT);
    triangle(158, 38, 218, 38, 188, 335); // Point 15
    
    fill(LIGHT_POINT);
    triangle(218, 38, 278, 38, 248, 335); // Point 16
    
    fill(DARK_POINT);
    triangle(278, 38, 338, 38, 308, 335); // Point 17
    
    fill(LIGHT_POINT);
    triangle(338, 38, 398, 38, 368, 335); // Point 18
    
    // Top Right Points (19-24) - Dark/Light alternating
    fill(DARK_POINT);
    triangle(507, 38, 567, 38, 537, 335); // Point 19
    
    fill(LIGHT_POINT);
    triangle(567, 38, 627, 38, 597, 335); // Point 20
    
    fill(DARK_POINT);
    triangle(627, 38, 687, 38, 657, 335); // Point 21
    
    fill(LIGHT_POINT);
    triangle(687, 38, 747, 38, 717, 335); // Point 22
    
    fill(DARK_POINT);
    triangle(747, 38, 807, 38, 777, 335); // Point 23
    
    fill(LIGHT_POINT);
    triangle(807, 38, 867, 38, 837, 335); // Point 24
    
    // Bottom Left Points (7-12) - Light/Dark alternating
    fill(LIGHT_POINT);
    triangle(38, 754, 98, 754, 68, 457); // Point 12
    
    fill(DARK_POINT);
    triangle(98, 754, 158, 754, 128, 457); // Point 11
    
    fill(LIGHT_POINT);
    triangle(158, 754, 218, 754, 188, 457); // Point 10
    
    fill(DARK_POINT);
    triangle(218, 754, 278, 754, 248, 457); // Point 9
    
    fill(LIGHT_POINT);
    triangle(278, 754, 338, 754, 308, 457); // Point 8
    
    fill(DARK_POINT);
    triangle(338, 754, 398, 754, 368, 457); // Point 7
    
    // Bottom Right Points (1-6) - Light/Dark alternating
    fill(LIGHT_POINT);
    triangle(507, 754, 567, 754, 537, 457); // Point 6
    
    fill(DARK_POINT);
    triangle(567, 754, 627, 754, 597, 457); // Point 5
    
    fill(LIGHT_POINT);
    triangle(627, 754, 687, 754, 657, 457); // Point 4
    
    fill(DARK_POINT);
    triangle(687, 754, 747, 754, 717, 457); // Point 3
    
    fill(LIGHT_POINT);
    triangle(747, 754, 807, 754, 777, 457); // Point 2
    
    fill(DARK_POINT);
    triangle(807, 754, 867, 754, 837, 457); // Point 1
}

// Draw the center bar
function drawBar() {
    // Draw center bar
    fill(CENTER_BAR_COLOR);
    rect(CENTER_BAR_X, INNER_BOARD_Y, CENTER_BAR_WIDTH, INNER_BOARD_HEIGHT);
    
    // Draw checkers on the bar
    const barCenterX = CENTER_BAR_X + CENTER_BAR_WIDTH / 2;
    
    // Draw white checkers on the bar
    for (let i = 0; i < whiteBar.length; i++) {
        const y = INNER_BOARD_Y + INNER_BOARD_HEIGHT / 4 + i * (CHECKER_RADIUS * 2 + 5);
        drawChecker(barCenterX, y, 'white');
    }
    
    // Draw black checkers on the bar
    for (let i = 0; i < blackBar.length; i++) {
        const y = INNER_BOARD_Y + INNER_BOARD_HEIGHT * 3/4 - i * (CHECKER_RADIUS * 2 + 5);
        drawChecker(barCenterX, y, 'black');
    }
    
    // Highlight the bar if the current player has checkers on it
    if ((currentPlayer === 'player1' && whiteBar.length > 0) || 
        (currentPlayer === 'player2' && blackBar.length > 0)) {
        
        // Highlight the bar
        noFill();
        stroke(255, 50, 50); // Red outline
        strokeWeight(4);
        rect(CENTER_BAR_X, INNER_BOARD_Y, CENTER_BAR_WIDTH, INNER_BOARD_HEIGHT);
        
        // Add message
        fill(255);
        textSize(14);
        textAlign(CENTER);
        text("Must use bar first!", barCenterX, INNER_BOARD_HEIGHT / 2);
    }
}

// Draw the bear-off areas
function drawBearOffAreas() {
    // Draw bearing-off areas with gradient
    drawingContext.fillStyle = createGradient(
        BEARING_OFF_X, INNER_BOARD_Y, 
        BEARING_OFF_WIDTH, 0, 
        BEAR_OFF_GRADIENT
    );
    rect(BEARING_OFF_X, INNER_BOARD_Y, BEARING_OFF_WIDTH, BEARING_OFF_HEIGHT);
    
    drawingContext.fillStyle = createGradient(
        BEARING_OFF_X, INNER_BOARD_Y + BEARING_OFF_HEIGHT + BEARING_OFF_DIVIDER_HEIGHT, 
        BEARING_OFF_WIDTH, 0, 
        BEAR_OFF_GRADIENT
    );
    rect(BEARING_OFF_X, INNER_BOARD_Y + BEARING_OFF_HEIGHT + BEARING_OFF_DIVIDER_HEIGHT, 
         BEARING_OFF_WIDTH, BEARING_OFF_HEIGHT);
    
    // Draw bear-off area labels
    fill(255);
    textSize(16);
    textAlign(CENTER);
    
    // Black bear-off (top)
    text("BLACK", BEARING_OFF_X + BEARING_OFF_WIDTH/2, INNER_BOARD_Y + 30);
    text("BEAR OFF", BEARING_OFF_X + BEARING_OFF_WIDTH/2, INNER_BOARD_Y + 50);
    text(`${blackBearOff.length}/15`, BEARING_OFF_X + BEARING_OFF_WIDTH/2, INNER_BOARD_Y + 80);
    
    // White bear-off (bottom)
    text("WHITE", BEARING_OFF_X + BEARING_OFF_WIDTH/2, 
         INNER_BOARD_Y + BEARING_OFF_HEIGHT + BEARING_OFF_DIVIDER_HEIGHT + 30);
    text("BEAR OFF", BEARING_OFF_X + BEARING_OFF_WIDTH/2, 
         INNER_BOARD_Y + BEARING_OFF_HEIGHT + BEARING_OFF_DIVIDER_HEIGHT + 50);
    text(`${whiteBearOff.length}/15`, BEARING_OFF_X + BEARING_OFF_WIDTH/2, 
         INNER_BOARD_Y + BEARING_OFF_HEIGHT + BEARING_OFF_DIVIDER_HEIGHT + 80);
    
    // Highlight the appropriate bear-off area if it's the current player's turn
    if (canBearOff(currentPlayer === 'player1' ? 'white' : 'black')) {
        noFill();
        stroke(BEAR_OFF_HIGHLIGHT);
        strokeWeight(2);
        
        if (currentPlayer === 'player2') {
            // Highlight black bear-off (top)
            rect(BEARING_OFF_X, INNER_BOARD_Y, BEARING_OFF_WIDTH, BEARING_OFF_HEIGHT);
        } else {
            // Highlight white bear-off (bottom)
            rect(BEARING_OFF_X, INNER_BOARD_Y + BEARING_OFF_HEIGHT + BEARING_OFF_DIVIDER_HEIGHT, 
                 BEARING_OFF_WIDTH, BEARING_OFF_HEIGHT);
        }
        
        noStroke();
    }
}

// Draw a checker with gradient
function drawChecker(x, y, checkerColor) {
    if (checkerColor === 'white') {
        // Draw outer circle with gradient
        drawingContext.fillStyle = createRadialGradient(
            x, y, CHECKER_RADIUS, WHITE_CHECKER_GRADIENT
        );
        noStroke();
        ellipse(x, y, CHECKER_RADIUS * 2);
        
        // Draw inner circle with gradient
        drawingContext.fillStyle = createRadialGradient(
            x, y, CHECKER_INNER_RADIUS, WHITE_INNER_GRADIENT
        );
        ellipse(x, y, CHECKER_INNER_RADIUS * 2);
        
        // Add subtle border
        noFill();
        stroke(WHITE_CHECKER_OUTER);
        strokeWeight(1);
        ellipse(x, y, CHECKER_RADIUS * 2);
    } else {
        // Draw outer circle with gradient
        drawingContext.fillStyle = createRadialGradient(
            x, y, CHECKER_RADIUS, BLACK_CHECKER_GRADIENT
        );
        noStroke();
        ellipse(x, y, CHECKER_RADIUS * 2);
        
        // Draw inner circle with gradient
        drawingContext.fillStyle = createRadialGradient(
            x, y, CHECKER_INNER_RADIUS, BLACK_INNER_GRADIENT
        );
        ellipse(x, y, CHECKER_INNER_RADIUS * 2);
        
        // Add subtle border
        noFill();
        stroke(BLACK_CHECKER_OUTER);
        strokeWeight(1);
        ellipse(x, y, CHECKER_RADIUS * 2);
    }
} 