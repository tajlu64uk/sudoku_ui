import { useState, useMemo, useCallback } from 'react';
import { GameState, formatTimer } from '../hooks/useGame';
import { Difficulty } from '../core/generator';
import { countNum, countLogical } from '../core/solver';
import { AppTheme } from '../hooks/useSettings';
import { CandidateMode } from './Board';

interface Props {
  state: GameState;
  theme: AppTheme;
  timer: number;
  onSelectNum: (n: number) => void;
  onNewGame: (d: Difficulty, diagonal: boolean) => void;
  onHint: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRollbackToError: () => void;
  getShareUrl: () => string;
  candidateMode: CandidateMode;
  onSetCandidateMode: (mode: CandidateMode) => void;
  notesMode: boolean;
  onToggleNotesMode: () => void;
}

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: 'easy', label: 'Лёгкий' },
  { key: 'medium', label: 'Средний' },
  { key: 'hard', label: 'Сложный' },
];

const HINT_LABELS = ['Подсказка', 'Продолжить', 'Заполнить'];
const HINT_MSG_PHASE1 = 'Найдена клетка для заполнения';
const HINT_METHOD_MSGS: Record<number, string> = {
  1: 'Единственная цифра, подходящая в эту клетку',
  2: 'Единственная позиция для цифры в квадрате',
  3: 'Единственная позиция для цифры в строке',
  4: 'Единственная позиция для цифры в столбце',
  5: 'Единственная позиция для цифры на диагонали',
};

export default function Controls({ state, theme, timer, onSelectNum, onNewGame, onHint, onUndo, onRedo, onRollbackToError, getShareUrl, candidateMode, onSetCandidateMode, notesMode, onToggleNotesMode }: Props) {
  const [showNewGame, setShowNewGame] = useState(false);
  const [pendingDiff, setPendingDiff] = useState<Difficulty>(state.difficulty);
  const [pendingDiag, setPendingDiag] = useState(state.diagonal);
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Ссылка для шаринга:', url);
    }
  }, [getShareUrl]);

  const handleStart = () => {
    setShowNewGame(false);
    onNewGame(pendingDiff, pendingDiag);
  };

  const logicalCount = useMemo(() => {
    if (state.status === 'idle') return null;
    const base = countLogical(state.current, state.diagonal, false);
    const adv = countLogical(state.current, state.diagonal, true);
    return { base, adv };
  }, [state.current, state.status, state.diagonal]);

  const canUndo = state.history.length > 0 && state.status === 'playing';
  const canRedo = state.future.length > 0;
  const hintLabel = HINT_LABELS[state.hintPhase];
  const hintMsg = state.hintPhase === 1
    ? HINT_MSG_PHASE1
    : state.hintPhase === 2
      ? (HINT_METHOD_MSGS[state.hintMethod] ?? 'Видите, что мешает другим вариантам?')
      : null;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Timer + status */}
      <div className="flex md:flex-col items-center justify-between md:justify-start gap-2">
        <div>
          <div className="text-2xl md:text-3xl font-mono text-gray-700 tracking-widest">
            {formatTimer(timer)}
          </div>
          {logicalCount && (
            <div className={`text-xs font-mono ${theme.textMuted} text-center`}>
              {logicalCount.base} ({logicalCount.adv})
            </div>
          )}
        </div>
        <div className="text-right md:text-center">
          {state.status === 'solved' && (
            <div className="text-sm text-emerald-600 font-semibold">Решено!</div>
          )}
          {state.status === 'playing' && (
            <div className={`text-xs ${theme.textMuted}`}>
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
                : theme.numDoneInactive;
            else if (active)
              cls = `${theme.accent} text-white ${theme.accentBorder} shadow-sm`;
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
                ? theme.eraserActive
                : `bg-white ${theme.textMuted} border-gray-300 active:bg-gray-100`
            }`}
          >
            ✕
          </button>
        </div>
        <button
          onClick={() => onSelectNum(0)}
          className={`hidden md:block mt-1.5 w-full h-10 rounded-lg text-sm font-medium border transition-colors ${
            state.selectedNum === 0
              ? theme.eraserActive
              : `bg-white ${theme.textMuted} border-gray-300 hover:bg-gray-50`
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
          <div className="flex gap-1.5">
            <button
              onClick={onHint}
              disabled={state.status !== 'playing'}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed ${
                state.hintPhase > 0
                  ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 active:bg-gray-100'
              }`}
            >
              {hintLabel}
            </button>
            <button
              onClick={onRollbackToError}
              disabled={state.status !== 'playing'}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors text-gray-600 touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Найти ошибку
            </button>
          </div>
          {hintMsg && (
            <p className="mt-1 text-xs text-amber-600 text-center">{hintMsg}</p>
          )}
          {state.noErrorsNotice && (
            <p className="mt-1 text-xs text-emerald-600 text-center">Ошибок не найдено</p>
          )}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={onToggleNotesMode}
            disabled={state.status !== 'playing'}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed ${
              notesMode
                ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 active:bg-gray-100'
            }`}
          >
            Пометки
          </button>
          <button
            onClick={() => onSetCandidateMode(candidateMode === 'basic' ? 'none' : 'basic')}
            disabled={state.status !== 'playing'}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed ${
              candidateMode === 'basic'
                ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 active:bg-gray-100'
            }`}
          >
            Варианты
          </button>
          <button
            onClick={() => onSetCandidateMode(candidateMode === 'advanced' ? 'none' : 'advanced')}
            disabled={state.status !== 'playing'}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed ${
              candidateMode === 'advanced'
                ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 active:bg-gray-100'
            }`}
          >
            Расш.
          </button>
        </div>
        {state.status !== 'idle' && (
          <button
            onClick={handleShare}
            className="py-2.5 rounded-lg text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation text-gray-600"
          >
            {copied ? 'Скопировано!' : 'Поделиться'}
          </button>
        )}
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
            <p className={`text-xs ${theme.textMuted} mb-2 uppercase tracking-wider font-medium`}>Сложность</p>
            <div className="flex md:flex-col gap-1.5 md:gap-1">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.key}
                  onClick={() => setPendingDiff(d.key)}
                  className={`flex-1 md:flex-none py-1.5 rounded-lg text-sm font-medium border transition-colors touch-manipulation ${
                    pendingDiff === d.key
                      ? `${theme.accent} text-white ${theme.accentBorder}`
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
                pendingDiag ? theme.accent : 'bg-gray-300'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${pendingDiag ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-sm text-gray-600">Диагональ</span>
          </label>

          <button
            onClick={handleStart}
            disabled={state.generating}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold ${theme.accent} ${theme.accentHover} disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white touch-manipulation`}
          >
            {state.generating ? 'Генерация…' : 'Старт'}
          </button>
        </div>
      )}
    </div>
  );
}
