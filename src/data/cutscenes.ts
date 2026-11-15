import type {
  CutsceneShot,
  DilemmaCard,
  DilemmaOption,
  SolForecast,
  SpaceWeatherSnapshot,
} from '../types/game';
import { MISSION_START_SOL, type StoryMemory } from './storyChapters';

export function getOpeningCutscene(weather: SpaceWeatherSnapshot): CutsceneShot[] {
  return [
    {
      id: 'opening-1',
      preset: 'intro_outpost',
      durationMs: 2600,
      speaker: 'Houston Control',
      caption: 'Sol 214, Jezero Crater. Solar panels and domes are online.',
      radioLine: 'Sol 214 at Jezero Crater. Solar panels and domes are online.',
      mood: 'calm',
    },
    {
      id: 'opening-2',
      preset: 'intro_dust_wall',
      durationMs: 2800,
      speaker: 'Storm Alert · Control Center',
      caption: `Alert! A Martian dust storm is racing toward the solar panels! (${weather.latestFlareClass} solar wind)`,
      radioLine: 'Alert! A Martian dust storm is racing toward your solar panels!',
      dustBoost: true,
      mood: 'alert',
    },
  ];
}

export function getChapterIntroCutscene(
  solIndex: number,
  forecast: SolForecast,
  memory: StoryMemory
): CutsceneShot[] {
  const displaySol = MISSION_START_SOL + solIndex - 1;

  if (solIndex === 2) {
    return [
      {
        id: 'chap-215',
        preset: 'solar_arrays',
        durationMs: 2500,
        speaker: `Houston Control · Sol ${displaySol}`,
        caption: memory.retractedPanelsOn214
          ? 'Folded panels stayed clean, though batteries ran low overnight.'
          : 'Martian dust coated the solar panels overnight, cutting power.',
        radioLine: memory.retractedPanelsOn214
          ? `Sol ${displaySol}. Folded panels stayed clean, though batteries ran low overnight.`
          : `Sol ${displaySol}. Martian dust coated the solar panels overnight, cutting power.`,
        mood: 'calm',
      },
    ];
  }

  if (solIndex === 3) {
    return [
      {
        id: 'chap-216',
        preset: 'shelter_water',
        durationMs: 2600,
        speaker: `Space Weather Desk · Sol ${displaySol}`,
        caption: `${forecast.flareClass} solar radiation wave incoming! Shelter alarm active.`,
        radioLine: `${forecast.flareClass} solar radiation wave incoming! Shelter alarm is active.`,
        flareBoost: true,
        mood: 'alert',
      },
    ];
  }

  if (solIndex === 4) {
    return [
      {
        id: 'chap-217',
        preset: 'comms_dish',
        durationMs: 2600,
        speaker: `Deep Space Network · Sol ${displaySol}`,
        caption: 'Greenhouse airlock leak! Radio takes 14 minutes—Earth cannot answer in time.',
        radioLine: 'Greenhouse airlock leak! Earth radio takes 14 minutes—you’re on your own!',
        commsBeamBoost: true,
        mood: 'alert',
      },
    ];
  }

  if (solIndex === 5) {
    return [
      {
        id: 'chap-218',
        preset: 'farm_dome',
        durationMs: 2400,
        speaker: `Houston Science · Sol ${displaySol}`,
        caption: 'Greenhouse crops are ready to bloom under the grow lamps.',
        radioLine: `Sol ${displaySol}. Greenhouse crops are ready to bloom.`,
        mood: 'calm',
      },
    ];
  }

  if (solIndex === 6) {
    return [
      {
        id: 'chap-219',
        preset: 'rover_eva',
        durationMs: 2500,
        speaker: `Houston Geology · Sol ${displaySol}`,
        caption: 'Ancient riverbed rocks spotted outside. One more Sol until relief lands!',
        radioLine: `Sol ${displaySol}. Ancient riverbed rocks spotted outside—one day till relief lands!`,
        mood: 'calm',
      },
    ];
  }

  return [
    {
      id: 'chap-220',
      preset: 'lander_descent',
      durationMs: 2800,
      speaker: `Landing Control · Sol ${displaySol}`,
      caption: 'Final day! Relief cargo lander descending toward Pad 1!',
      radioLine: `Sol ${displaySol}, final day! Relief cargo lander descending toward Pad 1!`,
      landerDescending: true,
      dustBoost: true,
      mood: 'triumph',
    },
  ];
}

export function getDilemmaRadioLine(
  solIndex: number,
  dilemma: DilemmaCard,
  memory: StoryMemory
): string {
  if (solIndex === 1) {
    return 'Ten seconds! Fold the solar panels to protect them, or leave them out for power?';
  }
  if (solIndex === 2) {
    return memory.retractedPanelsOn214
      ? 'Oxygen scrubber is cold. Spend battery to warm it, or route air through the greenhouse?'
      : 'Dust is blocking the panels. Suit up outside to brush them clean, or stay inside and save air?';
  }
  if (solIndex === 3) {
    return 'Ten seconds! Pump farm water into the walls to block radiation, or keep the rover scanning?';
  }
  if (solIndex === 4) {
    return 'Ten seconds! Seal the hatch and boost oxygen now, or wait for Earth’s checklist?';
  }
  if (solIndex === 5) {
    return 'Blast grow lights for fresh food and air, or dim lights to save power and freeze samples?';
  }
  if (solIndex === 6) {
    return 'Keep Maya indoors to rest before landing day, or send her outside for rock samples?';
  }
  if (solIndex === 7) {
    return 'Final call! Cut lab power for a safe radar landing, or run full dust sensors during touchdown?';
  }
  return dilemma.briefing;
}

