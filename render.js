const CELL_SIZE = 26;
const BOARD_MARGIN = 20;
const BOARD_PIXEL = BOARD_SIZE * CELL_SIZE;
const MOVE_DELAY_MS = 120; // pause between bot moves so placements are visible

const HEURISTIC_COLORS = ["RED", "GREEN", "YELLOW", "BLUE"];
const NAME_TO_COLOR_ID = { RED: 1, GREEN: 2, YELLOW: 3, BLUE: 4 };
const DIFFICULTY_TO_HEURISTIC = { easy: "random", hard: "largest" };

let canvas, ctx, state, running = false;

// Human-play state
let HUMAN_COLOR = 1;      // color id (1-4) the person is playing as
let DIFFICULTY = "easy";  // "easy" -> random bot moves, "hard" -> largest-piece bot moves
let awaitingHumanInput = false;
let selectedPieceName = null;
let currentShape = null;  // the piece grid (possibly rotated/flipped) currently selected
let hoverCell = null;     // {x, y} board cell the mouse is currently over

function rgbToCss([r, g, b]) {
    return `rgb(${r}, ${g}, ${b})`;
}

function initCanvas() {
    canvas = document.querySelector('#canvas canvas');
    canvas.width = BOARD_PIXEL + BOARD_MARGIN * 2;
    canvas.height = BOARD_PIXEL + BOARD_MARGIN * 2;
    ctx = canvas.getContext('2d');
}

function drawBoard(board) {
    ctx.fillStyle = rgbToCss(COLOR_BG);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
            const cellValue = board.grid[y][x];
            const color = COLOR_MAP[cellValue] || COLOR_EMPTY;
            const px = BOARD_MARGIN + x * CELL_SIZE;
            const py = BOARD_MARGIN + y * CELL_SIZE;

            ctx.fillStyle = rgbToCss(color);
            ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

            ctx.strokeStyle = rgbToCss(COLOR_GRID_LINE);
            ctx.strokeRect(px, py, CELL_SIZE, CELL_SIZE);
        }
    }
}

// Draws a translucent preview of the currently selected piece at hoverCell,
// green if the placement would be legal, red otherwise.
function drawHoverPreview() {
    if (!awaitingHumanInput || !selectedPieceName || !hoverCell || !state) return;

    const player = state.currentPlayer;
    if (player.color !== HUMAN_COLOR) return;

    const isFirstMove = state.isFirstMoveFor(player);
    const valid = state.board.isValidPosition(
        currentShape, [hoverCell.x, hoverCell.y], HUMAN_COLOR, isFirstMove, player.startingCorner
    );

    ctx.globalAlpha = 0.55;
    ctx.fillStyle = valid ? 'rgb(80, 220, 100)' : 'rgb(220, 70, 70)';
    for (let i = 0; i < currentShape.length; i++) {
        for (let j = 0; j < currentShape[i].length; j++) {
            if (currentShape[i][j] !== 1) continue;
            const bx = hoverCell.x + j;
            const by = hoverCell.y + i;
            if (bx < 0 || bx >= BOARD_SIZE || by < 0 || by >= BOARD_SIZE) continue;
            const px = BOARD_MARGIN + bx * CELL_SIZE;
            const py = BOARD_MARGIN + by * CELL_SIZE;
            ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
        }
    }
    ctx.globalAlpha = 1;
}

function render() {
    if (!state) return;
    drawBoard(state.board);
    drawHoverPreview();
}

function logMessage(msg) {
    const logBox = document.querySelector('#log');
    if (!logBox) {
        console.log(msg);
        return;
    }
    const wasAtBottom = logBox.scrollHeight - logBox.scrollTop - logBox.clientHeight < 10;

    const line = document.createElement('div');
    line.textContent = msg;
    logBox.appendChild(line);

    if (wasAtBottom) {
        logBox.scrollTop = logBox.scrollHeight;
    }
}

function setStatus(msg) {
    const el = document.querySelector('#status-text');
    if (el) el.textContent = msg;
}

function readSetupSettings() {
    const humanChecked = document.querySelector('input[name="human-color"]:checked');
    const humanName = humanChecked ? humanChecked.value : "RED";
    HUMAN_COLOR = NAME_TO_COLOR_ID[humanName];

    const difficultyChecked = document.querySelector('input[name="difficulty"]:checked');
    DIFFICULTY = difficultyChecked ? difficultyChecked.value : "easy";

    const botHeuristic = DIFFICULTY_TO_HEURISTIC[DIFFICULTY] || "random";
    HEURISTIC_COLORS.forEach((colorName, idx) => {
        HEURISTIC_MAP[idx] = botHeuristic;
    });
}

