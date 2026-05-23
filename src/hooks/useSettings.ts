import { useState } from 'react';

export interface AppTheme {
  cellSelectedBg: string;
  cellSameVal: string;
  cellSameValText: string;
  cellSameValColor: string;
  cellPeer: string;
  cellPeerColor: string;
  cellDiagColor: string;
  cellSolvedBg: string;
  cellDiagBg: string;
  numDoneInactive: string;
  boardBorder: string;
  borderThickR: string;
  borderThickB: string;
  borderThinR: string;
  borderThinB: string;
  accent: string;
  accentHover: string;
  accentBorder: string;
  eraserActive: string;
  textMuted: string;
}

const defaultTheme: AppTheme = {
  cellSelectedBg: 'bg-blue-500',
  cellSameVal: 'bg-blue-100',
  cellSameValText: 'text-gray-800',
  cellSameValColor: '#dbeafe',
  cellPeer: 'bg-gray-100',
  cellPeerColor: '#f3f4f6',
  cellDiagColor: '#fffbeb',
  cellSolvedBg: 'bg-emerald-50',
  cellDiagBg: 'bg-amber-50',
  numDoneInactive: 'bg-emerald-50 text-emerald-600 border-emerald-300',
  boardBorder: 'border-2 border-gray-500',
  borderThickR: 'border-r-2 border-r-gray-500',
  borderThickB: 'border-b-2 border-b-gray-500',
  borderThinR: 'border-r border-r-gray-300',
  borderThinB: 'border-b border-b-gray-300',
  accent: 'bg-blue-500',
  accentHover: 'hover:bg-blue-600 active:bg-blue-700',
  accentBorder: 'border-blue-500',
  eraserActive: 'bg-gray-300 text-gray-700 border-gray-400',
  textMuted: 'text-gray-400',
};

const einkTheme: AppTheme = {
  cellSelectedBg: 'bg-gray-900',
  cellSameVal: 'bg-gray-900',
  cellSameValText: 'text-white',
  cellSameValColor: '#9ca3af',
  cellPeer: 'bg-gray-200',
  cellPeerColor: '#e5e7eb',
  cellDiagColor: '#fde68a',
  cellSolvedBg: 'bg-emerald-300',
  cellDiagBg: 'bg-amber-200',
  numDoneInactive: 'bg-emerald-400 text-emerald-600 border-emerald-300',
  boardBorder: 'border-2 border-gray-900',
  borderThickR: 'border-r-2 border-r-gray-800',
  borderThickB: 'border-b-2 border-b-gray-800',
  borderThinR: 'border-r border-r-gray-600',
  borderThinB: 'border-b border-b-gray-600',
  accent: 'bg-gray-900',
  accentHover: 'hover:bg-gray-800 active:bg-gray-700',
  accentBorder: 'border-gray-900',
  eraserActive: 'bg-gray-900 text-white border-gray-900',
  textMuted: 'text-gray-700',
};

export interface Settings {
  eink: boolean;
}

function loadBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? raw === 'true' : fallback;
  } catch {
    return fallback;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => ({
    eink: loadBool('settings.eink', false),
  }));

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(`settings.${key}`, String(value)); } catch {}
      return next;
    });
  }

  const theme = settings.eink ? einkTheme : defaultTheme;

  return { settings, set, theme };
}
