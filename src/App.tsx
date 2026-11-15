import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Minus,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Shield,
  Sprout,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import { GlossaryTerm } from './components/GlossaryTerm';
import { MissionEndModal } from './components/MissionEndModal';
import { NasaGuideModal } from './components/NasaGuideModal';
import { OutpostCanvas3D } from './components/OutpostCanvas3D';
import { TitleScreen } from './components/TitleScreen';
import { buildSolForecast, pickDilemmaForSol, SITE_PROFILES } from './data/nasaScienceData';
import {
  applyDeltas,
  calculatePowerAllocationDeltas,
  getInitialResources,
  getLiveTradeOffHint,
  getModuleUsedPower,
  getResourceStatusLabel,
  TOTAL_SOLS,
} from './engine/simulation';
import type {
  CoreResources,
  DifficultyMode,
  DilemmaCard,
  DilemmaOption,
  GameScreen,
  ModuleAllocation,
  ModuleKey,
  OutpostSite,
  ResourceDeltas,
  SolLogEntry,
  SolPhase,
  SpaceWeatherSnapshot,
} from './types/game';
import { soundEngine } from './utils/sound';

const DEFAULT_WEATHER: SpaceWeatherSnapshot = {
  sourceMode: 'curated-archive',
  sourceLabel: 'Curated NASA DONKI & NOAA SWPC Archive (Oct 2024 Solar Maximum)',
  fetchedAt: new Date().toISOString(),
  latestFlareClass: 'M6.8',
  flareTimestamp: '2024-10-09T01:56Z (Archived DONKI Event)',
  kpIndex: 5.3,
  solarWindSpeedKms: 640,
  radiationRiskLevel: 'Moderate',
  marsSolWeather: {
    location: 'Jezero Crater, Mars',
    solLabel: 'Perseverance MEDA Reference Sol',
    highTempC: -12,
    lowTempC: -76,
    pressurePa: 685,
    dustOpacityTau: 0.62,
    sourceNote: 'NASA Mars 2020 Perseverance MEDA & PDS Atmospheric Dataset',
  },
  lunarEnvData: {
    location: 'Shackleton Crater Rim, Moon',
    sunlitTempC: -24,
    shadowTempC: -173,
    oneWayLightDelaySec: 1.28,
    sourceNote: 'NASA Lunar Reconnaissance Orbiter (LRO) Diviner & Artemis III Site Data',
  },
};

const INITIAL_ALLOCATION: ModuleAllocation = {
  scrubber: 2,
  greenhouse: 1,
  shield: 1,
  lab: 1,
};

