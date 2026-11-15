export type GameScreen = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'MISSION_COMPLETE' | 'MISSION_FAILED';

export type OutpostSite = 'moon' | 'mars' | 'europa';

export type DifficultyMode = 'cadet' | 'commander';

export type ModuleKey = 'scrubber' | 'greenhouse' | 'shield' | 'lab';

export type SolPhase = 'ALLOCATE_POWER' | 'SIMULATING_SOL' | 'SOL_DILEMMA' | 'SOL_OUTCOME';

export interface CoreResources {
  power: number; // 0 - 100
  oxygen: number; // 0 - 100
  food: number; // 0 - 100
  health: number; // 0 - 100 (Crew Health & Shielding)
  science: number; // 0 - 100 (Mission Discovery Progress)
}

export interface ModuleAllocation {
  scrubber: number; // 0 - 3
  greenhouse: number; // 0 - 3
  shield: number; // 0 - 3
  lab: number; // 0 - 3
}

export interface SpaceWeatherSnapshot {
  sourceMode: 'live' | 'curated-archive';
  sourceLabel: string;
  fetchedAt: string;
  latestFlareClass: string;
  flareTimestamp: string;
  kpIndex: number;
  solarWindSpeedKms: number;
  radiationRiskLevel: 'Low' | 'Moderate' | 'High';
  marsSolWeather: {
    location: string;
    solLabel: string;
    highTempC: number;
    lowTempC: number;
    pressurePa: number;
    dustOpacityTau: number;
    sourceNote: string;
  };
  lunarEnvData: {
    location: string;
    sunlitTempC: number;
    shadowTempC: number;
    oneWayLightDelaySec: number;
    sourceNote: string;
  };
}

export interface SolForecast {
  sol: number;
  title: string;
  weatherSummary: string;
  solarBudget: number; // Free daily power units from solar panels (3 - 6)
  radiationMsv: number; // Incoming daily radiation hazard (6 - 30)
  flareClass: string; // e.g. 'C1.8', 'M4.2', 'X2.1'
  dustStormActive: boolean;
  lunarShadowDip: boolean;
  nasaContextNote: string;
}

export interface ResourceDeltas {
  power: number;
  oxygen: number;
  food: number;
  health: number;
  science: number;
}

export interface DilemmaOption {
  id: string;
  label: string;
  tradeOffSummary: string;
  deltas: ResourceDeltas;
  outcomeStory: string;
  scienceTakeaway: string;
}

export interface DilemmaCard {
  id: string;
  title: string;
  category: 'Solar Weather' | 'Life Support' | 'Comms Delay' | 'Biology & Food' | 'Rover Science';
  siteFilter: 'both' | OutpostSite;
  requiresCommsDelay?: boolean;
  commsDelayLabel?: string;
  briefing: string;
  nasaCitation: string;
  options: [DilemmaOption, DilemmaOption, DilemmaOption];
}

export interface SolLogEntry {
  sol: number;
  forecastTitle: string;
  dilemmaTitle: string;
  chosenLabel: string;
  summary: string;
  netDeltas: ResourceDeltas;
}

export interface GlossaryEntry {
  term: string;
  shortMeaning: string;
  kidExplanation: string;
  nasaFact: string;
}
