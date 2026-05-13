// Puzzle generator ported from Delphi Generatory_hard / Generatory_double.
// Complete grids are generated via backtracking (the part the original couldn't do).

import {
  Grid, Candidates, cloneGrid,
  buildCandidates, buildCandidatesAdvanced, buildCandidatesIncremental,
  countLogical, countLogicalFromV, solveLogically,
  isLogicallyForced, isLogicallyForcedFromV,
  countRedundant, countRedundantFromV,
  hasRedundant, hasRedundantFromV,
  countNum, hasConflict,
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

export interface ProgressInfo {
  percent: number;
  label: string;
}

type OnProgress = (info: ProgressInfo) => void;

const yieldToUI = (): Promise<void> => new Promise(r => setTimeout(r, 0));

const countFilled = (g: Grid): number =>
  g.reduce((s, row) => s + row.filter(v => v > 0).length, 0);

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
async function generatePuzzleHard(
  solution: Grid, diagonal: boolean, advanced: boolean, onProgress: OnProgress
): Promise<Grid> {
  // Phase 1: 100 tries, remove 7 symmetric pairs each time (180° rotational
  // symmetry), keep the starting point with the fewest "easy" moves.
  // solveLogically check guarantees a unique solution.
  let bestCount = Infinity;
  let K1: Grid = cloneGrid(solution);

  // All 40 symmetric pair representatives: (r,c) where r*9+c < (8-r)*9+(8-c)
  const allPairs: [number, number][] = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (r * 9 + c < (8 - r) * 9 + (8 - c))
        allPairs.push([r, c]);

  for (let attempt = 0; attempt < 100; attempt++) {
    if (attempt % 10 === 0) {
      onProgress({ percent: 5 + (attempt / 100) * 20, label: `Фаза 1: попытка ${attempt + 1} из 100` });
      await yieldToUI();
    }
    const A = cloneGrid(solution);
    const pairs = shuffle([...allPairs]);
    for (let i = 0; i < 7; i++) {
      const [r, c] = pairs[i];
      A[r][c] = 0;
      A[8 - r][8 - c] = 0;
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
  const startFilled = countFilled(A);

  while (hasRedundant(A, solution, diagonal, advanced)) {
    const filled = countFilled(A);
    const p2 = Math.min(1, (startFilled - filled) / Math.max(1, startFilled - 24));
    onProgress({ percent: 25 + p2 * 75, label: `Фаза 2: заполнено ${filled} клеток` });
    await yieldToUI();

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
          canRemove[r][c] = false;
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
async function generatePuzzleDouble(
  solution: Grid, diagonal: boolean, advanced: boolean, onProgress: OnProgress
): Promise<Grid> {
  // Phase 1: 100 tries, remove 13 unique cells each time
  let bestCount = Infinity;
  let K1: Grid = cloneGrid(solution);

  for (let attempt = 0; attempt < 100; attempt++) {
    if (attempt % 10 === 0) {
      onProgress({ percent: 5 + (attempt / 100) * 20, label: `Фаза 1: попытка ${attempt + 1} из 100` });
      await yieldToUI();
    }
    const A = cloneGrid(solution);
    let n = 0;
    while (n < 13) {
      const r = Math.floor(Math.random() * 9);
      const c = Math.floor(Math.random() * 9);
      if (A[r][c] !== 0) { A[r][c] = 0; n++; }
    }
    const cnt = countLogical(A, diagonal, advanced);
    if (cnt < bestCount && solveLogically(A, diagonal, advanced)) {
      bestCount = cnt;
      K1 = cloneGrid(A);
    }
  }

  // Phase 2: remove pairs of cells at a time
  const A = K1;
  const startFilled = countFilled(A);

  while (true) {
    const filled = countFilled(A);
    const p2 = Math.min(1, (startFilled - filled) / Math.max(1, startFilled - 24));
    onProgress({ percent: 25 + p2 * 75, label: `Фаза 2: удалено ${81 - filled} клеток из 81` });
    await yieldToUI();

    const V_A: Candidates = advanced
      ? buildCandidatesAdvanced(A, diagonal)
      : buildCandidates(A, diagonal);

    if (!hasRedundantFromV(A, solution, V_A, diagonal, advanced)) break;

    if (countRedundantFromV(A, solution, V_A, diagonal, advanced) < 3) {
      // Fewer than 3 redundant cells — finish with single removals
      for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
          if (A[r][c] > 0) {
            const Vt = advanced
              ? buildCandidatesAdvanced((() => { const p = cloneGrid(A); p[r][c] = 0; return p; })(), diagonal)
              : buildCandidatesIncremental(V_A, r, c, A[r][c], A, diagonal);
            if (isLogicallyForcedFromV(r, c, solution[r][c], Vt, diagonal)) A[r][c] = 0;
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
        const V_P1 = advanced
          ? buildCandidatesAdvanced(P1, diagonal)
          : buildCandidatesIncremental(V_A, r, c, A[r][c], A, diagonal);
        if (!isLogicallyForcedFromV(r, c, solution[r][c], V_P1, diagonal)) continue;

        for (let r2 = 0; r2 < 9; r2++) {
          for (let c2 = 0; c2 < 9; c2++) {
            if (P1[r2][c2] === 0) continue;

            const P2 = cloneGrid(P1);
            P2[r2][c2] = 0;
            const V_P2 = advanced
              ? buildCandidatesAdvanced(P2, diagonal)
              : buildCandidatesIncremental(V_P1, r2, c2, A[r2][c2], P1, diagonal);
            if (!isLogicallyForcedFromV(r2, c2, solution[r2][c2], V_P2, diagonal)) continue;

            const logical = countLogicalFromV(V_P2, diagonal);
            const delen = countRedundantFromV(P2, solution, V_P2, diagonal, advanced);

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

export async function generatePuzzle(
  opts: GenerateOptions,
  onProgress?: OnProgress
): Promise<GenerateResult> {
  const progress = onProgress ?? (() => {});
  const advanced = opts.difficulty === 'hard';

  progress({ percent: 0, label: 'Генерация сетки…' });
  await yieldToUI();
  const solution = generateSolvedGrid(opts.diagonal);

  progress({ percent: 5, label: 'Начальное удаление цифр…' });
  await yieldToUI();

  let puzzle: Grid;
  if (opts.difficulty === 'medium' || opts.difficulty === 'hard') {
    puzzle = await generatePuzzleDouble(solution, opts.diagonal, advanced, progress);
  } else {
    puzzle = await generatePuzzleHard(solution, opts.diagonal, advanced, progress);
  }

  return { puzzle, solution };
}
