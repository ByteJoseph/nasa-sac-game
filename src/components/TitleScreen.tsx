import { useState } from 'react';
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

const AVATAR_SRC = '/src/assets/images/astronaut_commander_avatar_1794738052744.jpg';

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
  const [avatarFailed, setAvatarFailed] = useState(false);
  const selectedProfile = SITE_PROFILES[site];

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between pointer-events-none">
      {/* Top Scrim & Title Lockup over Live 3D Sky */}
      <div className="bg-gradient-to-b from-[#070B16]/95 via-[#070B16]/75 to-transparent px-4 pt-4 pb-8 pointer-events-auto">
        <div className="flex items-center justify-between gap-2 mb-4">
          <p className="text-[11px] font-medium text-slate-300 truncate">
            {weather.sourceMode === 'live'
              ? `Live Space Weather · ${weather.latestFlareClass}`
              : `NASA Archive · ${weather.latestFlareClass}`}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenGuide}
              className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#0F172A]/90 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-100 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>NASA Data</span>
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              className="min-h-[40px] min-w-[40px] p-2 rounded-lg bg-[#0F172A]/90 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
              aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Bespoke Inline SVG Title Lockup */}
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 64 64" className="w-12 h-12 shrink-0" aria-hidden="true">
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
          <div>
            <h1 className="font-display font-extrabold text-3xl tracking-tight text-white leading-none">
              Outpost Horizon
            </h1>
            <p className="text-xs text-amber-300 font-semibold mt-1">
              3D Lunar &amp; Mars Mission Trainer
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Portrait Control Sheet leaving center 3D Outpost visible */}
      <div className="bg-gradient-to-t from-[#070B16] via-[#070B16]/95 to-transparent px-4 pt-8 pb-4 space-y-3 pointer-events-auto">
        {/* Junior Commander Pitch */}
        <div className="flex items-center gap-3 bg-[#0F172A]/95 border border-slate-700/80 rounded-xl p-2.5">
          {!avatarFailed ? (
            <img
              src={AVATAR_SRC}
              alt="Junior Astronaut Commander"
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="w-11 h-11 rounded-lg object-cover shrink-0 border border-slate-600"
            />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-slate-800 border border-slate-600 shrink-0" />
          )}
          <p className="text-xs text-slate-200 leading-snug">
            Orbit the 3D base, route solar watts, and survive <strong>7 Sols</strong>. Every choice
            has a real engineering trade-off!
          </p>
        </div>

        {/* Site Selector (switches live 3D Moon / Mars / Europa world above!) */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-3 gap-2">
            {(['moon', 'mars', 'europa'] as const).map((key) => {
              const prof = SITE_PROFILES[key];
              const active = site === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectSite(key)}
                  className={`min-h-[60px] text-left p-2 rounded-xl border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#16243D] border-amber-400 text-white'
                      : 'bg-[#0F172A]/90 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <p className="font-display font-bold text-xs text-white leading-tight truncate">
                    {key === 'moon' ? 'Moon' : key === 'mars' ? 'Mars' : 'Europa'}
                  </p>
                  <p className="text-[10px] font-mono text-amber-300 mt-0.5 truncate">
                    {prof.commsDelayText}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {key === 'moon' ? 'Artemis' : key === 'mars' ? 'Jezero' : 'Jupiter'}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-300 px-0.5">
            <strong className="text-amber-300">{selectedProfile.name}:</strong>{' '}
            {selectedProfile.keyChallenge}
          </p>
        </div>

        {/* Difficulty + Start Row */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-[#0F172A] border border-slate-700 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => onSelectDifficulty('cadet')}
              className={`min-h-[40px] px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
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
              className={`min-h-[40px] px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
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
            className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Play className="w-4 h-4 fill-slate-950" aria-hidden="true" />
            <span>Start Mission</span>
          </button>
        </div>

        <p className="text-[11px] text-center text-slate-400">
          Drag to orbit 3D outpost · Tap buildings to route power · {selectedProfile.nasaSourceTag}
        </p>
      </div>
    </div>
  );
}
