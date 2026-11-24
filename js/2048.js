
      (() => {
        'use strict';

        const MIN_DIM = 2;
        const MAX_DIM = 10;
        const MAX_HISTORY = 25;

        // DOM references
        const stageEl = document.getElementById('stage');
        const boardWrapperEl = document.getElementById('boardWrapper');
        const gridBgEl = document.getElementById('gridBg');
        const tileLayerEl = document.getElementById('tileLayer');
        const scoreValEl = document.getElementById('scoreVal');
        const bestValEl = document.getElementById('bestVal');
        const scoreBoxEl = document.getElementById('scoreBox');
        const gridMetaEl = document.getElementById('gridMeta');
        const undoBtn = document.getElementById('undoBtn');
        const newGameBtn = document.getElementById('newGameBtn');
        const soundBtn = document.getElementById('soundBtn');
        const soundOnIcon = document.getElementById('soundOnIcon');
        const soundOffIcon = document.getElementById('soundOffIcon');
        const presetsGroup = document.getElementById('presetsGroup');
        const rowsInput = document.getElementById('rowsInput');
        const colsInput = document.getElementById('colsInput');
        const rowsDec = document.getElementById('rowsDec');
        const rowsInc = document.getElementById('rowsInc');
        const colsDec = document.getElementById('colsDec');
        const colsInc = document.getElementById('colsInc');
        const overlayEl = document.getElementById('overlay');
        const overlayTitleEl = document.getElementById('overlayTitle');
        const overlaySubtitleEl = document.getElementById('overlaySubtitle');
        const overlayPrimaryBtn = document.getElementById('overlayPrimaryBtn');
        const overlaySecondaryBtn = document.getElementById('overlaySecondaryBtn');

        // Audio synthesis (Web Audio API)
        let audioCtx = null;
        let soundEnabled = true;

        function playTone(freq, duration = 0.07, type = 'sine', gainVal = 0.05) {
          if (!soundEnabled) return;
          try {
            if (!audioCtx) {
              const Ctx = window.AudioContext || window.webkitAudioContext;
              if (!Ctx) return;
              audioCtx = new Ctx();
            }
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
          } catch (_) {
            // Ignore audio errors
          }
        }

        function playMoveSound(mergedMax) {
          if (mergedMax > 0) {
            const step = Math.min(Math.log2(mergedMax), 12);
            const freq = 220 * Math.pow(1.09, step);
            playTone(freq, 0.1, 'triangle', 0.065);
          } else {
            playTone(150, 0.045, 'sine', 0.03);
          }
        }

        // Game state
        let rows = 4;
        let cols = 4;
        let grid = [];
        let score = 0;
        let best = 0;
        let won = false;
        let keepPlaying = false;
        let gameOver = false;
        let nextTileId = 1;
        let history = [];

        // Layout metrics (computed dynamically)
        let metrics = { tileSize: 80, gap: 10, pad: 10, radius: 8 };

        function bestStorageKey(r, c) {
          return `2048_dark_best_${r}x${c}`;
        }

        function loadBest(r, c) {
          try {
            return parseInt(localStorage.getItem(bestStorageKey(r, c)) || '0', 10) || 0;
          } catch (_) {
            return 0;
          }
        }

        function saveBest(r, c, val) {
          try {
            localStorage.setItem(bestStorageKey(r, c), String(val));
          } catch (_) {
            // Ignore storage errors
          }
        }

        function createEmptyGrid(r, c) {
          return Array.from({ length: r }, () => Array(c).fill(null));
        }

        function cloneGridState(g) {
          return g.map((row) => row.map((cell) => (cell ? { id: cell.id, value: cell.value } : null)));
        }

        function updateMetaLabel() {
          const shape = rows === cols ? (rows === 4 ? 'Classic' : 'Square') : 'Non-square';
          gridMetaEl.textContent = `${rows} × ${cols} · ${shape}`;
          rowsInput.value = String(rows);
          colsInput.value = String(cols);
          rowsDec.disabled = rows <= MIN_DIM;
          rowsInc.disabled = rows >= MAX_DIM;
          colsDec.disabled = cols <= MIN_DIM;
          colsInc.disabled = cols >= MAX_DIM;

          presetsGroup.querySelectorAll('.preset-btn').forEach((btn) => {
            const br = parseInt(btn.dataset.r, 10);
            const bc = parseInt(btn.dataset.c, 10);
            btn.classList.toggle('active', br === rows && bc === cols);
          });
        }

        function computeLayout() {
          const rect = stageEl.getBoundingClientRect();
          const availW = Math.max(160, rect.width - 8);
          const availH = Math.max(160, rect.height - 8);

          const maxDim = Math.max(rows, cols);
          const gapRatio = maxDim >= 8 ? 0.09 : maxDim >= 6 ? 0.11 : 0.13;

          // Total board width = tileSize * (cols + gapRatio * (cols + 1))
          const tileByW = availW / (cols + gapRatio * (cols + 1));
          const tileByH = availH / (rows + gapRatio * (rows + 1));
          const tileSize = Math.floor(Math.max(22, Math.min(tileByW, tileByH, 130)));
          const gap = Math.max(4, Math.min(12, Math.round(tileSize * gapRatio)));
          const pad = gap;
          const radius = Math.max(3, Math.min(6, Math.round(tileSize * 0.07)));

          metrics = { tileSize, gap, pad, radius };

          const boardW = cols * tileSize + (cols + 1) * gap;
          const boardH = rows * tileSize + (rows + 1) * gap;

          boardWrapperEl.style.width = `${boardW}px`;
          boardWrapperEl.style.height = `${boardH}px`;
          boardWrapperEl.style.padding = `${pad}px`;
          boardWrapperEl.style.borderRadius = `${radius + 3}px`;

          gridBgEl.style.gridTemplateColumns = `repeat(${cols}, ${tileSize}px)`;
          gridBgEl.style.gridTemplateRows = `repeat(${rows}, ${tileSize}px)`;
          gridBgEl.style.gap = `${gap}px`;

          const cells = gridBgEl.children;
          for (let i = 0; i < cells.length; i++) {
            cells[i].style.borderRadius = `${radius}px`;
          }

          positionAllTiles(false);
        }

        function buildBackgroundCells() {
          gridBgEl.innerHTML = '';
          const frag = document.createDocumentFragment();
          const total = rows * cols;
          for (let i = 0; i < total; i++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            frag.appendChild(cell);
          }
          gridBgEl.appendChild(frag);
        }

        function tileFontSize(value, tileSize) {
          const digits = String(value).length;
          if (digits <= 2) return Math.round(tileSize * 0.46);
          if (digits === 3) return Math.round(tileSize * 0.37);
          if (digits === 4) return Math.round(tileSize * 0.3);
          return Math.round(tileSize * 0.24);
        }

        function tileClassForValue(val) {
          return val <= 2048 ? `tile-${val}` : 'tile-super';
        }

        function getTileCoords(r, c) {
          const x = metrics.pad + c * (metrics.tileSize + metrics.gap);
          const y = metrics.pad + r * (metrics.tileSize + metrics.gap);
          return { x, y };
        }

        function renderTiles(transientTiles = []) {
          tileLayerEl.innerHTML = '';
          const frag = document.createDocumentFragment();

          const createTileEl = (tile, r, c, extraClass = '') => {
            const el = document.createElement('div');
            el.className = `tile ${tileClassForValue(tile.value)} ${extraClass}`.trim();
            el.dataset.id = String(tile.id);
            el.dataset.r = String(r);
            el.dataset.c = String(c);
            el.style.width = `${metrics.tileSize}px`;
            el.style.height = `${metrics.tileSize}px`;
            el.style.borderRadius = `${metrics.radius}px`;
            el.style.fontSize = `${tileFontSize(tile.value, metrics.tileSize)}px`;

            const startR = tile.prevR !== undefined ? tile.prevR : r;
            const startC = tile.prevC !== undefined ? tile.prevC : c;
            const pos = getTileCoords(startR, startC);
            el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;

            const inner = document.createElement('div');
            inner.className = 'tile-inner';
            inner.textContent = String(tile.value);
            el.appendChild(inner);
            return el;
          };

          // Render tiles that are sliding into a merge (underneath)
          for (const t of transientTiles) {
            const el = createTileEl(t, t.targetR, t.targetC);
            el.style.zIndex = '1';
            frag.appendChild(el);
          }

          // Render active grid tiles
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const tile = grid[r][c];
              if (!tile) continue;
              const cls = tile.isNew ? 'is-new' : tile.merged ? 'is-merged' : '';
              const el = createTileEl(tile, r, c, cls);
              el.style.zIndex = tile.merged ? '3' : '2';
              frag.appendChild(el);
            }
          }

          tileLayerEl.appendChild(frag);

          // Trigger slide transition on next frame
          requestAnimationFrame(() => {
            const els = tileLayerEl.children;
            for (let i = 0; i < els.length; i++) {
              const el = els[i];
              const r = parseInt(el.dataset.r, 10);
              const c = parseInt(el.dataset.c, 10);
              const pos = getTileCoords(r, c);
              el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
            }
          });
        }

        function positionAllTiles(animate = false) {
          const els = tileLayerEl.children;
          for (let i = 0; i < els.length; i++) {
            const el = els[i];
            const r = parseInt(el.dataset.r, 10);
            const c = parseInt(el.dataset.c, 10);
            const val = parseInt(el.textContent || '2', 10);
            const pos = getTileCoords(r, c);
            if (!animate) el.style.transition = 'none';
            el.style.width = `${metrics.tileSize}px`;
            el.style.height = `${metrics.tileSize}px`;
            el.style.borderRadius = `${metrics.radius}px`;
            el.style.fontSize = `${tileFontSize(val, metrics.tileSize)}px`;
            el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
            if (!animate) {
              // Force reflow then restore transition
              void el.offsetWidth;
              el.style.transition = '';
            }
          }
        }

        function spawnRandomTile() {
          const empty = [];
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (!grid[r][c]) empty.push({ r, c });
            }
          }
          if (empty.length === 0) return false;
          const spot = empty[Math.floor(Math.random() * empty.length)];
          grid[spot.r][spot.c] = {
            id: nextTileId++,
            value: Math.random() < 0.9 ? 2 : 4,
            isNew: true,
          };
          return true;
        }

        function updateScoreUI(delta = 0) {
          scoreValEl.textContent = String(score);
          if (score > best) {
            best = score;
            saveBest(rows, cols, best);
          }
          bestValEl.textContent = String(best);

          if (delta > 0) {
            const floatEl = document.createElement('span');
            floatEl.className = 'score-delta';
            floatEl.textContent = `+${delta}`;
            scoreBoxEl.appendChild(floatEl);
            setTimeout(() => floatEl.remove(), 680);
          }
        }

        function hasAvailableMoves() {
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const cell = grid[r][c];
              if (!cell) return true;
              if (r + 1 < rows && grid[r + 1][c] && grid[r + 1][c].value === cell.value) return true;
              if (c + 1 < cols && grid[r][c + 1] && grid[r][c + 1].value === cell.value) return true;
            }
          }
          return false;
        }

        function showOverlay(mode) {
          overlayEl.classList.add('visible');
          if (mode === 'win') {
            overlayTitleEl.textContent = 'You reached 2048';
            overlaySubtitleEl.textContent = `Score: ${score.toLocaleString()}`;
            overlayPrimaryBtn.textContent = 'Keep Playing';
            overlayPrimaryBtn.onclick = () => {
              keepPlaying = true;
              hideOverlay();
            };
            overlaySecondaryBtn.textContent = 'New Game';
            overlaySecondaryBtn.onclick = () => startNewGame();
          } else {
            overlayTitleEl.textContent = 'Game Over';
            overlaySubtitleEl.textContent = `Final score: ${score.toLocaleString()}`;
            overlayPrimaryBtn.textContent = 'Play Again';
            overlayPrimaryBtn.onclick = () => startNewGame();
            overlaySecondaryBtn.textContent = 'Undo Move';
            overlaySecondaryBtn.style.display = history.length > 0 ? '' : 'none';
            overlaySecondaryBtn.onclick = () => undoMove();
          }
        }

        function hideOverlay() {
          overlayEl.classList.remove('visible');
          overlaySecondaryBtn.style.display = '';
        }

        function startNewGame() {
          grid = createEmptyGrid(rows, cols);
          score = 0;
          best = loadBest(rows, cols);
          won = false;
          keepPlaying = false;
          gameOver = false;
          history = [];
          undoBtn.disabled = true;
          hideOverlay();
          updateMetaLabel();
          buildBackgroundCells();
          computeLayout();

          // Spawn 2 starting tiles (or 1 if 2x2 is tiny, 2 is still great)
          spawnRandomTile();
          spawnRandomTile();
          updateScoreUI(0);
          renderTiles();
        }

        function setGridDimensions(newR, newC) {
          const clampedR = Math.max(MIN_DIM, Math.min(MAX_DIM, newR));
          const clampedC = Math.max(MIN_DIM, Math.min(MAX_DIM, newC));
          if (clampedR === rows && clampedC === cols) {
            updateMetaLabel();
            return;
          }
          rows = clampedR;
          cols = clampedC;
          startNewGame();
        }

        function undoMove() {
          if (history.length === 0) return;
          const prev = history.pop();
          grid = prev.grid;
          score = prev.score;
          won = prev.won;
          keepPlaying = prev.keepPlaying;
          gameOver = false;
          undoBtn.disabled = history.length === 0;
          hideOverlay();
          updateScoreUI(0);
          renderTiles();
        }

        // Direction: 'up' | 'down' | 'left' | 'right'
        function move(direction) {
          if (gameOver || (won && !keepPlaying)) return;

          const snapshot = {
            grid: cloneGridState(grid),
            score,
            won,
            keepPlaying,
          };

          // Clear previous frame flags
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (grid[r][c]) {
                delete grid[r][c].isNew;
                delete grid[r][c].merged;
                grid[r][c].prevR = r;
                grid[r][c].prevC = c;
              }
            }
          }

          let moved = false;
          let gained = 0;
          let mergedMax = 0;
          const transientTiles = [];

          const isHorizontal = direction === 'left' || direction === 'right';
          const reverse = direction === 'right' || direction === 'down';
          const outerLen = isHorizontal ? rows : cols;
          const innerLen = isHorizontal ? cols : rows;

          for (let i = 0; i < outerLen; i++) {
            const line = [];
            for (let j = 0; j < innerLen; j++) {
              const idx = reverse ? innerLen - 1 - j : j;
              const r = isHorizontal ? i : idx;
              const c = isHorizontal ? idx : i;
              if (grid[r][c]) {
                line.push({ tile: grid[r][c], r, c });
              }
            }

            const result = [];
            let k = 0;
            while (k < line.length) {
              const curr = line[k];
              const next = line[k + 1];
              if (next && curr.tile.value === next.tile.value) {
                const newVal = curr.tile.value * 2;
                gained += newVal;
                if (newVal > mergedMax) mergedMax = newVal;
                result.push({
                  tile: {
                    id: nextTileId++,
                    value: newVal,
                    merged: true,
                    prevR: undefined,
                    prevC: undefined,
                  },
                  mergedFrom: [curr.tile, next.tile],
                });
                k += 2;
              } else {
                result.push({ tile: curr.tile, mergedFrom: null });
                k += 1;
              }
            }

            // Write back to grid
            for (let j = 0; j < innerLen; j++) {
              const idx = reverse ? innerLen - 1 - j : j;
              const r = isHorizontal ? i : idx;
              const c = isHorizontal ? idx : i;
              const entry = result[j];
              if (entry) {
                if (entry.mergedFrom) {
                  moved = true;
                  entry.tile.prevR = r;
                  entry.tile.prevC = c;
                  for (const src of entry.mergedFrom) {
                    transientTiles.push({
                      id: src.id,
                      value: src.value,
                      prevR: src.prevR,
                      prevC: src.prevC,
                      targetR: r,
                      targetC: c,
                    });
                  }
                } else if (entry.tile.prevR !== r || entry.tile.prevC !== c) {
                  moved = true;
                }
                grid[r][c] = entry.tile;
              } else {
                grid[r][c] = null;
              }
            }
          }

          if (!moved) return;

          history.push(snapshot);
          if (history.length > MAX_HISTORY) history.shift();
          undoBtn.disabled = false;

          score += gained;
          spawnRandomTile();
          updateScoreUI(gained);
          renderTiles(transientTiles);
          playMoveSound(mergedMax);

          if (!won && mergedMax >= 2048) {
            won = true;
            setTimeout(() => {
              if (won && !keepPlaying) showOverlay('win');
            }, 220);
            return;
          }

          if (!hasAvailableMoves()) {
            gameOver = true;
            setTimeout(() => {
              if (gameOver) showOverlay('gameover');
            }, 240);
          }
        }

        // Event Listeners
        window.addEventListener('keydown', (e) => {
          if (document.activeElement === rowsInput || document.activeElement === colsInput) return;

          const key = e.key;
          if (key === 'ArrowUp' || key === 'w' || key === 'W') {
            e.preventDefault();
            move('up');
          } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
            e.preventDefault();
            move('down');
          } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
            e.preventDefault();
            move('left');
          } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
            e.preventDefault();
            move('right');
          } else if (key === 'z' || key === 'Z' || key === 'u' || key === 'U') {
            e.preventDefault();
            undoMove();
          } else if (key === 'r' || key === 'R') {
            e.preventDefault();
            startNewGame();
          }
        });

        // Touch / Pointer swipe support on the board
        let touchStartX = 0;
        let touchStartY = 0;
        let trackingTouch = false;

        boardWrapperEl.addEventListener(
          'touchstart',
          (e) => {
            if (e.touches.length !== 1) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            trackingTouch = true;
          },
          { passive: true }
        );

        boardWrapperEl.addEventListener(
          'touchend',
          (e) => {
            if (!trackingTouch || e.changedTouches.length === 0) return;
            trackingTouch = false;
            const dx = e.changedTouches[0].clientX - touchStartX;
            const dy = e.changedTouches[0].clientY - touchStartY;
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);
            if (Math.max(absX, absY) < 24) return;
            if (absX > absY) {
              move(dx > 0 ? 'right' : 'left');
            } else {
              move(dy > 0 ? 'down' : 'up');
            }
          },
          { passive: true }
        );

        // Buttons & Controls
        newGameBtn.addEventListener('click', startNewGame);
        undoBtn.addEventListener('click', undoMove);

        soundBtn.addEventListener('click', () => {
          soundEnabled = !soundEnabled;
          soundBtn.setAttribute('aria-pressed', String(soundEnabled));
          soundOnIcon.style.display = soundEnabled ? '' : 'none';
          soundOffIcon.style.display = soundEnabled ? 'none' : '';
        });

        presetsGroup.addEventListener('click', (e) => {
          const btn = e.target.closest('.preset-btn');
          if (!btn) return;
          setGridDimensions(parseInt(btn.dataset.r, 10), parseInt(btn.dataset.c, 10));
        });

        rowsDec.addEventListener('click', () => setGridDimensions(rows - 1, cols));
        rowsInc.addEventListener('click', () => setGridDimensions(rows + 1, cols));
        colsDec.addEventListener('click', () => setGridDimensions(rows, cols - 1));
        colsInc.addEventListener('click', () => setGridDimensions(rows, cols + 1));

        rowsInput.addEventListener('change', () => {
          const val = parseInt(rowsInput.value, 10);
          setGridDimensions(Number.isFinite(val) ? val : rows, cols);
        });

        colsInput.addEventListener('change', () => {
          const val = parseInt(colsInput.value, 10);
          setGridDimensions(rows, Number.isFinite(val) ? val : cols);
        });

        // Automatic responsive resizing
        const resizeObserver = new ResizeObserver(() => {
          computeLayout();
        });
        resizeObserver.observe(stageEl);
        window.addEventListener('resize', computeLayout);

        // Initialize
        startNewGame();
      })();
    
