import { createServer } from 'node:http';
import { loadCached, saveCached } from './cache.ts';
import { generateDailyPuzzle } from './generateDaily.ts';

const PORT = Number(process.env.PORT) || 4000;
const CANDIDATE_COUNT = Number(process.env.CANDIDATE_COUNT) || 20;
const WORKER_COUNT = process.env.WORKER_COUNT ? Number(process.env.WORKER_COUNT) : undefined;

let generating: Promise<void> | null = null;

async function regenerate(): Promise<void> {
  console.log(`[daily-api] generating ${CANDIDATE_COUNT} candidates…`);
  const puzzle = await generateDailyPuzzle(CANDIDATE_COUNT, WORKER_COUNT);
  saveCached(puzzle);
  console.log(
    `[daily-api] done in ${puzzle.generationMs}ms (${puzzle.workerCount} workers) — minRatio=${puzzle.score.minRatio.toFixed(3)}, minCount=${puzzle.score.minCount}, steps=${puzzle.score.steps}`
  );
}

function triggerRegenerate(): Promise<void> {
  if (!generating) {
    generating = regenerate()
      .catch(err => console.error('[daily-api] generation failed', err))
      .finally(() => { generating = null; });
  }
  return generating;
}

// Simple in-process daily cron: schedule the next run for the next UTC midnight,
// re-arming itself after each run. No OS cron / extra process needed for the prototype.
function scheduleDailyCron(): void {
  const msUntilNextMidnightUtc = (): number => {
    const now = new Date();
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
    return next - now.getTime();
  };
  const tick = async (): Promise<void> => {
    await triggerRegenerate();
    setTimeout(tick, msUntilNextMidnightUtc());
  };
  setTimeout(tick, msUntilNextMidnightUtc());
}

const server = createServer((req, res) => {
  if (req.url === '/api/daily' && req.method === 'GET') {
    const cached = loadCached();
    if (!cached) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'daily puzzle not generated yet' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cached));
    return;
  }

  if (req.url === '/api/daily/regenerate' && req.method === 'POST') {
    void triggerRegenerate();
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: generating ? 'generating' : 'started' }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log(`[daily-api] listening on :${PORT}`);
  scheduleDailyCron();
  if (!loadCached()) void triggerRegenerate();
});
