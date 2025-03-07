// fix-loops.js - Fixes for backgammon game issues
// This script should be added at the bottom of game.html before the closing </body> tag

// Fix for duplicate variable declarations
// Set these variables only if they don't already exist
window.BOARD_WIDTH = window.BOARD_WIDTH || 800;
window.BOARD_HEIGHT = window.BOARD_HEIGHT || 600;
window.POINT_WIDTH = window.POINT_WIDTH || 50;
window.POINT_HEIGHT = window.POINT_HEIGHT || 240;
window.CHECKER_RADIUS = window.CHECKER_RADIUS || 25;
window.BAR_WIDTH = window.BAR_WIDTH || 50;
window.BEAR_OFF_WIDTH = window.BEAR_OFF_WIDTH || 80;

console.log("Loading backgammon infinite loop protections...");

// -------------------------------
// Board state protection
// -------------------------------

// Keep a local backup of the last valid board state
let boardBackup = null;
let backupTimestamp = 0;

// Function to backup current board state
function backupBoardState() {
    if (window.board && Array.isArray(window.board) && window.board.length === 24) {
        // Check if board has any pieces before backing up
        let hasPieces = false;
        for (let i = 0; i < window.board.length; i++) {
            if (Array.isArray(window.board[i]) && window.board[i].length > 0) {
                hasPieces = true;
                break;
            }
        }
        
        if (hasPieces) {
            // Deep clone the board to avoid reference issues
            const clone = [];
            for (let i = 0; i < window.board.length; i++) {
                if (Array.isArray(window.board[i])) {
                    clone[i] = [];
                    for (let j = 0; j < window.board[i].length; j++) {
                        if (window.board[i][j] && window.board[i][j].color) {
                            clone[i][j] = { color: window.board[i][j].color };
                        }
                    }
                } else {
                    clone[i] = [];
                }
            }
            
            boardBackup = clone;
            backupTimestamp = Date.now();
            console.log("Board state backed up successfully");
        }
    }
}

// Function to restore board from backup
function restoreBoardFromBackup() {
    if (boardBackup && Array.isArray(boardBackup) && boardBackup.length === 24) {
        console.log("Restoring board from backup");
        
        // Ensure board exists and is an array
        if (!window.board || !Array.isArray(window.board) || window.board.length !== 24) {
            window.board = [];
            for (let i = 0; i < 24; i++) {
                window.board[i] = [];
            }
        }
        
        // Copy from backup to board
        for (let i = 0; i < 24; i++) {
            if (!window.board[i]) window.board[i] = [];
            
            if (Array.isArray(boardBackup[i])) {
                // Clear current points
                window.board[i] = [];
                
                // Copy from backup
                for (let j = 0; j < boardBackup[i].length; j++) {
                    if (boardBackup[i][j] && boardBackup[i][j].color) {
                        window.board[i].push({ color: boardBackup[i][j].color });
                    }
                }
            }
        }
        
        console.log("Board restored from backup");
        
        // Save the restored board to Firebase
        if (typeof window.saveGameState === 'function') {
            setTimeout(function() {
                window.saveGameState();
            }, 1000);
        }
    } else if (typeof window.initializeBoard === 'function') {
        console.log("No valid board backup available, initializing new board");
        window.initializeBoard();
    }
}

// Check if board is valid
function isValidBoard() {
    if (!window.board || !Array.isArray(window.board) || window.board.length !== 24) {
        return false;
    }
    
    // Check if any point has pieces
    for (let i = 0; i < window.board.length; i++) {
        if (Array.isArray(window.board[i]) && window.board[i].length > 0) {
            return true;
        }
    }
    
    return false;
}

// -------------------------------
// Global performance safeguards
// -------------------------------

// Prevent too many redraws
const MAX_FPS = 30;
let lastFrameTime = 0;

// Store original draw function
if (typeof window.draw === 'function' && !window.originalDraw) {
    window.originalDraw = window.draw;
    
    // Replace with rate-limited version
    window.draw = function() {
        const now = performance.now();
        if (now - lastFrameTime < 1000 / MAX_FPS) {
            return; // Skip this frame
        }
        lastFrameTime = now;
        
        try {
            window.originalDraw();
        } catch (error) {
            console.error("Error in draw function:", error);
        }
    };
}

// Prevent console log flood
const MAX_LOGS_PER_SECOND = 5;
const logThrottleMap = new Map();
const originalConsoleLog = console.log;

