// Backgammon Game Implementation
console.log("Loading backgammon.js");

// Game configurations
const BOARD_WIDTH = 800;
const BOARD_HEIGHT = 600;
const POINT_WIDTH = 50;
const POINT_HEIGHT = 240;
const CHECKER_RADIUS = 25;
const BAR_WIDTH = 50;
const BEAR_OFF_WIDTH = 80;

// Game state
let board = [];
let selectedChecker = null;
let validMoves = [];
let combinedMoves = [];
let currentPlayer = 'player1';
let dice = [];
let diceRolled = false;
let gameStatus = "Waiting for opponent...";
let whiteBar = [];
let blackBar = [];
let whiteBearOff = [];
let blackBearOff = [];

// p5.js 

// In backgammon.js or game-board.js, modify the setup function:
function setup() {
    console.log("Setup function called");
    // Create canvas and append to container
    const canvas = createCanvas(BOARD_WIDTH + 2 * BEAR_OFF_WIDTH, BOARD_HEIGHT);
    canvas.parent('canvas-container');
    
    // Always initialize board regardless of player count
    initializeBoard();
    
    // Set up event handler for roll button
    document.getElementById('roll-button').addEventListener('click', rollDice);
    
    // Initialize game state
    gameStarted = true; // Set to true to show the board with checkers
    
    console.log("Backgammon game initialized");
}

// Make sure draw() always draws the board with checkers
function draw() {
    background(240);
    
    // Always draw the board and pieces
    drawBoard();
    drawCheckers();
    drawBar();
    drawBearOffAreas();
    
    // Only show valid moves if it's the current player's turn
    if (selectedChecker && canPlayerMove()) {
        drawValidMoves();
    }
    
    // Draw selected checker being dragged
    if (selectedChecker) {
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
}

// Initialize the game board
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
    
    // Draw bar borders
    noFill();
    stroke(80, 40, 0);
    strokeWeight(3);
    rect(barX - BAR_WIDTH/2, 0, BAR_WIDTH, BOARD_HEIGHT);
    
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
}

function drawBearOffAreas() {
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
}

function drawValidMoves() {
    // Only show valid moves if it's the current player's turn
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
            if (combinedMove.targetIndex === 24 || combinedMove.targetIndex === -1) continue;
            
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
}
// Mouse interaction functions
function mousePressed() {
    // Only allow player to interact if it's their turn
    if (!canPlayerMove()) return;
    
    if (!diceRolled) return;
    if (mouseY > BOARD_HEIGHT) return;
    
    let playerColor = currentPlayer === 'player1' ? 'white' : 'black';
    
    // Check if player has checkers on the bar
    if ((playerColor === 'white' && whiteBar.length > 0) || 
        (playerColor === 'black' && blackBar.length > 0)) {
        
        let barX = BOARD_WIDTH / 2 + BEAR_OFF_WIDTH;
        let barY = playerColor === 'white' ? BOARD_HEIGHT / 4 : BOARD_HEIGHT * 3/4;
        
        if (dist(mouseX, mouseY, barX, barY) < CHECKER_RADIUS * 2) {
            selectedChecker = { pointIndex: -1, checkerIndex: 0 };
            calculateValidMoves(-1, dice);
            return;
        }
        
        return;  // Must move from bar
    }
    
    // Check if a checker was clicked
    for (let i = 0; i < board.length; i++) {
        let point = board[i];
        let pointX = getPointX(i);
        
        for (let j = 0; j < point.length; j++) {
            let checker = point[j];
            if (checker.color === playerColor) {
                let checkerY = getCheckerY(i, j);
                
                if (dist(mouseX, mouseY, pointX, checkerY) < CHECKER_RADIUS) {
                    selectedChecker = { pointIndex: i, checkerIndex: j };
                    calculateValidMoves(i, dice);
                    return;
                }
            }
        }
    }
}

