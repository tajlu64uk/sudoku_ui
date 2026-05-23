// Core Sudoku logic ported from the original Delphi implementation.
// All coordinates are 0-based (Delphi was 1-based).
// Candidates[r][c][d]: d=0..8 represents digits 1..9.

export type Grid = number[][];
export type Candidates = boolean[][][];

export function cloneGrid(g: Grid): Grid {
  return g.map(row => [...row]);
}

function boxStart(r: number, c: number): [number, number] {
  return [Math.floor(r / 3) * 3, Math.floor(c / 3) * 3];
}

function countCands(V: Candidates, r: number, c: number): number {
  return V[r][c].reduce((n, v) => n + (v ? 1 : 0), 0);
}

function equalCands(V: Candidates, r1: number, c1: number, r2: number, c2: number): boolean {
  for (let d = 0; d < 9; d++) if (V[r1][c1][d] !== V[r2][c2][d]) return false;
  return true;
}

// BapuaHt — basic candidate matrix
export function buildCandidates(grid: Grid, diagonal: boolean): Candidates {
  const V: Candidates = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => Array(9).fill(true))
  );
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] > 0) {
        for (let d = 0; d < 9; d++) V[r][c][d] = false;
        continue;
      }
      const [r0, c0] = boxStart(r, c);
      for (let k = 0; k < 9; k++) {
        if (k !== r && grid[k][c] > 0) V[r][c][grid[k][c] - 1] = false;
        if (k !== c && grid[r][k] > 0) V[r][c][grid[r][k] - 1] = false;
      }
      for (let rr = r0; rr < r0 + 3; rr++)
        for (let cc = c0; cc < c0 + 3; cc++)
          if ((rr !== r || cc !== c) && grid[rr][cc] > 0)
            V[r][c][grid[rr][cc] - 1] = false;
      if (diagonal) {
        if (r === c) for (let k = 0; k < 9; k++) { if (grid[k][k] > 0) V[r][c][grid[k][k] - 1] = false; }
        if (r + c === 8) for (let k = 0; k < 9; k++) { if (grid[k][8 - k] > 0) V[r][c][grid[k][8 - k] - 1] = false; }
      }
    }
  }
  return V;
}

function cloneCandidates(V: Candidates): Candidates {
  return V.map(row => row.map(cell => [...cell]));
}

// Builds candidates for grid-{(r,c)} incrementally from V (candidates for grid).
// Only updates the removed cell and its peers — O(peers) instead of O(81×9).
export function buildCandidatesIncremental(
  V: Candidates,
  r: number, c: number, val: number,
  grid: Grid,
  diagonal: boolean
): Candidates {
  const newV = cloneCandidates(V);
  const d = val - 1;
  const [r0, c0] = boxStart(r, c);

  // (r,c) is now empty: compute its candidates from peers in grid (before removal)
  newV[r][c] = Array(9).fill(true);
  for (let k = 0; k < 9; k++) {
    if (k !== c && grid[r][k] > 0) newV[r][c][grid[r][k] - 1] = false;
    if (k !== r && grid[k][c] > 0) newV[r][c][grid[k][c] - 1] = false;
  }
  for (let rr = r0; rr < r0 + 3; rr++)
    for (let cc = c0; cc < c0 + 3; cc++)
      if ((rr !== r || cc !== c) && grid[rr][cc] > 0)
        newV[r][c][grid[rr][cc] - 1] = false;
  if (diagonal) {
    if (r === c)
      for (let k = 0; k < 9; k++)
        if (k !== r && grid[k][k] > 0) newV[r][c][grid[k][k] - 1] = false;
    if (r + c === 8)
      for (let k = 0; k < 9; k++)
        if (k !== r && grid[k][8 - k] > 0) newV[r][c][grid[k][8 - k] - 1] = false;
  }

  // For each empty peer of (r,c): digit val may now be available there
  const tryRestore = (rp: number, cp: number) => {
    if (grid[rp][cp] !== 0 || newV[rp][cp][d]) return;
    const [rp0, cp0] = boxStart(rp, cp);
    for (let k = 0; k < 9; k++) {
      if (k === cp) continue;
      if (rp === r && k === c) continue;
      if (grid[rp][k] === val) return;
    }
    for (let k = 0; k < 9; k++) {
      if (k === rp) continue;
      if (k === r && cp === c) continue;
      if (grid[k][cp] === val) return;
    }
    for (let rr = rp0; rr < rp0 + 3; rr++)
      for (let cc = cp0; cc < cp0 + 3; cc++) {
        if (rr === rp && cc === cp) continue;
        if (rr === r && cc === c) continue;
        if (grid[rr][cc] === val) return;
      }
    if (diagonal) {
      if (rp === cp)
        for (let k = 0; k < 9; k++) {
          if (k === rp || (k === r && k === c)) continue;
          if (grid[k][k] === val) return;
        }
      if (rp + cp === 8)
        for (let k = 0; k < 9; k++) {
          if (k === rp || (k === r && 8 - k === c)) continue;
          if (grid[k][8 - k] === val) return;
        }
    }
    newV[rp][cp][d] = true;
  };

  for (let k = 0; k < 9; k++) {
    if (k !== c) tryRestore(r, k);
    if (k !== r) tryRestore(k, c);
  }
  for (let rr = r0; rr < r0 + 3; rr++)
    for (let cc = c0; cc < c0 + 3; cc++)
      if (rr !== r || cc !== c) tryRestore(rr, cc);
  if (diagonal) {
    if (r === c) for (let k = 0; k < 9; k++) if (k !== r) tryRestore(k, k);
    if (r + c === 8) for (let k = 0; k < 9; k++) if (k !== r) tryRestore(k, 8 - k);
  }

  return newV;
}

