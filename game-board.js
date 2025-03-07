// game-board.js - Complete implementation
// This file handles drawing the game board and visual elements

// Game configurations - using var to avoid redeclaration errors
if (typeof BOARD_WIDTH === 'undefined') var BOARD_WIDTH = 800;
if (typeof BOARD_HEIGHT === 'undefined') var BOARD_HEIGHT = 600;
if (typeof POINT_WIDTH === 'undefined') var POINT_WIDTH = 50;
if (typeof POINT_HEIGHT === 'undefined') var POINT_HEIGHT = 240;
if (typeof CHECKER_RADIUS === 'undefined') var CHECKER_RADIUS = 25;
if (typeof BAR_WIDTH === 'undefined') var BAR_WIDTH = 50;
if (typeof BEAR_OFF_WIDTH === 'undefined') var BEAR_OFF_WIDTH = 80;

// Performance optimization variables
let lastDrawTime = 0;
const FRAME_RATE_LIMIT = 30; // Limit to 30 FPS to reduce CPU usage
let gameInitialized = false;
let lastDebugTime = 0;

// Safe debug logging to prevent console flooding
function safeDebugLog(message, data) {
    const now = performance.now();
    if (now - lastDebugTime < 500) return; // Limit to 2 logs per second
    
    lastDebugTime = now;
    if (typeof debugLog === 'function') {
        debugLog(message, data);
    } else {
        if (data) {
            console.log("[DEBUG] " + message, data);
        } else {
            console.log("[DEBUG] " + message);
        }
    }
}

// Initialize the game board
function initializeBoard() {
    try {
        safeDebugLog("Initializing game board");
        
        // Create new board array
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
        
        // Reset game state
        whiteBar = [];
        blackBar = [];
        whiteBearOff = [];
        blackBearOff = [];
        
        safeDebugLog("Board initialized successfully", { boardLength: board.length });
    } catch (error) {
        console.error("Error in initializeBoard:", error);
    }
}

// Drawing functions
function drawBoard() {
    try {
        // Draw bear-off areas
        fill(101, 67, 33);
        rect(0, 0, BEAR_OFF_WIDTH, BOARD_HEIGHT); // Left bear-off
        rect(BOARD_WIDTH + BEAR_OFF_WIDTH, 0, BEAR_OFF_WIDTH, BOARD_HEIGHT); // Right bear-off
        
        // Draw main board
        fill(101, 67, 33);
        rect(BEAR_OFF_WIDTH, 0, BOARD_WIDTH, BOARD_HEIGHT);
        
        // Define point colors
        let darkPointColor = color(165, 42, 42);
        let lightPointColor = color(245, 245, 220);
        
        // Draw all 24 points
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
    } catch (error) {
        console.error("Error in drawBoard:", error);
    }
}

function drawCheckers() {
    try {
        // Safety check
        if (!board || !Array.isArray(board) || board.length === 0) {
            return;
        }
        
        // Draw checkers on all points
        for (let i = 0; i < board.length; i++) {
            let point = board[i];
            if (!point || !Array.isArray(point) || point.length === 0) continue;
            
            let pointX = getPointX(i);
            
            for (let j = 0; j < point.length; j++) {
                // Skip the selected checker (it will be drawn at mouse position)
                if (selectedChecker && 
                    selectedChecker.pointIndex === i && 
                    selectedChecker.checkerIndex === j) {
                    continue;
                }
                
                let checker = point[j];
                if (!checker || !checker.color) continue;
                
                let checkerY = getCheckerY(i, j);
                drawChecker(pointX, checkerY, checker.color);
            }
        }
    } catch (error) {
        console.error("Error in drawCheckers:", error);
    }
}

function drawChecker(x, y, color) {
    try {
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
    } catch (error) {
        console.error("Error in drawChecker:", error);
    }
}

function drawBar() {
    try {
        let barX = BOARD_WIDTH/2 + BEAR_OFF_WIDTH;
            
        // Draw bar background
        fill(120, 80, 40);
        rect(barX - BAR_WIDTH/2, 0, BAR_WIDTH, BOARD_HEIGHT);
        
        // Draw bar borders
        noFill();
        stroke(80, 40, 0);
        strokeWeight(3);
        rect(barX - BAR_WIDTH/2, 0, BAR_WIDTH, BOARD_HEIGHT);
        
        // Safety checks for arrays
        if (!whiteBar) whiteBar = [];
        if (!blackBar) blackBar = [];
        
        // Draw checkers on the bar
        for (let i = 0; i < whiteBar.length; i++) {
            let barY = BOARD_HEIGHT / 4 - (i * CHECKER_RADIUS * 1.5);
            drawChecker(barX, barY, 'white');
        }
        
        for (let i = 0; i < blackBar.length; i++) {
            let barY = BOARD_HEIGHT * 3/4 + (i * CHECKER_RADIUS * 1.5);
            drawChecker(barX, barY, 'black');
        }
        
        // Highlight the bar if player has checkers there and must move them
        let playerColor = currentPlayer === 'player1' ? 'white' : 'black';
        if ((playerColor === 'white' && whiteBar.length > 0) || 
            (playerColor === 'black' && blackBar.length > 0)) {
            
            noFill();
            stroke(255, 255, 0);
            strokeWeight(3);
            rect(barX - BAR_WIDTH/2, 0, BAR_WIDTH, BOARD_HEIGHT);
            
            fill(255, 255, 0);
            noStroke();
            textSize(14);
            textAlign(CENTER);
            
            if (playerColor === 'white') {
                text("Must move from bar", barX, BOARD_HEIGHT/4 + CHECKER_RADIUS * 3);
            } else {
                text("Must move from bar", barX, BOARD_HEIGHT * 3/4 - CHECKER_RADIUS * 3);
            }
        }
    } catch (error) {
        console.error("Error in drawBar:", error);
    }
}

