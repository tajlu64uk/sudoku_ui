import { GameState } from '../hooks/useGame';

interface Props {
  state: GameState;
  onCellClick: (r: number, c: number) => void;
}

export default function Board({ state, onCellClick }: Props) {
  const {
    current, errors, selectedCell, selectedNum,
    diagonal, hintPhase, hintTarget, hintConstraintCells,
    status, flashCells,
  } = state;

  function cellClass(r: number, c: number): string {
    const val = current[r][c];
    const isSelected   = selectedCell?.[0] === r && selectedCell?.[1] === c;
    const isHintTarget = hintTarget?.[0] === r && hintTarget?.[1] === c;
    const isHintConstr = hintPhase === 2 && hintConstraintCells.some(([hr, hc]) => hr === r && hc === c);
    const isError      = errors[r][c] === 1;
    const isSameVal    = selectedNum > 0 && val === selectedNum && val > 0 && !isSelected;
    const isFlash      = flashCells.some(([fr, fc]) => fr === r && fc === c);

    const isPeer = (() => {
      if (!selectedCell) return false;
      const [sr, sc] = selectedCell;
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
    if (isFlash)              bg = 'cell-flash';
    else if (status === 'solved') bg = 'bg-emerald-50';
    else if (isHintTarget)    bg = 'bg-amber-200';
    else if (isHintConstr)    bg = 'bg-purple-100';
    else if (isSelected)      bg = 'bg-blue-500';
    else if (isError)         bg = 'bg-red-50';
    else if (isSameVal)       bg = 'bg-blue-100';
    else if (isPeer)          bg = 'bg-gray-100';
    else if (onDiag)          bg = 'bg-amber-50';
    else                      bg = 'bg-white';

    let text = '';
    if (isFlash)              text = 'text-emerald-800';
    else if (status === 'solved') text = 'text-emerald-700';
    else if (isHintTarget)    text = 'text-amber-800';
    else if (isHintConstr)    text = 'text-purple-700';
    else if (isSelected)      text = 'text-white';
    else if (isError)         text = 'text-red-500';
    else                      text = 'text-gray-800';

    return `flex items-center justify-center w-full h-full select-none cursor-pointer transition-colors text-xl font-semibold ${bg} ${text}`;
  }

  function borderClass(r: number, c: number): string {
    const rB = c === 2 || c === 5 ? 'border-r-2 border-r-gray-500' : c < 8 ? 'border-r border-r-gray-300' : '';
    const bB = r === 2 || r === 5 ? 'border-b-2 border-b-gray-500' : r < 8 ? 'border-b border-b-gray-300' : '';
    return `${rB} ${bB}`;
  }

  return (
    <div
      className="grid w-full border-2 border-gray-500 rounded-sm overflow-hidden shadow-md"
      style={{ gridTemplateColumns: 'repeat(9, 1fr)' }}
    >
      {Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => {
          const val = current[r][c];
          return (
            <div
              key={`${r}-${c}`}
              className={`relative aspect-square ${borderClass(r, c)}`}
              onClick={() => onCellClick(r, c)}
              style={{ touchAction: 'manipulation' }}
            >
              <div className={cellClass(r, c)}>
                {val > 0 ? val : ''}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