// BapuaHt2 — advanced: naked pairs + box-line reduction
export function buildCandidatesAdvanced(grid: Grid, diagonal: boolean): Candidates {
  const V = buildCandidates(grid, diagonal);
  let changed = true;
  while (changed) {
    changed = false;
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const r0 = br * 3, c0 = bc * 3;

        // Naked pairs in box
        for (let r = r0; r < r0 + 3; r++) {
          for (let c = c0; c < c0 + 3; c++) {
            if (grid[r][c] !== 0 || countCands(V, r, c) !== 2) continue;
            for (let r2 = r0; r2 < r0 + 3; r2++) {
              for (let c2 = c0; c2 < c0 + 3; c2++) {
                if (r2 < r || (r2 === r && c2 <= c)) continue;
                if (grid[r2][c2] !== 0 || countCands(V, r2, c2) !== 2) continue;
                if (!equalCands(V, r, c, r2, c2)) continue;
                for (let d = 0; d < 9; d++) {
                  if (!V[r][c][d]) continue;
                  for (let rr = r0; rr < r0 + 3; rr++)
                    for (let cc = c0; cc < c0 + 3; cc++) {
                      if ((rr === r && cc === c) || (rr === r2 && cc === c2)) continue;
                      if (V[rr][cc][d]) { V[rr][cc][d] = false; changed = true; }
                    }
                }
              }
            }
          }
        }

        // Box-line reduction
        for (let d = 0; d < 9; d++) {
          let fR = -1, fC = -1, sameR = true, sameC = true, cnt = 0;
          for (let r = r0; r < r0 + 3; r++)
            for (let c = c0; c < c0 + 3; c++)
              if (V[r][c][d]) {
                if (fR === -1) { fR = r; fC = c; }
                else { if (r !== fR) sameR = false; if (c !== fC) sameC = false; }
                cnt++;
              }
          if (cnt > 1 && fR !== -1) {
            if (sameR) for (let c = 0; c < 9; c++) {
              if (c >= c0 && c < c0 + 3) continue;
              if (V[fR][c][d]) { V[fR][c][d] = false; changed = true; }
            }
            if (sameC) for (let r = 0; r < 9; r++) {
              if (r >= r0 && r < r0 + 3) continue;
              if (V[r][fC][d]) { V[r][fC][d] = false; changed = true; }
            }
          }
        }
      }
    }

    // Naked pairs in columns
    for (let c = 0; c < 9; c++)
      for (let r = 0; r < 9; r++) {
        if (grid[r][c] !== 0 || countCands(V, r, c) !== 2) continue;
        for (let r2 = r + 1; r2 < 9; r2++) {
          if (grid[r2][c] !== 0 || countCands(V, r2, c) !== 2) continue;
          if (!equalCands(V, r, c, r2, c)) continue;
          for (let d = 0; d < 9; d++) {
            if (!V[r][c][d]) continue;
            for (let rr = 0; rr < 9; rr++) {
              if (rr === r || rr === r2) continue;
              if (V[rr][c][d]) { V[rr][c][d] = false; changed = true; }
            }
          }
        }
      }

    // Naked pairs in rows
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] !== 0 || countCands(V, r, c) !== 2) continue;
        for (let c2 = c + 1; c2 < 9; c2++) {
          if (grid[r][c2] !== 0 || countCands(V, r, c2) !== 2) continue;
          if (!equalCands(V, r, c, r, c2)) continue;
          for (let d = 0; d < 9; d++) {
            if (!V[r][c][d]) continue;
            for (let cc = 0; cc < 9; cc++) {
              if (cc === c || cc === c2) continue;
              if (V[r][cc][d]) { V[r][cc][d] = false; changed = true; }
            }
          }
        }
      }
  }
  return V;
}

