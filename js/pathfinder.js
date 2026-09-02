/**
 * Pathfinder engine — uses C++ WASM when available, JS fallback otherwise.
 */
const PathfinderEngine = (() => {
  const ALGO = { bfs: 0, dfs: 1, dijkstra: 2, astar: 3, greedy: 4, bibfs: 5 };

  const META = {
    bfs:      { name: 'Breadth-First Search', complexity: 'O(V + E)' },
    dfs:      { name: 'Depth-First Search', complexity: 'O(V + E)' },
    dijkstra: { name: "Dijkstra's Algorithm", complexity: 'O(E log V)' },
    astar:    { name: 'A* Search', complexity: 'O(E log V)' },
    greedy:   { name: 'Greedy Best-First', complexity: 'O(E log V)' },
    bibfs:    { name: 'Bidirectional BFS', complexity: 'O(b^(d/2))' },
  };

  let wasmModule = null;
  let useWasm = false;

  async function initWasm() {
    try {
      const script = document.createElement('script');
      script.src = 'wasm/pathfinder.js';
      script.type = 'text/javascript';
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      if (typeof createPathfinderModule === 'function') {
        wasmModule = await createPathfinderModule();
        useWasm = true;
        console.log('[PFV] C++ WASM module loaded');
      }
    } catch {
      console.log('[PFV] WASM not found — using JS fallback (run build.bat to compile C++)');
      useWasm = false;
    }
  }

  /* ===== JS Fallback (mirrors C++ logic) ===== */
  class JSPathfinder {
    constructor(rows, cols) {
      this.rows = rows;
      this.cols = cols;
      this.cells = new Uint8Array(rows * cols);
      this.weights = new Int32Array(rows * cols).fill(1);
      this.startR = Math.floor(rows / 2);
      this.startC = Math.floor(cols / 8);
      this.endR = Math.floor(rows / 2);
      this.endC = cols - Math.floor(cols / 8) - 1;
    }

    idx(r, c) { return r * this.cols + c; }
    inBounds(r, c) { return r >= 0 && r < this.rows && c >= 0 && c < this.cols; }
    isWalkable(r, c) { return this.inBounds(r, c) && this.cells[this.idx(r, c)] !== 1; }
    getCost(r, c) { return this.weights[this.idx(r, c)]; }
    heuristic(r, c) { return Math.abs(r - this.endR) + Math.abs(c - this.endC); }

    neighbors(r, c) {
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      const result = [];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (this.isWalkable(nr, nc)) result.push([nr, nc]);
      }
      return result;
    }

    setWall(r, c, wall) {
      if (!this.inBounds(r, c)) return;
      if ((r === this.startR && c === this.startC) || (r === this.endR && c === this.endC)) return;
      this.cells[this.idx(r, c)] = wall ? 1 : 0;
      if (!wall) this.weights[this.idx(r, c)] = 1;
    }

    setWeight(r, c, w) {
      if (!this.inBounds(r, c)) return;
      if ((r === this.startR && c === this.startC) || (r === this.endR && c === this.endC)) return;
      if (this.cells[this.idx(r, c)] === 1) return;
      this.cells[this.idx(r, c)] = 2;
      this.weights[this.idx(r, c)] = Math.max(1, w);
    }

    buildResult(visitOrder, parent, peakMemory, elapsedMs, found) {
      const path = [];
      let pathLength = 0;
      if (found) {
        let r = this.endR, c = this.endC;
        const rev = [[r, c]];
        while (r !== this.startR || c !== this.startC) {
          const p = parent[r][c];
          if (p[0] === -1) break;
          r = p[0]; c = p[1];
          rev.push([r, c]);
        }
        rev.reverse();
        pathLength = rev.length;
        for (const [pr, pc] of rev) { path.push(pr, pc); }
      }
      return {
        found, visitOrder, path,
        visitedCount: visitOrder.length / 2,
        pathLength, peakMemory,
        executionMs: elapsedMs,
      };
    }

    runBFS() {
      const t0 = performance.now();
      const parent = Array.from({ length: this.rows }, () => Array(this.cols).fill([-1, -1]));
      const visited = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
      const q = [[this.startR, this.startC]];
      visited[this.startR][this.startC] = true;
      const visitOrder = [];
      let peakMemory = 0, found = false;

      while (q.length) {
        peakMemory = Math.max(peakMemory, q.length);
        const [r, c] = q.shift();
        visitOrder.push(r, c);
        if (r === this.endR && c === this.endC) { found = true; break; }
        for (const [nr, nc] of this.neighbors(r, c)) {
          if (!visited[nr][nc]) {
            visited[nr][nc] = true;
            parent[nr][nc] = [r, c];
            q.push([nr, nc]);
          }
        }
      }
      return this.buildResult(visitOrder, parent, peakMemory, performance.now() - t0, found);
    }

    runDFS() {
      const t0 = performance.now();
      const parent = Array.from({ length: this.rows }, () => Array(this.cols).fill([-1, -1]));
      const visited = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
      const st = [[this.startR, this.startC]];
      visited[this.startR][this.startC] = true;
      const visitOrder = [];
      let peakMemory = 0, found = false;

      while (st.length) {
        peakMemory = Math.max(peakMemory, st.length);
        const [r, c] = st.pop();
        visitOrder.push(r, c);
        if (r === this.endR && c === this.endC) { found = true; break; }
        const nbs = this.neighbors(r, c).reverse();
        for (const [nr, nc] of nbs) {
          if (!visited[nr][nc]) {
            visited[nr][nc] = true;
            parent[nr][nc] = [r, c];
            st.push([nr, nc]);
          }
        }
      }
      return this.buildResult(visitOrder, parent, peakMemory, performance.now() - t0, found);
    }

    runDijkstra() {
      const t0 = performance.now();
      const dist = Array.from({ length: this.rows }, () => Array(this.cols).fill(Infinity));
      const parent = Array.from({ length: this.rows }, () => Array(this.cols).fill([-1, -1]));
      const pq = [[0, this.startR, this.startC]];
      const visitOrder = [];
      let peakMemory = 0, found = false;

      dist[this.startR][this.startC] = 0;
      while (pq.length) {
        peakMemory = Math.max(peakMemory, pq.length);
        pq.sort((a, b) => a[0] - b[0]);
        const [d, r, c] = pq.shift();
        if (d > dist[r][c]) continue;
        visitOrder.push(r, c);
        if (r === this.endR && c === this.endC) { found = true; break; }
        for (const [nr, nc] of this.neighbors(r, c)) {
          const nd = d + this.getCost(nr, nc);
          if (nd < dist[nr][nc]) {
            dist[nr][nc] = nd;
            parent[nr][nc] = [r, c];
            pq.push([nd, nr, nc]);
          }
        }
      }
      return this.buildResult(visitOrder, parent, peakMemory, performance.now() - t0, found);
    }

    runAStar() {
      const t0 = performance.now();
      const gScore = Array.from({ length: this.rows }, () => Array(this.cols).fill(Infinity));
      const parent = Array.from({ length: this.rows }, () => Array(this.cols).fill([-1, -1]));
      const closed = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
      const pq = [[this.heuristic(this.startR, this.startC), 0, this.startR, this.startC]];
      const visitOrder = [];
      let peakMemory = 0, found = false;

      gScore[this.startR][this.startC] = 0;
      while (pq.length) {
        peakMemory = Math.max(peakMemory, pq.length);
        pq.sort((a, b) => a[0] - b[0]);
        const [, g, r, c] = pq.shift();
        if (closed[r][c]) continue;
        closed[r][c] = true;
        visitOrder.push(r, c);
        if (r === this.endR && c === this.endC) { found = true; break; }
        for (const [nr, nc] of this.neighbors(r, c)) {
          const ng = g + this.getCost(nr, nc);
          if (ng < gScore[nr][nc]) {
            gScore[nr][nc] = ng;
            parent[nr][nc] = [r, c];
            pq.push([ng + this.heuristic(nr, nc), ng, nr, nc]);
          }
        }
      }
      return this.buildResult(visitOrder, parent, peakMemory, performance.now() - t0, found);
    }

    runGreedy() {
      const t0 = performance.now();
      const parent = Array.from({ length: this.rows }, () => Array(this.cols).fill([-1, -1]));
      const visited = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
      const pq = [[this.heuristic(this.startR, this.startC), this.startR, this.startC]];
      visited[this.startR][this.startC] = true;
      const visitOrder = [];
      let peakMemory = 0, found = false;

      while (pq.length) {
        peakMemory = Math.max(peakMemory, pq.length);
        pq.sort((a, b) => a[0] - b[0]);
        const [, r, c] = pq.shift();
        visitOrder.push(r, c);
        if (r === this.endR && c === this.endC) { found = true; break; }
        for (const [nr, nc] of this.neighbors(r, c)) {
          if (!visited[nr][nc]) {
            visited[nr][nc] = true;
            parent[nr][nc] = [r, c];
            pq.push([this.heuristic(nr, nc), nr, nc]);
          }
        }
      }
      return this.buildResult(visitOrder, parent, peakMemory, performance.now() - t0, found);
    }

    runBiBFS() {
      const t0 = performance.now();
      const parentF = Array.from({ length: this.rows }, () => Array(this.cols).fill([-1, -1]));
      const parentB = Array.from({ length: this.rows }, () => Array(this.cols).fill([-1, -1]));
      const visitedF = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
      const visitedB = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
      const qF = [[this.startR, this.startC]];
      const qB = [[this.endR, this.endC]];
      visitedF[this.startR][this.startC] = true;
      visitedB[this.endR][this.endC] = true;
      const visitOrder = [];
      let peakMemory = 0, found = false, meetR = -1, meetC = -1;

      while (qF.length && qB.length) {
        peakMemory = Math.max(peakMemory, qF.length + qB.length);

        const sizeF = qF.length;
        for (let i = 0; i < sizeF; i++) {
          const [r, c] = qF.shift();
          visitOrder.push(r, c);
          if (visitedB[r][c]) { meetR = r; meetC = c; found = true; break; }
          for (const [nr, nc] of this.neighbors(r, c)) {
            if (!visitedF[nr][nc]) {
              visitedF[nr][nc] = true;
              parentF[nr][nc] = [r, c];
              qF.push([nr, nc]);
            }
          }
        }
        if (found) break;

        const sizeB = qB.length;
        for (let i = 0; i < sizeB; i++) {
          const [r, c] = qB.shift();
          visitOrder.push(r, c);
          if (visitedF[r][c]) { meetR = r; meetC = c; found = true; break; }
          for (const [nr, nc] of this.neighbors(r, c)) {
            if (!visitedB[nr][nc]) {
              visitedB[nr][nc] = true;
              parentB[nr][nc] = [r, c];
              qB.push([nr, nc]);
            }
          }
        }
      }

      const elapsedMs = performance.now() - t0;
      const path = [];
      let pathLength = 0;
      if (found) {
        const pathF = [[meetR, meetC]];
        let r = meetR, c = meetC;
        while (r !== this.startR || c !== this.startC) {
          const p = parentF[r][c];
          if (p[0] === -1) break;
          r = p[0]; c = p[1];
          pathF.unshift([r, c]);
        }
        const pathB = [];
        r = meetR; c = meetC;
        if (!(r === this.endR && c === this.endC)) {
          const p = parentB[r][c];
          r = p[0]; c = p[1];
        }
        while (r !== this.endR || c !== this.endC) {
          pathB.push([r, c]);
          const p = parentB[r][c];
          if (p[0] === -1) break;
          r = p[0]; c = p[1];
        }
        pathLength = pathF.length + pathB.length - 1;
        for (const [pr, pc] of pathF) path.push(pr, pc);
        for (const [pr, pc] of pathB) path.push(pr, pc);
      }

      return {
        found, visitOrder, path,
        visitedCount: visitOrder.length / 2,
        pathLength, peakMemory,
        executionMs: elapsedMs,
      };
    }

    run(algo) {
      switch (algo) {
        case 0: return this.runBFS();
        case 1: return this.runDFS();
        case 2: return this.runDijkstra();
        case 3: return this.runAStar();
        case 4: return this.runGreedy();
        case 5: return this.runBiBFS();
        default: return this.runBFS();
      }
    }
  }

  let jsEngine = null;

  function syncGrid(state) {
    if (useWasm && wasmModule) {
      wasmModule._pf_init(state.rows, state.cols);
      for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
          const cell = state.grid[r][c];
          if (cell === 'wall') wasmModule._pf_set_wall(r, c, 1);
          else if (cell === 'weight') wasmModule._pf_set_weight(r, c, state.weights[r][c] || 5);
        }
      }
      wasmModule._pf_set_start(state.startR, state.startC);
      wasmModule._pf_set_end(state.endR, state.endC);

      const lenPtr = wasmModule._malloc(4);
      const bufPtr = wasmModule._pf_run(ALGO[state.algo], lenPtr);
      const totalLen = wasmModule.HEAP32[lenPtr >> 2];
      wasmModule._free(lenPtr);

      const heap = wasmModule.HEAP32;
      const base = bufPtr >> 2;
      const found = heap[base] === 1;
      const visitedCount = heap[base + 1];
      const pathLength = heap[base + 2];
      const peakMemory = heap[base + 3];
      const executionMs = heap[base + 4] / 1000;
      const visitCount = heap[base + 5];
      const pathCount = heap[base + 6];

      const visitOrder = [];
      for (let i = 0; i < visitCount; i++) visitOrder.push(heap[base + 7 + i]);
      const path = [];
      for (let i = 0; i < pathCount; i++) path.push(heap[base + 7 + visitCount + i]);

      wasmModule._pf_free(bufPtr);
      return { found, visitOrder, path, visitedCount, pathLength, peakMemory, executionMs };
    }

    if (!jsEngine || jsEngine.rows !== state.rows || jsEngine.cols !== state.cols) {
      jsEngine = new JSPathfinder(state.rows, state.cols);
    }
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = state.grid[r][c];
        if (cell === 'wall') jsEngine.setWall(r, c, true);
        else if (cell === 'weight') jsEngine.setWeight(r, c, state.weights[r][c] || 5);
        else jsEngine.setWall(r, c, false);
      }
    }
    jsEngine.startR = state.startR;
    jsEngine.startC = state.startC;
    jsEngine.endR = state.endR;
    jsEngine.endC = state.endC;
    return jsEngine.run(ALGO[state.algo]);
  }

  return { initWasm, syncGrid, META, ALGO, get useWasm() { return useWasm; } };
})();

window.PathfinderEngine = PathfinderEngine;