console.log = function(...args) {
    const now = Date.now();
    const message = args[0] || '';
    const messageKey = typeof message === 'string' ? message.substring(0, 50) : 'non-string-message';
    
    // Always log errors
    if (typeof message === 'string' && 
        (message.includes('error') || message.includes('Error') || 
         message.includes('exception') || message.includes('Exception'))) {
        return originalConsoleLog.apply(console, args);
    }
    
    // Check if we've logged this message recently
    const lastLog = logThrottleMap.get(messageKey);
    if (!lastLog || now - lastLog.time > 1000 / MAX_LOGS_PER_SECOND) {
        logThrottleMap.set(messageKey, { time: now, count: 1 });
        return originalConsoleLog.apply(console, args);
    } 
    
    // Update count but don't log
    const newCount = lastLog.count + 1;
    logThrottleMap.set(messageKey, { time: lastLog.time, count: newCount });
    
    // Every 100 skipped logs, show a summary
    if (newCount % 100 === 0) {
        originalConsoleLog.call(console, `[Skipped ${newCount} similar logs] ${message}`);
    }
};

// -------------------------------
// Firebase safety measures
// -------------------------------

// Prevent Firebase update loops by throttling
let lastSaveTime = 0;
const MIN_SAVE_INTERVAL = 3000; // 3 seconds between saves

// Safely override saveGameState function if it exists
if (typeof window.saveGameState === 'function' && !window.originalSaveGameState) {
    window.originalSaveGameState = window.saveGameState;
    
    window.saveGameState = function() {
        const now = Date.now();
        if (now - lastSaveTime < MIN_SAVE_INTERVAL) {
            console.log("Throttling game state save (too recent)");
            return;
        }
        
        // Check if board is valid before saving
        if (!isValidBoard() && boardBackup) {
            console.log("Board is invalid, restoring from backup before saving");
            restoreBoardFromBackup();
        }
        
        lastSaveTime = now;
        
        try {
            // Add a version number if not already there
            if (!window.gameStateVersion) {
                window.gameStateVersion = 1;
            } else {
                window.gameStateVersion++;
            }
            
            // Backup board before saving
            backupBoardState();
            
            // Call original function
            window.originalSaveGameState();
        } catch (error) {
            console.error("Error in saveGameState:", error);
        }
    };
}

// Intercept processFirebaseUpdate to check board validity
if (typeof window.processFirebaseUpdate === 'function' && !window.originalProcessFirebaseUpdate) {
    window.originalProcessFirebaseUpdate = window.processFirebaseUpdate;
    
    window.processFirebaseUpdate = function(gameData) {
        // Backup current board before updating
        backupBoardState();
        
        // Call original function
        window.originalProcessFirebaseUpdate(gameData);
        
        // Verify board state after update
        setTimeout(function() {
            if (!isValidBoard()) {
                console.log("Board became invalid after update, restoring");
                restoreBoardFromBackup();
            }
        }, 500);
    };
}

// -------------------------------
// Roll dice protection
// -------------------------------

// Prevent roll dice loops and double-clicks
let lastRollTime = 0;
const MIN_ROLL_INTERVAL = 2000; // 2 seconds between rolls
let isRolling = false;

// Safely override rollDice function if it exists
if (typeof window.rollDice === 'function' && !window.originalRollDice) {
    window.originalRollDice = window.rollDice;
    
    window.rollDice = function() {
        const now = Date.now();
        
        // Skip if already rolling or too soon after last roll
        if (isRolling || now - lastRollTime < MIN_ROLL_INTERVAL) {
            console.log("Skipping roll (in progress or too soon)");
            return;
        }
        
        // Check if board is valid before rolling
        if (!isValidBoard() && boardBackup) {
            console.log("Board is invalid, restoring from backup before rolling");
            restoreBoardFromBackup();
        }
        
        isRolling = true;
        lastRollTime = now;
        
        try {
            window.originalRollDice();
        } catch (error) {
            console.error("Error in rollDice:", error);
        } finally {
            // Release the lock after a delay
            setTimeout(() => {
                isRolling = false;
            }, 1000);
        }
    };
}