function setSetupInputsDisabled(disabled) {
    document.querySelectorAll('#setup-settings input[type="radio"]').forEach(el => {
        el.disabled = disabled;
    });
}

// piece tray

function drawPieceIcon(iconCanvas, shape, colorId, cellPx) {
    const iconCtx = iconCanvas.getContext('2d');
    const rows = shape.length, cols = shape[0].length;
    const offX = (iconCanvas.width - cols * cellPx) / 2;
    const offY = (iconCanvas.height - rows * cellPx) / 2;

    iconCtx.clearRect(0, 0, iconCanvas.width, iconCanvas.height);
    const color = COLOR_MAP[colorId] || COLOR_EMPTY;
    iconCtx.fillStyle = rgbToCss(color);
    iconCtx.strokeStyle = '#000';
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (shape[i][j] !== 1) continue;
            const px = offX + j * cellPx;
            const py = offY + i * cellPx;
            iconCtx.fillRect(px, py, cellPx, cellPx);
            iconCtx.strokeRect(px, py, cellPx, cellPx);
        }
    }
}

function renderPreviewCanvas() {
    const previewCanvas = document.querySelector('#preview-canvas');
    if (!previewCanvas) return;
    const previewCtx = previewCanvas.getContext('2d');
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    if (selectedPieceName && currentShape) {
        drawPieceIcon(previewCanvas, currentShape, HUMAN_COLOR, 16);
    }
}

function renderPieceTray(player) {
    const list = document.querySelector('#piece-list');
    if (!list) return;
    list.innerHTML = '';

    for (const pieceName of player.getPieces()) {
        const iconCanvas = document.createElement('canvas');
        iconCanvas.width = 64;
        iconCanvas.height = 40;
        iconCanvas.className = 'piece-icon';
        if (pieceName === selectedPieceName) iconCanvas.classList.add('selected');
        drawPieceIcon(iconCanvas, PIECES[pieceName], player.color, 10);
        iconCanvas.addEventListener('click', () => selectPiece(pieceName));
        list.appendChild(iconCanvas);
    }

    document.querySelectorAll('.piece-icon').forEach(el => {
        el.classList.toggle('disabled', !awaitingHumanInput);
    });
}

function setTrayButtonsEnabled(enabled) {
    const rotateBtn = document.querySelector('#rotateButton');
    const flipBtn = document.querySelector('#flipButton');
    if (rotateBtn) rotateBtn.disabled = !enabled || !selectedPieceName;
    if (flipBtn) flipBtn.disabled = !enabled || !selectedPieceName;
}

function selectPiece(pieceName) {
    if (!awaitingHumanInput) return;
    selectedPieceName = pieceName;
    currentShape = PIECES[pieceName];
    setStatus(`Selected ${pieceName.toUpperCase()} — rotate/flip if needed, then click the board to place it.`);
    renderPieceTray(state.currentPlayer);
    renderPreviewCanvas();
    setTrayButtonsEnabled(true);
    render();
}

function rotateSelected() {
    if (!awaitingHumanInput || !selectedPieceName) return;
    currentShape = pieceRotatedClockwise(currentShape);
    renderPreviewCanvas();
    render();
}

function flipSelected() {
    if (!awaitingHumanInput || !selectedPieceName) return;
    currentShape = pieceFlippedX(currentShape);
    renderPreviewCanvas();
    render();
}

function clearPieceTray() {
    const list = document.querySelector('#piece-list');
    if (list) list.innerHTML = '';
    renderPreviewCanvas();
    setTrayButtonsEnabled(false);
    const passBtn = document.querySelector('#passButton');
    if (passBtn) passBtn.disabled = true;
}

function clearSelection() {
    selectedPieceName = null;
    currentShape = null;
    hoverCell = null;
    setTrayButtonsEnabled(false);
}

// board stuff

function canvasToCell(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (evt.clientX - rect.left) * scaleX;
    const py = (evt.clientY - rect.top) * scaleY;
    return {
        x: Math.floor((px - BOARD_MARGIN) / CELL_SIZE),
        y: Math.floor((py - BOARD_MARGIN) / CELL_SIZE)
    };
}

function onCanvasMouseMove(evt) {
    if (!awaitingHumanInput || !selectedPieceName) return;
    hoverCell = canvasToCell(evt);
    render();
}

function onCanvasMouseLeave() {
    if (!awaitingHumanInput) return;
    hoverCell = null;
    render();
}