export interface LogicalMove {
  row: number;
  col: number;
  val: number;
  method: number; // 1=naked single, 2=hidden box, 3=hidden row, 4=hidden col, 5=diagonal
}

// Find what value (i,j) should have, using the first applicable method
function resolveCellValue(V: Candidates, _grid: Grid, diagonal: boolean, r: number, c: number): LogicalMove | null {
  const [r0, c0] = boxStart(r, c);

  // Method 1: only one candidate in cell
  if (countCands(V, r, c) === 1) {
    const d = V[r][c].indexOf(true);
    return { row: r, col: c, val: d + 1, method: 1 };
  }

  // Method 2: only one position in box for some digit
  for (let d = 0; d < 9; d++) {
    if (!V[r][c][d]) continue;
    let cnt = 0;
    for (let rr = r0; rr < r0 + 3; rr++)
      for (let cc = c0; cc < c0 + 3; cc++)
        if (V[rr][cc][d]) cnt++;
    if (cnt === 1) return { row: r, col: c, val: d + 1, method: 2 };
  }

  // Method 3: only one position in row
  for (let d = 0; d < 9; d++) {
    let cnt = 0;
    for (let cc = 0; cc < 9; cc++) if (V[r][cc][d]) cnt++;
    if (cnt === 1 && V[r][c][d]) return { row: r, col: c, val: d + 1, method: 3 };
  }

  // Method 4: only one position in column
  for (let d = 0; d < 9; d++) {
    let cnt = 0;
    for (let rr = 0; rr < 9; rr++) if (V[rr][c][d]) cnt++;
    if (cnt === 1 && V[r][c][d]) return { row: r, col: c, val: d + 1, method: 4 };
  }

  // Method 5: diagonal constraint
  if (diagonal) {
    for (let d = 0; d < 9; d++) {
      if (!V[r][c][d]) continue;
      if (r === c) {
        let cnt = 0;
        for (let k = 0; k < 9; k++) if (V[k][k][d]) cnt++;
        if (cnt === 1) return { row: r, col: c, val: d + 1, method: 5 };
      }
      if (r + c === 8) {
        let cnt = 0;
        for (let k = 0; k < 9; k++) if (V[k][8 - k][d]) cnt++;
        if (cnt === 1) return { row: r, col: c, val: d + 1, method: 5 };
      }
    }
  }

  return null;
}

interface LogicalInfo {
  V: Candidates;
  D: number[][];
  count: number;
}