function drawBearOffAreas() {
    try {
        // Safety checks for arrays
        if (!whiteBearOff) whiteBearOff = [];
        if (!blackBearOff) blackBearOff = [];
        
        // Left bear-off area (Black)
        fill(80, 50, 20);
        rect(0, 0, BEAR_OFF_WIDTH, BOARD_HEIGHT);
        
        // Right bear-off area (White)
        fill(80, 50, 20);
        rect(BOARD_WIDTH + BEAR_OFF_WIDTH, 0, BEAR_OFF_WIDTH, BOARD_HEIGHT);
        
        // Rectangle dimensions for borne off pieces
        const rectWidth = 50;
        const rectHeight = 20;
        
        // Draw rectangle for each white piece borne off
        for (let i = 0; i < whiteBearOff.length; i++) {
            fill(255);
            stroke(200);
            strokeWeight(2);
            
            // Stack vertically
            const y = 100 + i * (rectHeight + 5);
            const x = BOARD_WIDTH + BEAR_OFF_WIDTH + 15;
            
            rect(x, y, rectWidth, rectHeight, 5);
        }
        
        // Draw rectangle for each black piece borne off
        for (let i = 0; i < blackBearOff.length; i++) {
            fill(50);
            stroke(20);
            strokeWeight(2);
            
            // Stack vertically
            const y = 100 + i * (rectHeight + 5);
            const x = 15;
            
            rect(x, y, rectWidth, rectHeight, 5);
        }
    } catch (error) {
        console.error("Error in drawBearOffAreas:", error);
    }
}

