document.addEventListener('DOMContentLoaded', () => {
    const boardElement = document.getElementById('game-board');
    const playerTurnElement = document.getElementById('player-turn').querySelector('span');
    const blackScoreElement = document.getElementById('black-score');
    const whiteScoreElement = document.getElementById('white-score');
    const resetButton = document.getElementById('reset-button');
    const gameModeSelector = document.querySelectorAll('input[name="game-mode"]');

    const BOARD_SIZE = 8;
    const EMPTY = 0;
    const BLACK = 1;
    const WHITE = 2;

    let board = [];
    let currentPlayer = BLACK;
    let gameMode = 'pvp'; // 'pvp' or 'pvc'

    // 8個方向: 上, 下, 左, 右, 左上, 右上, 左下, 右下
    const directions = [
        { r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 },
        { r: -1, c: -1 }, { r: -1, c: 1 }, { r: 1, c: -1 }, { r: 1, c: 1 }
    ];

    // 位置權重矩陣，用於 AI 策略
    const positionalWeights = [
        [120, -20, 20,  5,  5, 20, -20, 120],
        [-20, -40, -5, -5, -5, -5, -40, -20],
        [ 20,  -5, 15,  3,  3, 15,  -5,  20],
        [  5,  -5,  3,  3,  3,  3,  -5,   5],
        [  5,  -5,  3,  3,  3,  3,  -5,   5],
        [ 20,  -5, 15,  3,  3, 15,  -5,  20],
        [-20, -40, -5, -5, -5, -5, -40, -20],
        [120, -20, 20,  5,  5, 20, -20, 120]
    ];

    function initializeGame() {
        board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(EMPTY));
        // 初始棋子
        board[3][3] = WHITE;
        board[3][4] = BLACK;
        board[4][3] = BLACK;
        board[4][4] = WHITE;
        
        gameMode = document.querySelector('input[name="game-mode"]:checked').value;
        currentPlayer = BLACK;
        renderBoard();
        updateInfo();
    }

    function renderBoard() {
        boardElement.innerHTML = '';
        const isFirstRender = !boardElement.hasChildNodes();

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                if (board[r][c] !== EMPTY) {
                    const disc = document.createElement('div');
                    disc.className = `disc ${board[r][c] === BLACK ? 'black' : 'white'}`;
                    cell.appendChild(disc);
                }
                cell.addEventListener('click', handleCellClick);
                boardElement.appendChild(cell);
            }
        }
    }

    function handleCellClick(event) {
        // 如果是電腦回合，不允許玩家點擊
        if (gameMode === 'pvc' && currentPlayer === WHITE) {
            return;
        }

        const row = parseInt(event.currentTarget.dataset.row);
        const col = parseInt(event.currentTarget.dataset.col);

        if (board[row][col] !== EMPTY) {
            return; // 該位置已有棋子
        }

        const piecesToFlip = getFlippablePieces(row, col, currentPlayer);
        if (piecesToFlip.length === 0) {
            return; // 無效的落子位置
        }

        // 放置新棋子
        board[row][col] = currentPlayer;
        
        // 落子並翻轉棋子
        piecesToFlip.forEach(p => {
            board[p.r][p.c] = currentPlayer;
        });

        // 優化渲染：只更新變動的棋子，而不是重繪整個棋盤
        updateBoardDOM(row, col, piecesToFlip);

        switchPlayer();
    }

    function updateBoardDOM(newPieceRow, newPieceCol, flippedPieces) {
        // 放置新棋子
        const newCell = boardElement.querySelector(`[data-row='${newPieceRow}'][data-col='${newPieceCol}']`);
        const newDisc = document.createElement('div');
        newDisc.className = `disc ${currentPlayer === BLACK ? 'black' : 'white'} new`;
        newCell.appendChild(newDisc);

        // 翻轉棋子
        flippedPieces.forEach(p => {
            const cellToFlip = boardElement.querySelector(`[data-row='${p.r}'][data-col='${p.c}']`);
            const discToFlip = cellToFlip.querySelector('.disc');
            if (discToFlip) {
                // 觸發翻轉動畫，並在動畫結束後更新顏色
                discToFlip.classList.add('flipping');
                setTimeout(() => {
                    discToFlip.className = `disc ${currentPlayer === BLACK ? 'black' : 'white'}`;
                }, 250); // 在動畫中點切換顏色
            }
        });

        // 更新分數
        setTimeout(updateInfo, 500); // 等待動畫結束後更新分數
    }

    function getFlippablePieces(row, col, player) {
        const opponent = player === BLACK ? WHITE : BLACK;
        let flippablePieces = [];

        for (const dir of directions) {
            let piecesInLine = [];
            let r = row + dir.r;
            let c = col + dir.c;

            // 尋找對手的棋子
            while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === opponent) {
                piecesInLine.push({ r, c });
                r += dir.r;
                c += dir.c;
            }

            // 如果線的末端是自己的棋子，則中間的棋子都可以翻轉
            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
                flippablePieces = flippablePieces.concat(piecesInLine);
            }
        }
        return flippablePieces;
    }

    function switchPlayer() {
        currentPlayer = (currentPlayer === BLACK) ? WHITE : BLACK;
        
        if (!hasValidMoves(currentPlayer)) {
            // 如果當前玩家無處可下，再次切換
            currentPlayer = (currentPlayer === BLACK) ? WHITE : BLACK;
            if (!hasValidMoves(currentPlayer)) {
                // 雙方都無處可下，遊戲結束
                endGame();
                return;
            } else {
                alert(`${currentPlayer === BLACK ? '鬼' : '鬼殺隊'}無棋可下，跳過回合。`);
            }
        }
        updateInfo();

        // 如果是電腦回合，觸發AI
        if (gameMode === 'pvc' && currentPlayer === WHITE) {
            setTimeout(computerMove, 500); // 延遲500毫秒，模擬思考
        }
    }

    function hasValidMoves(player) {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === EMPTY && getFlippablePieces(r, c, player).length > 0) {
                    return true;
                }
            }
        }
        return false;
    }

    function computerMove() {
        if (!hasValidMoves(WHITE)) return;

        let bestMove = null;
        let maxFlipped = -1;

        // 遍歷所有可能的落子點
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] === EMPTY) {
                    const piecesToFlip = getFlippablePieces(r, c, WHITE);
                    if (piecesToFlip.length > maxFlipped) {
                        maxFlipped = piecesToFlip.length;
                        bestMove = { r, c };
                    }
                }
            }
        }

        // 執行最佳移動
        if (bestMove) {
            const { r, c } = bestMove;
            const piecesToFlip = getFlippablePieces(r, c, WHITE);
            
            board[r][c] = WHITE;
            piecesToFlip.forEach(p => {
                board[p.r][p.c] = WHITE;
            });

            updateBoardDOM(r, c, piecesToFlip);
            switchPlayer();
        }
    }

    function updateInfo() {
        let blackCount = 0;
        let whiteCount = 0;
        board.flat().forEach(cell => {
            if (cell === BLACK) blackCount++;
            if (cell === WHITE) whiteCount++;
        });

        blackScoreElement.textContent = blackCount;
        whiteScoreElement.textContent = whiteCount;

        const playerColor = currentPlayer === BLACK ? 'black' : 'white';
        playerTurnElement.className = `disc ${playerColor}`;
        playerTurnElement.dataset.player = playerColor;
    }

    function endGame() {
        updateInfo();
        const blackCount = parseInt(blackScoreElement.textContent);
        const whiteCount = parseInt(whiteScoreElement.textContent);
        let message = '遊戲結束！\n';
        if (blackCount > whiteCount) {
            message += '鬼殺隊獲勝！';
        } else if (whiteCount > blackCount) {
            message += '鬼獲勝！';
        } else {
            message += '平手！';
        }
        setTimeout(() => alert(message), 100); // 延遲一點，讓畫面先更新
    }

    resetButton.addEventListener('click', initializeGame);
    gameModeSelector.forEach(radio => {
        radio.addEventListener('change', initializeGame);
    });

    // 初始化遊戲
    initializeGame();
});