function buildLogicalD(V: Candidates, diagonal: boolean): { D: number[][], count: number } {
  const D: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));

  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (countCands(V, r, c) === 1) D[r][c] = 1;

  for (let br = 0; br < 3; br++)
    for (let bc = 0; bc < 3; bc++)
      for (let d = 0; d < 9; d++) {
        let cnt = 0;
        for (let r = br * 3; r < br * 3 + 3; r++)
          for (let c = bc * 3; c < bc * 3 + 3; c++)
            if (V[r][c][d]) cnt++;
        if (cnt === 1)
          for (let r = br * 3; r < br * 3 + 3; r++)
            for (let c = bc * 3; c < bc * 3 + 3; c++)
              if (V[r][c][d]) D[r][c] = 1;
      }

  for (let r = 0; r < 9; r++)
    for (let d = 0; d < 9; d++) {
      let cnt = 0;
      for (let c = 0; c < 9; c++) if (V[r][c][d]) cnt++;
      if (cnt === 1) for (let c = 0; c < 9; c++) if (V[r][c][d]) D[r][c] = 1;
    }

  for (let c = 0; c < 9; c++)
    for (let d = 0; d < 9; d++) {
      let cnt = 0;
      for (let r = 0; r < 9; r++) if (V[r][c][d]) cnt++;
      if (cnt === 1) for (let r = 0; r < 9; r++) if (V[r][c][d]) D[r][c] = 1;
    }

  if (diagonal) {
    for (let d = 0; d < 9; d++) {
      let cnt = 0;
      for (let k = 0; k < 9; k++) if (V[k][k][d]) cnt++;
      if (cnt === 1) for (let k = 0; k < 9; k++) if (V[k][k][d]) D[k][k] = 1;
      cnt = 0;
      for (let k = 0; k < 9; k++) if (V[k][8 - k][d]) cnt++;
      if (cnt === 1) for (let k = 0; k < 9; k++) if (V[k][8 - k][d]) D[k][8 - k] = 1;
    }
  }

  const count = D.reduce((s, row) => s + row.reduce((ss, v) => ss + v, 0), 0);
  return { D, count };
}

// Variants2(3,...) internals — build the logical-move matrix
function buildLogicalInfo(grid: Grid, diagonal: boolean, advanced: boolean): LogicalInfo {
  const V = advanced ? buildCandidatesAdvanced(grid, diagonal) : buildCandidates(grid, diagonal);
  const { D, count } = buildLogicalD(V, diagonal);
  return { V, D, count };
}

// Variants2(3,...) — count logically solvable cells
export function countLogical(grid: Grid, diagonal: boolean, advanced: boolean): number {
  return buildLogicalInfo(grid, diagonal, advanced).count;
}

export function countLogicalFromV(V: Candidates, diagonal: boolean): number {
  return buildLogicalD(V, diagonal).count;
}

// Variants2(7,...) — deterministic: find the first logically forced cell (top-left)
export function nextLogicalMove(grid: Grid, diagonal: boolean, advanced: boolean): LogicalMove | null {
  const { V, D, count } = buildLogicalInfo(grid, diagonal, advanced);
  if (count === 0) return null;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (D[r][c] === 1) return resolveCellValue(V, grid, diagonal, r, c);
  return null;
}

// Variants2(1,...) — random pick among logically forced cells (for hints)
export function nextLogicalMoveRandom(grid: Grid, diagonal: boolean, advanced: boolean): LogicalMove | null {
  const { V, D, count } = buildLogicalInfo(grid, diagonal, advanced);
  if (count === 0) return null;

  // Collect all D=1 cells, pick random (port of original: Random(vv-1)+1 → 1..vv-1)
  const cells: [number, number][] = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (D[r][c] === 1) cells.push([r, c]);

  const idx = cells.length > 1 ? Math.floor(Math.random() * (cells.length - 1)) : 0;
  const [r, c] = cells[idx];
  return resolveCellValue(V, grid, diagonal, r, c);
}

