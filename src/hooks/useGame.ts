import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  Grid, cloneGrid, hasConflict, nextLogicalMoveRandom, countNum, getConstrainingCells, solvePuzzle,
} from '../core/solver';
import { generatePuzzle, Difficulty, GenerateResult, ProgressInfo } from '../core/generator';
import { readShareParam, decodeShare, clearShareParam } from '../utils/share';

export type GameStatus = 'idle' | 'playing' | 'solved';

interface Snapshot { current: Grid; errors: Grid; }

export interface GameState {
  puzzle: Grid;
  current: Grid;
  selectedCell: [number, number] | null;
  selectedNum: number;
  diagonal: boolean;
  difficulty: Difficulty;
  status: GameStatus;
  errors: Grid;
  // multi-step hint
  hintPhase: 0 | 1 | 2;
  hintTarget: [number, number] | null;
  hintValue: number;
  hintConstraintCells: [number, number][];
  // undo / redo
  history: Snapshot[];
  future: Snapshot[];
  // transient flash after completing a region/digit
  flashCells: [number, number][];
  generating: boolean;
  generationProgress: ProgressInfo | null;
  noErrorsNotice: boolean;
  rollbackCell: [number, number] | null;
  puzzleWarning: string | null;
}

type Action =
  | { type: 'NEW_GAME'; result: GenerateResult; difficulty: Difficulty; diagonal: boolean }
  | { type: 'SELECT_CELL'; row: number; col: number }
  | { type: 'SELECT_NUM'; num: number }
  | { type: 'ENTER_VALUE'; row: number; col: number; val: number }
  | { type: 'HINT' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR_FLASH' }
  | { type: 'SET_GENERATING'; value: boolean }
  | { type: 'SET_PROGRESS'; info: ProgressInfo }
  | { type: 'ROLLBACK_TO_ERROR' }
  | { type: 'CLEAR_NO_ERRORS_NOTICE' }
  | { type: 'DISMISS_PUZZLE_WARNING' };

const EMPTY_GRID: Grid = Array.from({ length: 9 }, () => Array(9).fill(0));

const MAX_HISTORY = 100;

const initialState: GameState = {
  puzzle: EMPTY_GRID,
  current: EMPTY_GRID,
  selectedCell: null,
  selectedNum: 1,
  diagonal: false,
  difficulty: 'easy',
  status: 'idle',
  errors: EMPTY_GRID,
  hintPhase: 0,
  hintTarget: null,
  hintValue: 0,
  hintConstraintCells: [],
  history: [],
  future: [],
  flashCells: [],
  generating: false,
  generationProgress: null,
  noErrorsNotice: false,
  rollbackCell: null,
  puzzleWarning: null,
};

function isSolved(current: Grid, diagonal: boolean): boolean {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      if (current[r][c] === 0) return false;
      if (hasConflict(current, r, c, current[r][c], diagonal)) return false;
    }
  return true;
}

function gridsEqual(a: Grid, b: Grid): boolean {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (a[r][c] !== b[r][c]) return false;
  return true;
}

function bs(r: number, c: number): [number, number] {
  return [Math.floor(r / 3) * 3, Math.floor(c / 3) * 3];
}

function computeFlash(r: number, c: number, val: number, current: Grid, diagonal: boolean): [number, number][] {
  const set = new Set<string>();
  const mark = (rr: number, cc: number) => set.add(`${rr},${cc}`);

  if (current[r].every(v => v > 0))
    for (let cc = 0; cc < 9; cc++) mark(r, cc);

  if (current.every(row => row[c] > 0))
    for (let rr = 0; rr < 9; rr++) mark(rr, c);

  const [r0, c0] = bs(r, c);
  let boxOk = true;
  for (let rr = r0; rr < r0 + 3 && boxOk; rr++)
    for (let cc = c0; cc < c0 + 3 && boxOk; cc++)
      if (current[rr][cc] === 0) boxOk = false;
  if (boxOk)
    for (let rr = r0; rr < r0 + 3; rr++)
      for (let cc = c0; cc < c0 + 3; cc++) mark(rr, cc);

  if (diagonal) {
    if (r === c && current.every((row, k) => row[k] > 0))
      for (let k = 0; k < 9; k++) mark(k, k);
    if (r + c === 8) {
      let ok = true;
      for (let k = 0; k < 9; k++) if (current[k][8 - k] === 0) { ok = false; break; }
      if (ok) for (let k = 0; k < 9; k++) mark(k, 8 - k);
    }
  }

  if (val > 0 && countNum(val, current) === 9)
    for (let rr = 0; rr < 9; rr++)
      for (let cc = 0; cc < 9; cc++)
        if (current[rr][cc] === val) mark(rr, cc);

  return Array.from(set).map(s => s.split(',').map(Number) as [number, number]);
}

