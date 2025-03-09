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

// Global p5.js instance
let p5Instance = null;

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
        
        // White checkers - match the setup in firebase-config.js
        for (let i = 0; i < 2; i++) board[0].push({ color: 'white' });
        for (let i = 0; i < 5; i++) board[11].push({ color: 'white' });
        for (let i = 0; i < 3; i++) board[16].push({ color: 'white' });
        for (let i = 0; i < 5; i++) board[18].push({ color: 'white' });
        
        // Black checkers - match the setup in firebase-config.js
        for (let i = 0; i < 2; i++) board[23].push({ color: 'black' });
        for (let i = 0; i < 5; i++) board[12].push({ color: 'black' });
        for (let i = 0; i < 3; i++) board[7].push({ color: 'black' });
        for (let i = 0; i < 5; i++) board[5].push({ color: 'black' });
        
        // Initialize other game state variables
        if (typeof whiteBar === 'undefined') whiteBar = [];
        if (typeof blackBar === 'undefined') blackBar = [];
        if (typeof whiteBearOff === 'undefined') whiteBearOff = [];
        if (typeof blackBearOff === 'undefined') blackBearOff = [];
        
        safeDebugLog("Board initialized with starting positions");
    } catch (error) {
        console.error("Error initializing board:", error);
    }
}

// Function to create a new p5.js instance in global mode
function createP5Instance() {
    // Define the sketch
    const sketch = function(p) {
        p.setup = function() {
            console.log("p5.js setup function called");
            const canvas = p.createCanvas(BOARD_WIDTH + 2 * BEAR_OFF_WIDTH, BOARD_HEIGHT);
            p.frameRate(30);
            console.log("Canvas created with dimensions:", { 
                width: BOARD_WIDTH + 2 * BEAR_OFF_WIDTH, 
                height: BOARD_HEIGHT 
            });
            
            // Initialize game
            if (typeof initializeBoard === 'function') {
                initializeBoard();
            }
        };
        
        p.draw = function() {
            // Frame rate limiting
            const currentTime = performance.now();
            if (currentTime - lastDrawTime < 1000 / FRAME_RATE_LIMIT) {
                return; // Skip this frame
            }
            lastDrawTime = currentTime;
            
            p.background(240);
            
            // Draw the game board
            drawBoard(p);
            
            // Only draw checkers if game has started or board is initialized
            if (typeof board !== 'undefined' && board && board.length > 0) {
                drawCheckers(p);
                drawBar(p);
                drawBearOffAreas(p);
            }
            
            // Only show valid moves if it's the current player's turn
            if (typeof selectedChecker !== 'undefined' && selectedChecker && typeof canPlayerMove === 'function' && canPlayerMove()) {
                drawValidMoves(p);
            }
            
            // Draw selected checker being dragged
            if (typeof selectedChecker !== 'undefined' && selectedChecker) {
                let checker;
                
                if (selectedChecker.pointIndex === -1) {
                    checker = { color: currentPlayer === 'player1' ? 'white' : 'black' };
                } else if (board[selectedChecker.pointIndex] && 
                           board[selectedChecker.pointIndex][selectedChecker.checkerIndex]) {
                    checker = board[selectedChecker.pointIndex][selectedChecker.checkerIndex];
                }
                
                if (checker) {
                    drawChecker(p, p.mouseX, p.mouseY, checker.color);
                }
            }
        };
        
        // Mouse event handlers
        p.mousePressed = function() {
            // Store mouse coordinates in global variables for game-logic.js
            window.mouseX = p.mouseX;
            window.mouseY = p.mouseY;
            
            // Call the game logic mousePressed function
            if (typeof window.mousePressed === 'function') {
                window.mousePressed();
            }
            
            // Prevent default browser behavior
            return false;
        };
        
        p.mouseReleased = function() {
            // Store mouse coordinates in global variables for game-logic.js
            window.mouseX = p.mouseX;
            window.mouseY = p.mouseY;
            
            // Call the game logic mouseReleased function
            if (typeof window.mouseReleased === 'function') {
                window.mouseReleased();
            }
            
            // Prevent default browser behavior
            return false;
        };
        
        // Helper function for distance calculation
        window.dist = function(x1, y1, x2, y2) {
            return p.dist(x1, y1, x2, y2);
        };
    };
    
    // Create a new p5 instance
    return new p5(sketch, 'canvas-container');
}

