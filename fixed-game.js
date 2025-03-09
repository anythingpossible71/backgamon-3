// fixed-game.js - Version 10.4.0 (Last updated: June 19, 2024)
// Simplified local two-player backgammon with improved placement and drag

// Game configurations
const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 600;
const POINT_WIDTH = 50;
const POINT_HEIGHT = 200;  // Reduced height for better checker placement
const CHECKER_RADIUS = 22; // Slightly smaller checkers for better stacking
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

// Initialize the game board with checker positions
function initializeBoard() {
    board = [];
    for (let i = 0; i < 24; i++) {
        board.push([]);
    }
    
    // White checkers - standard backgammon setup
    for (let i = 0; i < 2; i++) board[0].push({ color: 'white' });
    for (let i = 0; i < 5; i++) board[11].push({ color: 'white' });
    for (let i = 0; i < 3; i++) board[16].push({ color: 'white' });
    for (let i = 0; i < 5; i++) board[18].push({ color: 'white' });
    
    // Black checkers - standard backgammon setup
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
    lastUpdateTime = new Date().toLocaleString();
    
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

// Mouse interaction handlers - improved for reliable dragging
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
            isDragging = true;
            calculateValidMoves(-1);
            return;
        }
        
        return; // Must move from bar
    }
    
    // Check if a checker was clicked
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
                calculateValidMoves(i);
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
                if (targetIndex >= 24 || (isHighestChecker(pointIndex, playerColor) && die >= 24 - pointIndex)) {
                    moves.push(24); // White bears off to point 24
                    continue;
                }
            } else if (playerColor === 'black' && pointIndex <= 5) {
                if (targetIndex < 0 || (isHighestChecker(pointIndex, playerColor) && die >= pointIndex + 1)) {
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

// Check if a checker is the highest one (farthest from home) for bearing off
function isHighestChecker(pointIndex, playerColor) {
    if (playerColor === 'white') {
        // For white, check if there are any white checkers with lower indices
        for (let i = 0; i < pointIndex; i++) {
            if (board[i].some(checker => checker.color === 'white')) {
                return false;
            }
        }
    } else {
        // For black, check if there are any black checkers with higher indices
        for (let i = pointIndex + 1; i < 24; i++) {
            if (board[i].some(checker => checker.color === 'black')) {
                return false;
            }
        }
    }
    return true;
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
        gameStatus = `${playerColor === 'white' ? 'White' : 'Black'} moved from ${fromPoint === -1 ? 'bar' : fromPoint} to ${toPoint}`;
    }
    
    // Remove used die
    const moveDistance = Math.abs(toPoint - fromPoint);
    const dieIndex = dice.indexOf(moveDistance);
    
    if (dieIndex !== -1) {
        dice.splice(dieIndex, 1);
    } else {
        // Just use the first die if no match (for bearing off with larger die)
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
    
    // Highlight if there are checkers on the bar and it's that player's turn
    const playerColor = currentPlayer === 'player1' ? 'white' : 'black';
    if ((playerColor === 'white' && whiteBar.length > 0) || 
        (playerColor === 'black' && blackBar.length > 0)) {
        
        noFill();
        stroke(255, 255, 0);
        strokeWeight(3);
        rect(barX - BAR_WIDTH/2, 0, BAR_WIDTH, BOARD_HEIGHT);
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

// Helper functions for positioning - fixed for better placement
function getPointX(pointIndex) {
    const boardOffset = BEAR_OFF_WIDTH;
    const pointSpacing = BOARD_WIDTH / 12;
    const halfPointSpacing = pointSpacing / 2;
    
    if (pointIndex < 6) {
        // Bottom right 6 points
        return boardOffset + BOARD_WIDTH - (pointIndex * pointSpacing) - halfPointSpacing;
    } else if (pointIndex < 12) {
        // Bottom left 6 points
        return boardOffset + ((11 - pointIndex) * pointSpacing) + halfPointSpacing;
    } else if (pointIndex < 18) {
        // Top left 6 points
        return boardOffset + ((pointIndex - 12) * pointSpacing) + halfPointSpacing;
    } else {
        // Top right 6 points
        return boardOffset + BOARD_WIDTH - ((pointIndex - 18) * pointSpacing) - halfPointSpacing;
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
        version: '10.4.0',
        lastUpdateTime
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
        versionBanner.style.fontFamily = 'Arial, sans-serif';
        versionBanner.style.zIndex = '1000';
        document.body.appendChild(versionBanner);
    }
    
    versionBanner.textContent = `Version 10.4.0 - Last Updated: ${lastUpdateTime}`;
}

// Export functions to window object
window.setup = setup;
window.draw = draw;
window.mousePressed = mousePressed;
window.mouseReleased = mouseReleased;
window.rollDice = rollDice;
window.resetGame = resetGame; 