const HINT_RESET = {
  hintPhase: 0 as const,
  hintTarget: null,
  hintValue: 0,
  hintConstraintCells: [] as [number, number][],
};

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_GENERATING':
      return { ...state, generating: action.value, generationProgress: action.value ? state.generationProgress : null };

    case 'SET_PROGRESS':
      return { ...state, generationProgress: action.info };

    case 'NEW_GAME': {
      const { puzzle } = action.result;
      const current = cloneGrid(puzzle);
      const newState: GameState = {
        ...initialState,
        puzzle,
        current,
        difficulty: action.difficulty,
        diagonal: action.diagonal,
        selectedNum: 1,
        status: 'playing',
        generating: false,
      };
      persist(newState);
      return newState;
    }

    case 'SELECT_CELL': {
      const { row, col } = action;
      if (state.puzzle[row][col] > 0) return state; // given cell — ignore
      if (state.status === 'playing') {
        if (state.selectedNum > 0)
          return reducer(state, { type: 'ENTER_VALUE', row, col, val: state.selectedNum });
        return reducer(state, { type: 'ENTER_VALUE', row, col, val: 0 });
      }
      return { ...state, selectedCell: [row, col] };
    }

    case 'SELECT_NUM': {
      const { num } = action;
      if (state.selectedCell && state.status === 'playing') {
        const [r, c] = state.selectedCell;
        if (state.puzzle[r][c] === 0)
          return reducer({ ...state, selectedNum: num, ...HINT_RESET }, { type: 'ENTER_VALUE', row: r, col: c, val: num });
      }
      return { ...state, selectedNum: num, ...HINT_RESET };
    }

    case 'ENTER_VALUE': {
      if (state.status !== 'playing') return state;
      const { row, col } = action;
      let { val } = action;
      if (state.puzzle[row][col] !== 0) return state;

      if (val > 0 && state.current[row][col] === val) val = 0;

      const current = cloneGrid(state.current);
      current[row][col] = val;
      const errors = cloneGrid(state.errors);
      errors[row][col] = val > 0 && hasConflict(current, row, col, val, state.diagonal) ? 1 : 0;

      const prevSnap = state.history[state.history.length - 1];
      const history = prevSnap && gridsEqual(current, prevSnap.current)
        ? state.history.slice(0, -1)
        : [...state.history, { current: state.current, errors: state.errors }].slice(-MAX_HISTORY);

      const flashCells = val > 0 ? computeFlash(row, col, val, current, state.diagonal) : [];
      const solved = val > 0 && isSolved(current, state.diagonal);

      const newState: GameState = {
        ...state,
        current,
        errors,
        history,
        future: [],
        ...HINT_RESET,
        flashCells,
        rollbackCell: null,
        status: solved ? 'solved' : 'playing',
      };
      persist(newState);
      return newState;
    }

    case 'HINT': {
      if (state.status !== 'playing') return state;

      if (state.hintPhase === 0) {
        const move = nextLogicalMoveRandom(state.current, state.diagonal, false);
        if (!move) return state;
        return {
          ...state,
          hintPhase: 1,
          hintTarget: [move.row, move.col],
          hintValue: move.val,
          hintConstraintCells: getConstrainingCells(move.row, move.col, state.current, state.diagonal),
        };
      }

      if (state.hintPhase === 1) {
        return { ...state, hintPhase: 2 };
      }

      // phase 2 → fill
      const { hintTarget, hintValue } = state;
      if (!hintTarget || !hintValue) return state;
      const [r, c] = hintTarget;
      const snap: Snapshot = { current: state.current, errors: state.errors };
      const history = [...state.history, snap].slice(-MAX_HISTORY);
      const current = cloneGrid(state.current);
      current[r][c] = hintValue;
      const errors = cloneGrid(state.errors);
      errors[r][c] = 0;
      const flashCells = computeFlash(r, c, hintValue, current, state.diagonal);
      const solved = isSolved(current, state.diagonal);
      const newState: GameState = {
        ...state,
        current,
        errors,
        history,
        future: [],
        ...HINT_RESET,
        flashCells,
        rollbackCell: null,
        status: solved ? 'solved' : 'playing',
      };
      persist(newState);
      return newState;
    }

    case 'UNDO': {
      if (state.history.length === 0) return state;
      const prev = state.history[state.history.length - 1];
      const future = [{ current: state.current, errors: state.errors }, ...state.future].slice(0, MAX_HISTORY);
      const newState: GameState = {
        ...state,
        current: prev.current,
        errors: prev.errors,
        history: state.history.slice(0, -1),
        future,
        ...HINT_RESET,
        flashCells: [],
        rollbackCell: null,
        status: 'playing',
      };
      persist(newState);
      return newState;
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const history = [...state.history, { current: state.current, errors: state.errors }].slice(-MAX_HISTORY);
      const newState: GameState = {
        ...state,
        current: next.current,
        errors: next.errors,
        history,
        future: state.future.slice(1),
        ...HINT_RESET,
        flashCells: [],
        rollbackCell: null,
      };
      persist(newState);
      return newState;
    }

    case 'CLEAR_FLASH':
      return { ...state, flashCells: [] };

    case 'CLEAR_NO_ERRORS_NOTICE':
      return { ...state, noErrorsNotice: false };

    case 'DISMISS_PUZZLE_WARNING':
      return { ...state, puzzleWarning: null };

    case 'ROLLBACK_TO_ERROR': {
      if (state.status !== 'playing') return state;
      const solution = solvePuzzle(state.puzzle, state.diagonal);
      if (!solution) return state;

      // allStates[0] = initial puzzle (before any moves)
      // allStates[k] = grid after k-th user move
      const allStates: Grid[] = [...state.history.map(s => s.current), state.current];

      let wrongIndex = -1;
      outer: for (let k = 1; k < allStates.length; k++) {
        for (let r = 0; r < 9; r++) {
          for (let c = 0; c < 9; c++) {
            if (state.puzzle[r][c] !== 0) continue;
            const v = allStates[k][r][c];
            if (v !== 0 && v !== solution[r][c]) { wrongIndex = k; break outer; }
          }
        }
      }

      if (wrongIndex === -1) return { ...state, noErrorsNotice: true };

      const wrongGrid = cloneGrid(allStates[wrongIndex]);
      const wrongErrors: Grid = Array.from({ length: 9 }, () => Array(9).fill(0));
      let wrongCell: [number, number] | null = null;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (state.puzzle[r][c] === 0 && wrongGrid[r][c] !== 0 && wrongGrid[r][c] !== solution[r][c]) {
            wrongErrors[r][c] = 1;
            if (!wrongCell) wrongCell = [r, c];
          }
        }
      }

      const newState: GameState = {
        ...state,
        current: wrongGrid,
        errors: wrongErrors,
        history: state.history.slice(0, wrongIndex),
        future: [],
        ...HINT_RESET,
        flashCells: [],
        noErrorsNotice: false,
        rollbackCell: wrongCell,
        selectedCell: null,
        selectedNum: 0,
      };
      persist(newState);
      return newState;
    }

    default:
      return state;
  }
}