// Fix the hasLegalMoves function to handle null/undefined values
if (typeof window.hasLegalMoves === 'function' && !window.originalHasLegalMoves) {
    window.originalHasLegalMoves = window.hasLegalMoves;
    
    window.hasLegalMoves = function() {
        // Ensure board is valid before checking
        if (!isValidBoard() && boardBackup) {
            console.log("Board is invalid, restoring from backup before checking moves");
            restoreBoardFromBackup();
        }
        
        try {
            // Make sure dice exists
            if (!window.dice || !Array.isArray(window.dice) || window.dice.length === 0) {
                console.log("No dice available, can't check for legal moves");
                return false;
            }
            
            let playerColor = window.currentPlayer === 'player1' ? 'white' : 'black';
            console.log("Checking if player has legal moves. Color:", playerColor);
            
            // Check if player has checkers on the bar
            if ((playerColor === 'white' && window.whiteBar && window.whiteBar.length > 0) || 
                (playerColor === 'black' && window.blackBar && window.blackBar.length > 0)) {
                
                for (let i = 0; i < window.dice.length; i++) {
                    let die = window.dice[i];
                    let entryPoint = playerColor === 'white' ? die - 1 : 24 - die;
                    
                    if (entryPoint >= 0 && entryPoint < 24 && window.board[entryPoint]) {
                        if (window.board[entryPoint].length === 0 || 
                            (window.board[entryPoint][0] && window.board[entryPoint][0].color === playerColor) ||
                            (window.board[entryPoint].length === 1 && window.board[entryPoint][0] && 
                             window.board[entryPoint][0].color !== playerColor)) {
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
                if (!window.board[i]) {
                    window.board[i] = [];
                }
            }
            
            // Check for regular moves
            for (let i = 0; i < 24; i++) {
                for (let j = 0; j < window.board[i].length; j++) {
                    if (window.board[i][j] && window.board[i][j].color === playerColor) {
                        for (let k = 0; k < window.dice.length; k++) {
                            let die = window.dice[k];
                            let direction = playerColor === 'white' ? 1 : -1;
                            let targetIndex = i + (die * direction);
                            
                            if (targetIndex >= 0 && targetIndex < 24 && window.board[targetIndex]) {
                                if (window.board[targetIndex].length === 0 || 
                                    (window.board[targetIndex][0] && window.board[targetIndex][0].color === playerColor) ||
                                    (window.board[targetIndex].length === 1 && window.board[targetIndex][0] && 
                                     window.board[targetIndex][0].color !== playerColor)) {
                                    console.log("Legal regular move found from point", i, "to", targetIndex);
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
            
            // Check for bearing off (simplified)
            if (typeof window.canPlayerBearOff === 'function' && window.canPlayerBearOff(playerColor)) {
                console.log("Player can bear off, assuming there's at least one legal move");
                return true;
            }
            
            console.log("No legal moves found");
            return false;
        } catch (error) {
            console.error("Error in hasLegalMoves:", error);
            return false;
        }
    };
}

// -------------------------------
// Setup execution protection
// -------------------------------

// Ensure setup only runs once
let setupExecuted = false;

if (typeof window.setup === 'function' && !window.originalSetup) {
    window.originalSetup = window.setup;
    
    window.setup = function() {
        if (setupExecuted) {
            console.log("Setup already executed, skipping");
            return;
        }
        
        setupExecuted = true;
        console.log("Running setup once");
        
        try {
            window.originalSetup();
            
            // After setup completes, initialize board if needed
            setTimeout(() => {
                if (!isValidBoard() && typeof window.initializeBoard === 'function') {
                    console.log("Board is invalid after setup, initializing");
                    window.initializeBoard();
                    
                    // Then back it up
                    setTimeout(backupBoardState, 500);
                } else {
                    // Just back up existing board
                    backupBoardState();
                }
            }, 1000);
        } catch (error) {
            console.error("Error in setup:", error);
        }
    };
}

// Set a limit on the framerate for p5.js if available
if (typeof frameRate === 'function') {
    try {
        frameRate(30);
        console.log("Frame rate limited to 30 FPS");
    } catch (e) {
        console.warn("Could not limit frame rate:", e);
    }
}

// Periodically check board state
setInterval(function() {
    if (!isValidBoard()) {
        console.log("Periodic check found invalid board, restoring");
        restoreBoardFromBackup();
    } else {
        // Board is valid, create a backup
        backupBoardState();
    }
}, 10000); // Check every 10 seconds

console.log("Backgammon fixes and protections installed successfully");
