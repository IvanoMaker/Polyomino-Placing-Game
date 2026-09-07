const COLOR_BG = [0, 0, 0]
const COLOR_GRID_LINE = [20, 20, 20]
const COLOR_EMPTY = [40, 40, 40]

const COLOR_MAP = {
    0: COLOR_EMPTY,
    1: [200, 50, 50],
    2: [50, 160, 70],
    3: [225, 195, 40],
    4: [50, 90, 200]
}

function logMessage(msg) {
    console.log(msg);
}

const HEURISTIC_MAP = ["random", "random", "random", "random"]

function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function N_squareCount(piece) {
    let sum = 0;
    for (const row of piece) {
        for (const cube of row) {
            sum += cube;
        }
    }
    return sum;
}

function legalMovesForPiece(state, player, pieceName) {
    let legalMoves = []
    let isFirstMove = state.isFirstMoveFor(player)
    for (let i = 0; i < PIECE_ORIENTATIONS[pieceName].length; i++) {
        let piece = PIECE_ORIENTATIONS[pieceName][i]
        const [h, w] = [piece.length, piece[0].length]
        for (let y = 0; y <= BOARD_SIZE - h; y++) {
            for (let x = 0; x <= BOARD_SIZE - w; x++) {
                if (state.board.isValidPosition(piece, [x, y], player.color, isFirstMove, player.startingCorner)) {
                    legalMoves.push({ pieceName: pieceName, orientationIndex: i, x: x, y: y })
                }
            }
        }
    }
    return legalMoves
}

function chooseLargestPieceMove(state, player) {
    const piecesBySize = {};
    for (const pieceName of player.pieces) {
        const size = N_squareCount(PIECES[pieceName]);
        if (!piecesBySize[size]) piecesBySize[size] = [];
        piecesBySize[size].push(pieceName);
    }

    const sizesDescending = Object.keys(piecesBySize)
        .map(Number)
        .sort((a, b) => b - a);

    for (const size of sizesDescending) {
        const candidates = shuffleArray(piecesBySize[size]);
        for (const pieceName of candidates) {
            const moves = legalMovesForPiece(state, player, pieceName);
            if (moves.length > 0) {
                return randomItem(moves);
            }
        }
    }

    return null; // no legal placement for any remaining piece
}

function processMove(state) {
    const player = state.currentPlayer;
    const moves = state.legalMoves(player);

    if (moves.length === 0) {
        state.passTurn();
        return false;
    }

    const heuristic = HEURISTIC_MAP[player.color - 1] || "random";

    let pieceName, orientationIndex, x, y;

    if (heuristic === "random") {
        const move = randomItem(moves);
        [pieceName, orientationIndex, [x, y]] = move;
    } else if (heuristic === "largest") {
        const move = chooseLargestPieceMove(state, player);
        if (move === null) {
            state.passTurn();
            return false;
        }
        ({ pieceName, orientationIndex, x, y } = move);
    } else {
        throw new Error(`Unknown heuristic: ${heuristic}`);
    }

    const shape = PIECE_ORIENTATIONS[pieceName][orientationIndex];
    state.applyMove(pieceName, orientationIndex, [x, y]);
    logMessage(`${player.colorName} placed ${JSON.stringify(shape)} at [${x}, ${y}]`);
    return true;
}

// Convenience for quick console testing: fills every color's heuristic
// with the same value, rather than mixing them via the UI.
function run(heuristic = "random") {
    for (let i = 0; i < HEURISTIC_MAP.length; i++) HEURISTIC_MAP[i] = heuristic;

    const state = new GameState();
    let turnCount = 0;

    while (!state.isGameOver()) {
        processMove(state);
        turnCount++;
        if (turnCount > 2000) {
            console.log("Hit turn cap, breaking to avoid an infinite loop.");
            break;
        }
    }

    console.log("Game Over");
    console.log(`Total turns: ${turnCount}`);
    console.log(state.scores());
}