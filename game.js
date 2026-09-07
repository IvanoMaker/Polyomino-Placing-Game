const BOARD_SIZE = 20;

const STARTING_CORNERS = {
    "RED":    [BOARD_SIZE - 1, 0],
    "GREEN":  [BOARD_SIZE - 1, BOARD_SIZE - 1],
    "YELLOW": [0, BOARD_SIZE - 1],
    "BLUE":   [0, 0]
};

const COLORS = [["RED", 1], ["GREEN", 2], ["YELLOW", 3], ["BLUE", 4]];

const PIECES = {
    "i1": [[1]],
    "i2": [[1, 1]],
    "i3": [[1, 1, 1]],
    "i4": [[1, 1, 1, 1]],
    "i5": [[1, 1, 1, 1, 1]],
    "z4": [[1, 1, 0], [0, 1, 1]],
    "t4": [[1, 1, 1], [0, 1, 0]],
    "l4": [[1, 1, 1], [0, 0, 1]],
    "sq": [[1, 1], [1, 1]],
    "f" : [[0, 1, 1], [1, 1, 0], [0, 1, 0]],
    "p" : [[1, 1, 0], [1, 1, 0], [1, 0, 0]],
    "w" : [[1, 0, 0], [1, 1, 0], [0, 1, 1]],
    "t5": [[1, 1, 1], [0, 1, 0], [0, 1, 0]],
    "x" : [[0, 1, 0], [1, 1, 1], [0, 1, 0]],
    "z5": [[1, 1, 0], [0, 1, 0], [0, 1, 1]],
    "v5": [[1, 0, 0], [1, 0, 0], [1, 1, 1]],
    "u" : [[1, 0, 1], [1, 1, 1]],
    "v3": [[1, 0], [1, 1]],
    "n" : [[1, 1, 1, 0], [0, 0, 1, 1]],
    "y" : [[1, 1, 1, 1], [0, 1, 0, 0]],
    "l5": [[1, 1, 1, 1], [0, 0, 0, 1]]
}

function pieceFlippedX(piece) {
    return piece.map(row => [...row].reverse());
}

function pieceRotatedClockwise(piece) {
    return piece[0].map((_, colIndex) => piece.map(row => row[colIndex]).reverse());
}

function getPieceOrientations(piece) {
    const orientations = []; 
    for (let flipped of [false, true]) {
        let p = flipped ? pieceFlippedX(piece) : piece;
        for (let i = 0; i < 4; i++) {
            orientations.push(p);
            p = pieceRotatedClockwise(p);
        }
    }

    const seen = new Set();
    const unique = [];
    for (let o of orientations) {
        const key = JSON.stringify(o);
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(o);
        }
    }
    return unique;
}

const PIECE_ORIENTATIONS = {};
for (let [name, piece] of Object.entries(PIECES)) {
    PIECE_ORIENTATIONS[name] = getPieceOrientations(piece);
}