// Draw the game board
function drawBoard(p) {
    try {
        // Draw bear-off areas
        p.fill(101, 67, 33);
        p.rect(0, 0, BEAR_OFF_WIDTH, BOARD_HEIGHT); // Left bear-off
        p.rect(BOARD_WIDTH + BEAR_OFF_WIDTH, 0, BEAR_OFF_WIDTH, BOARD_HEIGHT); // Right bear-off
        
        // Draw main board
        p.fill(101, 67, 33);
        p.rect(BEAR_OFF_WIDTH, 0, BOARD_WIDTH, BOARD_HEIGHT);
        
        // Define point colors
        let darkPointColor = p.color(165, 42, 42);
        let lightPointColor = p.color(245, 245, 220);
        
        // Draw all 24 points
        for (let i = 0; i < 24; i++) {
            let pointX = getPointX(i);
            let pointY = getPointY(i);
            
            p.fill(i % 2 === 0 ? darkPointColor : lightPointColor);
            p.noStroke();
            
            if (i < 12) {
                p.triangle(
                    pointX - POINT_WIDTH/2, pointY, 
                    pointX + POINT_WIDTH/2, pointY, 
                    pointX, pointY - POINT_HEIGHT
                );
            } else {
                p.triangle(
                    pointX - POINT_WIDTH/2, pointY, 
                    pointX + POINT_WIDTH/2, pointY, 
                    pointX, pointY + POINT_HEIGHT
                );
            }
        }
        
        // Draw center bar
        p.fill(120, 80, 40); // Slightly different color for bar
        const barX = BOARD_WIDTH/2 - BAR_WIDTH/2 + BEAR_OFF_WIDTH;
        p.rect(barX, 0, BAR_WIDTH, BOARD_HEIGHT);
        
        // Draw board border
        p.noFill();
        p.strokeWeight(10);
        p.stroke(101, 67, 33);
        p.rect(BEAR_OFF_WIDTH, 0, BOARD_WIDTH, BOARD_HEIGHT);
        
    } catch (error) {
        console.error("Error drawing board:", error);
    }
}

// Draw all checkers on the board
function drawCheckers(p) {
    try {
        // Draw checkers on points
        for (let i = 0; i < 24; i++) {
            if (board[i] && board[i].length > 0) {
                for (let j = 0; j < board[i].length; j++) {
                    const x = getPointX(i);
                    const y = getCheckerY(i, j);
                    drawChecker(p, x, y, board[i][j].color);
                }
            }
        }
    } catch (error) {
        console.error("Error drawing checkers:", error);
    }
}

// Draw a single checker
function drawChecker(p, x, y, color) {
    try {
        p.strokeWeight(2);
        
        if (color === 'white') {
            p.fill(255);
            p.stroke(200);
        } else {
            p.fill(50);
            p.stroke(20);
        }
        
        p.circle(x, y, CHECKER_RADIUS * 2);
        
        // Add some detail to the checker
        p.strokeWeight(1);
        if (color === 'white') {
            p.stroke(220);
            p.noFill();
        } else {
            p.stroke(70);
            p.noFill();
        }
        
        p.circle(x, y, CHECKER_RADIUS * 1.5);
        p.circle(x, y, CHECKER_RADIUS * 1.0);
        p.circle(x, y, CHECKER_RADIUS * 0.5);
    } catch (error) {
        console.error("Error drawing checker:", error);
    }
}

// Draw the bar with checkers
function drawBar(p) {
    try {
        const barX = BOARD_WIDTH/2 + BEAR_OFF_WIDTH;
        
        // Draw white checkers on the bar
        if (typeof whiteBar !== 'undefined' && whiteBar && whiteBar.length > 0) {
            for (let i = 0; i < whiteBar.length; i++) {
                const y = BOARD_HEIGHT/4 + i * (CHECKER_RADIUS * 2 + 5);
                drawChecker(p, barX, y, 'white');
            }
        }
        
        // Draw black checkers on the bar
        if (typeof blackBar !== 'undefined' && blackBar && blackBar.length > 0) {
            for (let i = 0; i < blackBar.length; i++) {
                const y = BOARD_HEIGHT*3/4 - i * (CHECKER_RADIUS * 2 + 5);
                drawChecker(p, barX, y, 'black');
            }
        }
    } catch (error) {
        console.error("Error drawing bar:", error);
    }
}

