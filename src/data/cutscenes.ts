import type {
  CutsceneShot,
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
      durationMs: 2800,
      speaker: 'Commander Maya',
      caption:
        'Sol 214 at Jezero Crater, Mars. Solar panels are humming and our domes are pressurized.',
      mood: 'calm',
    },
    {
      id: 'opening-2',
      preset: 'intro_dust_wall',
      durationMs: 3000,
      speaker: 'Storm Alert',
      caption: `Wait—an iron-dust storm just crested the canyon rim! ${weather.latestFlareClass} solar wind is rising. Save the arrays!`,
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
        durationMs: 2400,
        speaker: `Commander Maya · Sol ${displaySol}`,
        caption: memory.retractedPanelsOn214
          ? 'Morning light breaks over Jezero. The folded solar wings survived clean, though our battery gauge is low.'
          : 'Dawn reveals fine Martian grit crusted over the solar glass after last night’s howling storm.',
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
        speaker: `NASA DONKI Alert · Sol ${displaySol}`,
        caption: `A ${forecast.flareClass} solar proton wave is racing toward Mars! Our shelter dosimeter beacon just went hot.`,
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
        speaker: `Comms Alarm · Sol ${displaySol}`,
        caption:
          'Airlock leak at the greenhouse! Radio signals take 14 minutes round-trip—Earth cannot answer in time.',
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
        speaker: `Commander Maya · Sol ${displaySol}`,
        caption:
          'Inside the geodesic farm, dwarf tomatoes and greens are ready to bloom under the grow lamps.',
        mood: 'calm',
      },
    ];
  }

  if (solIndex === 6) {
    return [
      {
        id: 'chap-219',
        preset: 'rover_eva',
        durationMs: 2400,
        speaker: `Commander Maya · Sol ${displaySol}`,
        caption:
          'Our 6-wheel rover spotted an ancient riverbed ridge just outside camp. One more Sol before relief arrives!',
        mood: 'calm',
      },
    ];
  }

  return [
    {
      id: 'chap-220',
      preset: 'lander_descent',
      durationMs: 2800,
      speaker: `Landing Radar · Sol ${displaySol}`,
      caption:
        'Final day! The Mars relief & cargo lander just lit its retro-thrusters above Pad 1!',
      landerDescending: true,
      dustBoost: true,
      mood: 'triumph',
    },
  ];
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
        durationMs: 2500,
        speaker: `Sol ${displaySol} Action`,
        caption: option.retractPanels
          ? 'Maya triggers the stow locks—both solar wings fold flat as Martian dust roars overhead!'
          : 'Maya keeps the solar panels angled into the gale—lamps blaze bright as grit pelts the glass!',
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
        speaker: `Sol ${displaySol} Action`,
        caption: brushedOutside
          ? 'Maya steps out beside the rover and sweeps red Martian dust off the solar glass!'
          : routedToFarm
            ? 'Cabin air reroutes smoothly through the geodesic plant beds.'
            : 'Maya routes emergency power to warm the O₂ scrubber and stabilize cabin air.',
        mood: 'calm',
      },
    ];
  }

  if (solIndex === 3) {
    return [
      {
        id: `out-${id}`,
        preset: id === 'flood-water-shield' ? 'shelter_water' : 'rover_eva',
        durationMs: 2500,
        speaker: `Sol ${displaySol} Action`,
        caption:
          id === 'flood-water-shield'
            ? 'Water surges from farm pipes into the shelter’s outer H₂O bladder tanks, braking cosmic protons!'
            : 'The rover’s spectrometer locks onto the sky while golden proton streaks sweep the ridge!',
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
        durationMs: 2500,
        speaker: `Sol ${displaySol} Action`,
        caption:
          id === 'maya-acts-now'
            ? 'Maya slams the bulkhead seal shut and spins the O₂ scrubbers to max—no waiting on Earth!'
            : 'The deep-space dish beams an urgent ping across 130 million km while airlock pressure dips.',
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
        speaker: `Sol ${displaySol} Action`,
        caption:
          id === 'full-grow-leds'
            ? 'Grow-lamps flood the geodesic farm in vivid magenta—crisp greens surge upward!'
            : 'Maya dims the lamps and seals cryogenic leaf vials for NASA’s OSDR lab.',
        mood: 'calm',
      },
    ];
  }

  if (solIndex === 6) {
    return [
      {
        id: `out-${id}`,
        preset: id === 'rest-and-eat-indoors' ? 'o2_dome' : 'rover_eva',
        durationMs: 2400,
        speaker: `Sol ${displaySol} Action`,
        caption:
          id === 'rest-and-eat-indoors'
            ? 'Maya cycles back into the warm hab dome for rest and fresh rations.'
            : 'Maya steps out beside the 6-wheel rover to collect ancient Jezero river-rock cores!',
        mood: 'calm',
      },
    ];
  }

  return [
    {
      id: `out-${id}`,
      preset: 'lander_descent',
      durationMs: 2700,
      speaker: `Touchdown · Sol ${displaySol}`,
      caption:
        'Golden thruster plumes flare over Pad 1—the Mars relief lander settles safely onto Jezero Crater!',
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
      durationMs: 2900,
      speaker: 'Commander Maya · Mission Accomplished',
      caption:
        'Pad 1 engines powered down! Seven Martian sols survived—welcome to the relief crew, Cadet!',
      mood: 'triumph',
    },
  ];
}