// Variants3 — check if cell (r,c) with solution value `val` is logically forced
// by the surrounding cells in `grid` (grid[r][c] must be 0)
export function isLogicallyForced(
  r: number, c: number, val: number,
  grid: Grid, diagonal: boolean, advanced: boolean
): boolean {
  const V = advanced ? buildCandidatesAdvanced(grid, diagonal) : buildCandidates(grid, diagonal);
  const d = val - 1;
  const [r0, c0] = boxStart(r, c);

  // Method 1
  if (countCands(V, r, c) === 1 && V[r][c][d]) return true;

  // Method 2
  let cnt = 0;
  for (let rr = r0; rr < r0 + 3; rr++)
    for (let cc = c0; cc < c0 + 3; cc++)
      if (V[rr][cc][d]) cnt++;
  if (cnt === 1) return true;

  // Method 3
  cnt = 0;
  for (let cc = 0; cc < 9; cc++) if (V[r][cc][d]) cnt++;
  if (cnt === 1 && V[r][c][d]) return true;

  // Method 4
  cnt = 0;
  for (let rr = 0; rr < 9; rr++) if (V[rr][c][d]) cnt++;
  if (cnt === 1 && V[r][c][d]) return true;

  // Method 5
  if (diagonal) {
    if (r === c) {
      cnt = 0;
      for (let k = 0; k < 9; k++) if (V[k][k][d]) cnt++;
      if (cnt === 1) return true;
    }
    if (r + c === 8) {
      cnt = 0;
      for (let k = 0; k < 9; k++) if (V[k][8 - k][d]) cnt++;
      if (cnt === 1) return true;
    }
  }

  return false;
}

export function isLogicallyForcedFromV(
  r: number, c: number, val: number,
  V: Candidates, diagonal: boolean
): boolean {
  const d = val - 1;
  const [r0, c0] = boxStart(r, c);

  if (countCands(V, r, c) === 1 && V[r][c][d]) return true;

  let cnt = 0;
  for (let rr = r0; rr < r0 + 3; rr++)
    for (let cc = c0; cc < c0 + 3; cc++)
      if (V[rr][cc][d]) cnt++;
  if (cnt === 1) return true;

  cnt = 0;
  for (let cc = 0; cc < 9; cc++) if (V[r][cc][d]) cnt++;
  if (cnt === 1 && V[r][c][d]) return true;

  cnt = 0;
  for (let rr = 0; rr < 9; rr++) if (V[rr][c][d]) cnt++;
  if (cnt === 1 && V[r][c][d]) return true;

  if (diagonal) {
    if (r === c) {
      cnt = 0;
      for (let k = 0; k < 9; k++) if (V[k][k][d]) cnt++;
      if (cnt === 1) return true;
    }
    if (r + c === 8) {
      cnt = 0;
      for (let k = 0; k < 9; k++) if (V[k][8 - k][d]) cnt++;
      if (cnt === 1) return true;
    }
  }

  return false;
}

// PackPew — can the puzzle be solved by logic alone?
export function solveLogically(puzzle: Grid, diagonal: boolean, advanced: boolean): boolean {
  const grid = cloneGrid(puzzle);
  while (true) {
    const { D, V, count } = buildLogicalInfo(grid, diagonal, advanced);
    if (count === 0) break;
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (D[r][c] === 1) {
          const move = resolveCellValue(V, grid, diagonal, r, c);
          if (move) grid[r][c] = move.val;
        }
  }
  return grid.every(row => row.every(v => v > 0));
}

// Delen(0,...) — count how many filled cells in puzzle can be logically
// deduced from the other cells (i.e., are redundant)
export function countRedundant(
  puzzle: Grid, solution: Grid,
  diagonal: boolean, advanced: boolean
): number {
  let cnt = 0;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (puzzle[r][c] > 0) {
        const p = cloneGrid(puzzle);
        p[r][c] = 0;
        if (isLogicallyForced(r, c, solution[r][c], p, diagonal, advanced)) cnt++;
      }
  return cnt;
}

// Delen(1,...) — does any filled cell in puzzle become logically deducible
// when removed from the puzzle?
export function hasRedundant(
  puzzle: Grid, solution: Grid,
  diagonal: boolean, advanced: boolean
): boolean {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (puzzle[r][c] > 0) {
        const p = cloneGrid(puzzle);
        p[r][c] = 0;
        if (isLogicallyForced(r, c, solution[r][c], p, diagonal, advanced)) return true;
      }
  return false;
}