function drawValidMoves() {
    try {
        // Safety checks for arrays
        if (!validMoves) validMoves = [];
        if (!combinedMoves) combinedMoves = [];
        
        // Only show valid moves if it's the current player's turn and they can move
        if ((playerRole === "player1" && currentPlayer === "player1") || 
            (playerRole === "player2" && currentPlayer === "player2")) {
            
            // Highlight normal moves (from single dice)
            noStroke();
            fill(255, 255, 0, 100);
            
            for (const pointIndex of validMoves) {
                if (pointIndex === 24 || pointIndex === -1) continue;
                
                let pointX = getPointX(pointIndex);
                let pointY = getPointY(pointIndex);
                
                if (pointIndex < 12) {
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
            
            // Highlight combined moves (using both dice)
            noStroke();
            fill(0, 255, 255, 100);
            
            for (const combinedMove of combinedMoves) {
                if (!combinedMove || 
                    combinedMove.targetIndex === 24 || 
                    combinedMove.targetIndex === -1) continue;
                
                let pointX = getPointX(combinedMove.targetIndex);
                let pointY = getPointY(combinedMove.targetIndex);
                
                if (combinedMove.targetIndex < 12) {
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
            
            // Bearing off indicators
            let playerColor = currentPlayer === 'player1' ? 'white' : 'black';
            
            if (validMoves.includes(24) || validMoves.includes(-1)) {
                noStroke();
                fill(255, 255, 0, 100);
                
                if (playerColor === 'white' && validMoves.includes(24)) {
                    rect(BOARD_WIDTH + BEAR_OFF_WIDTH, 0, BEAR_OFF_WIDTH, BOARD_HEIGHT/2);
                } else if (playerColor === 'black' && validMoves.includes(-1)) {
                    rect(0, BOARD_HEIGHT/2, BEAR_OFF_WIDTH, BOARD_HEIGHT/2);
                }
            }
        }
    } catch (error) {
        console.error("Error in drawValidMoves:", error);
    }
}

// Helper functions for board positions
function getPointX(pointIndex) {
    try {
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
    } catch (error) {
        console.error("Error in getPointX:", error);
        return BOARD_WIDTH / 2 + BEAR_OFF_WIDTH; // Return center X if error
    }
}

function getPointY(pointIndex) {
    return pointIndex < 12 ? BOARD_HEIGHT : 0;
}

function getCheckerY(pointIndex, checkerIndex) {
    try {
        let pointY = getPointY(pointIndex);
        if (pointIndex < 12) {
            return pointY - CHECKER_RADIUS - (checkerIndex * CHECKER_RADIUS * 2);
        } else {
            return pointY + CHECKER_RADIUS + (checkerIndex * CHECKER_RADIUS * 2);
        }
    } catch (error) {
        console.error("Error in getCheckerY:", error);
        return BOARD_HEIGHT / 2; // Return center Y if error
    }
}

// Check if both players have joined and force game to start if needed
function checkAndStartGame() {
    try {
        safeDebugLog("Checking if game can start...");
        
        if (player1Name !== "Player 1" && player2Name !== "Player 2") {
            safeDebugLog("Both players have joined, forcing game to start");
            
            // Force UI update
            gameStarted = true;
            
            // Hide waiting message for player 1
            const waitingMessage = document.getElementById('waiting-message');
            const playerJoin = document.getElementById('player-join');
            const gameControls = document.getElementById('game-controls');
            
            if (waitingMessage) waitingMessage.classList.add('hidden');
            if (playerJoin) playerJoin.classList.add('hidden');
            if (gameControls) gameControls.classList.remove('hidden');
            
            // Enable roll button for player 1
            if (currentPlayer === 'player1' && playerRole === 'player1') {
                const rollButton = document.getElementById('roll-button');
                if (rollButton) rollButton.disabled = false;
            }
            
            // Update UI
            const gameStatusEl = document.getElementById('game-status');
            if (gameStatusEl) gameStatusEl.textContent = player1Name + "'s turn to roll";
            
            // Update other UI elements without using functions that might cause loops
            updateUIDirectly();
            
            // Save game state after a delay
            setTimeout(() => {
                if (typeof saveGameState === 'function') {
                    saveGameState();
                }
            }, 500);
        }
    } catch (error) {
        console.error("Error in checkAndStartGame:", error);
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

// p5.js setup function - only runs once
function setup() {
    try {
        if (gameInitialized) {
            console.log("Setup already called once, skipping");
            return;
        }
        
        safeDebugLog("Setup function called");
        gameInitialized = true;
        
        // Create canvas and append to container
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
            const canvas = createCanvas(BOARD_WIDTH + 2 * BEAR_OFF_WIDTH, BOARD_HEIGHT);
            canvas.parent('canvas-container');
            
            // Set framerate limit
            frameRate(30);
            
            safeDebugLog("Canvas created with dimensions:", { 
                width: BOARD_WIDTH + 2 * BEAR_OFF_WIDTH, 
                height: BOARD_HEIGHT 
            });
        } else {
            console.error("Canvas container not found");
        }
        
        // Initialize game
        initializeBoard();
        
        // Make sure the roll button is connected
        const rollButton = document.getElementById('roll-button');
        if (rollButton) {
            // Remove any existing event listeners
            const newButton = rollButton.cloneNode(true);
            rollButton.parentNode.replaceChild(newButton, rollButton);
            
            // Add new event listener
            newButton.addEventListener('click', function() {
                console.log("Roll button clicked");
                if (typeof rollDice === 'function') {
                    rollDice();
                } else if (typeof window.rollDice === 'function') {
                    window.rollDice();
                } else {
                    console.error("rollDice function not found");
                }
            });
            
            safeDebugLog("Roll button event listener added");
        } else {
            safeDebugLog("Roll button not found");
        }
        
        safeDebugLog("Backgammon game initialized in setup");
    } catch (error) {
        console.error("Error in setup:", error);
    }
}

// p5.js draw function with frame rate limiting
function draw() {
    try {
        // Frame rate limiting to prevent high CPU usage
        const currentTime = performance.now();
        if (currentTime - lastDrawTime < 1000 / FRAME_RATE_LIMIT) {
            return; // Skip this frame
        }
        lastDrawTime = currentTime;
        
        background(240);
        
        // Always draw the game board
        drawBoard();
        
        // Only draw checkers if game has started or board is initialized
        if (board && board.length > 0) {
            drawCheckers();
            drawBar();
            drawBearOffAreas();
        }
        
        // Only show valid moves if it's the current player's turn
        if (selectedChecker && canPlayerMove()) {
            drawValidMoves();
        }
        
        // Draw selected checker being dragged
        if (selectedChecker) {
            let checker;
            
            if (selectedChecker.pointIndex === -1) {
                checker = { color: currentPlayer === 'player1' ? 'white' : 'black' };
            } else if (board[selectedChecker.pointIndex] && 
                       board[selectedChecker.pointIndex][selectedChecker.checkerIndex]) {
                checker = board[selectedChecker.pointIndex][selectedChecker.checkerIndex];
            }
            
            if (checker) {
                drawChecker(mouseX, mouseY, checker.color);
            }
        }
    } catch (error) {
        console.error("Error in draw:", error);
    }
}

// Debug function to log current board state
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

// Make these functions globally accessible
window.initializeBoard = initializeBoard;
window.drawBoard = drawBoard;
window.drawCheckers = drawCheckers;
window.drawChecker = drawChecker;
window.drawBar = drawBar;
window.drawBearOffAreas = drawBearOffAreas;
window.drawValidMoves = drawValidMoves;
window.getPointX = getPointX;
window.getPointY = getPointY;
window.getCheckerY = getCheckerY;
window.checkAndStartGame = checkAndStartGame;
window.updateUIDirectly = updateUIDirectly;
window.setup = setup;
window.draw = draw;
window.debugBoard = debugBoard;

// Log that the board functions have been loaded
console.log("Game board functions loaded successfully");
