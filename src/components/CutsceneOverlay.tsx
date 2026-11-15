import { ArrowRight, Radio, SkipForward } from 'lucide-react';
import type { CutsceneShot } from '../types/game';

interface CutsceneOverlayProps {
  shot: CutsceneShot;
  shotIndex: number;
  totalShots: number;
  radioTransmitting: boolean;
  onReplayRadio: () => void;
  onAdvance: () => void;
  onSkipAll: () => void;
}

export function CutsceneOverlay({
  shot,
  shotIndex,
  totalShots,
  radioTransmitting,
  onReplayRadio,
  onAdvance,
  onSkipAll,
}: CutsceneOverlayProps) {
  const hasMoreShots = shotIndex + 1 < totalShots;
  const speakerColor =
    shot.mood === 'alert'
      ? 'text-rose-300'
      : shot.mood === 'triumph'
        ? 'text-emerald-300'
        : 'text-amber-300';

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col justify-between pointer-events-none"
      aria-live="polite"
    >
      {/* Top Cinema Letterbox Bar */}
      <div className="bg-[#04070F] px-4 pt-3 pb-3 border-b border-slate-800/80 flex items-center justify-between gap-2 pointer-events-auto">
        <div className="flex items-center gap-2 text-xs min-w-0">
          <span className={`font-display font-bold truncate ${speakerColor}`}>
            {shot.speaker}
          </span>
          {totalShots > 1 && (
            <>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              <span className="font-mono text-slate-400 tabular-nums shrink-0">
                {shotIndex + 1}/{totalShots}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onReplayRadio}
            className={`min-h-[38px] px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              radioTransmitting
                ? 'bg-emerald-950 border-emerald-500/80 text-emerald-300'
                : 'bg-[#111A2E] hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
            aria-label="Replay Control Center Radio transmission"
          >
            <Radio className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{radioTransmitting ? 'On Air' : 'Radio'}</span>
          </button>

          <button
            type="button"
            onClick={onSkipAll}
            className="min-h-[38px] px-3 rounded-lg bg-[#111A2E] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <span>Skip</span>
            <SkipForward className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Bottom Cinema Letterbox Bar + Story Subtitles */}
      <div className="bg-[#04070F] px-4 pt-3 pb-4 border-t border-slate-800/80 space-y-2.5 pointer-events-auto">
        <p className="text-sm text-slate-100 leading-snug font-medium">
          {shot.caption}
        </p>

        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              key={shot.id}
              className="h-full bg-amber-400 rounded-full origin-left animate-[cutsceneBar_linear_forwards]"
              style={{ animationDuration: `${shot.durationMs}ms` }}
            />
          </div>

          <button
            type="button"
            onClick={onAdvance}
            className="min-h-[40px] px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-extrabold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span>{hasMoreShots ? 'Next' : 'Continue'}</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
