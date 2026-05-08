import { useState } from 'react';
import { GameState, formatTimer } from '../hooks/useGame';
import { Difficulty } from '../core/generator';
import { countNum } from '../core/solver';

interface Props {
  state: GameState;
  onSelectNum: (n: number) => void;
  onNewGame: (d: Difficulty, diagonal: boolean) => void;
  onHint: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: 'easy', label: 'Лёгкий' },
  { key: 'medium', label: 'Средний' },
  { key: 'hard', label: 'Сложный' },
];

const HINT_LABELS = ['Подсказка', 'Продолжить', 'Заполнить'];
const HINT_MSGS = [
  null,
  'Найдена клетка для заполнения',
  'Видите, что мешает другим вариантам?',
];

export default function Controls({ state, onSelectNum, onNewGame, onHint, onUndo, onRedo }: Props) {
  const [showNewGame, setShowNewGame] = useState(false);
  const [pendingDiff, setPendingDiff] = useState<Difficulty>(state.difficulty);
  const [pendingDiag, setPendingDiag] = useState(state.diagonal);

  const handleStart = () => {
    setShowNewGame(false);
    onNewGame(pendingDiff, pendingDiag);
  };

  const canUndo = state.history.length > 0 && state.status === 'playing';
  const canRedo = state.future.length > 0;
  const hintLabel = HINT_LABELS[state.hintPhase];
  const hintMsg   = HINT_MSGS[state.hintPhase];

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Timer + status */}
      <div className="flex md:flex-col items-center justify-between md:justify-start gap-2">
        <div className="text-2xl md:text-3xl font-mono text-gray-700 tracking-widest">
          {formatTimer(state.timer)}
        </div>
        <div className="text-right md:text-center">
          {state.status === 'solved' && (
            <div className="text-sm text-emerald-600 font-semibold">Решено!</div>
          )}
          {state.status === 'playing' && (
            <div className="text-xs text-gray-400">
              {DIFFICULTIES.find(d => d.key === state.difficulty)?.label}
              {state.diagonal ? ' · Диаг.' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Number pad */}
      <div>
        <div className="grid grid-cols-5 md:grid-cols-3 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
            const done = state.status !== 'idle' && countNum(n, state.current) === 9;
            const active = state.selectedNum === n;
            let cls = '';
            if (done)
              cls = active
                ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                : 'bg-emerald-50 text-emerald-600 border-emerald-300';
            else if (active)
              cls = 'bg-blue-500 text-white border-blue-500 shadow-sm';
            else
              cls = 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 active:bg-gray-100';
            return (
              <button
                key={n}
                onClick={() => onSelectNum(n)}
                className={`h-11 md:h-12 rounded-lg text-lg font-semibold border transition-colors touch-manipulation ${cls}`}
              >
                {n}
              </button>
            );
          })}
          {/* Eraser — mobile only (5th slot in 5-col grid) */}
          <button
            onClick={() => onSelectNum(0)}
            className={`h-11 md:hidden rounded-lg text-sm border transition-colors touch-manipulation ${
              state.selectedNum === 0
                ? 'bg-gray-300 text-gray-700 border-gray-400'
                : 'bg-white text-gray-400 border-gray-300 active:bg-gray-100'
            }`}
          >
            ✕
          </button>
        </div>
        <button
          onClick={() => onSelectNum(0)}
          className={`hidden md:block mt-1.5 w-full h-10 rounded-lg text-sm font-medium border transition-colors ${
            state.selectedNum === 0
              ? 'bg-gray-200 text-gray-700 border-gray-300'
              : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Стереть
        </button>
      </div>

      {/* Undo / Redo */}
      <div className="flex gap-1.5">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Ctrl+Z"
          className="flex-1 h-9 rounded-lg text-sm border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors text-gray-600 touch-manipulation"
        >
          ↩ Отменить
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Ctrl+Y"
          className="flex-1 h-9 rounded-lg text-sm border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors text-gray-600 touch-manipulation"
        >
          Повторить ↪
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        <div>
          <button
            onClick={onHint}
            disabled={state.status !== 'playing'}
            className={`w-full py-2.5 rounded-lg text-sm font-medium border transition-colors touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed ${
              state.hintPhase > 0
                ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 active:bg-gray-100'
            }`}
          >
            {hintLabel}
          </button>
          {hintMsg && (
            <p className="mt-1 text-xs text-amber-600 text-center">{hintMsg}</p>
          )}
        </div>
        <button
          onClick={() => setShowNewGame(v => !v)}
          className="py-2.5 rounded-lg text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors text-gray-600 touch-manipulation"
        >
          Новая игра
        </button>
      </div>

      {/* New game panel */}
      {showNewGame && (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
          <div>
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider font-medium">Сложность</p>
            <div className="flex md:flex-col gap-1.5 md:gap-1">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.key}
                  onClick={() => setPendingDiff(d.key)}
                  className={`flex-1 md:flex-none py-1.5 rounded-lg text-sm font-medium border transition-colors touch-manipulation ${
                    pendingDiff === d.key
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setPendingDiag(v => !v)}
              className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 ${
                pendingDiag ? 'bg-blue-500' : 'bg-gray-300'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${pendingDiag ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-sm text-gray-600">Диагональ</span>
          </label>

          <button
            onClick={handleStart}
            disabled={state.generating}
            className="w-full py-2.5 rounded-lg text-sm font-semibold bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white touch-manipulation"
          >
            {state.generating ? 'Генерация…' : 'Старт'}
          </button>
        </div>
      )}
    </div>
  );
}
