import { memo, CSSProperties, useMemo } from 'react';
import { GameState, Notes } from '../hooks/useGame';
import { AppTheme } from '../hooks/useSettings';
import { buildCandidates, buildCandidatesAdvanced, Candidates } from '../core/solver';

export type CandidateMode = 'none' | 'basic' | 'advanced';

interface Props {
  state: GameState;
  theme: AppTheme;
  onCellClick: (r: number, c: number) => void;
  candidateMode?: CandidateMode;
  notes: Notes;
}

function Board({ state, theme, onCellClick, candidateMode = 'none', notes }: Props) {
  const {
    current, errors, selectedCell, selectedNum,
    diagonal, hintPhase, hintTarget, hintConstraintCells, hintAltCells,
    status, flashCells, rollbackCell,
  } = state;

  const basicCandidates: Candidates | null = useMemo(
    () => candidateMode !== 'none' ? buildCandidates(current, diagonal) : null,
    [candidateMode, current, diagonal]
  );

  const advancedCandidates: Candidates | null = useMemo(
    () => candidateMode === 'advanced' ? buildCandidatesAdvanced(current, diagonal) : null,
    [candidateMode, current, diagonal]
  );

  function cellInfo(r: number, c: number): { className: string; style?: CSSProperties } {
    const val = current[r][c];
    const isSelected   = selectedCell?.[0] === r && selectedCell?.[1] === c;
    const isHintTarget = hintTarget?.[0] === r && hintTarget?.[1] === c;
    const isHintConstr = hintPhase === 2 && hintConstraintCells.some(([hr, hc]) => hr === r && hc === c);
    const isHintAlt    = hintPhase === 2 && hintAltCells.some(([hr, hc]) => hr === r && hc === c);
    const isError      = errors[r][c] === 1;
    const isSameVal    = selectedNum > 0 && val === selectedNum && val > 0 && !isSelected;
    const isFlash      = flashCells.some(([fr, fc]) => fr === r && fc === c);

    const peerRef = selectedCell ?? rollbackCell;
    const isPeer = (() => {
      if (!peerRef) return false;
      const [sr, sc] = peerRef;
      if (r === sr || c === sc) return true;
      if (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3)) return true;
      if (diagonal) {
        if (sr === sc && r === c) return true;
        if (sr + sc === 8 && r + c === 8) return true;
      }
      return false;
    })();

    const onDiag = diagonal && (r === c || r + c === 8);

    let bg = '';
    let style: CSSProperties | undefined;

    if (isFlash)                   bg = 'cell-flash';
    else if (status === 'solved')  bg = theme.cellSolvedBg;
    else if (isHintTarget)         bg = 'bg-amber-200';
    else if (isHintConstr && onDiag) {
      const angle = r === c ? '-135deg' : '135deg';
      style = { background: `linear-gradient(${angle}, ${theme.cellDiagColor} 35%, #f3e8ff 55%)` };
    }
    else if (isHintConstr)         bg = 'bg-purple-100';
    else if (isHintAlt && onDiag) {
      const angle = r === c ? '-135deg' : '135deg';
      style = { background: `linear-gradient(${angle}, ${theme.cellDiagColor} 35%, #f0f9ff 55%)` };
    }
    else if (isHintAlt)            bg = 'bg-sky-50';
    else if (isSelected)           bg = theme.cellSelectedBg;
    else if (isError)              bg = 'bg-red-50';
    else if (isSameVal && onDiag) {
      const angle = r === c ? '-135deg' : '135deg';
      style = { background: `linear-gradient(${angle}, ${theme.cellDiagColor} 35%, ${theme.cellSameValColor} 55%)` };
    }
    else if (isSameVal)            bg = theme.cellSameVal;

    else if (isPeer)               bg = theme.cellPeer;
    else if (onDiag)               bg = theme.cellDiagBg;
    else                           bg = 'bg-white';

    let text = '';
    if (isFlash)              text = 'text-emerald-800';
    else if (status === 'solved') text = 'text-emerald-700';
    else if (isHintTarget)    text = 'text-amber-800';
    else if (isHintConstr)    text = 'text-purple-700';
    else if (isHintAlt)       text = 'text-sky-600';
    else if (isSelected)      text = 'text-white';
    else if (isError)         text = 'text-red-500';
    else if (isSameVal)       text = theme.cellSameValText;
    else                      text = 'text-gray-800';

    return {
      className: `flex items-center justify-center w-full h-full select-none cursor-pointer transition-colors text-xl font-semibold ${bg} ${text}`,
      style,
    };
  }

  function borderClass(r: number, c: number): string {
    const rB = c === 2 || c === 5 ? theme.borderThickR : c < 8 ? theme.borderThinR : '';
    const bB = r === 2 || r === 5 ? theme.borderThickB : r < 8 ? theme.borderThinB : '';
    return `${rB} ${bB}`;
  }

  return (
    <div
      className={`grid w-full ${theme.boardBorder} rounded-sm overflow-hidden shadow-md`}
      style={{ gridTemplateColumns: 'repeat(9, 1fr)' }}
    >
      {Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => {
          const val = current[r][c];
          const cell = cellInfo(r, c);
          return (
            <div
              key={`${r}-${c}`}
              className={`relative aspect-square ${borderClass(r, c)}`}
              onClick={() => onCellClick(r, c)}
              style={{ touchAction: 'manipulation' }}
            >
              <div className={cell.className} style={cell.style}>
                {val > 0
                  ? val
                  : basicCandidates
                    ? (
                      <div className="flex flex-wrap content-start justify-end w-full h-full p-[2px]">
                        {[1,2,3,4,5,6,7,8,9].filter(d => basicCandidates[r][c][d - 1]).map(d => {
                          const inAdvanced = advancedCandidates ? advancedCandidates[r][c][d - 1] : true;
                          const eliminated = !inAdvanced;
                          const highlighted = selectedNum === d;
                          return (
                            <span
                              key={d}
                              style={{ width: '25%' }}
                              className={`text-center text-[11px] leading-[1.2] font-medium ${highlighted ? 'bg-blue-100 rounded-sm text-blue-700' : eliminated ? 'text-red-400' : 'text-gray-500'}`}
                            >{d}</span>
                          );
                        })}
                      </div>
                    )
                    : notes[r][c].some(Boolean)
                      ? (
                        <div className="flex flex-wrap content-start justify-end w-full h-full p-[2px]">
                          {[1,2,3,4,5,6,7,8,9].filter(d => notes[r][c][d - 1]).map(d => (
                            <span
                              key={d}
                              style={{ width: '25%' }}
                              className={`text-center text-[11px] leading-[1.2] font-medium ${selectedNum === d ? 'text-blue-600' : 'text-gray-400'}`}
                            >{d}</span>
                          ))}
                        </div>
                      )
                      : ''
                }
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default memo(Board);
