import { BookOpen, Play, Volume2, VolumeX } from 'lucide-react';
import type { DifficultyMode, SpaceWeatherSnapshot } from '../types/game';

interface TitleScreenProps {
  difficulty: DifficultyMode;
  weather: SpaceWeatherSnapshot;
  muted: boolean;
  onSelectDifficulty: (diff: DifficultyMode) => void;
  onStart: () => void;
  onOpenGuide: () => void;
  onToggleMute: () => void;
}

export function TitleScreen({
  difficulty,
  weather,
  muted,
  onSelectDifficulty,
  onStart,
  onOpenGuide,
  onToggleMute,
}: TitleScreenProps) {
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
            onClick={onOpenGuide}
            className="min-h-[44px] min-w-[44px] px-2.5 rounded-xl bg-[#0F172A]/90 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-100 flex items-center justify-center gap-1.5 cursor-pointer"
            aria-label="Open NASA Science Field Guide"
          >
            <BookOpen className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <span>Guide</span>
          </button>
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

      {/* Minimal Bottom Story Launch Sheet (no 2D face avatar — 3D astronaut waves in scene!) */}
      <div className="bg-gradient-to-t from-[#070B16] via-[#070B16]/94 to-transparent px-4 pt-8 pb-4 space-y-3 pointer-events-auto">
        <div className="rounded-xl bg-[#0F172A]/90 border border-amber-500/35 px-3.5 py-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display font-bold text-sm text-white leading-tight">
              Jezero Crater · Mars
            </p>
            <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
              Help Commander Maya survive dust storms &amp; a 14m Earth delay.
            </p>
          </div>
          <span className="font-mono text-[11px] font-bold text-amber-300 shrink-0">
            Sol 214–220
          </span>
        </div>

        {/* Difficulty + Big Play CTA */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-[#0F172A] border border-slate-700 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => onSelectDifficulty('cadet')}
              className={`min-h-[42px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                difficulty === 'cadet'
                  ? 'bg-slate-200 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Cadet
            </button>
            <button
              type="button"
              onClick={() => onSelectDifficulty('commander')}
              className={`min-h-[42px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                difficulty === 'commander'
                  ? 'bg-slate-200 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Tough
            </button>
          </div>

          <button
            type="button"
            onClick={onStart}
            className="flex-1 min-h-[50px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Play className="w-4 h-4 fill-slate-950" aria-hidden="true" />
            <span>Start Mars Story</span>
          </button>
        </div>
      </div>
    </div>
  );
}
