import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Grid } from '../../src/core/solver.ts';
import { TrajectoryScore } from './scoring.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(__dirname, 'worker.ts');

export interface DailyPuzzle {
  date: string;
  difficulty: 'hard';
  diagonal: true;
  puzzle: Grid;
  solution: Grid;
  score: TrajectoryScore;
  candidatesEvaluated: number;
  workerCount: number;
  generationMs: number;
}

interface WorkerResult {
  puzzle: Grid;
  solution: Grid;
  score: TrajectoryScore;
}

// Node is single-threaded, so running the candidate loop in-process (even via
// Promise.all) would not use more than one core — every candidate would still
// fight over the same thread. Each worker is a genuinely separate OS process
// instead, so `workerCount` candidate batches run on `workerCount` cores at once.
function runWorker(candidateCount: number): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', WORKER_PATH, String(candidateCount)], {
      cwd: join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => { out += chunk; });
    child.on('error', reject);
    child.on('exit', code => {
      if (code !== 0) { reject(new Error(`worker exited with code ${code}`)); return; }
      try {
        resolve(JSON.parse(out));
      } catch (err) {
        reject(new Error(`worker produced invalid JSON: ${(err as Error).message}`));
      }
    });
  });
}

// Generates `candidateCount` independent hard/diagonal puzzles (spread across
// up to `workerCount` OS processes) and keeps the one whose logical-solve
// trajectory has the lowest minRatio (count / cells-still-empty) — i.e. the
// tightest bottleneck relative to how much of the board is still open, not
// just the fewest starting clues or the trivially-low count near the end game.
export async function generateDailyPuzzle(
  candidateCount: number,
  workerCount: number = Math.max(1, cpus().length)
): Promise<DailyPuzzle> {
  const t0 = Date.now();
  const n = Math.max(1, Math.min(workerCount, candidateCount));

  // Spread candidateCount as evenly as possible across n worker processes.
  const base = Math.floor(candidateCount / n);
  const remainder = candidateCount % n;
  const chunks = Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0)).filter(c => c > 0);

  const results = await Promise.all(chunks.map(runWorker));

  let best = results[0];
  for (const r of results) if (r.score.minRatio < best.score.minRatio) best = r;

  return {
    date: new Date().toISOString().slice(0, 10),
    difficulty: 'hard',
    diagonal: true,
    puzzle: best.puzzle,
    solution: best.solution,
    score: best.score,
    candidatesEvaluated: candidateCount,
    workerCount: chunks.length,
    generationMs: Date.now() - t0,
  };
}
