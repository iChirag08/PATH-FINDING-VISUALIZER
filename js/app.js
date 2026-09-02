NO(() => {
  'use strict';

  const ROWS = 27;
  const COLS = 53;

  const SPEEDS = { slow: 25, medium: 8, fast: 2, instant: 0 };

  let grid = [];
  let weights = [];
  let startR, startC, endR, endC;
  let currentAlgo = 'bfs';
  let currentTool = 'wall';
  let isMouseDown = false;
  let isVisualizing = false;
  let dragTarget = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const gridEl = $('#grid');

  /* ===== Init ===== */
  async function init() {
    const savedTheme = localStorage.getItem('pfv-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    await PathfinderEngine.initWasm();
    resetBoard();
    bindEvents();
    updateStats(null);
  }

  function createEmptyGrid() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill('empty'));
    weights = Array.from({ length: ROWS }, () => Array(COLS).fill(1));
    startR = Math.floor(ROWS / 2);
    startC = Math.floor(COLS / 8);
    endR = Math.floor(ROWS / 2);
    endC = COLS - Math.floor(COLS / 8) - 1;
    grid[startR][startC] = 'start';
    grid[endR][endC] = 'end';
  }

  function renderGrid() {
    gridEl.style.gridTemplateColumns = `repeat(${COLS}, 22px)`;
    gridEl.innerHTML = '';

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        applyCellClass(cell, r, c);
        gridEl.appendChild(cell);
      }
    }
  }

  function applyCellClass(el, r, c) {
    el.className = 'cell';
    const type = grid[r][c];
    if (type === 'start') { el.classList.add('start'); el.textContent = 'A'; }
    else if (type === 'end') { el.classList.add('end'); el.textContent = 'B'; }
    else if (type === 'wall') el.classList.add('wall');
    else if (type === 'weight') el.classList.add('weight');
    else if (type === 'visited') el.classList.add('visited');
    else if (type === 'path') el.classList.add('path');
    else el.textContent = '';
  }

  function getCellEl(r, c) {
    return gridEl.children[r * COLS + c];
  }

  function clearVisualization() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === 'visited' || grid[r][c] === 'path') {
          grid[r][c] = weights[r][c] > 1 ? 'weight' : 'empty';
        }
      }
    }
    renderGrid();
  }

  /* ===== Drawing ===== */
  function paintCell(r, c) {
    if (isVisualizing) return;
    if (r === startR && c === startC) return;
    if (r === endR && c === endC) return;

    if (currentTool === 'wall') {
      grid[r][c] = 'wall';
      weights[r][c] = 1;
    } else if (currentTool === 'weight') {
      grid[r][c] = 'weight';
      weights[r][c] = 5;
    } else if (currentTool === 'erase') {
      grid[r][c] = 'empty';
      weights[r][c] = 1;
    }

    applyCellClass(getCellEl(r, c), r, c);
  }

  function moveNode(type, r, c) {
    if (!isWalkable(r, c)) return;
    if (type === 'start') {
      grid[startR][startC] = weights[startR][startC] > 1 ? 'weight' : 'empty';
      startR = r; startC = c;
      grid[r][c] = 'start';
    } else {
      grid[endR][endC] = weights[endR][endC] > 1 ? 'weight' : 'empty';
      endR = r; endC = c;
      grid[r][c] = 'end';
    }
    renderGrid();
  }

  function isWalkable(r, c) {
    return grid[r][c] !== 'wall' && !(r === startR && c === startC) && !(r === endR && c === endC);
  }

  /* ===== Maze Generator (Recursive Backtracker) ===== */
  function generateMaze() {
    if (isVisualizing) return;
    clearVisualization();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] !== 'start' && grid[r][c] !== 'end') {
          grid[r][c] = 'wall';
        }
      }
    }

    const visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const stack = [[startR, startC]];
    visited[startR][startC] = true;
    grid[startR][startC] = 'start';

    const dirs = [[-2,0],[2,0],[0,-2],[0,2]];

    while (stack.length) {
      const [r, c] = stack[stack.length - 1];
      const neighbors = [];

      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr > 0 && nr < ROWS - 1 && nc > 0 && nc < COLS - 1 && !visited[nr][nc]) {
          if (nr === endR && nc === endC) continue;
          neighbors.push([nr, nc, dr, dc]);
        }
      }

      if (neighbors.length) {
        const [nr, nc, dr, dc] = neighbors[Math.floor(Math.random() * neighbors.length)];
        grid[r + dr / 2][c + dc / 2] = 'empty';
        grid[nr][nc] = 'empty';
        weights[nr][nc] = 1;
        weights[r + dr / 2][c + dc / 2] = 1;
        visited[nr][nc] = true;
        stack.push([nr, nc]);
      } else {
        stack.pop();
      }
    }

    grid[endR][endC] = 'end';
    renderGrid();
  }

  function sprinkleWeights() {
    if (isVisualizing) return;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === 'empty' && Math.random() < 0.12) {
          grid[r][c] = 'weight';
          weights[r][c] = 5;
        }
      }
    }
    renderGrid();
  }

  function clearWalls() {
    if (isVisualizing) return;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === 'wall' || grid[r][c] === 'weight') {
          grid[r][c] = 'empty';
          weights[r][c] = 1;
        }
      }
    }
    renderGrid();
  }

  function resetBoard() {
    if (isVisualizing) return;
    createEmptyGrid();
    renderGrid();
    updateStats(null);
  }

  /* ===== Visualize ===== */
  async function visualize() {
    if (isVisualizing) return;
    isVisualizing = true;
    setButtonsDisabled(true);
    clearVisualization();

    const state = {
      rows: ROWS, cols: COLS, grid, weights,
      startR, startC, endR, endC, algo: currentAlgo,
    };

    const result = PathfinderEngine.syncGrid(state);
    const speed = SPEEDS[$('#speed-select').value] || 8;

    for (let i = 0; i < result.visitOrder.length; i += 2) {
      const r = result.visitOrder[i];
      const c = result.visitOrder[i + 1];
      if ((r === startR && c === startC) || (r === endR && c === endC)) continue;
      if (grid[r][c] === 'empty' || grid[r][c] === 'weight') {
        grid[r][c] = 'visited';
        const el = getCellEl(r, c);
        el.classList.add('visited');
        if (currentAlgo === 'bibfs') el.classList.add('frontier');
      }
      if (speed > 0) await sleep(speed);
    }

    if (result.found) {
      for (let i = 0; i < result.path.length; i += 2) {
        const r = result.path[i];
        const c = result.path[i + 1];
        if ((r === startR && c === startC) || (r === endR && c === endC)) continue;
        grid[r][c] = 'path';
        applyCellClass(getCellEl(r, c), r, c);
        if (speed > 0) await sleep(Math.max(1, speed / 2));
      }
    }

    updateStats(result);
    isVisualizing = false;
    setButtonsDisabled(false);
  }

  function updateStats(result) {
    const meta = PathfinderEngine.META[currentAlgo];
    $('#stat-algo').textContent = meta.name;
    $('#stat-complexity').textContent = meta.complexity;

    if (!result) {
      $('#stat-visited').textContent = '0';
      $('#stat-path').textContent = '—';
      $('#stat-time').textContent = '0 ms';
      $('#stat-memory').textContent = '0 nodes';
      return;
    }

    $('#stat-visited').textContent = result.visitedCount;
    $('#stat-path').textContent = result.found ? `${result.pathLength} steps` : '—';
    $('#stat-time').textContent = result.executionMs < 1
      ? `${result.executionMs.toFixed(1)} ms`
      : `${result.executionMs.toFixed(1)} ms`;
    $('#stat-memory').textContent = `${result.peakMemory} nodes`;
  }

  function setButtonsDisabled(disabled) {
    $$('.btn, .tool-btn, .algo-list li').forEach(el => {
      if (disabled) el.style.pointerEvents = 'none';
      else el.style.pointerEvents = '';
    });
    $('#visualize-btn').disabled = disabled;
  }

  function selectAlgo(algo) {
    if (isVisualizing) return;
    currentAlgo = algo;
    $$('.algo-list li').forEach(li => {
      li.classList.toggle('active', li.dataset.algo === algo);
    });
    $('#algo-select').value = algo;
    updateStats(null);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* ===== Events ===== */
  function bindEvents() {
    gridEl.addEventListener('mousedown', (e) => {
      if (isVisualizing) return;
      isMouseDown = true;
      const cell = e.target.closest('.cell');
      if (!cell) return;
      const r = +cell.dataset.r, c = +cell.dataset.c;

      if (cell.classList.contains('start')) dragTarget = 'start';
      else if (cell.classList.contains('end')) dragTarget = 'end';
      else paintCell(r, c);
    });

    gridEl.addEventListener('mousemove', (e) => {
      if (!isMouseDown || isVisualizing) return;
      const cell = e.target.closest('.cell');
      if (!cell) return;
      const r = +cell.dataset.r, c = +cell.dataset.c;

      if (dragTarget) moveNode(dragTarget, r, c);
      else paintCell(r, c);
    });

    document.addEventListener('mouseup', () => {
      isMouseDown = false;
      dragTarget = null;
    });

    gridEl.addEventListener('contextmenu', (e) => e.preventDefault());

    $$('.algo-list li').forEach(li => {
      li.addEventListener('click', () => selectAlgo(li.dataset.algo));
    });

    $('#algo-select').addEventListener('change', (e) => selectAlgo(e.target.value));

    $$('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (isVisualizing) return;
        $$('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
      });
    });

    $('#visualize-btn').addEventListener('click', visualize);
    $('#maze-btn').addEventListener('click', generateMaze);
    $('#sprinkle-btn').addEventListener('click', sprinkleWeights);
    $('#clear-walls-btn').addEventListener('click', clearWalls);
    $('#reset-btn').addEventListener('click', resetBoard);

    $('#theme-toggle').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('pfv-theme', next);
    });

    $('#refresh-btn').addEventListener('click', resetBoard);

    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'SELECT') return;
      switch (e.code) {
        case 'Space': e.preventDefault(); visualize(); break;
        case 'KeyM': generateMaze(); break;
        case 'KeyC': clearWalls(); break;
        case 'KeyR': resetBoard(); break;
        case 'KeyD': $('#theme-toggle').click(); break;
      }
    });
  }

  init();
})();