function onCanvasClick(evt) {
    if (!awaitingHumanInput) return;
    if (!selectedPieceName) {
        setStatus('Pick a piece from the tray first.');
        return;
    }
    const { x, y } = canvasToCell(evt);
    attemptPlaceHuman(x, y);
}

function attemptPlaceHuman(x, y) {
    const player = state.currentPlayer;
    if (player.color !== HUMAN_COLOR) return;

    const isFirstMove = state.isFirstMoveFor(player);
    const valid = state.board.isValidPosition(
        currentShape, [x, y], HUMAN_COLOR, isFirstMove, player.startingCorner
    );

    if (!valid) {
        setStatus("Can't place it there — try another spot or rotate/flip the piece.");
        return;
    }

    const orientations = PIECE_ORIENTATIONS[selectedPieceName];
    const shapeKey = JSON.stringify(currentShape);
    const orientationIndex = orientations.findIndex(o => JSON.stringify(o) === shapeKey);

    state.applyMove(selectedPieceName, orientationIndex, [x, y]);
    logMessage(`${player.colorName} (you) placed ${selectedPieceName} at [${x}, ${y}]`);

    clearSelection();
    awaitingHumanInput = false;
    clearPieceTray();
    render();

    setTimeout(turnLoop, MOVE_DELAY_MS);
}

function onPassClick() {
    if (!awaitingHumanInput) return;
    const player = state.currentPlayer;
    if (player.color !== HUMAN_COLOR) return;
    if (state.legalMoves(player).length > 0) return; 

    state.passTurn();
    logMessage(`${player.colorName} (you) passed`);
    clearSelection();
    awaitingHumanInput = false;
    clearPieceTray();
    render();
    setTimeout(turnLoop, MOVE_DELAY_MS);
}

function enterHumanTurn(player) {
    awaitingHumanInput = true;
    clearSelection();
    setStatus(`Your turn (${player.colorName}) — pick a piece, rotate/flip, then click the board.`);
    renderPieceTray(player);
    renderPreviewCanvas();

    const passBtn = document.querySelector('#passButton');
    if (passBtn) passBtn.disabled = state.legalMoves(player).length > 0;

    render();
}

function finishGame() {
    running = false;
    awaitingHumanInput = false;
    setSetupInputsDisabled(false);
    clearPieceTray();

    setStatus('Game over — see the log for final scores.');
    logMessage('Game Over');
    const scores = state.scores();
    for (const [colorName, score] of Object.entries(scores)) {
        logMessage(`  ${colorName}: ${score}`);
    }
}

function turnLoop() {
    if (!running) return;

    if (state.isGameOver()) {
        finishGame();
        return;
    }

    const player = state.currentPlayer;

    if (player.color === HUMAN_COLOR) {
        enterHumanTurn(player);
        return; // wait for the person to act via the tray/board
    }

    awaitingHumanInput = false;
    clearPieceTray();
    setStatus(`${player.colorName} (bot) is thinking...`);

    processMove(state);
    render();
    setTimeout(turnLoop, MOVE_DELAY_MS);
}

function startGame() {
    if (running) return; // ignore repeated clicks mid-game

    readSetupSettings();
    setSetupInputsDisabled(true);

    const logBox = document.querySelector('#log');
    if (logBox) logBox.innerHTML = '';

    logMessage('Match settings:');
    logMessage(`  You: ${HEURISTIC_COLORS[HUMAN_COLOR - 1]}`);
    logMessage(`  Bot difficulty: ${DIFFICULTY}`);

    state = new GameState();
    running = true;
    clearSelection();
    render();
    turnLoop();
}

function resetGame() {
    running = false;
    awaitingHumanInput = false;
    setSetupInputsDisabled(false);
    clearSelection();
    clearPieceTray();

    const logBox = document.querySelector('#log');
    if (logBox) logBox.innerHTML = '';

    setStatus('Choose your color and the bots\' difficulty, then hit Start.');
    state = new GameState();
    render();
}

document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    state = new GameState();
    render();

    document.querySelector('#startButton').addEventListener('click', startGame);
    document.querySelector('#resetButton').addEventListener('click', resetGame);
    document.querySelector('#rotateButton').addEventListener('click', rotateSelected);
    document.querySelector('#flipButton').addEventListener('click', flipSelected);
    document.querySelector('#passButton').addEventListener('click', onPassClick);

    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseleave', onCanvasMouseLeave);
    canvas.addEventListener('click', onCanvasClick);
});