// Draw the bear-off areas with checkers
function drawBearOffAreas(p) {
    try {
        // Draw white bear-off area
        const whiteBearOffX = BOARD_WIDTH + BEAR_OFF_WIDTH + BEAR_OFF_WIDTH/2;
        
        if (typeof whiteBearOff !== 'undefined' && whiteBearOff && whiteBearOff.length > 0) {
            // Calculate how many checkers to stack before starting a new column
            const maxStackHeight = Math.floor(BOARD_HEIGHT / (CHECKER_RADIUS * 2 + 5));
            
            for (let i = 0; i < whiteBearOff.length; i++) {
                const column = Math.floor(i / maxStackHeight);
                const row = i % maxStackHeight;
                
                const x = whiteBearOffX - column * (CHECKER_RADIUS * 2 + 5);
                const y = CHECKER_RADIUS + row * (CHECKER_RADIUS * 2 + 5);
                
                drawChecker(p, x, y, 'white');
            }
        }
        
        // Draw black bear-off area
        const blackBearOffX = BEAR_OFF_WIDTH/2;
        
        if (typeof blackBearOff !== 'undefined' && blackBearOff && blackBearOff.length > 0) {
            // Calculate how many checkers to stack before starting a new column
            const maxStackHeight = Math.floor(BOARD_HEIGHT / (CHECKER_RADIUS * 2 + 5));
            
            for (let i = 0; i < blackBearOff.length; i++) {
                const column = Math.floor(i / maxStackHeight);
                const row = i % maxStackHeight;
                
                const x = blackBearOffX + column * (CHECKER_RADIUS * 2 + 5);
                const y = BOARD_HEIGHT - CHECKER_RADIUS - row * (CHECKER_RADIUS * 2 + 5);
                
                drawChecker(p, x, y, 'black');
            }
        }
    } catch (error) {
        console.error("Error drawing bear-off areas:", error);
    }
}

// Draw valid moves for the selected checker
function drawValidMoves(p) {
    try {
        if (!selectedChecker) return;
        
        // Use the global validMoves array calculated by game-logic.js
        if (!window.validMoves || !Array.isArray(window.validMoves)) {
            console.log("No valid moves available");
            return;
        }
        
        console.log("Drawing valid moves:", window.validMoves);
        
        // Draw valid move indicators with more visible highlighting
        p.noStroke();
        p.fill(0, 255, 0, 150); // Semi-transparent green with higher opacity
        
        for (let i = 0; i < window.validMoves.length; i++) {
            const toPoint = window.validMoves[i];
            
            if (toPoint === 24) {
                // White bear-off
                const x = BOARD_WIDTH + BEAR_OFF_WIDTH + BEAR_OFF_WIDTH/2;
                const y = BOARD_HEIGHT/2;
                
                // Draw a larger highlight for bear-off
                p.circle(x, y, CHECKER_RADIUS * 3);
                
                // Add a pulsing effect
                const pulseSize = Math.sin(p.frameCount * 0.1) * 10 + 5;
                p.stroke(255, 255, 0);
                p.strokeWeight(2);
                p.noFill();
                p.circle(x, y, CHECKER_RADIUS * 3 + pulseSize);
            } else if (toPoint === -1) {
                // Black bear-off
                const x = BEAR_OFF_WIDTH/2;
                const y = BOARD_HEIGHT/2;
                
                // Draw a larger highlight for bear-off
                p.circle(x, y, CHECKER_RADIUS * 3);
                
                // Add a pulsing effect
                const pulseSize = Math.sin(p.frameCount * 0.1) * 10 + 5;
                p.stroke(255, 255, 0);
                p.strokeWeight(2);
                p.noFill();
                p.circle(x, y, CHECKER_RADIUS * 3 + pulseSize);
            } else {
                // Regular move
                const x = getPointX(toPoint);
                
                // For regular points, highlight the entire point
                if (toPoint < 12) {
                    // Bottom row
                    p.fill(0, 255, 0, 100);
                    p.triangle(
                        x - POINT_WIDTH/2, BOARD_HEIGHT,
                        x + POINT_WIDTH/2, BOARD_HEIGHT,
                        x, BOARD_HEIGHT - POINT_HEIGHT
                    );
                    
                    // Draw a circle at the position where the checker would go
                    const checkerCount = board[toPoint] ? board[toPoint].length : 0;
                    const checkerY = getCheckerY(toPoint, checkerCount);
                    
                    p.fill(0, 255, 0, 150);
                    p.circle(x, checkerY, CHECKER_RADIUS * 2.5);
                    
                    // Add a pulsing effect
                    const pulseSize = Math.sin(p.frameCount * 0.1) * 5 + 2;
                    p.stroke(255, 255, 0);
                    p.strokeWeight(2);
                    p.noFill();
                    p.circle(x, checkerY, CHECKER_RADIUS * 2.5 + pulseSize);
                } else {
                    // Top row
                    p.fill(0, 255, 0, 100);
                    p.triangle(
                        x - POINT_WIDTH/2, 0,
                        x + POINT_WIDTH/2, 0,
                        x, POINT_HEIGHT
                    );
                    
                    // Draw a circle at the position where the checker would go
                    const checkerCount = board[toPoint] ? board[toPoint].length : 0;
                    const checkerY = getCheckerY(toPoint, checkerCount);
                    
                    p.fill(0, 255, 0, 150);
                    p.circle(x, checkerY, CHECKER_RADIUS * 2.5);
                    
                    // Add a pulsing effect
                    const pulseSize = Math.sin(p.frameCount * 0.1) * 5 + 2;
                    p.stroke(255, 255, 0);
                    p.strokeWeight(2);
                    p.noFill();
                    p.circle(x, checkerY, CHECKER_RADIUS * 2.5 + pulseSize);
                }
            }
        }
    } catch (error) {
        console.error("Error drawing valid moves:", error);
    }
}

