import { BookOpen, Play, Volume2, VolumeX } from 'lucide-react';
import { SITE_PROFILES } from '../data/nasaScienceData';
import type { DifficultyMode, OutpostSite, SpaceWeatherSnapshot } from '../types/game';

interface TitleScreenProps {
  site: OutpostSite;
  difficulty: DifficultyMode;
  weather: SpaceWeatherSnapshot;
  muted: boolean;
  onSelectSite: (site: OutpostSite) => void;
  onSelectDifficulty: (diff: DifficultyMode) => void;
  onStart: () => void;
  onOpenGuide: () => void;
  onToggleMute: () => void;
}

const SITE_STORY_HOOK: Record<OutpostSite, string> = {
  moon: 'Sol 214, Shackleton Ridge · Guide Astronaut Maya through a sudden lunar storm.',
  mars: 'Sol 214, Jezero Crater · Help Astronaut Maya survive dust storms & a 14m radio delay.',
  europa: 'Sol 214, Conamara Ice · Help Astronaut Maya survive 4% sunlight & Jupiter flares.',
};

export function TitleScreen({
  site,
  difficulty,
  weather,
  muted,
  onSelectSite,
  onSelectDifficulty,
  onStart,
  onOpenGuide,
  onToggleMute,
}: TitleScreenProps) {
  const siteTitle = site === 'moon' ? 'Moon' : site === 'mars' ? 'Mars' : 'Europa';

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
              3D Astronaut Story ·{' '}
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
      <div className="bg-gradient-to-t from-[#070B16] via-[#070B16]/94 to-transparent px-4 pt-8 pb-4 space-y-2.5 pointer-events-auto">
        <p className="text-xs text-slate-200 text-center leading-snug px-1">
          {SITE_STORY_HOOK[site]}
        </p>

        {/* World Selector Tabs */}
        <div className="grid grid-cols-3 gap-2">
          {(['moon', 'mars', 'europa'] as const).map((key) => {
            const active = site === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelectSite(key)}
                className={`min-h-[44px] px-2 py-1.5 rounded-xl border text-center transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#16243D] border-amber-400 text-white shadow-md'
                    : 'bg-[#0F172A]/90 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="font-display font-bold text-sm block leading-none">
                  {key === 'moon' ? 'Moon' : key === 'mars' ? 'Mars' : 'Europa'}
                </span>
                <span className="text-[10px] font-mono text-amber-300 mt-1 block">
                  {SITE_PROFILES[key].commsDelayText.replace(' round-trip', '')}
                </span>
              </button>
            );
          })}
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
            <span>Start {siteTitle} Story</span>
          </button>
        </div>
      </div>
    </div>
  );
}
