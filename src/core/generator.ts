// Puzzle generator ported from Delphi Generatory_hard / Generatory_double.
// Complete grids are generated via backtracking (the part the original couldn't do).

import {
  Grid, cloneGrid,
  countLogical, solveLogically,
  isLogicallyForced, countRedundant, hasRedundant, countNum,
  hasConflict,
} from './solver';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface GenerateOptions {
  difficulty: Difficulty;
  diagonal: boolean;
}

export interface GenerateResult {
  puzzle: Grid;
  solution: Grid;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Backtracking grid generator (the part the original author couldn't implement)
function fillGrid(grid: Grid, diagonal: boolean): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) continue;
      const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (const d of digits) {
        if (!hasConflict(grid, r, c, d, diagonal)) {
          grid[r][c] = d;
          if (fillGrid(grid, diagonal)) return true;
          grid[r][c] = 0;
        }
      }
      return false;
    }
  }
  return true;
}

export function generateSolvedGrid(diagonal: boolean): Grid {
  const grid: Grid = Array.from({ length: 9 }, () => Array(9).fill(0));
  fillGrid(grid, diagonal);
  return grid;
}

// Generatory_hard — removes one cell at a time, choosing the removal that
// minimises the count of logically solvable cells (= hardest remaining puzzle)
function generatePuzzleHard(solution: Grid, diagonal: boolean, advanced: boolean): Grid {
  // Phase 1: 100 tries, remove 15 cells each time, keep the
  // starting point with the fewest "easy" moves
  let bestCount = Infinity;
  let K1: Grid = cloneGrid(solution);

  for (let attempt = 0; attempt < 100; attempt++) {
    const A = cloneGrid(solution);
    for (let n = 0; n < 15; n++) {
      A[Math.floor(Math.random() * 9)][Math.floor(Math.random() * 9)] = 0;
    }
    const cnt = countLogical(A, diagonal, advanced);
    if (cnt < bestCount && solveLogically(A, diagonal, advanced)) {
      bestCount = cnt;
      K1 = cloneGrid(A);
    }
  }

  // Phase 2: greedily remove cells until no cell is logically redundant.
  // At each step, remove the cell whose absence minimises logical moves
  // (hardest puzzle), with Delen count as tiebreaker.
  const A = K1;
  const canRemove: boolean[][] = Array.from({ length: 9 }, () => Array(9).fill(true));

  while (hasRedundant(A, solution, diagonal, advanced)) {
    let bestR = -1, bestC = -1;
    let bestLogical = Infinity;
    let bestDelen = -1;
    let bestNumCnt = Infinity;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (A[r][c] === 0 || !canRemove[r][c]) continue;

        const P = cloneGrid(A);
        P[r][c] = 0;

        if (!isLogicallyForced(r, c, solution[r][c], P, diagonal, advanced)) {
          canRemove[r][c] = false; // this cell will never become removable later
          continue;
        }

        const logical = countLogical(P, diagonal, advanced);
        const delen = countRedundant(P, solution, diagonal, advanced);
        const numCnt = countNum(solution[r][c], A);

        if (
          logical < bestLogical ||
          (logical === bestLogical && delen > bestDelen) ||
          (logical === bestLogical && delen === bestDelen && numCnt < bestNumCnt)
        ) {
          bestLogical = logical;
          bestDelen = delen;
          bestNumCnt = numCnt;
          bestR = r;
          bestC = c;
        }
      }
    }

    if (bestR === -1) break;
    A[bestR][bestC] = 0;
  }

  return A;
}

// Generatory_double — removes pairs of cells at a time (medium difficulty)
function generatePuzzleDouble(solution: Grid, diagonal: boolean): Grid {
  // Phase 1: 100 tries, remove 13 unique cells each time
  let bestCount = Infinity;
  let K1: Grid = cloneGrid(solution);

  for (let attempt = 0; attempt < 100; attempt++) {
    const A = cloneGrid(solution);
    let n = 0;
    while (n < 13) {
      const r = Math.floor(Math.random() * 9);
      const c = Math.floor(Math.random() * 9);
      if (A[r][c] !== 0) { A[r][c] = 0; n++; }
    }
    const cnt = countLogical(A, diagonal, false);
    if (cnt < bestCount && solveLogically(A, diagonal, false)) {
      bestCount = cnt;
      K1 = cloneGrid(A);
    }
  }

  // Phase 2: remove pairs of cells at a time
  const A = K1;

  while (hasRedundant(A, solution, diagonal, false)) {
    if (countRedundant(A, solution, diagonal, false) < 3) {
      // Fewer than 3 redundant cells — finish with single removals
      for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
          if (A[r][c] > 0) {
            const P = cloneGrid(A);
            P[r][c] = 0;
            if (isLogicallyForced(r, c, solution[r][c], P, diagonal, false)) A[r][c] = 0;
          }
      break;
    }

    let bestR1 = -1, bestC1 = -1, bestR2 = -1, bestC2 = -1;
    let bestLogical = Infinity;
    let bestDelen = -1;
    let found = false;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (A[r][c] === 0) continue;
        const P1 = cloneGrid(A);
        P1[r][c] = 0;
        if (!isLogicallyForced(r, c, solution[r][c], P1, diagonal, false)) continue;

        for (let r2 = 0; r2 < 9; r2++) {
          for (let c2 = 0; c2 < 9; c2++) {
            if (P1[r2][c2] === 0) continue;
            const P2 = cloneGrid(P1);
            P2[r2][c2] = 0;
            if (!isLogicallyForced(r2, c2, solution[r2][c2], P2, diagonal, false)) continue;

            const logical = countLogical(P2, diagonal, false);
            const delen = countRedundant(P2, solution, diagonal, false);

            if (!found || logical < bestLogical || (logical === bestLogical && delen > bestDelen)) {
              bestLogical = logical;
              bestDelen = delen;
              bestR1 = r; bestC1 = c;
              bestR2 = r2; bestC2 = c2;
              found = true;
            }
          }
        }
      }
    }

    if (!found) break;
    A[bestR1][bestC1] = 0;
    A[bestR2][bestC2] = 0;
  }

  return A;
}

export function generatePuzzle(opts: GenerateOptions): GenerateResult {
  const solution = generateSolvedGrid(opts.diagonal);
  const advanced = opts.difficulty === 'hard';

  let puzzle: Grid;
  if (opts.difficulty === 'medium') {
    puzzle = generatePuzzleDouble(solution, opts.diagonal);
  } else {
    puzzle = generatePuzzleHard(solution, opts.diagonal, advanced);
  }

  return { puzzle, solution };
}