// Helper function to get the X coordinate of a point
function getPointX(pointIndex) {
    try {
        // Points 0-11 are on the bottom, 12-23 are on the top
        // Points are numbered right to left for the bottom row, left to right for the top row
        
        const barX = BOARD_WIDTH/2 + BEAR_OFF_WIDTH;
        const pointWidth = (BOARD_WIDTH - BAR_WIDTH) / 12;
        
        if (pointIndex < 12) {
            // Bottom row (right to left)
            if (pointIndex < 6) {
                // Right side of the bar
                return barX + BAR_WIDTH/2 + pointWidth/2 + pointIndex * pointWidth;
            } else {
                // Left side of the bar
                return barX - BAR_WIDTH/2 - pointWidth/2 - (11 - pointIndex) * pointWidth;
            }
        } else {
            // Top row (left to right)
            if (pointIndex < 18) {
                // Left side of the bar
                return BEAR_OFF_WIDTH + pointWidth/2 + (pointIndex - 12) * pointWidth;
            } else {
                // Right side of the bar
                return barX + BAR_WIDTH/2 + pointWidth/2 + (pointIndex - 18) * pointWidth;
            }
        }
    } catch (error) {
        console.error("Error getting point X:", error);
        return 0;
    }
}

// Helper function to get the Y coordinate of a point
function getPointY(pointIndex) {
    return pointIndex < 12 ? BOARD_HEIGHT : 0;
}

// Helper function to get the Y coordinate of a checker on a point
function getCheckerY(pointIndex, checkerIndex) {
    try {
        if (pointIndex < 12) {
            // Bottom row, checkers stack upward
            return BOARD_HEIGHT - CHECKER_RADIUS - checkerIndex * (CHECKER_RADIUS * 2 + 5);
        } else {
            // Top row, checkers stack downward
            return CHECKER_RADIUS + checkerIndex * (CHECKER_RADIUS * 2 + 5);
        }
    } catch (error) {
        console.error("Error getting checker Y:", error);
        return 0;
    }
}

// Function to start the game loop
function startGameLoop() {
    try {
        console.log("Starting game loop");
        
        // Create p5 instance if it doesn't exist
        if (!p5Instance) {
            p5Instance = createP5Instance();
            console.log("Created new p5 instance");
        }
        
        console.log("Game loop started");
    } catch (error) {
        console.error("Error starting game loop:", error);
    }
}

// Make the function available globally
window.startGameLoop = startGameLoop;

// Log that the board functions have been loaded
console.log("Game board functions loaded successfully");