class Board {
    constructor() {
        this.grid = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(0));
    }

    placePiece(piece, position, color) {
        const [x, y] = position;
        for (let i = 0; i < piece.length; i++) {
            for (let j = 0; j < piece[i].length; j++) {
                if (piece[i][j] === 1) {
                    this.grid[y + i][x + j] = color;
                }
            }
        }
    }

    getCornerConnectionSquares(color) {
        const connections = new Set();
        for (let y = 0; y < BOARD_SIZE; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                if (this.grid[y][x] === color) {
                    for (let dy of [-1, 1]) {
                        for (let dx of [-1, 1]) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
                                if (this.grid[ny][nx] === 0) {
                                    connections.add(`${nx},${ny}`);
                                }
                            }
                        }
                    }
                }
            }
        }
        return connections;
    }

    isValidPosition(piece, position, color, isFirstMove=false, requiredCorner=null) {
        const [x, y] = position;
        let coversRequiredCorner = requiredCorner === null;
        let touchesCorner = false;

        const cornerConnections = (isFirstMove) ? null : this.getCornerConnectionSquares(color);

        for (let i = 0; i < piece.length; i++) {
            for (let j = 0; j < piece[i].length; j++) {
                if (piece[i][j] === 1) {
                    const boardX = x + j;
                    const boardY = y + i;

                    if (boardX < 0 || boardX >= BOARD_SIZE || boardY < 0 || boardY >= BOARD_SIZE) {
                        return false;
                    }
                    if (this.grid[boardY][boardX] !== 0) {
                        return false;
                    }

                    if (isFirstMove) {
                        if (boardX === requiredCorner[0] && boardY === requiredCorner[1]) {
                            coversRequiredCorner = true;
                        }
                    } else {
                        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                            const nx = boardX + dx;
                            const ny = boardY + dy;
                            if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
                                if (this.grid[ny][nx] === color) {
                                    return false;
                                }
                            }
                        }
                        if (cornerConnections.has(`${boardX},${boardY}`)) {
                            touchesCorner = true;
                        }
                    }
                }
            }
        }
        if (isFirstMove && !coversRequiredCorner) {
            return false;
        }
        if (!isFirstMove && !touchesCorner) {
            return false;
        }
        return true;
    }

    playerCanMove(player, isFirstMove=false) {
    const playersColor = player.color;
    const playersColorPieces = player.getPieces();

    for (let pieceName of playersColorPieces) {
        const orientations = PIECE_ORIENTATIONS[pieceName];
        for (let orientation of orientations) {
            for (let y = 0; y < BOARD_SIZE; y++) {
                for (let x = 0; x < BOARD_SIZE; x++) {
                    const requiredCorner = isFirstMove ? player.startingCorner : null;
                    if (this.isValidPosition(orientation, [x, y], playersColor, isFirstMove, requiredCorner)) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}
}

class Player {
    constructor(color) {
        const [name, id] = color;
        this.colorName = name;
        this.color = id;
        this.pieces = Object.keys(PIECES);
        this.startingCorner = STARTING_CORNERS[name];
        this.canPlay = true;
    }

    hasPiece(pieceName) {
        return this.pieces.includes(pieceName);
    }

    getPieces() {
        return this.pieces;
    }

    checkCanPlay(board, isFirstMove=false) {
        this.canPlay = board.playerCanMove(this, isFirstMove);
        return this.canPlay;
    }

    placePiece(board, pieceName, orientationIndex, position, isFirstMove=false) {
        if (!this.hasPiece(pieceName)) {
            return false;
        }
        const orientations = PIECE_ORIENTATIONS[pieceName];
        if (orientationIndex >= orientations.length) {
            return false;
        }
        const piece = orientations[orientationIndex];
        if (board.isValidPosition(piece, position, this.color, isFirstMove, this.startingCorner)) {
            board.placePiece(piece, position, this.color);
            this.pieces = this.pieces.filter(p => p !== pieceName);
            return true;
        }
        return false;
    }
}

class GameState {
    constructor() {
        this.board = new Board();
        this.players = COLORS.map(c => new Player(c));
        this.currentPlayerIndex = 0;
    }

    get currentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    activePlayers() {
        let count = 0;
        for (const player of this.players) {
            if (player.canPlay) {
                count++;
            }
        }
        return count;
    }

    clone() {
        const newState = Object.create(GameState.prototype);

        newState.board = Object.create(Board.prototype);
        newState.board.grid = this.board.grid.map(row => [...row]);

        newState.players = this.players.map(p => {
            const newP = Object.create(Player.prototype);
            newP.colorName = p.colorName;
            newP.color = p.color;
            newP.pieces = [...p.pieces];
            newP.startingCorner = p.startingCorner;
            newP.canPlay = p.canPlay;
            return newP;
        });

        newState.currentPlayerIndex = this.currentPlayerIndex;
        return newState;
    }

    isFirstMoveFor(player) {
        return player.pieces.length === Object.keys(PIECES).length;
    }

    legalMoves(player) {
        const moves = [];
        const isFirstMove = this.isFirstMoveFor(player);
        for (const pieceName of player.pieces) {
            const orientations = PIECE_ORIENTATIONS[pieceName];
            for (let idx = 0; idx < orientations.length; idx++) {
                const shape = orientations[idx];
                const h = shape.length, w = shape[0].length;
                for (let x = 0; x <= BOARD_SIZE - w; x++) {
                    for (let y = 0; y <= BOARD_SIZE - h; y++) {
                        if (this.board.isValidPosition(
                            shape, [x, y], player.color, isFirstMove, player.startingCorner
                        )) {
                            moves.push([pieceName, idx, [x, y]]);
                        }
                    }
                }
            }
        }
        return moves;
    }

    applyMove(pieceName, orientationIndex, position) {
        const player = this.currentPlayer;
        const shape = PIECE_ORIENTATIONS[pieceName][orientationIndex];
        this.board.placePiece(shape, position, player.color);
        player.pieces = player.pieces.filter(p => p !== pieceName);
        this._advanceTurn();
    }

    passTurn() {
        this.currentPlayer.canPlay = false;
        this._advanceTurn();
    }

    _advanceTurn() {
        for (let i = 0; i < this.players.length; i++) {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            const player = this.currentPlayer;
            const isFirstMove = this.isFirstMoveFor(player);
            if (player.canPlay && player.checkCanPlay(this.board, isFirstMove)) {
                return;
            }
        }
    }

    isGameOver() {
        return !this.players.some(p => p.canPlay);
    }

    scores() {
        const result = {};
        for (const p of this.players) {
            const remainingSquares = p.pieces.reduce(
                (sum, name) => sum + PIECES[name].flat().reduce((a, b) => a + b, 0), 0
            );
            let score = -remainingSquares;
            if (p.pieces.length === 0) score += 15;
            result[p.colorName] = score;
        }
        return result;
    }
}