export function countRedundantFromV(
  puzzle: Grid, solution: Grid,
  V: Candidates, diagonal: boolean, advanced: boolean
): number {
  let cnt = 0;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (puzzle[r][c] > 0) {
        let Vt: Candidates;
        if (advanced) {
          const p = cloneGrid(puzzle); p[r][c] = 0;
          Vt = buildCandidatesAdvanced(p, diagonal);
        } else {
          Vt = buildCandidatesIncremental(V, r, c, solution[r][c], puzzle, diagonal);
        }
        if (isLogicallyForcedFromV(r, c, solution[r][c], Vt, diagonal)) cnt++;
      }
  return cnt;
}

export function hasRedundantFromV(
  puzzle: Grid, solution: Grid,
  V: Candidates, diagonal: boolean, advanced: boolean
): boolean {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (puzzle[r][c] > 0) {
        let Vt: Candidates;
        if (advanced) {
          const p = cloneGrid(puzzle); p[r][c] = 0;
          Vt = buildCandidatesAdvanced(p, diagonal);
        } else {
          Vt = buildCandidatesIncremental(V, r, c, solution[r][c], puzzle, diagonal);
        }
        if (isLogicallyForcedFromV(r, c, solution[r][c], Vt, diagonal)) return true;
      }
  return false;
}

// Count occurrences of `num` in puzzle (count_num in original)
export function countNum(num: number, grid: Grid): number {
  return grid.reduce((s, row) => s + row.reduce((ss, v) => ss + (v === num ? 1 : 0), 0), 0);
}

// Returns all filled peer cells that restrict what can go at (r,c)
export function getConstrainingCells(r: number, c: number, grid: Grid, diagonal: boolean): [number, number][] {
  const seen = new Set<string>();
  const add = (rr: number, cc: number) => { if (grid[rr][cc] > 0) seen.add(`${rr},${cc}`); };
  for (let k = 0; k < 9; k++) { if (k !== c) add(r, k); if (k !== r) add(k, c); }
  const [r0, c0] = boxStart(r, c);
  for (let rr = r0; rr < r0 + 3; rr++) for (let cc = c0; cc < c0 + 3; cc++) if (rr !== r || cc !== c) add(rr, cc);
  if (diagonal) {
    if (r === c) for (let k = 0; k < 9; k++) if (k !== r) add(k, k);
    if (r + c === 8) for (let k = 0; k < 9; k++) if (k !== r) add(k, 8 - k);
  }
  return Array.from(seen).map(s => s.split(',').map(Number) as [number, number]);
}

export function solvePuzzle(puzzle: Grid, diagonal: boolean): Grid | null {
  const grid = cloneGrid(puzzle);
  function bt(): boolean {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] !== 0) continue;
        for (let d = 1; d <= 9; d++) {
          if (!hasConflict(grid, r, c, d, diagonal)) {
            grid[r][c] = d;
            if (bt()) return true;
            grid[r][c] = 0;
          }
        }
        return false;
      }
    }
    return true;
  }
  return bt() ? grid : null;
}

// Check if placing val at (r,c) violates any constraint
export function hasConflict(grid: Grid, r: number, c: number, val: number, diagonal: boolean): boolean {
  if (val === 0) return false;
  for (let k = 0; k < 9; k++) {
    if (k !== c && grid[r][k] === val) return true;
    if (k !== r && grid[k][c] === val) return true;
  }
  const [r0, c0] = boxStart(r, c);
  for (let rr = r0; rr < r0 + 3; rr++)
    for (let cc = c0; cc < c0 + 3; cc++)
      if ((rr !== r || cc !== c) && grid[rr][cc] === val) return true;
  if (diagonal) {
    if (r === c) for (let k = 0; k < 9; k++) { if (k !== r && grid[k][k] === val) return true; }
    if (r + c === 8) for (let k = 0; k < 9; k++) { if (k !== r && grid[k][8 - k] === val) return true; }
  }
  return false;
}