function mouseReleased() {
    if (!canPlayerMove()) {
        selectedChecker = null;
        validMoves = [];
        combinedMoves = [];
        return;
    }
    
    if (!selectedChecker) return;
    
    // Check for win condition
    if (whiteBearOff.length === 15 || blackBearOff.length === 15) {
        selectedChecker = null;
        validMoves = [];
        combinedMoves = [];
        return;
    }
    
    let moved = false;
    let playerColor = currentPlayer === 'player1' ? 'white' : 'black';
    
    // Check valid moves (including combined moves)
    let allPossibleMoves = [...validMoves, ...combinedMoves.map(cm => cm.targetIndex)];
    
    for (let i = 0; i < allPossibleMoves.length; i++) {
        const pointIndex = allPossibleMoves[i];
        const isCombinedMove = i >= validMoves.length;
        
        // Handle bearing off
        if ((playerColor === 'white' && pointIndex === 24) || 
            (playerColor === 'black' && pointIndex === -1)) {
            
            let checker;
            
            if (selectedChecker.pointIndex === -1) {
                checker = playerColor === 'white' ? whiteBar.pop() : blackBar.pop();
            } else {
                checker = board[selectedChecker.pointIndex].splice(selectedChecker.checkerIndex, 1)[0];
            }
            
            if (playerColor === 'white') {
                whiteBearOff.push(checker);
                if (whiteBearOff.length === 15) {
                    gameStatus = "White wins the game!";
                    dice = [];
                    diceRolled = false;
                    selectedChecker = null;
                    validMoves = [];
                    combinedMoves = [];
                    moved = true;
                    break;
                } else {
                    gameStatus = 'White checker borne off!';
                }
            } else {
                blackBearOff.push(checker);
                if (blackBearOff.length === 15) {
                    gameStatus = "Black wins the game!";
                    dice = [];
                    diceRolled = false;
                    selectedChecker = null;
                    validMoves = [];
                    combinedMoves = [];
                    moved = true;
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
            } else {
                // Calculate which die was used
                let die;
                if (playerColor === 'white') {
                    if (selectedChecker.pointIndex === -1) {
                        // From bar
                        if (dice.length > 0) {
                            dice.splice(0, 1);
                        }
                    } else {
                        die = 24 - selectedChecker.pointIndex;
                        
                        // Find and remove the die that was used or the closest larger one
                        let dieIndex = dice.indexOf(die);
                        if (dieIndex !== -1) {
                            dice.splice(dieIndex, 1);
                        } else {
                            // Find smallest die larger than needed
                            let smallestLargerDie = 100;
                            let smallestLargerDieIndex = -1;
                            
                            for (let i = 0; i < dice.length; i++) {
                                if (dice[i] > die && dice[i] < smallestLargerDie) {
                                    smallestLargerDie = dice[i];
                                    smallestLargerDieIndex = i;
                                }
                            }
                            
                            if (smallestLargerDieIndex !== -1) {
                                dice.splice(smallestLargerDieIndex, 1);
                            } else if (dice.length > 0) {
                                dice.splice(0, 1);
                            }
                        }
                    }
                } else {
                    // Black player
                    if (selectedChecker.pointIndex === -1) {
                        // From bar
                        if (dice.length > 0) {
                            dice.splice(0, 1);
                        }
                    } else {
                        die = selectedChecker.pointIndex + 1;
                        
                        // Find and remove the die that was used or the closest larger one
                        let dieIndex = dice.indexOf(die);
                        if (dieIndex !== -1) {
                            dice.splice(dieIndex, 1);
                        } else {
                            // Find smallest die larger than needed
                            let smallestLargerDie = 100;
                            let smallestLargerDieIndex = -1;
                            
                            for (let i = 0; i < dice.length; i++) {
                                if (dice[i] > die && dice[i] < smallestLargerDie) {
                                    smallestLargerDie = dice[i];
                                    smallestLargerDieIndex = i;
                                }
                            }
                            
                            if (smallestLargerDieIndex !== -1) {
                                dice.splice(smallestLargerDieIndex, 1);
                            } else if (dice.length > 0) {
                                dice.splice(0, 1);
                            }
                        }
                    }
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
            } else {
                checker = board[selectedChecker.pointIndex].splice(selectedChecker.checkerIndex, 1)[0];
            }
            
            // Check if hitting opponent's checker
            if (board[pointIndex].length === 1 && board[pointIndex][0].color !== checker.color) {
                let hitChecker = board[pointIndex].pop();
                if (hitChecker.color === 'white') {
                    whiteBar.push(hitChecker);
                    gameStatus = "White checker was hit!";
                } else {
                    blackBar.push(hitChecker);
                    gameStatus = "Black checker was hit!";
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
            } else {
                // Calculate which die was used
                let die;
                if (selectedChecker.pointIndex === -1) {
                    die = playerColor === 'white' ? pointIndex + 1 : 24 - pointIndex;
                } else {
                    die = Math.abs(pointIndex - selectedChecker.pointIndex);
                }
                
                // Find and remove the die that was used
                let dieIndex = dice.indexOf(die);
                if (dieIndex !== -1) {
                    dice.splice(dieIndex, 1);
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
    }
    
    // Check for win or end of turn
    if (moved) {
        // Update UI
        updatePlayerInfo();
        
        // Check win condition
        if ((playerColor === 'white' && whiteBearOff.length === 15) ||
            (playerColor === 'black' && blackBearOff.length === 15)) {
            checkWinCondition();
        } else if (dice.length === 0 || !hasLegalMoves()) {
            // Switch player
            switchPlayer();
        }
    }
    
    selectedChecker = null;
    validMoves = [];
    combinedMoves = [];
    
    // Update UI
    updateGameStatus();
    updateDiceDisplay();
}
// Game mechanics functions
function rollDice() {
    if (diceRolled) return;
    if (whiteBearOff.length === 15 || blackBearOff.length === 15) return;
    if (!canPlayerMove()) return;
    
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    
    if (die1 === die2) {
        // For doubles, we get 4 moves
        dice = [die1, die1, die1, die1];
    } else {
        dice = [die1, die2];
    }
    
    diceRolled = true;
    
    // Update the dice display in UI
    updateDiceDisplay();
    
    gameStatus = currentPlayer === 'player1' ? 
        player1Name + " rolled " + die1 + " and " + die2 + "!" :
        player2Name + " rolled " + die1 + " and " + die2 + "!";
    
    updateGameStatus();
    
    // Check if there are legal moves
    if (!hasLegalMoves()) {
        gameStatus = "No legal moves available. Switching players...";
        updateGameStatus();
        
        // Auto switch player after short delay
        setTimeout(() => {
            switchPlayer();
        }, 2000);
    }
}

function switchPlayer() {
    currentPlayer = currentPlayer === 'player1' ? 'player2' : 'player1';
    diceRolled = false;
    gameStatus = currentPlayer === 'player1' ? 
        player1Name + "'s turn" : player2Name + "'s turn";
    
    // Enable/disable roll button based on whose turn it is
    document.getElementById('roll-button').disabled = !canPlayerMove();
    
    // Update UI
    updateGameStatus();
    updatePlayerInfo();
    updateDiceDisplay();
}

function calculateValidMoves(pointIndex, dice) {
    validMoves = [];
    combinedMoves = [];
    
    let playerColor = currentPlayer === 'player1' ? 'white' : 'black';
    let direction = currentPlayer === 'player1' ? 1 : -1;
    
    // Handle moves from the bar
    if ((playerColor === 'white' && whiteBar.length > 0) || 
        (playerColor === 'black' && blackBar.length > 0)) {
        
        if (pointIndex !== -1) {
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
                    }
                }
            }
        }
        return;
    }
    
    // Check if player can bear off
    let canBearOff = canPlayerBearOff(playerColor);
    
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
                        }
                        continue;
                    }
                }
            } else { // Black player
                if (pointIndex <= 5) { // Only allow bearing off from home board
                    if (targetIndex < 0 || (die > pointIndex + 1 && isValidBearOff(pointIndex, die, playerColor))) {
                        if (!validMoves.includes(-1)) {
                            validMoves.push(-1); // Special target index for bearing off
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
            for (let d1 = 0; d1 < uniqueDice.length - 1; d1++) {
                for (let d2 = d1 + 1; d2 < uniqueDice.length; d2++) {
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
                                    }
                                }
                            }
                        }
                    }
                    
                    // Try die2 then die1 (opposite order)
                    intermediateIndex = pointIndex + (die2 * direction);
                    if (intermediateIndex >= 0 && intermediateIndex < 24) {
                        if (board[intermediateIndex].length === 0 ||
                            board[intermediateIndex][0].color === playerColor) {
                            
                            let finalIndex = intermediateIndex + (die1 * direction);
                            
                            // Check if this is a valid move
                            if (finalIndex >= 0 && finalIndex < 24) {
                                if (board[finalIndex].length === 0 ||
                                    board[finalIndex][0].color === playerColor ||
                                    (board[finalIndex].length === 1 && board[finalIndex][0].color !== playerColor)) {
                                    let alreadyAdded = combinedMoves.some(move => move.targetIndex === finalIndex);
                                    if (!alreadyAdded) {
                                        combinedMoves.push({
                                            targetIndex: finalIndex,
                                            die1: die2,
                                            die2: die1
                                        });
                                    }
                                }
                            } else if (canBearOff && 
                                    ((playerColor === 'white' && finalIndex >= 24) || 
                                    (playerColor === 'black' && finalIndex < 0))) {
                                // Valid bearing off with combined dice
                                if (isValidBearOff(intermediateIndex, die1, playerColor)) {
                                    let bearOffTarget = playerColor === 'white' ? 24 : -1;
                                    let alreadyAdded = combinedMoves.some(move => move.targetIndex === bearOffTarget);
                                    if (!alreadyAdded) {
                                        combinedMoves.push({
                                            targetIndex: bearOffTarget,
                                            die1: die2,
                                            die2: die1
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
function isValidBearOff(pointIndex, die, playerColor) {
    // For white players (home board is 18-23)
    if (playerColor === 'white') {
        // Case 1: Exact roll (e.g., position 20 with die 4 = 24)
        if (pointIndex + die === 24) {
            return true;
        }
        
        // Case 2: Roll is higher than needed
        if (die > 24 - pointIndex) {
            // Verify this is the highest piece
            for (let i = 23; i > pointIndex; i--) {
                if (board[i] && board[i].length > 0 && board[i][0].color === 'white') {
                    // Not the highest piece, can't use larger die
                    return false;
                }
            }
            return true; // This is the highest piece, can use larger die
        }
        return false;
    } 
    // For black players (home board is 0-5)
    else {
        // Case 1: Exact roll (e.g., position 3 with die 4 = -1)
        if (pointIndex - die === -1) {
            return true;
        }
        
        // Case 2: Roll is higher than needed
        if (die > pointIndex + 1) {
            // Verify this is the highest piece
            for (let i = 0; i < pointIndex; i++) {
                if (board[i] && board[i].length > 0 && board[i][0].color === 'black') {
                    // Not the highest piece, can't use larger die
                    return false;
                }
            }
            return true; // This is the highest piece, can use larger die
        }
        return false;
    }
}

function canPlayerBearOff(playerColor) {
    let checkersOutside = 0;
    
    if (playerColor === 'white') {
        // White checkers must all be in home board (points 18-23)
        for (let i = 0; i < 18; i++) {
            for (let j = 0; j < board[i].length; j++) {
                if (board[i][j].color === 'white') {
                    checkersOutside++;
                }
            }
        }
        checkersOutside += whiteBar.length;
    } else {
        // Black checkers must all be in home board (points 0-5)
        for (let i = 6; i < 24; i++) {
            for (let j = 0; j < board[i].length; j++) {
                if (board[i][j].color === 'black') {
                    checkersOutside++;
                }
            }
        }
        checkersOutside += blackBar.length;
    }
    
    return checkersOutside === 0;
}

function hasLegalMoves() {
    let playerColor = currentPlayer === 'player1' ? 'white' : 'black';
    
    // Check if player has checkers on the bar
    if ((playerColor === 'white' && whiteBar.length > 0) || 
        (playerColor === 'black' && blackBar.length > 0)) {
        
        for (let i = 0; i < dice.length; i++) {
            let die = dice[i];
            let entryPoint = playerColor === 'white' ? die - 1 : 24 - die;
            
            if (entryPoint >= 0 && entryPoint < 24) {
                if (board[entryPoint].length === 0 || 
                    board[entryPoint][0].color === playerColor ||
                    (board[entryPoint].length === 1 && board[entryPoint][0].color !== playerColor)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // Check for bearing off
    let canBearOff = canPlayerBearOff(playerColor);
    if (canBearOff) {
        if (playerColor === 'white') {
            for (let i = 18; i <= 23; i++) {
                for (let j = 0; j < board[i].length; j++) {
                    if (board[i][j].color === 'white') {
                        for (let k = 0; k < dice.length; k++) {
                            let die = dice[k];
                            if (isValidBearOff(i, die, playerColor)) {
                                return true;
                            }
                        }
                    }
                }
            }
        } else {
            for (let i = 0; i <= 5; i++) {
                for (let j = 0; j < board[i].length; j++) {
                    if (board[i][j].color === 'black') {
                        for (let k = 0; k < dice.length; k++) {
                            let die = dice[k];
                            if (isValidBearOff(i, die, playerColor)) {
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
        for (let j = 0; j < board[i].length; j++) {
            if (board[i][j].color === playerColor) {
                for (let k = 0; k < dice.length; k++) {
                    let die = dice[k];
                    let direction = playerColor === 'white' ? 1 : -1;
                    let targetIndex = i + (die * direction);
                    
                    if (targetIndex >= 0 && targetIndex < 24) {
                        if (board[targetIndex].length === 0 || 
                            board[targetIndex][0].color === playerColor ||
                            (board[targetIndex].length === 1 && board[targetIndex][0].color !== playerColor)) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    
    return false;
}

function checkWinCondition() {
    if (whiteBearOff.length === 15) {
        gameStatus = player1Name + " (White) wins the game!";
        diceRolled = false;
        dice = [];
        selectedChecker = null;
        validMoves = [];
        combinedMoves = [];
        updateGameStatus();
        return true;
    } 
    else if (blackBearOff.length === 15) {
        gameStatus = player2Name + " (Black) wins the game!";
        diceRolled = false;
        dice = [];
        selectedChecker = null;
        validMoves = [];
        combinedMoves = [];
        updateGameStatus();
        return true;
    }
    return false;
}

// Helper functions
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
// UI update functions
function updateDiceDisplay() {
    // Update dice UI
    const dice1El = document.getElementById('dice1');
    const dice2El = document.getElementById('dice2');
    
    if (!dice1El || !dice2El) return;
    
    if (dice.length >= 1) {
        dice1El.innerText = dice[0];
    } else {
        dice1El.innerText = '-';
    }
    
    if (dice.length >= 2) {
        dice2El.innerText = dice[1];
    } else {
        dice2El.innerText = '-';
    }
    
    // Disable roll button if dice are already rolled
    const rollButton = document.getElementById('roll-button');
    if (rollButton) {
        rollButton.disabled = diceRolled || !canPlayerMove();
    }
}

function updatePlayerInfo() {
    // Update bar and off counts
    const player1Bar = document.getElementById('player1-bar');
    const player1Off = document.getElementById('player1-off');
    const player2Bar = document.getElementById('player2-bar');
    const player2Off = document.getElementById('player2-off');
    
    if (player1Bar) player1Bar.innerText = whiteBar.length;
    if (player1Off) player1Off.innerText = whiteBearOff.length;
    if (player2Bar) player2Bar.innerText = blackBar.length;
    if (player2Off) player2Off.innerText = blackBearOff.length;
    
    // Highlight active player
    const player1Card = document.getElementById('player1-card');
    const player2Card = document.getElementById('player2-card');
    
    if (player1Card && player2Card) {
        if (currentPlayer === 'player1') {
            player1Card.classList.add('active');
            player2Card.classList.remove('active');
        } else {
            player1Card.classList.remove('active');
            player2Card.classList.add('active');
        }
    }
}

function updateGameStatus() {
    const gameStatusEl = document.getElementById('game-status');
    if (!gameStatusEl) return;
    
    gameStatusEl.innerText = gameStatus;
    
    // Special styling for win messages
    if (gameStatus.includes("wins")) {
        gameStatusEl.style.color = '#ff6600';
        gameStatusEl.style.fontWeight = 'bold';
    } else {
        gameStatusEl.style.color = '';
        gameStatusEl.style.fontWeight = '';
    }
}

// Check if current player can move
function canPlayerMove() {
    if (playerRole === "spectator") return false;
    if (playerRole === "player1" && currentPlayer === "player1") return true;
    if (playerRole === "player2" && currentPlayer === "player2") return true;
    return false;
}

// URL parameter handling
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        gameId: params.get('gameId'),
        playerNum: params.get('playerNum'),
        playerName: params.get('playerName')
    };
}

// Initialize from URL parameters
function initializeFromUrl() {
    const params = getUrlParams();
    
    if (params.gameId) {
        gameId = params.gameId;
        
        // Handle player joining from URL
        if (params.playerNum && params.playerName) {
            const playerNum = parseInt(params.playerNum);
            const playerName = decodeURIComponent(params.playerName);
            
            if (playerNum === 1) {
                // Player 1 is joining
                player1Name = playerName;
                playerRole = "player1";
                
                // Update player1 card
                const player1NameEl = document.getElementById('player1-name');
                if (player1NameEl) {
                    player1NameEl.innerText = playerName + " (White)";
                }
            } 
            else if (playerNum === 2) {
                // Player 2 is joining
                player2Name = playerName;
                playerRole = "player2";
                
                // Update player2 card
                const player2NameEl = document.getElementById('player2-name');
                if (player2NameEl) {
                    player2NameEl.innerText = playerName + " (Black)";
                }
                
                // Start game
                gameStarted = true;
            }
        }
    }
}

// Add this initialization code to be executed when the script loads
initializeFromUrl();
console.log("Backgammon game fully loaded");
