import { useEffect, useState } from 'react';
import { useGame } from './hooks/useGame';
import { useSettings } from './hooks/useSettings';
import Board, { CandidateMode } from './components/Board';
import Controls from './components/Controls';
import SettingsModal from './components/SettingsModal';
import { buildShareUrl } from './utils/share';

export default function App() {
  const { state, timer, startNewGame, selectCell, selectNum, hint, undo, redo, rollbackToError, dismissPuzzleWarning, toggleNotesMode } = useGame();
  const { settings, set: setSetting, theme } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [candidateMode, setCandidateMode] = useState<CandidateMode>('none');

  useEffect(() => { setCandidateMode('none'); }, [state.puzzle]);

  const getShareUrl = () => buildShareUrl({
    puzzle: state.status === 'playing' ? state.current : state.puzzle,
    difficulty: state.difficulty,
    diagonal: state.diagonal,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }

      if (e.key >= '1' && e.key <= '9') { selectNum(Number(e.key)); return; }
      if (e.key === '0' || e.key === 'Backspace' || e.key === 'Delete') { selectNum(0); return; }
      if (e.key === 'h' || e.key === 'H') { hint(); return; }

      if (!state.selectedCell) return;
      const [r, c] = state.selectedCell;
      const moves: Record<string, [number, number]> = {
        ArrowUp: [r - 1, c], ArrowDown: [r + 1, c],
        ArrowLeft: [r, c - 1], ArrowRight: [r, c + 1],
      };
      if (moves[e.key]) {
        const [nr, nc] = moves[e.key];
        if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) selectCell(nr, nc);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.selectedCell, selectNum, selectCell, hint, undo, redo]);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-gray-800">Sudoky</h1>
        <button
          onClick={() => setSettingsOpen(true)}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none touch-manipulation"
          title="Настройки"
        >
          ⚙
        </button>
      </header>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        theme={theme}
        onSet={setSetting}
      />

      {state.puzzleWarning && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3 text-sm text-amber-800">
          <span>{state.puzzleWarning}</span>
          <button onClick={dismissPuzzleWarning} className="text-amber-600 hover:text-amber-900 shrink-0 leading-none" aria-label="Закрыть">✕</button>
        </div>
      )}
      <main className="flex-1 flex items-center justify-center px-3 py-4 md:px-6 md:py-8">
        {state.generating ? (
          <div className="flex flex-col items-center gap-3 w-64">
            <p className="text-sm text-gray-500 text-center">
              {state.generationProgress?.label ?? 'Генерация судоку…'}
            </p>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${theme.accent} rounded-full transition-all duration-200`}
                style={{ width: `${state.generationProgress?.percent ?? 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {Math.round(state.generationProgress?.percent ?? 0)}%
            </p>
          </div>
        ) : state.status === 'idle' ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">Добро пожаловать</h2>
              <p className="text-gray-400 text-sm">Нажмите «Новая игра», чтобы начать</p>
            </div>
            <Controls
              state={state}
              theme={theme}
              onSelectNum={selectNum}
              onNewGame={startNewGame}
              onHint={hint}
              onUndo={undo}
              onRedo={redo}
              onRollbackToError={rollbackToError}
              timer={timer}
              getShareUrl={getShareUrl}
              candidateMode={candidateMode}
              onSetCandidateMode={setCandidateMode}
              notesMode={state.notesMode}
              onToggleNotesMode={toggleNotesMode}
            />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 w-full max-w-3xl">
            <div className="w-full max-w-[min(480px,100%)] md:flex-1 md:max-w-[520px]">
              <Board state={state} theme={theme} onCellClick={selectCell} candidateMode={candidateMode} notes={state.notes} />
            </div>
            <div className="w-full md:w-56 md:shrink-0">
              <Controls
                state={state}
                theme={theme}
                onSelectNum={selectNum}
                onNewGame={startNewGame}
                onHint={hint}
                onUndo={undo}
                onRedo={redo}
                onRollbackToError={rollbackToError}
                timer={timer}
                getShareUrl={getShareUrl}
                candidateMode={candidateMode}
                onSetCandidateMode={setCandidateMode}
                notesMode={state.notesMode}
                onToggleNotesMode={toggleNotesMode}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
