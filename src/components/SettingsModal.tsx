import { Settings, AppTheme } from '../hooks/useSettings';

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  theme: AppTheme;
  onSet: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

export default function SettingsModal({ open, onClose, settings, theme, onSet }: Props) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Настройки</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none touch-manipulation"
            >
              ✕
            </button>
          </div>

          <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
            <div>
              <p className="text-sm font-medium text-gray-700">Режим e-ink</p>
              <p className="text-xs text-gray-400">Высокий контраст для электронных чернил</p>
            </div>
            <div
              onClick={() => onSet('eink', !settings.eink)}
              className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 ${
                settings.eink ? theme.accent : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  settings.eink ? 'translate-x-5' : ''
                }`}
              />
            </div>
          </label>
        </div>
      </div>
    </>
  );
}
