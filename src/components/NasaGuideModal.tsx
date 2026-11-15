import { useState } from 'react';
import { BookOpen, Database, Radio, X } from 'lucide-react';
import { NASA_DATASET_CITATIONS, SCIENCE_GLOSSARY } from '../data/nasaScienceData';
import type { SpaceWeatherSnapshot } from '../types/game';

interface NasaGuideModalProps {
  open: boolean;
  onClose: () => void;
  weather: SpaceWeatherSnapshot;
}

export function NasaGuideModal({ open, onClose, weather }: NasaGuideModalProps) {
  const [tab, setTab] = useState<'datasets' | 'glossary'>('datasets');
  const [blueprintFailed, setBlueprintFailed] = useState(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="NASA Open Data and Science Field Guide"
    >
      <div className="w-full max-w-[440px] max-h-[88dvh] flex flex-col rounded-2xl bg-[#111A2E] border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-800 bg-[#0D1526]">
          <div className="flex items-center gap-3 min-w-0">
            <Database className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                NASA Open Data &amp; Science Field Guide
              </h2>
              <p className="text-xs text-slate-400">
                Verified science powering every mission trade-off
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            aria-label="Close NASA Guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Honest Live vs Archive Data Source Banner */}
        <div className="px-6 py-3 bg-[#15223B] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            <Radio
              className={`w-4 h-4 shrink-0 ${
                weather.sourceMode === 'live' ? 'text-emerald-400' : 'text-amber-400'
              }`}
              aria-hidden="true"
            />
            <span className="font-semibold text-slate-100">
              {weather.sourceMode === 'live'
                ? 'Live Space Weather Feed Active'
                : 'Curated NASA Archive Dataset Active'}
            </span>
            <span className="text-slate-400" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-300">{weather.sourceLabel}</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-300">
            <span>Flare: {weather.latestFlareClass}</span>
            <span aria-hidden="true">·</span>
            <span>Kp: {weather.kpIndex}</span>
            <span aria-hidden="true">·</span>
            <span>Solar Wind: {weather.solarWindSpeedKms} km/s</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-800 flex items-center gap-2 bg-[#0F172A]">
          <button
            type="button"
            onClick={() => setTab('datasets')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
              tab === 'datasets'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" aria-hidden="true" />
            <span>NASA Data Sources</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('glossary')}
            className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
              tab === 'glossary'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            <span>Junior Astronaut Dictionary</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {tab === 'datasets' ? (
            <>
              {!blueprintFailed && (
                <div className="rounded-xl overflow-hidden border border-slate-700/80 bg-[#0D1526]">
                  <img
                    src="/assets/aistudio/image_cbb8f67a.png"
                    alt="Interconnected canyon-rim surface outpost blueprint showing helipads, central hub, ribbed radiation shelter, geodesic greenhouse, solar arrays, and crane rover"
                    referrerPolicy="no-referrer"
                    onError={() => setBlueprintFailed(true)}
                    className="w-full h-36 object-cover"
                  />
                  <div className="px-3.5 py-2 border-t border-slate-800">
                    <p className="text-[11px] font-semibold text-amber-300">
                      Outpost Architecture Blueprint
                    </p>
                    <p className="text-[11px] text-slate-300">
                      Interconnected O₂ Hab, Ribbed Radiation Shelter, Geodesic Farm, and Rover Lab
                      on a canyon rim.
                    </p>
                  </div>
                </div>
              )}
              <p className="text-sm text-slate-300 leading-relaxed">
                Outpost Horizon avoids made-up space statistics. Your solar power budgets,
                radiation alerts, crop yields, and radio delays come from real NASA datasets:
              </p>
              <div className="grid grid-cols-1 gap-3.5">
                {NASA_DATASET_CITATIONS.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-[#162033] border border-slate-700/80 p-4 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <h3 className="font-display font-bold text-base text-amber-300">
                        {item.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 mb-2">{item.agencySystem}</p>
                      <p className="text-xs text-slate-200 leading-relaxed mb-2">
                        <strong className="text-white">Real Data:</strong> {item.whatItMeasures}
                      </p>
                      <p className="text-xs text-cyan-200 leading-relaxed">
                        <strong className="text-cyan-300">In the Game:</strong>{' '}
                        {item.howItShapesGameplay}
                      </p>
                    </div>
                    <p className="text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-700/60 truncate">
                      Source: {item.referenceUrl}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {Object.values(SCIENCE_GLOSSARY).map((entry) => (
                <div
                  key={entry.term}
                  className="rounded-xl bg-[#162033] border border-slate-700/80 p-4"
                >
                  <h3 className="font-display font-bold text-base text-amber-300">{entry.term}</h3>
                  <p className="text-xs text-slate-400 mb-2">{entry.shortMeaning}</p>
                  <p className="text-xs text-slate-200 leading-relaxed mb-2">
                    {entry.kidExplanation}
                  </p>
                  <p className="text-[11px] text-cyan-300 border-t border-slate-700/60 pt-2">
                    NASA Fact: {entry.nasaFact}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer action */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-[#0D1526] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors cursor-pointer"
          >
            Back to Outpost
          </button>
        </div>
      </div>
    </div>
  );
}
