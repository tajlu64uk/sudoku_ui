import { useEffect } from 'react';
import { useGame } from './hooks/useGame';
import Board from './components/Board';
import Controls from './components/Controls';

export default function App() {
  const { state, startNewGame, selectCell, selectNum, hint, undo, redo } = useGame();

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
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-gray-800">Sudoky</h1>
      </header>

      <main className="flex-1 flex items-center justify-center px-3 py-4 md:px-6 md:py-8">
        {state.generating ? (
          <div className="flex flex-col items-center gap-4 text-gray-500">
            <div className="w-10 h-10 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-sm">Генерация судоку…</p>
          </div>
        ) : state.status === 'idle' ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">Добро пожаловать</h2>
              <p className="text-gray-400 text-sm">Нажмите «Новая игра», чтобы начать</p>
            </div>
            <Controls
              state={state}
              onSelectNum={selectNum}
              onNewGame={startNewGame}
              onHint={hint}
              onUndo={undo}
              onRedo={redo}
            />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 w-full max-w-3xl">
            <div className="w-full max-w-[min(480px,100%)] md:flex-1 md:max-w-[520px]">
              <Board state={state} onCellClick={selectCell} />
            </div>
            <div className="w-full md:w-56 md:shrink-0">
              <Controls
                state={state}
                onSelectNum={selectNum}
                onNewGame={startNewGame}
                onHint={hint}
                onUndo={undo}
                onRedo={redo}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
