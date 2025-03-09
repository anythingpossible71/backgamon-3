// fixed-game.js - Version 10.3.0
// Simplified local two-player backgammon with working placement and drag

// Game configurations
const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 600;
const POINT_WIDTH = 50;
const POINT_HEIGHT = 240;
const CHECKER_RADIUS = 25;
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

// p5.js setup
let canvas;

// Initialize the game
function setup() {
    console.log("Setup function called");
    canvas = createCanvas(BOARD_WIDTH + 2 * BEAR_OFF_WIDTH, BOARD_HEIGHT);
    canvas.parent('canvas-container');
    
    initializeBoard();
    document.getElementById('roll-button').addEventListener('click', rollDice);
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

// Initialize the game board with checker positions
function initializeBoard() {
    board = [];
    for (let i = 0; i < 24; i++) {
        board.push([]);
    }
    
    // White checkers
    for (let i = 0; i < 2; i++) board[0].push({ color: 'white' });
    for (let i = 0; i < 5; i++) board[11].push({ color: 'white' });
    for (let i = 0; i < 3; i++) board[16].push({ color: 'white' });
    for (let i = 0; i < 5; i++) board[18].push({ color: 'white' });
    
    // Black checkers
    for (let i = 0; i < 2; i++) board[23].push({ color: 'black' });
    for (let i = 0; i < 5; i++) board[12].push({ color: 'black' });
    for (let i = 0; i < 3; i++) board[7].push({ color: 'black' });
    for (let i = 0; i < 5; i++) board[5].push({ color: 'black' });
    
    whiteBar = [];
    blackBar = [];
    whiteBearOff = [];
    blackBearOff = [];
    dice = [];
    diceRolled = false;
    currentPlayer = 'player1';
    gameStatus = "Player 1's turn to roll";
    
    saveGameState();
}

// Roll dice
function rollDice() {
    if (diceRolled) return;
    
    dice = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
    ];

    if (dice[0] === dice[1]) {
        dice = [dice[0], dice[0], dice[0], dice[0]];
    }

    diceRolled = true;
    gameStatus = `${currentPlayer === 'player1' ? 'Player 1' : 'Player 2'} rolled ${dice.join(', ')}`;
    updateUI();
}

// Mouse interaction handlers
function mousePressed() {
    if (!diceRolled) return;
    
    const playerColor = currentPlayer === 'player1' ? 'white' : 'black';
    
    // Check bar first
    if ((playerColor === 'white' && whiteBar.length > 0) || 
        (playerColor === 'black' && blackBar.length > 0)) {
        
        const barX = BOARD_WIDTH/2 + BEAR_OFF_WIDTH;
        const barY = playerColor === 'white' ? BOARD_HEIGHT/4 : BOARD_HEIGHT * 3/4;
        
        if (dist(mouseX, mouseY, barX, barY) < CHECKER_RADIUS * 2) {
            selectedChecker = { pointIndex: -1, checkerIndex: 0 };
            calculateValidMoves(-1);
            return;
        }
        
        return; // Must move from bar
    }
    
    // Check if a checker was clicked
    for (let i = 0; i < board.length; i++) {
        const point = board[i];
        if (!point.length) continue;
        
        const pointX = getPointX(i);
        
        for (let j = 0; j < point.length; j++) {
            const checker = point[j];
            if (checker.color === playerColor) {
                const checkerY = getCheckerY(i, j);
                
                if (dist(mouseX, mouseY, pointX, checkerY) < CHECKER_RADIUS) {
                    selectedChecker = { pointIndex: i, checkerIndex: j };
                    calculateValidMoves(i);
                    return;
                }
            }
        }
    }
}

function mouseReleased() {
    if (!selectedChecker) return;
    
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
}

