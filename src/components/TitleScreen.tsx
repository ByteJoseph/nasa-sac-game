import { useState } from 'react';
import { Play, Volume2, VolumeX, User, Rocket } from 'lucide-react';
import type { SpaceWeatherSnapshot } from '../types/game';

interface TitleScreenProps {
  weather: SpaceWeatherSnapshot;
  muted: boolean;
  onStart: (commanderName: string) => void;
  onToggleMute: () => void;
}

export function TitleScreen({
  weather,
  muted,
  onStart,
  onToggleMute,
}: TitleScreenProps) {
  const [showNameModal, setShowNameModal] = useState(false);
  const [commanderName, setCommanderName] = useState('');

  const handleLaunch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commanderName.trim();
    onStart(trimmed || 'Maya');
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between pointer-events-none">
      {/* Clean Top Game Header */}
      <div className="bg-gradient-to-b from-[#070B16]/90 via-[#070B16]/45 to-transparent px-4 pt-4 pb-6 pointer-events-auto flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <svg viewBox="0 0 64 64" className="w-10 h-10 shrink-0" aria-hidden="true">
            <circle cx="32" cy="32" r="29" fill="#0F172A" stroke="#F59E0B" strokeWidth="2.5" />
            <path
              d="M 14 44 Q 32 34 50 44"
              fill="none"
              stroke="#38BDF8"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M 20 40 C 20 26, 44 26, 44 40 Z"
              fill="#1E293B"
              stroke="#F1F5F9"
              strokeWidth="2"
            />
            <circle cx="44" cy="18" r="5" fill="#F59E0B" />
            <path d="M 32 14 L 35 22 L 29 22 Z" fill="#38BDF8" />
          </svg>
          <div className="min-w-0">
            <h1 className="font-display font-extrabold text-2xl tracking-tight text-white leading-none truncate">
              Outpost Horizon
            </h1>
            <p className="text-[11px] text-amber-300 font-semibold mt-1 truncate">
              Mars Mission ·{' '}
              {weather.sourceMode === 'live'
                ? `Live Solar ${weather.latestFlareClass}`
                : `NASA ${weather.latestFlareClass}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#0F172A]/90 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
            aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Minimal Bottom Story Launch Sheet */}
      <div className="bg-gradient-to-t from-[#070B16] via-[#070B16]/94 to-transparent px-4 pt-8 pb-4 space-y-3 pointer-events-auto">
        <div className="rounded-xl bg-[#0F172A]/90 border border-amber-500/35 px-3.5 py-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display font-bold text-sm text-white leading-tight">
              Jezero Crater · Mars
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
              Help your Commander survive dust storms &amp; a 14m Earth delay.
            </p>
          </div>
          <span className="font-mono text-[11px] font-bold text-amber-300 shrink-0">
            Sol 214–220
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowNameModal(true)}
          className="w-full min-h-[50px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 whitespace-nowrap cursor-pointer"
        >
          <Play className="w-4 h-4 fill-slate-950" aria-hidden="true" />
          <span>Start Mars Story</span>
        </button>
      </div>

      {/* Commander Name Dialog Modal */}
      {showNameModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Enter Commander Name"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#111A2E] border border-slate-700 p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Rocket className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg text-white leading-tight">
                  Mission Commander
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Enter your name to begin the Jezero Crater briefing.
                </p>
              </div>
            </div>

            <form onSubmit={handleLaunch} className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4 text-amber-400" />
                </div>
                <input
                  type="text"
                  value={commanderName}
                  onChange={(e) => setCommanderName(e.target.value)}
                  placeholder="e.g. Alex, Sam, Maya..."
                  maxLength={24}
                  autoFocus
                  className="w-full min-h-[48px] pl-10 pr-3 rounded-xl bg-[#070B16] border border-slate-700 text-white placeholder-slate-500 text-sm font-semibold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNameModal(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-lg"
                >
                  <Play className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Launch Mission</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
