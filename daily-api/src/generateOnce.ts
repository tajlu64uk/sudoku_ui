// CLI helper for local testing without spinning up the HTTP server:
//   npx tsx src/generateOnce.ts [candidateCount] [workerCount]
import { saveCached } from './cache.ts';
import { generateDailyPuzzle } from './generateDaily.ts';

const candidateCount = Number(process.argv[2]) || 20;
const workerCount = process.argv[3] ? Number(process.argv[3]) : undefined;

const puzzle = await generateDailyPuzzle(candidateCount, workerCount);
saveCached(puzzle);

console.log(JSON.stringify({
  date: puzzle.date,
  candidatesEvaluated: puzzle.candidatesEvaluated,
  workerCount: puzzle.workerCount,
  generationMs: puzzle.generationMs,
  minRatio: puzzle.score.minRatio,
  minCount: puzzle.score.minCount,
  steps: puzzle.score.steps,
  clues: puzzle.puzzle.flat().filter(v => v !== 0).length,
}, null, 2));