function formatDelta(n: number): string {
  if (n > 0) return `+${n}`;
  return `${n}`;
}

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('TITLE_MENU');
  const [site, setSite] = useState<OutpostSite>('mars');
  const [difficulty, setDifficulty] = useState<DifficultyMode>('cadet');
  const [weather, setWeather] = useState<SpaceWeatherSnapshot>(DEFAULT_WEATHER);
  const [guideOpen, setGuideOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deckCollapsed, setDeckCollapsed] = useState(false);

  // Active Mission State
  const [sol, setSol] = useState(1);
  const [phase, setPhase] = useState<SolPhase>('ALLOCATE_POWER');
  const [resources, setResources] = useState<CoreResources>(() =>
    getInitialResources('mars', 'cadet')
  );
  const [allocation, setAllocation] = useState<ModuleAllocation>(INITIAL_ALLOCATION);
  const [usedDilemmaIds, setUsedDilemmaIds] = useState<string[]>([]);
  const [activeDilemma, setActiveDilemma] = useState<DilemmaCard | null>(null);
  const [chosenOption, setChosenOption] = useState<DilemmaOption | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState<string[]>([]);
  const [solNetDeltas, setSolNetDeltas] = useState<ResourceDeltas | null>(null);
  const [logs, setLogs] = useState<SolLogEntry[]>([]);
  const [failureReason, setFailureReason] = useState('');
  const [commsSecondsLeft, setCommsSecondsLeft] = useState(0);

  // Fetch live space weather on mount (falls back honestly to curated NASA archive)
  useEffect(() => {
    let active = true;
    fetch('/api/nasa-weather')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: SpaceWeatherSnapshot | null) => {
        if (active && data && data.latestFlareClass) {
          setWeather(data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const forecast = useMemo(
    () => buildSolForecast(sol, site, difficulty, weather),
    [sol, site, difficulty, weather]
  );

  const predictedPowerDeltas = useMemo(
    () => calculatePowerAllocationDeltas(allocation, forecast, site, difficulty),
    [allocation, forecast, site, difficulty]
  );

  const liveTradeOffHint = useMemo(
    () => getLiveTradeOffHint(allocation, predictedPowerDeltas, forecast, site),
    [allocation, predictedPowerDeltas, forecast, site]
  );

  const usedPowerUnits = getModuleUsedPower(allocation);
  const maxAllowedUnits = forecast.solarBudget + (resources.power >= 20 ? 2 : 0);

  useEffect(() => {
    if (screen !== 'PLAYING' || phase !== 'SOL_DILEMMA' || !activeDilemma?.requiresCommsDelay) {
      return;
    }
    const timer = setInterval(() => {
      setCommsSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [screen, phase, activeDilemma]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const startMission = useCallback(
    (overrideSite?: OutpostSite, overrideDiff?: DifficultyMode) => {
      const targetSite = overrideSite ?? site;
      const targetDiff = overrideDiff ?? difficulty;
      setSol(1);
      setPhase('ALLOCATE_POWER');
      setDeckCollapsed(false);
      setResources(getInitialResources(targetSite, targetDiff));
      setAllocation({
        scrubber: 2,
        greenhouse: 1,
        shield: 1,
        lab: 1,
      });
      setUsedDilemmaIds([]);
      setActiveDilemma(null);
      setChosenOption(null);
      setOutcomeNotes([]);
      setSolNetDeltas(null);
      setLogs([]);
      setFailureReason('');
      setScreen('PLAYING');
      soundEngine.playSolLaunch();
    },
    [site, difficulty]
  );

  const adjustModulePower = useCallback(
    (key: ModuleKey, delta: number) => {
      if (phase !== 'ALLOCATE_POWER' || screen !== 'PLAYING') return;
      setAllocation((prev) => {
        const currentVal = prev[key];
        const nextVal = Math.max(0, Math.min(3, currentVal + delta));
        if (nextVal === currentVal) return prev;
        const nextAlloc = { ...prev, [key]: nextVal };
        if (getModuleUsedPower(nextAlloc) > maxAllowedUnits) {
          return prev;
        }
        soundEngine.playPowerAdjust(nextVal);
        return nextAlloc;
      });
    },
    [phase, screen, maxAllowedUnits]
  );

  const cycleModulePower = useCallback(
    (key: ModuleKey) => {
      if (phase !== 'ALLOCATE_POWER' || screen !== 'PLAYING') return;
      setAllocation((prev) => {
        const currentVal = prev[key];
        let nextVal = (currentVal + 1) % 4;
        const candidate = { ...prev, [key]: nextVal };
        if (getModuleUsedPower(candidate) > maxAllowedUnits) {
          nextVal = 0;
        }
        soundEngine.playPowerAdjust(nextVal);
        return { ...prev, [key]: nextVal };
      });
    },
    [phase, screen, maxAllowedUnits]
  );

  const checkFailure = useCallback((nextRes: CoreResources): string | null => {
    if (nextRes.health <= 0) {
      return 'Crew Health dropped to 0% from radiation or life-support stress. Mission Control ordered an emergency evacuation.';
    }
    if (nextRes.oxygen <= 0 && nextRes.power <= 0) {
      return 'Both Power and Oxygen were exhausted simultaneously, forcing an emergency abort.';
    }
    return null;
  }, []);

  const handleRunSolPower = useCallback(() => {
    if (phase !== 'ALLOCATE_POWER' || screen !== 'PLAYING') return;

    const { next, secondaryNotes } = applyDeltas(resources, predictedPowerDeltas);
    setResources(next);
    setOutcomeNotes(secondaryNotes);

    const failMsg = checkFailure(next);
    if (failMsg) {
      setFailureReason(failMsg);
      setScreen('MISSION_FAILED');
      soundEngine.playFailure();
      return;
    }

    const dilemma = pickDilemmaForSol(sol, site, forecast, usedDilemmaIds);
    setActiveDilemma(dilemma);
    setUsedDilemmaIds((prev) => [...prev, dilemma.id]);
    setCommsSecondsLeft(site === 'europa' ? 2580 : site === 'mars' ? 864 : 3);
    setDeckCollapsed(false);
    setPhase('SOL_DILEMMA');
    soundEngine.playDilemmaAlert(forecast.radiationMsv >= 18);
  }, [
    phase,
    screen,
    resources,
    predictedPowerDeltas,
    checkFailure,
    sol,
    site,
    forecast,
    usedDilemmaIds,
  ]);

  const handleResolveDilemma = useCallback(
    (option: DilemmaOption) => {
      if (phase !== 'SOL_DILEMMA' || screen !== 'PLAYING' || !activeDilemma) return;

      const { next, secondaryNotes } = applyDeltas(resources, option.deltas);
      const combinedNotes = [...outcomeNotes, ...secondaryNotes];
      const combinedDeltas: ResourceDeltas = {
        power: predictedPowerDeltas.power + option.deltas.power,
        oxygen: predictedPowerDeltas.oxygen + option.deltas.oxygen,
        food: predictedPowerDeltas.food + option.deltas.food,
        health: predictedPowerDeltas.health + option.deltas.health,
        science: predictedPowerDeltas.science + option.deltas.science,
      };

      setResources(next);
      setChosenOption(option);
      setOutcomeNotes(combinedNotes);
      setSolNetDeltas(combinedDeltas);
      setLogs((prev) => [
        ...prev,
        {
          sol,
          forecastTitle: forecast.title,
          dilemmaTitle: activeDilemma.title,
          chosenLabel: option.label,
          summary: option.outcomeStory,
          netDeltas: combinedDeltas,
        },
      ]);

      const failMsg = checkFailure(next);
      if (failMsg) {
        setFailureReason(failMsg);
        setScreen('MISSION_FAILED');
        soundEngine.playFailure();
        return;
      }

      setDeckCollapsed(false);
      setPhase('SOL_OUTCOME');
      soundEngine.playChoiceConfirm();
    },
    [
      phase,
      screen,
      activeDilemma,
      resources,
      outcomeNotes,
      predictedPowerDeltas,
      sol,
      forecast.title,
      checkFailure,
    ]
  );

  const handleNextSol = useCallback(() => {
    if (phase !== 'SOL_OUTCOME' || screen !== 'PLAYING') return;

    if (sol >= TOTAL_SOLS) {
      setScreen('MISSION_COMPLETE');
      soundEngine.playVictory();
      return;
    }

    const nextSol = sol + 1;
    const nextForecast = buildSolForecast(nextSol, site, difficulty, weather);
    const nextAlloc = { ...allocation };
    while (getModuleUsedPower(nextAlloc) > nextForecast.solarBudget) {
      if (nextAlloc.lab > 0) nextAlloc.lab -= 1;
      else if (nextAlloc.greenhouse > 0) nextAlloc.greenhouse -= 1;
      else if (nextAlloc.shield > 0) nextAlloc.shield -= 1;
      else if (nextAlloc.scrubber > 0) nextAlloc.scrubber -= 1;
      else break;
    }

    setSol(nextSol);
    setAllocation(nextAlloc);
    setActiveDilemma(null);
    setChosenOption(null);
    setOutcomeNotes([]);
    setSolNetDeltas(null);
    setDeckCollapsed(false);
    setPhase('ALLOCATE_POWER');
    soundEngine.playSolLaunch();
  }, [phase, screen, sol, site, difficulty, weather, allocation]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'm' || e.key === 'M') {
        toggleMute();
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        if (screen === 'PLAYING') setDeckCollapsed((p) => !p);
        return;
      }
      if (e.key === 'Escape') {
        if (guideOpen) {
          setGuideOpen(false);
        } else if (screen === 'PLAYING') {
          setScreen('PAUSED');
        } else if (screen === 'PAUSED') {
          setScreen('PLAYING');
        }
        return;
      }
      if (guideOpen) return;

      if (screen === 'TITLE_MENU' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        startMission();
        return;
      }

      if (screen === 'PLAYING') {
        if (phase === 'ALLOCATE_POWER') {
          if (e.key === '1') cycleModulePower('scrubber');
          if (e.key === '2') cycleModulePower('greenhouse');
          if (e.key === '3') cycleModulePower('shield');
          if (e.key === '4') cycleModulePower('lab');
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRunSolPower();
          }
        } else if (phase === 'SOL_OUTCOME' && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleNextSol();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    guideOpen,
    screen,
    phase,
    toggleMute,
    startMission,
    cycleModulePower,
    handleRunSolPower,
    handleNextSol,
  ]);

  const siteProfile = SITE_PROFILES[site];

  return (
    <div className="w-screen h-dvh overflow-hidden bg-[#04070F] flex items-center justify-center">
      {/* Dedicated Portrait Game Shell (9:16 mobile aspect on desktop, edge-to-edge on phones) */}
      <div className="relative w-full max-w-[460px] h-dvh overflow-hidden bg-[#070B16] sm:border-x sm:border-slate-800/90 shadow-2xl flex flex-col">
        {/* Continuous 3D WebGL Outpost Scene (runs across Title & Active Play) */}
        <div className="relative flex-1 min-h-0">
          <OutpostCanvas3D
            site={site}
            allocation={allocation}
            forecast={forecast}
            canEditPower={screen === 'PLAYING' && phase === 'ALLOCATE_POWER'}
            commsActive={
              screen === 'PLAYING' &&
              phase === 'SOL_DILEMMA' &&
              Boolean(activeDilemma?.requiresCommsDelay)
            }
            isTitleMode={screen === 'TITLE_MENU'}
            onCycleModule={cycleModulePower}
          />

          {/* Top Telemetry HUD (Playing / Paused / End) */}
          {screen !== 'TITLE_MENU' && (
            <header className="absolute top-0 inset-x-0 z-20 bg-[#0B1120]/92 border-b border-slate-800 px-3 py-2 space-y-2 pointer-events-auto">
              {/* Row 1: Site, Sol, Utility buttons */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 text-xs">
                  <span className="font-display font-bold text-white truncate">
                    {siteProfile.shortName}
                  </span>
                  <span className="text-slate-500" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono font-bold text-amber-300 tabular-nums shrink-0">
                    <GlossaryTerm termKey="Sol" label={`Sol ${sol}/${TOTAL_SOLS}`} />
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setGuideOpen(true)}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-semibold text-slate-100 flex items-center gap-1 cursor-pointer"
                    aria-label="Open NASA Data and Science Guide"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                    <span>NASA</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                    aria-label={muted ? 'Unmute sound' : 'Mute sound'}
                  >
                    {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScreen('PAUSED')}
                    className="min-h-[36px] min-w-[36px] p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                    aria-label="Pause Mission"
                  >
                    <Pause className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 2: 5 Portrait Telemetry Meters */}
              <div className="grid grid-cols-5 gap-1.5">
                <HudMeter
                  label="Pwr"
                  value={resources.power}
                  previewDelta={phase === 'ALLOCATE_POWER' ? predictedPowerDeltas.power : undefined}
                  icon={<Zap className="w-3 h-3 text-amber-400" aria-hidden="true" />}
                  barColor="bg-amber-400"
                />
                <HudMeter
                  label="O₂"
                  value={resources.oxygen}
                  previewDelta={phase === 'ALLOCATE_POWER' ? predictedPowerDeltas.oxygen : undefined}
                  icon={<Wind className="w-3 h-3 text-cyan-400" aria-hidden="true" />}
                  barColor="bg-cyan-400"
                />
                <HudMeter
                  label="Food"
                  value={resources.food}
                  previewDelta={phase === 'ALLOCATE_POWER' ? predictedPowerDeltas.food : undefined}
                  icon={<Sprout className="w-3 h-3 text-emerald-400" aria-hidden="true" />}
                  barColor="bg-emerald-400"
                />
                <HudMeter
                  label="Hlth"
                  value={resources.health}
                  previewDelta={phase === 'ALLOCATE_POWER' ? predictedPowerDeltas.health : undefined}
                  icon={<Activity className="w-3 h-3 text-sky-400" aria-hidden="true" />}
                  barColor="bg-sky-400"
                />
                <HudMeter
                  label="Sci"
                  value={resources.science}
                  previewDelta={phase === 'ALLOCATE_POWER' ? predictedPowerDeltas.science : undefined}
                  icon={<FlaskConical className="w-3 h-3 text-indigo-400" aria-hidden="true" />}
                  barColor="bg-indigo-400"
                  hideStatusWord
                />
              </div>
            </header>
          )}

          {/* Compact Floating Sol Forecast Strip right below Top HUD */}
          {screen === 'PLAYING' && (
            <div className="absolute top-[102px] inset-x-3 z-20 pointer-events-none flex justify-between items-start gap-2">
              <div className="pointer-events-auto max-w-[290px] rounded-xl bg-[#0B1120]/88 border border-slate-700/80 px-3 py-2 shadow-lg">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-display font-bold text-amber-300 truncate">
                    {forecast.title}
                  </span>
                  <span className="font-mono tabular-nums text-slate-300 shrink-0">
                    {forecast.flareClass} · {forecast.radiationMsv} mSv
                  </span>
                </div>
                <p className="text-[11px] text-slate-200 leading-snug mt-0.5">
                  {forecast.weatherSummary}{' '}
                  {forecast.radiationMsv >= 18 ? (
                    <GlossaryTerm termKey="Radiation (mSv)" label="mSv?" />
                  ) : forecast.dustStormActive ? (
                    <GlossaryTerm termKey="Dust Opacity" label="Dust?" />
                  ) : site === 'europa' ? (
                    <GlossaryTerm termKey="RTG Power" label="4% Sun?" />
                  ) : (
                    <GlossaryTerm termKey="Electrolysis" label="O₂?" />
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Title Screen Overlay over live 3D Outpost */}
          {screen === 'TITLE_MENU' && (
            <TitleScreen
              site={site}
              difficulty={difficulty}
              weather={weather}
              muted={muted}
              onSelectSite={setSite}
              onSelectDifficulty={setDifficulty}
              onStart={() => startMission()}
              onOpenGuide={() => setGuideOpen(true)}
              onToggleMute={toggleMute}
            />
          )}
        </div>

        {/* Collapsible Portrait Bottom Command Deck */}
        {screen !== 'TITLE_MENU' && (
          <section
            aria-label="Mission Command Deck"
            className="shrink-0 relative z-20 bg-[#0D1526] border-t border-slate-800"
          >
            {/* Collapse/Expand Handle */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/80 bg-[#0A101E]">
              <span className="text-[11px] font-semibold text-slate-300">
                {phase === 'ALLOCATE_POWER'
                  ? `Solar Supply: ${forecast.solarBudget} units`
                  : phase === 'SOL_DILEMMA'
                    ? 'Engineering Decision'
                    : `Sol ${sol} Summary`}
              </span>
              <button
                type="button"
                onClick={() => setDeckCollapsed((p) => !p)}
                className="min-h-[32px] px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 flex items-center gap-1 cursor-pointer"
                aria-expanded={!deckCollapsed}
              >
                {deckCollapsed ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Show Deck</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Hide Deck</span>
                  </>
                )}
              </button>
            </div>

            {!deckCollapsed && (
              <div className="p-3 space-y-2.5 max-h-[46dvh] overflow-y-auto">
                {phase === 'ALLOCATE_POWER' && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">
                        Tap 3D buildings or adjust below:
                      </span>
                      <span
                        className={`font-mono font-semibold tabular-nums ${
                          usedPowerUnits > forecast.solarBudget
                            ? 'text-rose-300'
                            : usedPowerUnits < forecast.solarBudget
                              ? 'text-emerald-300'
                              : 'text-slate-300'
                        }`}
                      >
                        {usedPowerUnits > forecast.solarBudget
                          ? `Battery -${(usedPowerUnits - forecast.solarBudget) * 11}%`
                          : usedPowerUnits < forecast.solarBudget
                            ? `Battery +${(forecast.solarBudget - usedPowerUnits) * 7}%`
                            : '0% Battery Net'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <PowerControlCard
                        shortcut="1"
                        title="O₂ Dome"
                        level={allocation.scrubber}
                        effectNote={
                          allocation.scrubber === 0
                            ? 'Off (-O₂)'
                            : `+${
                                site === 'moon'
                                  ? [0, 10, 19, 27][allocation.scrubber]
                                  : site === 'europa'
                                    ? [0, 11, 20, 28][allocation.scrubber]
                                    : [0, 9, 17, 25][allocation.scrubber]
                              } O₂`
                        }
                        canIncrement={allocation.scrubber < 3 && usedPowerUnits < maxAllowedUnits}
                        canDecrement={allocation.scrubber > 0}
                        onIncrement={() => adjustModulePower('scrubber', 1)}
                        onDecrement={() => adjustModulePower('scrubber', -1)}
                      />
                      <PowerControlCard
                        shortcut="2"
                        title="Farm"
                        level={allocation.greenhouse}
                        effectNote={
                          allocation.greenhouse === 0
                            ? 'Off (-Food)'
                            : `+${[0, 8, 16, 23][allocation.greenhouse]} Food`
                        }
                        canIncrement={allocation.greenhouse < 3 && usedPowerUnits < maxAllowedUnits}
                        canDecrement={allocation.greenhouse > 0}
                        onIncrement={() => adjustModulePower('greenhouse', 1)}
                        onDecrement={() => adjustModulePower('greenhouse', -1)}
                      />
                      <PowerControlCard
                        shortcut="3"
                        title="Shield"
                        level={allocation.shield}
                        effectNote={`Blocks ${[10, 45, 78, 94][allocation.shield]}% rad`}
                        canIncrement={allocation.shield < 3 && usedPowerUnits < maxAllowedUnits}
                        canDecrement={allocation.shield > 0}
                        onIncrement={() => adjustModulePower('shield', 1)}
                        onDecrement={() => adjustModulePower('shield', -1)}
                      />
                      <PowerControlCard
                        shortcut="4"
                        title="Rover Lab"
                        level={allocation.lab}
                        effectNote={
                          allocation.lab === 0
                            ? 'Parked'
                            : `+${(site === 'europa' ? [0, 12, 22, 30] : [0, 11, 20, 28])[allocation.lab]}% Sci · -${allocation.lab * 2} O₂`
                        }
                        canIncrement={allocation.lab < 3 && usedPowerUnits < maxAllowedUnits}
                        canDecrement={allocation.lab > 0}
                        onIncrement={() => adjustModulePower('lab', 1)}
                        onDecrement={() => adjustModulePower('lab', -1)}
                      />
                    </div>

                    <p className="text-[11px] leading-snug text-cyan-200 bg-[#121D33] border border-slate-700/80 rounded-lg px-2.5 py-1.5">
                      {liveTradeOffHint}
                    </p>

                    <button
                      type="button"
                      onClick={handleRunSolPower}
                      className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>Run Sol {sol}</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </>
                )}

                {phase === 'SOL_DILEMMA' && activeDilemma && (
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="font-display font-bold text-base text-white leading-tight">
                          {activeDilemma.title}
                        </h2>
                        {activeDilemma.requiresCommsDelay && (
                          <span className="flex items-center gap-1 text-[11px] font-mono tabular-nums text-amber-300 shrink-0">
                            <Radio className="w-3.5 h-3.5" aria-hidden="true" />
                            {site === 'mars' || site === 'europa'
                              ? `${Math.floor(commsSecondsLeft / 60)}m ${String(commsSecondsLeft % 60).padStart(2, '0')}s`
                              : `${commsSecondsLeft}s`}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-200 leading-snug mt-1">
                        {activeDilemma.briefing}{' '}
                        {activeDilemma.requiresCommsDelay && (
                          <GlossaryTerm termKey="Light-Time Delay" label="Why delay?" />
                        )}
                        {activeDilemma.category === 'Solar Weather' && (
                          <GlossaryTerm termKey="CME" label="What is CME?" />
                        )}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {activeDilemma.options.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleResolveDilemma(opt)}
                          className="w-full min-h-[52px] text-left p-2.5 rounded-xl bg-[#162033] hover:bg-[#1E2C47] border border-slate-700 hover:border-amber-400 transition-colors flex flex-col justify-center gap-0.5 cursor-pointer"
                        >
                          <span className="font-display font-bold text-xs sm:text-sm text-white">
                            {opt.label}
                          </span>
                          <span className="text-[11px] font-mono tabular-nums text-amber-300">
                            {opt.tradeOffSummary}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {phase === 'SOL_OUTCOME' && chosenOption && (
                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <p className="font-display font-bold text-sm text-emerald-300">
                        {chosenOption.label}
                      </p>
                      {solNetDeltas && (
                        <p className="text-[11px] font-mono tabular-nums text-slate-300">
                          Net: {formatDelta(solNetDeltas.power)} Pwr ·{' '}
                          {formatDelta(solNetDeltas.oxygen)} O₂ ·{' '}
                          {formatDelta(solNetDeltas.food)} Food ·{' '}
                          {formatDelta(solNetDeltas.health)} Hlth ·{' '}
                          {formatDelta(solNetDeltas.science)} Sci
                        </p>
                      )}
                      <p className="text-xs text-slate-200 leading-snug">
                        {chosenOption.outcomeStory}
                      </p>
                      {outcomeNotes.length > 0 && (
                        <p className="text-xs text-rose-300 font-medium">
                          {outcomeNotes.join(' ')}
                        </p>
                      )}
                      <p className="text-[11px] text-cyan-300">
                        <strong>NASA Note:</strong> {chosenOption.scienceTakeaway}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleNextSol}
                      className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>{sol >= TOTAL_SOLS ? 'Finish Mission' : `Start Sol ${sol + 1}`}</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Pause Modal */}
        {screen === 'PAUSED' && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Game Paused"
          >
            <div className="w-full max-w-sm rounded-2xl bg-[#111A2E] border border-slate-700 p-5 space-y-4 shadow-2xl">
              <div>
                <h2 className="font-display font-bold text-xl text-white">Mission Paused</h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  {siteProfile.name} · Sol {sol} of {TOTAL_SOLS}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setScreen('PLAYING')}
                  className="min-h-[44px] w-full px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-slate-950" aria-hidden="true" />
                  <span>Resume Mission</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGuideOpen(true)}
                  className="min-h-[44px] w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-amber-400" aria-hidden="true" />
                  <span>NASA Data &amp; Guide</span>
                </button>
                <button
                  type="button"
                  onClick={() => startMission()}
                  className="min-h-[44px] w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>Restart Sol 1</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScreen('TITLE_MENU')}
                  className="min-h-[44px] w-full px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-sm cursor-pointer"
                >
                  Return to Title Screen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Victory / Failure Modal */}
        {(screen === 'MISSION_COMPLETE' || screen === 'MISSION_FAILED') && (
          <MissionEndModal
            victory={screen === 'MISSION_COMPLETE'}
            failureReason={failureReason}
            site={site}
            solReached={sol}
            resources={resources}
            logs={logs}
            onPlayAgain={() => startMission()}
            onChangeSite={() => setScreen('TITLE_MENU')}
            onOpenGuide={() => setGuideOpen(true)}
          />
        )}

        <NasaGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} weather={weather} />
      </div>
    </div>
  );
}

interface HudMeterProps {
  label: string;
  value: number;
  previewDelta?: number;
  icon: React.ReactNode;
  barColor: string;
  hideStatusWord?: boolean;
}

function HudMeter({
  label,
  value,
  previewDelta,
  icon,
  barColor,
  hideStatusWord = false,
}: HudMeterProps) {
  const status = getResourceStatusLabel(value);
  const statusColor =
    status === 'CRITICAL'
      ? 'text-rose-400'
      : status === 'LOW'
        ? 'text-amber-300'
        : 'text-slate-400';

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center justify-between gap-0.5 text-[11px]">
        <span className="flex items-center gap-0.5 font-semibold text-slate-200 truncate">
          {icon}
          <span>{label}</span>
        </span>
        <span className="font-mono font-bold tabular-nums text-white shrink-0">{value}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full w-full transition-transform duration-150 origin-left ${
            !hideStatusWord && status === 'CRITICAL' ? 'bg-rose-500' : barColor
          }`}
          style={{ transform: `scaleX(${Math.max(0, Math.min(1, value / 100))})` }}
        />
      </div>
      <div className="flex items-center justify-between text-[9px] font-mono tabular-nums leading-none pt-0.5">
        {!hideStatusWord ? (
          <span className={`font-semibold ${statusColor}`}>{status === 'CRITICAL' ? 'CRIT' : status}</span>
        ) : (
          <span className="text-slate-400">DATA</span>
        )}
        {previewDelta !== undefined && previewDelta !== 0 && (
          <span className={previewDelta > 0 ? 'text-emerald-300' : 'text-rose-300'}>
            {formatDelta(previewDelta)}
          </span>
        )}
      </div>
    </div>
  );
}

interface PowerControlCardProps {
  shortcut: string;
  title: string;
  level: number;
  effectNote: string;
  canIncrement: boolean;
  canDecrement: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
}

function PowerControlCard({
  title,
  level,
  effectNote,
  canIncrement,
  canDecrement,
  onIncrement,
  onDecrement,
}: PowerControlCardProps) {
  return (
    <div className="rounded-xl bg-[#162033] border border-slate-700/80 p-2 flex flex-col justify-between gap-1.5">
      <div className="flex items-center justify-between gap-1">
        <span className="font-display font-bold text-xs text-white truncate">{title}</span>
        <span className="text-[10px] text-slate-300 truncate">{effectNote}</span>
      </div>

      <div className="flex items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={onDecrement}
          disabled={!canDecrement}
          aria-label={`Decrease power for ${title}`}
          className="min-w-[44px] min-h-[44px] rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed border border-slate-600 flex items-center justify-center text-slate-100 cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="font-mono font-bold text-sm tabular-nums text-amber-300">{level}/3</span>
        <button
          type="button"
          onClick={onIncrement}
          disabled={!canIncrement}
          aria-label={`Increase power for ${title}`}
          className="min-w-[44px] min-h-[44px] rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed border border-slate-600 flex items-center justify-center text-slate-100 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
