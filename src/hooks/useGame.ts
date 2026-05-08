import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  Grid, cloneGrid, hasConflict, nextLogicalMoveRandom, countNum, getConstrainingCells,
} from '../core/solver';
import { generatePuzzle, Difficulty, GenerateResult } from '../core/generator';

export type GameStatus = 'idle' | 'playing' | 'solved';

interface Snapshot { current: Grid; errors: Grid; }

export interface GameState {
  puzzle: Grid;
  solution: Grid;
  current: Grid;
  selectedCell: [number, number] | null;
  selectedNum: number;
  diagonal: boolean;
  difficulty: Difficulty;
  status: GameStatus;
  timer: number;
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
  | { type: 'TICK' }
  | { type: 'SET_GENERATING'; value: boolean };

const EMPTY_GRID: Grid = Array.from({ length: 9 }, () => Array(9).fill(0));
const MAX_HISTORY = 100;

const initialState: GameState = {
  puzzle: EMPTY_GRID,
  solution: EMPTY_GRID,
  current: EMPTY_GRID,
  selectedCell: null,
  selectedNum: 1,
  diagonal: false,
  difficulty: 'easy',
  status: 'idle',
  timer: 0,
  errors: EMPTY_GRID,
  hintPhase: 0,
  hintTarget: null,
  hintValue: 0,
  hintConstraintCells: [],
  history: [],
  future: [],
  flashCells: [],
  generating: false,
};

function isSolved(current: Grid, solution: Grid): boolean {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (current[r][c] !== solution[r][c]) return false;
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
      return { ...state, generating: action.value };

    case 'NEW_GAME': {
      const { puzzle, solution } = action.result;
      const current = cloneGrid(puzzle);
      const newState: GameState = {
        ...initialState,
        puzzle,
        solution,
        current,
        difficulty: action.difficulty,
        diagonal: action.diagonal,
        selectedNum: state.selectedNum,
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

      const snap: Snapshot = { current: state.current, errors: state.errors };
      const history = [...state.history, snap].slice(-MAX_HISTORY);

      const current = cloneGrid(state.current);
      current[row][col] = val;
      const errors = cloneGrid(state.errors);
      errors[row][col] = val > 0 && hasConflict(current, row, col, val, state.diagonal) ? 1 : 0;

      const flashCells = val > 0 ? computeFlash(row, col, val, current, state.diagonal) : [];
      const solved = val > 0 && isSolved(current, state.solution);

      const newState: GameState = {
        ...state,
        current,
        errors,
        history,
        future: [],
        ...HINT_RESET,
        flashCells,
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
      const solved = isSolved(current, state.solution);
      const newState: GameState = {
        ...state,
        current,
        errors,
        history,
        future: [],
        ...HINT_RESET,
        flashCells,
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
      };
      persist(newState);
      return newState;
    }

    case 'CLEAR_FLASH':
      return { ...state, flashCells: [] };

    case 'TICK':
      if (state.status !== 'playing') return state;
      return { ...state, timer: state.timer + 1 };

    default:
      return state;
  }
}

// ── localStorage ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sudoku_state';

function persist(state: GameState) {
  try {
    const { generating, flashCells, hintConstraintCells, ...rest } = state;
    void generating; void flashCells; void hintConstraintCells;
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

export function useGame() {
  const saved = loadPersistedState();
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    ...(saved ?? {}),
    hintPhase: 0,
    hintTarget: null,
    hintValue: 0,
    hintConstraintCells: [],
    history: (saved as any)?.history ?? [],
    future: (saved as any)?.future ?? [],
    flashCells: [],
    generating: false,
    status: saved?.status === 'playing' ? 'playing' : saved?.status === 'solved' ? 'solved' : 'idle',
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.status === 'playing') {
      timerRef.current = setInterval(() => dispatch({ type: 'TICK' }), 1000);
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

  const startNewGame = useCallback((difficulty: Difficulty, diagonal: boolean) => {
    dispatch({ type: 'SET_GENERATING', value: true });
    setTimeout(() => {
      const result = generatePuzzle({ difficulty, diagonal });
      dispatch({ type: 'NEW_GAME', result, difficulty, diagonal });
    }, 30);
  }, []);

  const selectCell  = useCallback((row: number, col: number) => dispatch({ type: 'SELECT_CELL', row, col }), []);
  const selectNum   = useCallback((num: number) => dispatch({ type: 'SELECT_NUM', num }), []);
  const hint        = useCallback(() => dispatch({ type: 'HINT' }), []);
  const undo        = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo        = useCallback(() => dispatch({ type: 'REDO' }), []);

  return { state, startNewGame, selectCell, selectNum, hint, undo, redo };
}

export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