// ── localStorage ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sudoku_state';
const TIMER_KEY   = 'sudoku_timer';

function loadTimer(): number {
  try {
    const v = localStorage.getItem(TIMER_KEY);
    if (v !== null) return Number(v) || 0;
    // migrate from old format where timer lived inside game state
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw).timer ?? 0) : 0;
  } catch { return 0; }
}

function saveTimer(t: number) {
  try { localStorage.setItem(TIMER_KEY, String(t)); } catch { /* quota */ }
}

function persist(state: GameState) {
  try {
    const { generating, flashCells, hintConstraintCells, noErrorsNotice, rollbackCell, puzzleWarning, ...rest } = state;
    void generating; void flashCells; void hintConstraintCells; void noErrorsNotice; void rollbackCell; void puzzleWarning;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch { /* quota exceeded */ }
}

function loadPersistedState(): Partial<GameState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<GameState>;
  } catch { return null; }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function buildInitialState(): GameState {
  const paramStr = readShareParam();
  if (paramStr) {
    clearShareParam();
    const shared = decodeShare(paramStr);
    if (shared) {
      const state: GameState = {
        ...initialState,
        puzzle: shared.puzzle,
        current: cloneGrid(shared.puzzle),
        difficulty: shared.difficulty,
        diagonal: shared.diagonal,
        status: 'playing',
        selectedNum: 1,
        puzzleWarning: shared.solvableLogically === false
          ? 'Этот судоку не решается логически — возможно, потребуется перебор'
          : null,
      };
      persist(state);
      return state;
    }
  }
  const saved = loadPersistedState();
  return {
    ...initialState,
    ...(saved ?? {}),
    hintPhase: 0,
    hintTarget: null,
    hintValue: 0,
    hintConstraintCells: [],
    history: saved?.history ?? [],
    future: saved?.future ?? [],
    flashCells: [],
    generating: false,
    generationProgress: null,
    noErrorsNotice: false,
    rollbackCell: null,
    status: saved?.status === 'playing' ? 'playing' : saved?.status === 'solved' ? 'solved' : 'idle',
  };
}