// Calculate valid moves for a checker
function calculateValidMoves(pointIndex) {
    if (!dice.length || !diceRolled) return [];

    const playerColor = currentPlayer === 'player1' ? 'white' : 'black';
    const direction = playerColor === 'white' ? 1 : -1;
    const moves = [];
    
    // Must move from bar first
    if ((playerColor === 'white' && whiteBar.length > 0) ||
        (playerColor === 'black' && blackBar.length > 0)) {
        if (pointIndex !== -1) return [];
    }
    
    // For each die, calculate possible moves
    for (let i = 0; i < dice.length; i++) {
        const die = dice[i];
        
        const targetIndex = pointIndex + (die * direction);
        
        // Check if can bear off
        if (canBearOff(playerColor)) {
            if (playerColor === 'white' && pointIndex >= 18) {
                if (targetIndex >= 24) {
                    moves.push(24); // White bears off to point 24
                    continue;
                }
            } else if (playerColor === 'black' && pointIndex <= 5) {
                if (targetIndex < 0) {
                    moves.push(-1); // Black bears off to point -1
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
    
    validMoves = moves;
    return moves;
}

// Check if a move to a point is valid
function canMoveToPoint(pointIndex, playerColor) {
    const targetPoint = board[pointIndex];
    
    return !targetPoint.length || // Empty point
           targetPoint[0].color === playerColor || // Own color
           targetPoint.length === 1; // Can hit single opponent checker
}

// Check if the player can bear off
function canBearOff(playerColor) {
    if (playerColor === 'white') {
        // Check if all white checkers are in the home board (points 18-23)
        for (let i = 0; i < 18; i++) {
            if (board[i].some(checker => checker.color === 'white')) {
                return false;
            }
        }
        // Also check bar
        if (whiteBar.length > 0) {
            return false;
        }
    } else {
        // Check if all black checkers are in the home board (points 0-5)
        for (let i = 6; i < 24; i++) {
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

// Execute a move
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
    if ((playerColor === 'white' && toPoint === 24) || 
        (playerColor === 'black' && toPoint === -1)) {
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
        gameStatus = `${playerColor === 'white' ? 'White' : 'Black'} moved from ${fromPoint} to ${toPoint}`;
    }
    
    // Remove used die
    const moveDistance = Math.abs(toPoint - fromPoint);
    const dieIndex = dice.indexOf(moveDistance);
    
    if (dieIndex !== -1) {
        dice.splice(dieIndex, 1);
    } else {
        // Just use the first die if no match
        if (dice.length > 0) {
            dice.splice(0, 1);
        }
    }
    
    // Check for win
    if (whiteBearOff.length === 15) {
        gameStatus = "Player 1 (White) wins!";
        dice = [];
        diceRolled = false;
    } else if (blackBearOff.length === 15) {
        gameStatus = "Player 2 (Black) wins!";
        dice = [];
        diceRolled = false;
    }
    
    // If no more dice, switch player
    if (dice.length === 0) {
        setTimeout(switchPlayer, 800);
    }
    
    // Save the game state
    saveGameState();
    
    // Update UI
    updateUI();
    return true;
}

// Switch to the other player
function switchPlayer() {
    dice = [];
    diceRolled = false;
    selectedChecker = null;
    validMoves = [];
    currentPlayer = currentPlayer === 'player1' ? 'player2' : 'player1';
    gameStatus = `${currentPlayer === 'player1' ? 'Player 1' : 'Player 2'}'s turn to roll`;
    saveGameState();
    updateUI();
}

// Check if the mouse is over a point
function isMouseOverPoint(x, y, pointIndex) {
    // Handle bear-off areas
    if (pointIndex === 24) { // White bear-off
        return x > BOARD_WIDTH + BEAR_OFF_WIDTH && 
               y < BOARD_HEIGHT;
    } else if (pointIndex === -1) { // Black bear-off
        return x < BEAR_OFF_WIDTH && 
               y < BOARD_HEIGHT;
    }
    
    // Handle regular points
    const pointX = getPointX(pointIndex);
    const pointY = getPointY(pointIndex);
    const pointTop = pointIndex < 12 ? pointY - POINT_HEIGHT : pointY;
    const pointBottom = pointIndex < 12 ? pointY : pointY + POINT_HEIGHT;
    
    return x >= pointX - POINT_WIDTH/2 && 
           x <= pointX + POINT_WIDTH/2 && 
           y >= pointTop && 
           y <= pointBottom;
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
            if (selectedChecker && selectedChecker.pointIndex === i && selectedChecker.checkerIndex === j) {
                continue; // Skip the checker being dragged
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
        
    // Draw checkers on the bar
    for (let i = 0; i < whiteBar.length; i++) {
        let barY = BOARD_HEIGHT / 4 - (i * CHECKER_RADIUS * 1.5);
        drawChecker(barX, barY, 'white');
    }
    
    for (let i = 0; i < blackBar.length; i++) {
        let barY = BOARD_HEIGHT * 3/4 + (i * CHECKER_RADIUS * 1.5);
        drawChecker(barX, barY, 'black');
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
    
    // Draw valid move indicators
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
            fill(0, 255, 0, 100);
            circle(x, y, CHECKER_RADIUS * 3);
            
            // Add a pulsing effect
            const pulse = (Math.sin(millis() * 0.005) + 1) * 10;
            stroke(255, 255, 0);
            strokeWeight(2);
            noFill();
            circle(x, y, CHECKER_RADIUS * 3 + pulse);
            
            continue;
        }
        
        // Regular move within the board
        const pointX = getPointX(pointIndex);
        const pointY = getPointY(pointIndex);
        
        // Highlight the triangular point
        noStroke();
        fill(0, 255, 0, 100);
        
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
        
        fill(0, 255, 0, 150);
        circle(pointX, checkerY, CHECKER_RADIUS * 2.5);
    }
}

// Helper functions for positioning
function getPointX(pointIndex) {
    const boardOffset = BEAR_OFF_WIDTH;
    
    if (pointIndex < 6) {
        return boardOffset + BOARD_WIDTH - (pointIndex + 1) * POINT_WIDTH + POINT_WIDTH/2;
    } else if (pointIndex < 12) {
        return boardOffset + (12 - pointIndex) * POINT_WIDTH - POINT_WIDTH/2;
    } else if (pointIndex < 18) {
        return boardOffset + (pointIndex - 12 + 1) * POINT_WIDTH - POINT_WIDTH/2;
    } else {
        return boardOffset + BOARD_WIDTH - (24 - pointIndex) * POINT_WIDTH + POINT_WIDTH/2;
    }
}

function getPointY(pointIndex) {
    return pointIndex < 12 ? BOARD_HEIGHT : 0;
}

function getCheckerY(pointIndex, checkerIndex) {
    let pointY = getPointY(pointIndex);
    if (pointIndex < 12) {
        return pointY - CHECKER_RADIUS - (checkerIndex * CHECKER_RADIUS * 2);
    } else {
        return pointY + CHECKER_RADIUS + (checkerIndex * CHECKER_RADIUS * 2);
    }
}

// Game state persistence
function saveGameState() {
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
        version: '10.3.0'
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
        } else {
            // Initialize new game
            initializeBoard();
        }
    } catch (error) {
        console.error('Error loading game state:', error);
        initializeBoard();
    }
}

function resetGame() {
    localStorage.removeItem('backgammonState');
    initializeBoard();
    updateUI();
}

// Update UI elements
function updateUI() {
    const diceContainer = document.getElementById('dice-container');
    if (diceContainer) {
        diceContainer.innerHTML = '';
        
        if (diceRolled && dice.length > 0) {
            dice.forEach(die => {
                const dieElement = document.createElement('div');
                dieElement.className = 'die';
                dieElement.textContent = die;
                diceContainer.appendChild(dieElement);
            });
        }
    }
    
    const rollButton = document.getElementById('roll-button');
    if (rollButton) {
        rollButton.disabled = diceRolled;
    }
    
    const player1Info = document.getElementById('player1-info');
    const player2Info = document.getElementById('player2-info');
    
    if (player1Info && player2Info) {
        player1Info.className = currentPlayer === 'player1' ? 'player-info active' : 'player-info';
        player2Info.className = currentPlayer === 'player2' ? 'player-info active' : 'player-info';
    }
    
    const statusElement = document.getElementById('game-status');
    if (statusElement) {
        statusElement.textContent = gameStatus;
    }
    
    // Create or update version banner
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
        versionBanner.style.zIndex = '1000';
        document.body.appendChild(versionBanner);
    }
    
    versionBanner.textContent = 'Version 10.3.0 - Local Mode';
}

// Export functions to window object
window.setup = setup;
window.draw = draw;
window.mousePressed = mousePressed;
window.mouseReleased = mouseReleased;
window.rollDice = rollDice;
window.resetGame = resetGame; 