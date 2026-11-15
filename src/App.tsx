import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Clock,
  FlaskConical,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Sprout,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import { CutsceneOverlay } from './components/CutsceneOverlay';
import { GlossaryTerm } from './components/GlossaryTerm';
import { MissionEndModal } from './components/MissionEndModal';
import { OutpostCanvas3D, type PulseEvent } from './components/OutpostCanvas3D';
import { TitleScreen } from './components/TitleScreen';
import {
  getChapterIntroCutscene,
  getChoiceOutcomeCutscene,
  getDilemmaRadioLine,
  getOpeningCutscene,
  getVictoryCutscene,
} from './data/cutscenes';
import { buildSolForecast, SITE_PROFILES } from './data/nasaScienceData';
import {
  buildStoryChapterDilemma,
  INITIAL_STORY_MEMORY,
  MISSION_START_SOL,
  type StoryMemory,
} from './data/storyChapters';
import {
  applyDeltas,
  calculatePowerAllocationDeltas,
  getInitialResources,
  getModuleUsedPower,
  TOTAL_SOLS,
} from './engine/simulation';
import type {
  CoreResources,
  CutsceneShot,
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
import { radioVoice } from './utils/radioVoice';
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

const MODULE_ORDER: ModuleKey[] = ['scrubber', 'greenhouse', 'shield', 'lab'];

const MODULE_INFO: Record<
  ModuleKey,
  { name: string; shortName: string; colorHex: number; dotClass: string }
> = {
  scrubber: {
    name: 'O₂ Dome',
    shortName: 'O₂',
    colorHex: 0x22d3ee,
    dotClass: 'bg-cyan-400',
  },
  greenhouse: {
    name: 'Farm Dome',
    shortName: 'Farm',
    colorHex: 0x34d399,
    dotClass: 'bg-emerald-400',
  },
  shield: {
    name: 'Shield',
    shortName: 'Shield',
    colorHex: 0xfbbf24,
    dotClass: 'bg-amber-400',
  },
  lab: {
    name: 'Rover Lab',
    shortName: 'Rover',
    colorHex: 0x818cf8,
    dotClass: 'bg-indigo-400',
  },
};

function formatDelta(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function getKidEffectLine(
  key: ModuleKey,
  level: number,
  _site: OutpostSite,
  radiationMsv: number
): string {
  if (key === 'scrubber') {
    const gain = [0, 9, 17, 25][level];
    return level === 0 ? 'Off · Air drops' : `Fresh Air +${gain}%`;
  }
  if (key === 'greenhouse') {
    const gain = [0, 8, 16, 23][level];
    return level === 0 ? 'Off · Food drops' : `Food +${gain}%`;
  }
  if (key === 'shield') {
    const pct = [10, 45, 78, 94][level];
    return radiationMsv >= 18 ? `Blocks ${pct}% · Storm!` : `Blocks ${pct}% rays`;
  }
  const sci = [0, 11, 20, 28][level];
  return level === 0 ? 'Parked' : `Science +${sci}%`;
}

function getDeltaChips(deltas: ResourceDeltas): Array<{ label: string; positive: boolean }> {
  const entries: Array<{ key: keyof ResourceDeltas; name: string }> = [
    { key: 'power', name: 'Power' },
    { key: 'oxygen', name: 'Air' },
    { key: 'food', name: 'Food' },
    { key: 'health', name: 'Health' },
    { key: 'science', name: 'Science' },
  ];
  return entries
    .filter((e) => deltas[e.key] !== 0)
    .map((e) => ({
      label: `${formatDelta(deltas[e.key])} ${e.name}`,
      positive: deltas[e.key] > 0,
    }));
}

const ZERO_DELTAS: ResourceDeltas = {
  power: 0,
  oxygen: 0,
  food: 0,
  health: 0,
  science: 0,
};

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('TITLE_MENU');
  const site: OutpostSite = 'mars';
  const [commanderName, setCommanderName] = useState('Maya');
  const [weather, setWeather] = useState<SpaceWeatherSnapshot>(DEFAULT_WEATHER);
  const [muted, setMuted] = useState(false);

  // Active Story State
  const [sol, setSol] = useState(1);
  const [phase, setPhase] = useState<SolPhase>('SOL_DILEMMA');
  const [selectedModule, setSelectedModule] = useState<ModuleKey>('scrubber');
  const [pulseEvent, setPulseEvent] = useState<PulseEvent | null>(null);
  const [panelsRetracted, setPanelsRetracted] = useState(false);
  const [storyMemory, setStoryMemory] = useState<StoryMemory>(INITIAL_STORY_MEMORY);
  const [resources, setResources] = useState<CoreResources>(() =>
    getInitialResources('mars', 'cadet')
  );
  const [allocation, setAllocation] = useState<ModuleAllocation>(INITIAL_ALLOCATION);
  const [activeDilemma, setActiveDilemma] = useState<DilemmaCard | null>(null);
  const [chosenOption, setChosenOption] = useState<DilemmaOption | null>(null);
  const [lastPowerDeltas, setLastPowerDeltas] = useState<ResourceDeltas>(ZERO_DELTAS);
  const [outcomeNotes, setOutcomeNotes] = useState<string[]>([]);
  const [solNetDeltas, setSolNetDeltas] = useState<ResourceDeltas | null>(null);
  const [simPopups, setSimPopups] = useState<Array<{ label: string; positive: boolean }>>([]);
  const [logs, setLogs] = useState<SolLogEntry[]>([]);
  const [failureReason, setFailureReason] = useState('');
  const [commsSecondsLeft, setCommsSecondsLeft] = useState(0);
  const [urgentSecondsLeft, setUrgentSecondsLeft] = useState<number | null>(null);
  const [cutsceneShots, setCutsceneShots] = useState<CutsceneShot[]>([]);
  const [cutsceneIndex, setCutsceneIndex] = useState(0);
  const [cutsceneMode, setCutsceneMode] = useState<'intro' | 'chapter' | 'outcome' | 'victory' | null>(null);
  const [pendingUrgentSec, setPendingUrgentSec] = useState<number | null>(null);
  const [radioTransmitting, setRadioTransmitting] = useState(false);

  const simTimerRef = useRef<number | null>(null);
  const displaySol = MISSION_START_SOL + sol - 1;
  const activeCutsceneShot = phase === 'CUTSCENE' ? cutsceneShots[cutsceneIndex] ?? null : null;

  const clearSimTimer = useCallback(() => {
    if (simTimerRef.current !== null) {
      window.clearTimeout(simTimerRef.current);
      simTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const unsub = radioVoice.subscribe(setRadioTransmitting);
    return () => {
      unsub();
      clearSimTimer();
      radioVoice.stop(false);
    };
  }, [clearSimTimer]);

  // Fetch live space weather on mount
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
    () => buildSolForecast(sol, site, 'cadet', weather),
    [sol, site, weather]
  );

  const nextSolForecast = useMemo(
    () =>
      sol < TOTAL_SOLS
        ? buildSolForecast(sol + 1, site, 'cadet', weather)
        : forecast,
    [sol, site, weather, forecast]
  );

  const activeBudgetForecast = phase === 'SOL_OUTCOME' ? nextSolForecast : forecast;
  const usedPowerUnits = getModuleUsedPower(allocation);
  const maxAllowedUnits = activeBudgetForecast.solarBudget + (resources.power >= 20 ? 2 : 0);
  const remainingSolarBars = Math.max(0, activeBudgetForecast.solarBudget - usedPowerUnits);
  const overdrivenBars = Math.max(0, usedPowerUnits - activeBudgetForecast.solarBudget);

  // Light-time comms countdown ticker
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
      radioVoice.setMuted(next);
      return next;
    });
  }, []);

  const triggerPulse = useCallback((key: ModuleKey) => {
    setPulseEvent({
      key,
      nonce: Date.now() + Math.random(),
      colorHex: MODULE_INFO[key].colorHex,
    });
  }, []);

  const startCutscene = useCallback(
    (
      shots: CutsceneShot[],
      mode: 'intro' | 'chapter' | 'outcome' | 'victory',
      urgentAfter: number | null = null
    ) => {
      setCutsceneShots(shots);
      setCutsceneIndex(0);
      setCutsceneMode(mode);
      setPendingUrgentSec(urgentAfter);
      setUrgentSecondsLeft(null);
      setPhase('CUTSCENE');
      soundEngine.playCutsceneCue(shots[0]?.mood ?? 'calm');
    },
    []
  );

  const finishCutscene = useCallback(() => {
    radioVoice.stop(false);
    const mode = cutsceneMode;
    const urgent = pendingUrgentSec;
    setCutsceneShots([]);
    setCutsceneIndex(0);
    setCutsceneMode(null);
    setPendingUrgentSec(null);

    if (mode === 'victory') {
      setScreen('MISSION_COMPLETE');
      soundEngine.playVictory();
      return;
    }

    if (mode === 'outcome') {
      setPhase('SOL_OUTCOME');
      soundEngine.playChoiceConfirm();
      return;
    }

    setUrgentSecondsLeft(urgent);
    setPhase('SOL_DILEMMA');
    soundEngine.playDilemmaAlert(Boolean(urgent));
  }, [cutsceneMode, pendingUrgentSec]);

  const advanceCutsceneShot = useCallback(() => {
    if (phase !== 'CUTSCENE') return;
    radioVoice.stop(false);
    const nextIdx = cutsceneIndex + 1;
    if (nextIdx < cutsceneShots.length) {
      setCutsceneIndex(nextIdx);
      soundEngine.playCutsceneCue(cutsceneShots[nextIdx]?.mood ?? 'calm');
    } else {
      finishCutscene();
    }
  }, [phase, cutsceneIndex, cutsceneShots, finishCutscene]);

  const replayCutsceneRadio = useCallback(() => {
    if (!activeCutsceneShot) return;
    radioVoice.unlock();
    radioVoice.speak(activeCutsceneShot.radioLine ?? activeCutsceneShot.caption, {
      speaker: activeCutsceneShot.speaker.includes('Maya') ? 'maya' : 'control',
    });
  }, [activeCutsceneShot]);

  const replayDilemmaRadio = useCallback(() => {
    if (!activeDilemma) return;
    radioVoice.unlock();
    radioVoice.speak(getDilemmaRadioLine(sol, activeDilemma, storyMemory), {
      speaker: 'control',
    });
  }, [sol, activeDilemma, storyMemory]);

  useEffect(() => {
    if (screen !== 'PLAYING' || phase !== 'CUTSCENE' || !activeCutsceneShot) {
      return;
    }
    let minDone = false;
    let voiceDone = false;
    const maybeAdvance = () => {
      if (minDone && voiceDone) {
        advanceCutsceneShot();
      }
    };

    const timer = window.setTimeout(() => {
      minDone = true;
      maybeAdvance();
    }, activeCutsceneShot.durationMs);

    radioVoice.speak(activeCutsceneShot.radioLine ?? activeCutsceneShot.caption, {
      speaker: activeCutsceneShot.speaker.includes('Maya') ? 'maya' : 'control',
      onEnd: () => {
        voiceDone = true;
        maybeAdvance();
      },
    });

    const upcoming: string[] = [];
    const nextShot = cutsceneShots[cutsceneIndex + 1];
    if (nextShot) {
      upcoming.push(nextShot.radioLine ?? nextShot.caption);
    }
    if ((cutsceneMode === 'intro' || cutsceneMode === 'chapter') && activeDilemma) {
      upcoming.push(getDilemmaRadioLine(sol, activeDilemma, storyMemory));
    }
    if (upcoming.length > 0) {
      radioVoice.prefetch(upcoming);
    }

    return () => {
      window.clearTimeout(timer);
      radioVoice.stop(false);
    };
  }, [
    screen,
    phase,
    activeCutsceneShot,
    cutsceneShots,
    cutsceneIndex,
    cutsceneMode,
    activeDilemma,
    sol,
    storyMemory,
    advanceCutsceneShot,
  ]);

  useEffect(() => {
    if (screen !== 'PLAYING' || phase !== 'SOL_DILEMMA' || !activeDilemma) {
      return;
    }
    radioVoice.speak(getDilemmaRadioLine(sol, activeDilemma, storyMemory), {
      speaker: 'control',
    });
    return () => {
      radioVoice.stop(false);
    };
  }, [screen, phase, activeDilemma, sol, storyMemory]);

  const startMission = useCallback(
    (customName?: string) => {
      clearSimTimer();
      radioVoice.unlock();
      const finalName = customName?.trim() || commanderName || 'Maya';
      setCommanderName(finalName);
      const targetSite = site;
      const initialForecast = buildSolForecast(1, targetSite, 'cadet', weather);
      const firstChapter = buildStoryChapterDilemma(
        1,
        targetSite,
        initialForecast,
        weather,
        INITIAL_STORY_MEMORY
      );
      const openingShots = getOpeningCutscene(weather);
      setSol(1);
      setSelectedModule('scrubber');
      setPanelsRetracted(false);
      setStoryMemory(INITIAL_STORY_MEMORY);
      setResources(getInitialResources(targetSite, 'cadet'));
      setAllocation({
        scrubber: 2,
        greenhouse: 1,
        shield: 1,
        lab: 1,
      });
      setActiveDilemma(firstChapter);
      setChosenOption(null);
      setLastPowerDeltas(ZERO_DELTAS);
      setOutcomeNotes([]);
      setSolNetDeltas(null);
      setSimPopups([]);
      setLogs([]);
      setFailureReason('');
      setCommsSecondsLeft(864);
      setScreen('PLAYING');
      radioVoice.prefetch([
        ...openingShots.slice(1).map((s) => s.radioLine ?? s.caption),
        getDilemmaRadioLine(1, firstChapter, INITIAL_STORY_MEMORY),
      ]);
      startCutscene(openingShots, 'intro', firstChapter.urgentSeconds ?? null);
    },
    [site, weather, commanderName, clearSimTimer, startCutscene]
  );

  const adjustModulePower = useCallback(
    (key: ModuleKey, delta: number) => {
      if (phase !== 'SOL_OUTCOME' || screen !== 'PLAYING') return;
      setAllocation((prev) => {
        const currentVal = prev[key];
        const nextVal = Math.max(0, Math.min(3, currentVal + delta));
        if (nextVal === currentVal) return prev;
        const nextAlloc = { ...prev, [key]: nextVal };
        if (getModuleUsedPower(nextAlloc) > maxAllowedUnits) {
          return prev;
        }
        soundEngine.playPowerAdjust(nextVal);
        triggerPulse(key);
        return nextAlloc;
      });
    },
    [phase, screen, maxAllowedUnits, triggerPulse]
  );

  const handleTap3DModule = useCallback(
    (key: ModuleKey) => {
      if (phase !== 'SOL_OUTCOME' || screen !== 'PLAYING') return;
      setSelectedModule(key);
      setAllocation((prev) => {
        const currentVal = prev[key];
        let nextVal = (currentVal + 1) % 4;
        const candidate = { ...prev, [key]: nextVal };
        if (getModuleUsedPower(candidate) > maxAllowedUnits) {
          nextVal = 0;
        }
        soundEngine.playPowerAdjust(nextVal);
        triggerPulse(key);
        return { ...prev, [key]: nextVal };
      });
    },
    [phase, screen, maxAllowedUnits, triggerPulse]
  );

  const checkFailure = useCallback((nextRes: CoreResources): string | null => {
    if (nextRes.health <= 0) {
      return `Commander ${commanderName}’s health dropped to 0%. Mission Control ordered an emergency evacuation.`;
    }
    if (nextRes.oxygen <= 0 && nextRes.power <= 0) {
      return `Both Power and Air hit 0%, forcing ${commanderName} into an emergency capsule abort.`;
    }
    return null;
  }, [commanderName]);

  const handleResolveDilemma = useCallback(
    (option: DilemmaOption, timedOut = false) => {
      if (phase !== 'SOL_DILEMMA' || screen !== 'PLAYING' || !activeDilemma) return;

      setUrgentSecondsLeft(null);
      if (option.retractPanels !== undefined) {
        setPanelsRetracted(option.retractPanels);
      }

      const nextMemory: StoryMemory = {
        ...storyMemory,
        retractedPanelsOn214:
          sol === 1 ? Boolean(option.retractPanels) : storyMemory.retractedPanelsOn214,
        waterShieldedFlare:
          option.id === 'flood-water-shield' ? true : storyMemory.waterShieldedFlare,
        actedWithoutEarth: option.id === 'maya-acts-now' ? true : storyMemory.actedWithoutEarth,
        wentOnEva: option.id === 'hero-eva-expedition' ? true : storyMemory.wentOnEva,
      };
      setStoryMemory(nextMemory);

      const { next, secondaryNotes } = applyDeltas(resources, option.deltas);
      const timeoutPrefix = timedOut ? ['Time ran out! Using fallback plan.'] : [];
      const combinedNotes = [...timeoutPrefix, ...outcomeNotes, ...secondaryNotes];
      const combinedDeltas: ResourceDeltas = {
        power: lastPowerDeltas.power + option.deltas.power,
        oxygen: lastPowerDeltas.oxygen + option.deltas.oxygen,
        food: lastPowerDeltas.food + option.deltas.food,
        health: lastPowerDeltas.health + option.deltas.health,
        science: lastPowerDeltas.science + option.deltas.science,
      };

      setResources(next);
      setChosenOption(option);
      setOutcomeNotes(combinedNotes);
      setSolNetDeltas(combinedDeltas);
      setLogs((prev) => [
        ...prev,
        {
          sol: displaySol,
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

      startCutscene(getChoiceOutcomeCutscene(sol, option, nextMemory), 'outcome', null);
    },
    [
      phase,
      screen,
      activeDilemma,
      sol,
      storyMemory,
      resources,
      outcomeNotes,
      lastPowerDeltas,
      displaySol,
      forecast.title,
      checkFailure,
      startCutscene,
    ]
  );

  useEffect(() => {
    if (
      screen !== 'PLAYING' ||
      phase !== 'SOL_DILEMMA' ||
      urgentSecondsLeft === null ||
      !activeDilemma
    ) {
      return;
    }

    if (urgentSecondsLeft <= 0) {
      handleResolveDilemma(activeDilemma.options[2], true);
      return;
    }

    const id = window.setTimeout(() => {
      const nextSec = urgentSecondsLeft - 1;
      setUrgentSecondsLeft(nextSec);
      if (nextSec > 0) {
        soundEngine.playCountdownTick(nextSec <= 3);
      }
    }, 1000);

    return () => window.clearTimeout(id);
  }, [screen, phase, urgentSecondsLeft, activeDilemma, handleResolveDilemma]);

  const handleNextSol = useCallback(() => {
    if (phase !== 'SOL_OUTCOME' || screen !== 'PLAYING') return;

    if (sol >= TOTAL_SOLS) {
      startCutscene(getVictoryCutscene(), 'victory', null);
      return;
    }

    const nextSol = sol + 1;
    const nextForecast = buildSolForecast(nextSol, site, 'cadet', weather);
    const nextMaxUnits = nextForecast.solarBudget + (resources.power >= 20 ? 2 : 0);
    const nextAlloc = { ...allocation };
    while (getModuleUsedPower(nextAlloc) > nextMaxUnits) {
      if (nextAlloc.lab > 0) nextAlloc.lab -= 1;
      else if (nextAlloc.greenhouse > 0) nextAlloc.greenhouse -= 1;
      else if (nextAlloc.shield > 0) nextAlloc.shield -= 1;
      else if (nextAlloc.scrubber > 0) nextAlloc.scrubber -= 1;
      else break;
    }

    const powerDeltas = calculatePowerAllocationDeltas(nextAlloc, nextForecast, site, 'cadet');
    const { next, secondaryNotes } = applyDeltas(resources, powerDeltas);

    setSol(nextSol);
    setPanelsRetracted(false);
    setAllocation(nextAlloc);
    setResources(next);
    setLastPowerDeltas(powerDeltas);
    setOutcomeNotes(secondaryNotes);
    setSimPopups(getDeltaChips(powerDeltas));
    setActiveDilemma(null);
    setChosenOption(null);
    setSolNetDeltas(null);
    setUrgentSecondsLeft(null);
    setPhase('SIMULATING_SOL');
    soundEngine.playSolLaunch();

    clearSimTimer();
    simTimerRef.current = window.setTimeout(() => {
      simTimerRef.current = null;
      const failMsg = checkFailure(next);
      if (failMsg) {
        setFailureReason(failMsg);
        setScreen('MISSION_FAILED');
        soundEngine.playFailure();
        return;
      }

      const chapter = buildStoryChapterDilemma(
        nextSol,
        site,
        nextForecast,
        weather,
        storyMemory
      );
      setActiveDilemma(chapter);
      setCommsSecondsLeft(864);
      setSimPopups([]);
      startCutscene(
        getChapterIntroCutscene(nextSol, nextForecast, storyMemory),
        'chapter',
        chapter.urgentSeconds ?? null
      );
    }, 900);
  }, [
    phase,
    screen,
    sol,
    site,
    weather,
    resources,
    allocation,
    storyMemory,
    clearSimTimer,
    checkFailure,
    startCutscene,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'm' || e.key === 'M') {
        toggleMute();
        return;
      }
      if (e.key === 'Escape') {
        if (screen === 'PLAYING') {
          setScreen('PAUSED');
        } else if (screen === 'PAUSED') {
          setScreen('PLAYING');
        }
        return;
      }

      if (screen === 'TITLE_MENU' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        startMission();
        return;
      }

      if (screen === 'PLAYING' && phase === 'CUTSCENE') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          advanceCutsceneShot();
        }
        return;
      }

      if (screen === 'PLAYING' && phase === 'SOL_OUTCOME') {
        if (e.key === '1') setSelectedModule('scrubber');
        if (e.key === '2') setSelectedModule('greenhouse');
        if (e.key === '3') setSelectedModule('shield');
        if (e.key === '4') setSelectedModule('lab');
        if (e.key === '+' || e.key === '=') adjustModulePower(selectedModule, 1);
        if (e.key === '-' || e.key === '_') adjustModulePower(selectedModule, -1);
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNextSol();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    screen,
    phase,
    selectedModule,
    toggleMute,
    startMission,
    advanceCutsceneShot,
    adjustModulePower,
    handleNextSol,
  ]);

  const siteProfile = SITE_PROFILES[site];

  const binaryOptions: DilemmaOption[] = useMemo(() => {
    if (!activeDilemma) return [];
    return [activeDilemma.options[0], activeDilemma.options[2]];
  }, [activeDilemma]);

  return (
    <div className="w-screen h-dvh overflow-hidden bg-[#04070F] flex items-center justify-center">
      {/* Full-Height Portrait Game Viewport */}
      <div className="relative w-full max-w-[460px] h-dvh overflow-hidden bg-[#070B16] sm:border-x sm:border-slate-800/90 shadow-2xl">
        {/* Continuous 100% Height 3D World */}
        <OutpostCanvas3D
          site={site}
          allocation={allocation}
          selectedModule={selectedModule}
          forecast={forecast}
          solNumber={sol}
          canEditPower={screen === 'PLAYING' && phase === 'SOL_OUTCOME'}
          isSimulating={screen === 'PLAYING' && phase === 'SIMULATING_SOL'}
          panelsRetracted={panelsRetracted}
          commsActive={
            screen === 'PLAYING' &&
            phase === 'SOL_DILEMMA' &&
            Boolean(activeDilemma?.requiresCommsDelay)
          }
          isTitleMode={screen === 'TITLE_MENU'}
          cutscenePreset={
            screen === 'PLAYING' && activeCutsceneShot ? activeCutsceneShot.preset : 'none'
          }
          cutsceneShotKey={activeCutsceneShot ? activeCutsceneShot.id : ''}
          cutsceneFlags={
            activeCutsceneShot
              ? {
                  dustBoost: activeCutsceneShot.dustBoost,
                  flareBoost: activeCutsceneShot.flareBoost,
                  commsBeamBoost: activeCutsceneShot.commsBeamBoost,
                  landerDescending: activeCutsceneShot.landerDescending,
                }
              : undefined
          }
          pulseEvent={pulseEvent}
          onTapModule={handleTap3DModule}
        />

        {/* Lean Floating Top HUD (hidden during cut scenes) */}
        {screen !== 'TITLE_MENU' && phase !== 'CUTSCENE' && (
          <header className="absolute top-0 inset-x-0 z-20 bg-gradient-to-b from-[#070B16]/95 via-[#070B16]/75 to-transparent px-3 pt-2.5 pb-4 space-y-1.5 pointer-events-auto">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 text-xs">
                <span className="font-display font-bold text-white truncate">
                  Jezero · {commanderName}
                </span>
                <span className="text-slate-400" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono font-bold text-amber-300 tabular-nums shrink-0">
                  Day {displaySol}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="min-h-[36px] min-w-[36px] rounded-lg bg-[#0F172A]/90 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                  aria-label={muted ? 'Unmute sound' : 'Mute sound'}
                >
                  {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setScreen('PAUSED')}
                  className="min-h-[36px] min-w-[36px] rounded-lg bg-[#0F172A]/90 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                  aria-label="Pause Mission"
                >
                  <Pause className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              <HudMeter
                label="Pwr"
                value={resources.power}
                icon={<Zap className="w-3 h-3 text-amber-400" aria-hidden="true" />}
                barColor="bg-amber-400"
              />
              <HudMeter
                label="Air"
                value={resources.oxygen}
                icon={<Wind className="w-3 h-3 text-cyan-400" aria-hidden="true" />}
                barColor="bg-cyan-400"
              />
              <HudMeter
                label="Food"
                value={resources.food}
                icon={<Sprout className="w-3 h-3 text-emerald-400" aria-hidden="true" />}
                barColor="bg-emerald-400"
              />
              <HudMeter
                label="Hlth"
                value={resources.health}
                icon={<Activity className="w-3 h-3 text-sky-400" aria-hidden="true" />}
                barColor="bg-sky-400"
              />
              <HudMeter
                label="Sci"
                value={resources.science}
                icon={<FlaskConical className="w-3 h-3 text-indigo-400" aria-hidden="true" />}
                barColor="bg-indigo-400"
                isGoal
              />
            </div>
          </header>
        )}

        {/* Title Screen Overlay */}
        {screen === 'TITLE_MENU' && (
          <TitleScreen
            weather={weather}
            muted={muted}
            onStart={(name) => startMission(name)}
            onToggleMute={toggleMute}
          />
        )}

        {/* Floating Resource Popups during Simulation */}
        {screen === 'PLAYING' && phase === 'SIMULATING_SOL' && simPopups.length > 0 && (
          <div className="absolute inset-x-4 bottom-20 z-20 pointer-events-none flex flex-wrap items-center justify-center gap-2">
            {simPopups.map((chip) => (
              <span
                key={chip.label}
                className={`px-3 py-1.5 rounded-xl font-mono font-bold text-xs shadow-lg border ${
                  chip.positive
                    ? 'bg-emerald-950/95 border-emerald-500/70 text-emerald-300'
                    : 'bg-rose-950/95 border-rose-500/70 text-rose-300'
                }`}
              >
                {chip.label}
              </span>
            ))}
          </div>
        )}

        {/* Cinematic Cut Scene Overlay */}
        {screen === 'PLAYING' && phase === 'CUTSCENE' && activeCutsceneShot && (
          <CutsceneOverlay
            shot={activeCutsceneShot}
            shotIndex={cutsceneIndex}
            totalShots={cutsceneShots.length}
            radioTransmitting={radioTransmitting}
            onReplayRadio={replayCutsceneRadio}
            onAdvance={advanceCutsceneShot}
            onSkipAll={finishCutscene}
          />
        )}

        {/* LIGHTWEIGHT FLOATING STORY CARD AT BOTTOM */}
        {screen === 'PLAYING' && phase !== 'CUTSCENE' && (
          <div className="absolute bottom-3 inset-x-3 z-20 pointer-events-auto">
            {phase === 'SIMULATING_SOL' ? (
              <div className="rounded-2xl bg-[#0F172A]/95 border border-slate-700/90 px-4 py-3 shadow-2xl space-y-2">
                <p className="text-xs font-semibold text-amber-300 text-center">
                  Commander {commanderName} is running Day {displaySol}...
                </p>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full w-full transition-transform duration-1000 origin-left" />
                </div>
              </div>
            ) : phase === 'SOL_DILEMMA' && activeDilemma ? (
              <div className="rounded-2xl bg-[#0F172A]/96 border border-slate-700/90 p-3 shadow-2xl space-y-2.5 max-h-[46dvh] overflow-y-auto">
                {urgentSecondsLeft !== null && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono font-bold tabular-nums">
                      <span className="flex items-center gap-1 text-rose-300">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Decide Fast!</span>
                      </span>
                      <span className={urgentSecondsLeft <= 3 ? 'text-rose-400' : 'text-amber-300'}>
                        {urgentSecondsLeft}s
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full w-full transition-transform duration-1000 linear origin-left ${
                          urgentSecondsLeft <= 3 ? 'bg-rose-500' : 'bg-amber-400'
                        }`}
                        style={{
                          transform: `scaleX(${Math.max(
                            0,
                            Math.min(1, urgentSecondsLeft / (activeDilemma.urgentSeconds || 10))
                          )})`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display font-bold text-sm text-white leading-tight">
                      {activeDilemma.title}
                    </h2>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {activeDilemma.requiresCommsDelay && (
                        <span className="flex items-center gap-1 text-[11px] font-mono tabular-nums text-amber-300">
                          <Radio className="w-3.5 h-3.5" aria-hidden="true" />
                          {`${Math.floor(commsSecondsLeft / 60)}m ${String(commsSecondsLeft % 60).padStart(2, '0')}s`}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={replayDilemmaRadio}
                        className={`min-h-[36px] px-2.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                          radioTransmitting
                            ? 'bg-emerald-950 border-emerald-500/80 text-emerald-300'
                            : 'bg-[#162033] hover:bg-slate-800 border-slate-700 text-slate-200'
                        }`}
                        aria-label="Replay Control Center radio briefing"
                      >
                        <Radio className="w-3 h-3" aria-hidden="true" />
                        <span>{radioTransmitting ? 'On Air' : 'Radio'}</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-200 leading-snug mt-1">
                    {activeDilemma.briefing}{' '}
                    {activeDilemma.requiresCommsDelay && (
                      <GlossaryTerm termKey="Light-Time Delay" label="Why delay?" />
                    )}
                    {activeDilemma.category === 'Solar Weather' && (
                      <GlossaryTerm termKey="CME" label="CME?" />
                    )}
                  </p>
                </div>

                <div className="space-y-2">
                  {binaryOptions.map((opt) => {
                    const chips = getDeltaChips(opt.deltas).slice(0, 3);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleResolveDilemma(opt)}
                        className="w-full min-h-[52px] text-left px-3 py-2 rounded-xl bg-[#162033] hover:bg-[#1E2C47] border border-slate-700 hover:border-amber-400 transition-colors flex flex-col justify-center gap-1 cursor-pointer"
                      >
                        <span className="font-display font-bold text-sm text-white leading-tight">
                          {opt.label}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          {chips.map((c) => (
                            <span
                              key={c.label}
                              className={`text-[11px] font-mono font-semibold tabular-nums ${
                                c.positive ? 'text-emerald-300' : 'text-rose-300'
                              }`}
                            >
                              {c.label}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : phase === 'SOL_OUTCOME' && chosenOption ? (
              <div className="rounded-2xl bg-[#0F172A]/96 border border-slate-700/90 p-3 shadow-2xl space-y-2.5 max-h-[48dvh] overflow-y-auto">
                <div className="space-y-1">
                  <p className="font-display font-bold text-sm text-amber-300">
                    {chosenOption.label}
                  </p>
                  {solNetDeltas && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono font-semibold tabular-nums">
                      {getDeltaChips(solNetDeltas).map((c) => (
                        <span
                          key={c.label}
                          className={c.positive ? 'text-emerald-300' : 'text-rose-300'}
                        >
                          {c.label}
                        </span>
                      ))}
                    </div>
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
                    <strong>NASA Fact:</strong> {chosenOption.scienceTakeaway}
                  </p>
                </div>

                {sol < TOTAL_SOLS && (
                  <div className="pt-1.5 border-t border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-slate-300 truncate">
                        <strong className="text-amber-300">Day {displaySol + 1}:</strong>{' '}
                        {nextSolForecast.radiationMsv >= 18
                          ? 'Solar Storm! Tap Shield'
                          : nextSolForecast.dustStormActive
                            ? 'Dust Storm · Low Solar'
                            : nextSolForecast.title}
                      </span>
                      <span
                        className={`font-mono font-bold tabular-nums shrink-0 ${
                          overdrivenBars > 0
                            ? 'text-rose-300'
                            : remainingSolarBars > 0
                              ? 'text-emerald-300'
                              : 'text-amber-300'
                        }`}
                      >
                        {overdrivenBars > 0
                          ? 'Using Battery'
                          : `${remainingSolarBars} Solar Left`}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {MODULE_ORDER.map((key) => {
                        const info = MODULE_INFO[key];
                        const level = allocation[key];
                        const active = selectedModule === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleTap3DModule(key)}
                            title={getKidEffectLine(
                              key,
                              level,
                              site,
                              nextSolForecast.radiationMsv
                            )}
                            className={`min-h-[36px] px-1.5 py-1 rounded-xl border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#1A2947] border-amber-400 text-white'
                                : 'bg-[#131D33] border-slate-700/70 text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            <span className="font-display font-bold text-xs">{info.shortName}</span>
                            <span className="flex items-center gap-0.5" aria-hidden="true">
                              {[1, 2, 3].map((pip) => (
                                <span
                                  key={pip}
                                  className={`w-1.5 h-2 rounded-[2px] ${
                                    level >= pip ? info.dotClass : 'bg-slate-700'
                                  }`}
                                />
                              ))}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleNextSol}
                  className="w-full min-h-[46px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-extrabold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>{sol >= TOTAL_SOLS ? 'Finish Story' : `Next: Day ${displaySol + 1}`}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </div>
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
                  {siteProfile.name} · Day {displaySol}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setScreen('PLAYING')}
                  className="min-h-[44px] w-full px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-slate-950" aria-hidden="true" />
                  <span>Resume Story</span>
                </button>
                <button
                  type="button"
                  onClick={() => startMission(commanderName)}
                  className="min-h-[44px] w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>Restart Day 1</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearSimTimer();
                    setScreen('TITLE_MENU');
                  }}
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
            commanderName={commanderName}
            resources={resources}
            logs={logs}
            onPlayAgain={() => startMission(commanderName)}
            onChangeSite={() => setScreen('TITLE_MENU')}
          />
        )}
      </div>
    </div>
  );
}

interface HudMeterProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  barColor: string;
  isGoal?: boolean;
}

function HudMeter({ label, value, icon, barColor, isGoal = false }: HudMeterProps) {
  const isDanger = !isGoal && value <= 20;

  return (
    <div
      className={`flex flex-col gap-1 min-w-0 rounded-lg px-1.5 py-1 ${
        isDanger ? 'bg-rose-950/75 border border-rose-500/70' : 'bg-[#0F182D]/90'
      }`}
    >
      <div className="flex items-center justify-between gap-0.5 text-[11px]">
        <span className="flex items-center gap-0.5 font-semibold text-slate-200 truncate">
          {icon}
          <span>{label}</span>
        </span>
        <span
          className={`font-mono font-bold tabular-nums shrink-0 ${
            isDanger ? 'text-rose-300' : 'text-white'
          }`}
        >
          {value}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full w-full transition-transform duration-150 origin-left ${
            isDanger ? 'bg-rose-500' : barColor
          }`}
          style={{ transform: `scaleX(${Math.max(0, Math.min(1, value / 100))})` }}
        />
      </div>
    </div>
  );
}
