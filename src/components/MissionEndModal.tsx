import { Award, AlertTriangle, RotateCcw } from 'lucide-react';
import { getMissionRank } from '../engine/simulation';
import type { CoreResources, OutpostSite, SolLogEntry } from '../types/game';

interface MissionEndModalProps {
  victory: boolean;
  failureReason: string;
  site: OutpostSite;
  solReached: number;
  commanderName: string;
  resources: CoreResources;
  logs: SolLogEntry[];
  onPlayAgain: () => void;
  onChangeSite: () => void;
}

export function MissionEndModal({
  victory,
  failureReason,
  site,
  solReached,
  commanderName,
  resources,
  logs,
  onPlayAgain,
  onChangeSite,
}: MissionEndModalProps) {
  const rankInfo = getMissionRank(resources, site);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={victory ? 'Mission Complete' : 'Mission Ended Early'}
    >
      <div className="w-full max-w-[440px] max-h-[90dvh] flex flex-col rounded-2xl bg-[#111A2E] border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-[#0D1526] flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              victory
                ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-300'
                : 'bg-rose-500/15 border border-rose-400/40 text-rose-300'
            }`}
          >
            {victory ? (
              <Award className="w-6 h-6" aria-hidden="true" />
            ) : (
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">
              Jezero Crater · Mars
              <span className="mx-2" aria-hidden="true">
                ·
              </span>
              Commander {commanderName} · Sol {214 + solReached - 1}
            </p>
            <h2 className="font-display font-extrabold text-2xl text-white mt-0.5">
              {victory ? `Story Complete: ${rankInfo.rank}` : 'Outpost Emergency Abort'}
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              {victory ? rankInfo.summary : failureReason}
            </p>
          </div>
        </div>

        {/* Final Telemetry Summary */}
        <div className="px-6 py-4 grid grid-cols-5 gap-2 bg-[#142038] border-b border-slate-800">
          {[
            { label: 'Power', val: resources.power, color: 'text-amber-300' },
            { label: 'Oxygen', val: resources.oxygen, color: 'text-cyan-300' },
            { label: 'Food', val: resources.food, color: 'text-emerald-300' },
            { label: 'Health', val: resources.health, color: 'text-sky-300' },
            { label: 'Science', val: resources.science, color: 'text-indigo-300' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-[11px] text-slate-400">{stat.label}</p>
              <p className={`font-mono font-bold text-lg tabular-nums ${stat.color}`}>
                {stat.val}%
              </p>
            </div>
          ))}
        </div>

        {/* Sol-by-Sol Trade-Off & Constraint Takeaways */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <div className="rounded-xl bg-[#14223B] border border-cyan-500/30 p-3.5 space-y-1.5">
            <h3 className="font-display font-bold text-xs text-cyan-300">
              Real Mars Constraints You Navigated
            </h3>
            <p className="text-xs text-slate-200 leading-relaxed">
              1. Dust &amp; Distance: Martian dust storms drop solar power right when CO₂-to-O₂
              scrubbers need watts. 2. 14-Minute Light Delay: Crews cannot wait for Earth
              checklists during urgent leaks.
            </p>
          </div>

          <h3 className="text-xs font-semibold text-slate-400">
            Mission Trade-Off Log ({logs.length} Sols Logged)
          </h3>
          {logs.length === 0 ? (
            <p className="text-sm text-slate-400">No full Sols completed yet.</p>
          ) : (
            logs.map((entry) => (
              <div
                key={entry.sol}
                className="rounded-xl bg-[#162033] border border-slate-700/70 p-3"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-display font-bold text-amber-300">
                    Sol {entry.sol}: {entry.dilemmaTitle}
                  </span>
                  <span className="text-slate-400">{entry.forecastTitle}</span>
                </div>
                <p className="text-xs text-slate-200 mt-1">
                  <strong>Decision:</strong> {entry.chosenLabel}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{entry.summary}</p>
              </div>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#0D1526] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onChangeSite}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Title Menu
          </button>
          <button
            type="button"
            onClick={onPlayAgain}
            className="min-h-[44px] px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Play Again</span>
          </button>
        </div>
      </div>
    </div>
  );
}