export function getChoiceOutcomeCutscene(
  solIndex: number,
  option: DilemmaOption,
  memory: StoryMemory
): CutsceneShot[] {
  const displaySol = MISSION_START_SOL + solIndex - 1;
  const id = option.id;

  if (solIndex === 1) {
    return [
      {
        id: `out-${id}`,
        preset: 'solar_arrays',
        durationMs: 2400,
        speaker: `Sol ${displaySol} · Control Link`,
        caption: option.retractPanels
          ? 'Solar wings folded flat before the storm hit. Running on battery tonight.'
          : 'Panels stayed open in the storm—power is up, but seals and health took a hit.',
        radioLine: option.retractPanels
          ? 'Panels folded safe! Running on battery tonight.'
          : 'Panels staying open! Power is up, watch your seals and crew health.',
        dustBoost: true,
        mood: option.retractPanels ? 'calm' : 'alert',
      },
    ];
  }

  if (solIndex === 2) {
    const brushedOutside = id === 'clean-or-warm-safe' && !memory.retractedPanelsOn214;
    const routedToFarm = id === 'save-batteries-conserve' && memory.retractedPanelsOn214;
    return [
      {
        id: `out-${id}`,
        preset: brushedOutside ? 'rover_eva' : routedToFarm ? 'farm_dome' : 'o2_dome',
        durationMs: 2300,
        speaker: `Sol ${displaySol} · Control Link`,
        caption: brushedOutside
          ? 'Dust brushed off the solar panels—power is climbing back.'
          : routedToFarm
            ? 'Cabin air routes through the greenhouse plants to scrub CO₂.'
            : 'Reserve battery power warms up the O₂ scrubber.',
        radioLine: brushedOutside
          ? 'Dust cleared—solar power is climbing back.'
          : routedToFarm
            ? 'Cabin air routed through the plants to scrub CO₂.'
            : 'Reserve power is warming the oxygen scrubber.',
        mood: 'calm',
      },
    ];
  }

  if (solIndex === 3) {
    return [
      {
        id: `out-${id}`,
        preset: id === 'flood-water-shield' ? 'shelter_water' : 'rover_eva',
        durationMs: 2400,
        speaker: `Sol ${displaySol} · Control Link`,
        caption:
          id === 'flood-water-shield'
            ? 'Farm water fills the shelter walls, blocking incoming radiation.'
            : 'Rover keeps scanning the storm while radiation spikes outside.',
        radioLine:
          id === 'flood-water-shield'
            ? 'Water walls are up and blocking the radiation.'
            : 'Rover is scanning the storm, but crew radiation is rising.',
        flareBoost: true,
        mood: id === 'flood-water-shield' ? 'calm' : 'alert',
      },
    ];
  }

  if (solIndex === 4) {
    return [
      {
        id: `out-${id}`,
        preset: id === 'maya-acts-now' ? 'o2_dome' : 'comms_dish',
        durationMs: 2400,
        speaker: `Sol ${displaySol} · Control Link`,
        caption:
          id === 'maya-acts-now'
            ? 'Hatch sealed and scrubbers boosted—cabin pressure holds!'
            : 'Waiting for Earth let precious oxygen leak through the seal.',
        radioLine:
          id === 'maya-acts-now'
            ? 'Good call! Hatch sealed and cabin pressure is holding.'
            : 'Waiting on Earth lost precious oxygen through the leak.',
        commsBeamBoost: true,
        mood: id === 'maya-acts-now' ? 'calm' : 'alert',
      },
    ];
  }

  if (solIndex === 5) {
    return [
      {
        id: `out-${id}`,
        preset: 'farm_dome',
        durationMs: 2300,
        speaker: `Sol ${displaySol} · Control Link`,
        caption:
          id === 'full-grow-leds'
            ? 'Full grow-lights boost fresh food and extra oxygen.'
            : 'Lights dimmed to save power and freeze plant samples for NASA.',
        radioLine:
          id === 'full-grow-leds'
            ? 'Grow lights at max—fresh food and bonus oxygen coming online.'
            : 'Lights dimmed—power saved and plant samples locked in.',
        mood: 'calm',
      },
    ];
  }

  if (solIndex === 6) {
    return [
      {
        id: `out-${id}`,
        preset: id === 'rest-and-eat-indoors' ? 'o2_dome' : 'rover_eva',
        durationMs: 2300,
        speaker: `Sol ${displaySol} · Control Link`,
        caption:
          id === 'rest-and-eat-indoors'
            ? 'Maya rests inside with a warm meal—health recovers.'
            : 'Maya and the rover drill ancient Jezero rock samples outside.',
        radioLine:
          id === 'rest-and-eat-indoors'
            ? 'Maya is resting inside—crew health is bouncing back.'
            : 'Maya and the rover are drilling ancient rock samples now.',
        mood: 'calm',
      },
    ];
  }

  return [
    {
      id: `out-${id}`,
      preset: 'lander_descent',
      durationMs: 2600,
      speaker: `Touchdown · Sol ${displaySol}`,
      caption: 'Touchdown on Pad 1! Relief supplies have arrived safely.',
      radioLine: 'Touchdown on Pad 1! Relief lander is down safe!',
      landerDescending: true,
      dustBoost: true,
      mood: 'triumph',
    },
  ];
}

export function getVictoryCutscene(): CutsceneShot[] {
  return [
    {
      id: 'victory-1',
      preset: 'victory_celebration',
      durationMs: 2800,
      speaker: 'Houston Flight · Mission Accomplished',
      caption: 'Seven Martian sols survived! Welcome the relief crew, Cadet!',
      radioLine: 'Seven sols survived at Jezero Crater. Mission accomplished, Cadet!',
      mood: 'triumph',
    },
  ];
}
