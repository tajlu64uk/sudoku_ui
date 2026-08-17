import { Grid, solveLogically } from '../core/solver';
import { Difficulty } from '../core/generator';

const PARAM = 's';
const PLAIN_PARAM = 'p';

export interface SharedState {
  puzzle: Grid;
  difficulty: Difficulty;
  diagonal: boolean;
  solvableLogically?: boolean;
}

// 64-char alphabet. Token mapping:
//   0       — unused/skip
//   1-9     — cell value
//   10-63   — zero run of length (token - 9), i.e. 1..54 zeros
// Last char encodes meta: bits 5-4 = diffIdx, bit 3 = diagonal.
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

function encodeGrid(grid: Grid): string {
  const flat = grid.flat();
  const out: string[] = [];
  let i = 0;
  while (i < 81) {
    if (flat[i] !== 0) {
      out.push(ALPHA[flat[i]]);
      i++;
    } else {
      let run = 0;
      while (i < 81 && flat[i] === 0) {
        run++;
        i++;
        if (run === 54) { out.push(ALPHA[63]); run = 0; }
      }
      if (run > 0) out.push(ALPHA[9 + run]);
    }
  }
  return out.join('');
}

function decodeGrid(s: string): Grid {
  const flat: number[] = [];
  for (const c of s) {
    if (flat.length >= 81) break;
    const t = ALPHA.indexOf(c);
    if (t >= 1 && t <= 9) {
      flat.push(t);
    } else if (t >= 10) {
      const run = t - 9;
      for (let j = 0; j < run && flat.length < 81; j++) flat.push(0);
    }
  }
  while (flat.length < 81) flat.push(0);
  const grid: Grid = [];
  for (let r = 0; r < 9; r++) grid.push(flat.slice(r * 9, r * 9 + 9));
  return grid;
}

// Legacy nibble helpers — kept only for backward-compat decoding of old 56-char URLs.
function nibblesToGrid(bytes: Uint8Array, offset: number): Grid {
  const flat: number[] = [];
  for (let i = 0; i < 41 && flat.length < 81; i++) {
    flat.push(bytes[offset + i] >> 4);
    if (flat.length < 81) flat.push(bytes[offset + i] & 0x0f);
  }
  const grid: Grid = [];
  for (let r = 0; r < 9; r++) grid.push(flat.slice(r * 9, r * 9 + 9));
  return grid;
}

function fromBase64url(s: string): Uint8Array {
  const pad = (4 - (s.length % 4)) % 4;
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

export function encodeShare(state: SharedState): string {
  const diffIdx = DIFFICULTIES.indexOf(state.difficulty);
  const meta = ((diffIdx & 0x3) << 4) | (state.diagonal ? 0x8 : 0);
  return encodeGrid(state.puzzle) + ALPHA[meta];
}

function decodePlainGrid(s: string): Grid {
  const flat = s.split('').map(Number);
  const grid: Grid = [];
  for (let r = 0; r < 9; r++) grid.push(flat.slice(r * 9, r * 9 + 9));
  return grid;
}

export function decodeShare(encoded: string): SharedState | null {
  try {
    if (encoded.length < 2) return null;

    // Plain 81-digit format: no difficulty/diagonal info
    if (/^\d{81}$/.test(encoded)) {
      const puzzle = decodePlainGrid(encoded);
      return {
        puzzle,
        difficulty: 'easy',
        diagonal: false,
        solvableLogically: solveLogically(puzzle, false, true),
      };
    }

    // Backward compat: old nibble format was always exactly 56 chars.
    if (encoded.length === 56) {
      const bytes = fromBase64url(encoded);
      if (bytes.length >= 42) {
        const meta = bytes[41];
        const diffIdx = (meta >> 6) & 0x3;
        if (diffIdx <= 2) {
          return {
            puzzle: nibblesToGrid(bytes, 0),
            difficulty: DIFFICULTIES[diffIdx],
            diagonal: (meta & 0x20) !== 0,
          };
        }
      }
    }

    // New RLE format: last char is meta.
    const metaIdx = ALPHA.indexOf(encoded[encoded.length - 1]);
    if (metaIdx < 0) return null;
    const diffIdx = (metaIdx >> 4) & 0x3;
    if (diffIdx > 2) return null;
    return {
      puzzle: decodeGrid(encoded.slice(0, -1)),
      difficulty: DIFFICULTIES[diffIdx],
      diagonal: (metaIdx & 0x8) !== 0,
    };
  } catch {
    return null;
  }
}

const WEB_BASE = 'https://tr.spb.ru/sudoku/';

export function buildShareUrl(state: SharedState): string {
  const base = window.location.protocol === 'capacitor:' ? WEB_BASE : window.location.href;
  const url = new URL(base);
  url.search = '';
  url.searchParams.set(PARAM, encodeShare(state));
  return url.toString();
}

export function readShareParam(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get(PLAIN_PARAM) ?? params.get(PARAM);
}

export function clearShareParam(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(PARAM);
  url.searchParams.delete(PLAIN_PARAM);
  window.history.replaceState(null, '', url.toString());
}
