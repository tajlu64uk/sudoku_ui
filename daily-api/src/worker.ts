// Worker process: npx tsx src/worker.ts <candidateCount>
// Generates `candidateCount` puzzles in this single process, scores each, and
// prints the single best (lowest minRatio) as JSON on stdout. Kept as a
// standalone script (spawned via child_process) rather than worker_threads
// so each candidate batch genuinely runs on its own OS process/core.
import { generatePuzzle } from '../../src/core/generator.ts';
import { Grid } from '../../src/core/solver.ts';
import { scorePuzzle, TrajectoryScore } from './scoring.ts';

interface WorkerResult {
  puzzle: Grid;
  solution: Grid;
  score: TrajectoryScore;
}

const candidateCount = Number(process.argv[2]) || 1;

let best: WorkerResult | null = null;
for (let i = 0; i < candidateCount; i++) {
  const { puzzle, solution } = await generatePuzzle({ difficulty: 'hard', diagonal: true });
  const score = scorePuzzle(puzzle, true);
  if (!best || score.minRatio < best.score.minRatio) {
    best = { puzzle, solution, score };
  }
}

if (!best) throw new Error('worker: no candidates were generated');
process.stdout.write(JSON.stringify(best));
