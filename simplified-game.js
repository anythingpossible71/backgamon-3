// simplified-game.js - Version 10.1.0
// Simplified local two-player backgammon game logic

// Game state variables
let board = Array(24).fill().map(() => []);
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

// Constants
const ROLL_COOLDOWN = 1000; // 1 second between rolls
let lastRollTime = 0;

// Core game functions
function rollDice() {
    const now = Date.now();
    if (now - lastRollTime < ROLL_COOLDOWN || diceRolled) {
        return;
    }
    lastRollTime = now;

    dice = [
        { value: Math.floor(Math.random() * 6) + 1, used: false },
        { value: Math.floor(Math.random() * 6) + 1, used: false }
    ];

    if (dice[0].value === dice[1].value) {
        dice = Array(4).fill().map(() => ({ value: dice[0].value, used: false }));
    }

    diceRolled = true;
    gameStatus = `${currentPlayer === 'player1' ? 'Player 1' : 'Player 2'} rolled ${dice.map(d => d.value).join(', ')}`;
    updateUI();
}

function switchPlayer() {
    dice = [];
    diceRolled = false;
    currentPlayer = currentPlayer === 'player1' ? 'player2' : 'player1';
    gameStatus = `${currentPlayer === 'player1' ? 'Player 1' : 'Player 2'}'s turn to roll`;
    updateUI();
}

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

    // Calculate moves for each unused die
    dice.forEach((die, i) => {
        if (die.used) return;

        const targetIndex = pointIndex + (die.value * direction);

        // Check if can bear off
        if (canBearOff(playerColor)) {
            if (playerColor === 'white' && pointIndex >= 18) {
                if (targetIndex >= 24) {
                    moves.push(24);
                    return;
                }
            } else if (playerColor === 'black' && pointIndex <= 5) {
                if (targetIndex < 0) {
                    moves.push(-1);
                    return;
                }
            }
        }

        // Regular move
        if (targetIndex >= 0 && targetIndex < 24) {
            const targetPoint = board[targetIndex];
            if (canMoveToPoint(targetPoint, playerColor)) {
                moves.push(targetIndex);
            }
        }
    });

    return moves;
}

function canMoveToPoint(point, playerColor) {
    return !point.length || 
           point[0].color === playerColor || 
           point.length === 1;
}

function canBearOff(playerColor) {
    const checkRange = playerColor === 'white' ? 
        Array.from({length: 18}, (_, i) => i) : 
        Array.from({length: 18}, (_, i) => i + 6);

    return !checkRange.some(i => 
        board[i].some(checker => checker.color === playerColor)
    );
}

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
    if (toPoint === 24 || toPoint === -1) {
        (playerColor === 'white' ? whiteBearOff : blackBearOff).push(checker);
    } else {
        // Handle hitting opponent's checker
        if (board[toPoint].length === 1 && board[toPoint][0].color !== playerColor) {
            const hitChecker = board[toPoint].pop();
            (hitChecker.color === 'white' ? whiteBar : blackBar).push(hitChecker);
        }
        board[toPoint].push(checker);
    }

    // Mark appropriate die as used
    const moveDistance = Math.abs(toPoint - fromPoint);
    const dieIndex = dice.findIndex(die => !die.used && die.value === moveDistance);
    if (dieIndex !== -1) dice[dieIndex].used = true;

    // Check for win
    if (whiteBearOff.length === 15 || blackBearOff.length === 15) {
        gameStatus = `${currentPlayer === 'player1' ? 'Player 1' : 'Player 2'} wins!`;
    }

    // Switch player if all dice used
    if (dice.every(die => die.used)) {
        setTimeout(switchPlayer, 500);
    }

    updateUI();
    return true;
}

// Mouse interaction handlers
function mousePressed(x, y) {
    if (!diceRolled || !canPlayerMove()) return;

    const playerColor = currentPlayer === 'player1' ? 'white' : 'black';
    
    // Check bar first
    if ((playerColor === 'white' && whiteBar.length > 0) ||
        (playerColor === 'black' && blackBar.length > 0)) {
        selectedChecker = { pointIndex: -1, checkerIndex: 0 };
        validMoves = calculateValidMoves(-1);
        return;
    }

    // Check board points
    for (let i = 0; i < 24; i++) {
        const point = board[i];
        if (!point.length) continue;

        if (point[0].color === playerColor) {
            // Use your existing point/checker position calculation logic here
            // If clicked on a checker:
            selectedChecker = { pointIndex: i, checkerIndex: point.length - 1 };
            validMoves = calculateValidMoves(i);
            break;
        }
    }
}

function mouseReleased(x, y) {
    if (!selectedChecker) return;

    // Check if mouse is over any valid move position
    // Use your existing position calculation logic here
    for (const targetPoint of validMoves) {
        // If mouse is over this point:
        if (isMouseOverPoint(x, y, targetPoint)) {
            executeMove(selectedChecker.pointIndex, targetPoint);
            break;
        }
    }

    selectedChecker = null;
    validMoves = [];
}

// Helper functions
function canPlayerMove() {
    return true; // In local mode, current player can always move
}

function isMouseOverPoint(x, y, pointIndex) {
    // Implement your point hit testing logic here
    // Return true if the mouse coordinates are over the given point
    return false; // Placeholder
}

function updateUI() {
    // Implement your UI update logic here
    // This should update the display of:
    // - Board state
    // - Dice
    // - Game status
    // - Player information
}

// Export functions to window object
window.rollDice = rollDice;
window.switchPlayer = switchPlayer;
window.mousePressed = mousePressed;
window.mouseReleased = mouseReleased;
window.calculateValidMoves = calculateValidMoves;
window.executeMove = executeMove; 