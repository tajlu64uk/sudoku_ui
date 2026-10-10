import { Grid, cloneGrid, countLogical, nextLogicalMove } from '../../src/core/solver.ts';

export interface TrajectoryStep {
  count: number;      // cells forced right now (countLogical)
  remaining: number;  // empty cells still left at this point
  ratio: number;       // count / remaining — low = tight bottleneck, independent of how far along the solve is
}

export interface TrajectoryScore {
  // Raw min(count) is dominated by the trivial end-game: with few empty cells
  // left, count is mechanically small regardless of difficulty (1 empty cell
  // left ⇒ count is at most 1). minRatio (count / remaining) corrects for
  // that — a real bottleneck is "few forced options despite many unknowns still
  // open", which shows up as a low ratio even mid-puzzle, while the trivial
  // end-game tail keeps a high ratio (nearly everything forced relative to
  // what's left) and stops dominating the score.
  minRatio: number;
  minCount: number;
  steps: number;
  trajectory: TrajectoryStep[];
}

// Simulates the full logical solve move-by-move (using the same "advanced"
// techniques as generation: naked pairs + box-line reduction), recording
// countLogical() and the count/remaining ratio at every step.
export function scorePuzzle(puzzle: Grid, diagonal: boolean): TrajectoryScore {
  const grid = cloneGrid(puzzle);
  const trajectory: TrajectoryStep[] = [];

  let remaining = grid.flat().filter(v => v === 0).length;
  while (remaining > 0) {
    const count = countLogical(grid, diagonal, true);
    if (count === 0) break; // shouldn't happen for a puzzle generated as logically solvable
    trajectory.push({ count, remaining, ratio: count / remaining });

    const move = nextLogicalMove(grid, diagonal, true);
    if (!move) break;
    grid[move.row][move.col] = move.val;
    remaining--;
  }

  const minRatio = trajectory.length ? Math.min(...trajectory.map(t => t.ratio)) : 0;
  const minCount = trajectory.length ? Math.min(...trajectory.map(t => t.count)) : 0;
  return { minRatio, minCount, steps: trajectory.length, trajectory };
}