export function useGame() {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);
  const [timer, setTimer] = useState(loadTimer);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.status === 'playing') {
      timerRef.current = setInterval(() => {
        setTimer((t: number) => { const next = t + 1; saveTimer(next); return next; });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.status]);

  // Auto-clear flash after 750ms
  useEffect(() => {
    if (state.flashCells.length > 0) {
      const t = setTimeout(() => dispatch({ type: 'CLEAR_FLASH' }), 750);
      return () => clearTimeout(t);
    }
  }, [state.flashCells]);

  // Auto-clear "no errors" notice after 2.5s
  useEffect(() => {
    if (state.noErrorsNotice) {
      const t = setTimeout(() => dispatch({ type: 'CLEAR_NO_ERRORS_NOTICE' }), 2500);
      return () => clearTimeout(t);
    }
  }, [state.noErrorsNotice]);

  const startNewGame = useCallback((difficulty: Difficulty, diagonal: boolean) => {
    dispatch({ type: 'SET_GENERATING', value: true });
    generatePuzzle({ difficulty, diagonal }, (info) => {
      dispatch({ type: 'SET_PROGRESS', info });
    }).then(result => {
      setTimer(0);
      saveTimer(0);
      dispatch({ type: 'NEW_GAME', result, difficulty, diagonal });
    });
  }, []);

  const selectCell           = useCallback((row: number, col: number) => dispatch({ type: 'SELECT_CELL', row, col }), []);
  const selectNum            = useCallback((num: number) => dispatch({ type: 'SELECT_NUM', num }), []);
  const hint                 = useCallback(() => dispatch({ type: 'HINT' }), []);
  const undo                 = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo                 = useCallback(() => dispatch({ type: 'REDO' }), []);
  const rollbackToError      = useCallback(() => dispatch({ type: 'ROLLBACK_TO_ERROR' }), []);
  const dismissPuzzleWarning = useCallback(() => dispatch({ type: 'DISMISS_PUZZLE_WARNING' }), []);

  return { state, timer, startNewGame, selectCell, selectNum, hint, undo, redo, rollbackToError, dismissPuzzleWarning };
}

export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
