import type { DilemmaCard, OutpostSite, SolForecast, SpaceWeatherSnapshot } from '../types/game';

export const MISSION_START_SOL = 214;

export interface StoryMemory {
  retractedPanelsOn214: boolean;
  waterShieldedFlare: boolean;
  actedWithoutEarth: boolean;
  wentOnEva: boolean;
}

export const INITIAL_STORY_MEMORY: StoryMemory = {
  retractedPanelsOn214: false,
  waterShieldedFlare: false,
  actedWithoutEarth: false,
  wentOnEva: false,
};

export function getAstronautBrief(
  solIndex: number,
  site: OutpostSite,
  forecast: SolForecast,
  memory: StoryMemory
): string {
  const displaySol = MISSION_START_SOL + solIndex - 1;
  const worldNoun = site === 'moon' ? 'lunar ridge' : site === 'mars' ? 'Jezero floor' : 'ice crust';

  if (solIndex === 1) {
    return `Sol ${displaySol}. I'm Commander Maya on solo watch. Route ${forecast.solarBudget} solar bars before dark—storm clouds are building.`;
  }
  if (solIndex === 2) {
    return memory.retractedPanelsOn214
      ? `Sol ${displaySol}. Retracting our arrays saved the hinges, though our battery bank is low. Help me balance air and power.`
      : `Sol ${displaySol}. Leaving the panels out powered last night, but grit jammed the joints. Let's nurse our power budget.`;
  }
  if (solIndex === 3) {
    return forecast.radiationMsv >= 18
      ? `Sol ${displaySol}. NASA DONKI just flashed a ${forecast.flareClass} flare alert! Check our Radiation Shield before running the base.`
      : `Sol ${displaySol}. Radiation sensors are rising across the ${worldNoun}. Let's protect crew health without starving the farm.`;
  }
  if (solIndex === 4) {
    return `Sol ${displaySol}. Earth is ${site === 'moon' ? '384,400 km' : site === 'mars' ? '130M km' : '780M km'} away today. Keep life support steady for field checks.`;
  }
  if (solIndex === 5) {
    return `Sol ${displaySol}. Equipment strain is piling up across the tunnels. Every watt has to count today.`;
  }
  if (solIndex === 6) {
    return `Sol ${displaySol}. One more Sol until the supply craft arrives. Keep Oxygen and Crew Health in the green!`;
  }
  return `Sol ${displaySol}. Final descent day! Hold our outpost steady until the supply lander touches down on Pad 1.`;
}

export function buildStoryChapterDilemma(
  solIndex: number,
  site: OutpostSite,
  forecast: SolForecast,
  weather: SpaceWeatherSnapshot,
  memory: StoryMemory
): DilemmaCard {
  const displaySol = MISSION_START_SOL + solIndex - 1;
  const liveTag =
    weather.sourceMode === 'live'
      ? `Live NOAA/NASA feed (${weather.latestFlareClass}, ${weather.solarWindSpeedKms} km/s)`
      : `NASA DONKI archive (${weather.latestFlareClass}, ${weather.solarWindSpeedKms} km/s)`;

  // CHAPTER 1 (Sol 214): Iconic 10-Second Storm Panel Decision
  if (solIndex === 1) {
    const stormType =
      site === 'moon'
        ? 'static dust & solar squall'
        : site === 'mars'
          ? 'fast-moving iron-dust storm'
          : 'cryo-plume ice squall';

    return {
      id: 'story-sol214-storm',
      title: `Sol ${displaySol}: 10 Seconds to Save the Arrays!`,
      category: 'Solar Weather',
      siteFilter: site,
      urgentSeconds: 10,
      briefing: `A sudden ${stormType} just rolled across the ridge! Your solar wings are about to get buried or sandblasted. Decide in 10 seconds:`,
      nasaCitation: 'NASA Artemis / Mars MEDA Dust & Solar Array Survival',
      options: [
        {
          id: 'retract-panels',
          label: 'Retract Panels & Ride Out Dark Night',
          tradeOffSummary: '-16 Power tonight · +8 Crew Health, Hardware Saved',
          deltas: { power: -16, oxygen: 0, food: 0, health: 8, science: 2 },
          retractPanels: true,
          outcomeStory:
            'Maya hit the stow switch with two seconds to spare! The solar wings folded flat safely as grit howled overhead, though cabin batteries paid tonight’s heating bill.',
          scienceTakeaway:
            'Retracting arrays protects hinges from storm grit, trading tonight’s power for tomorrow’s survival.',
        },
        {
          id: 'half-tilt-compromise',
          label: 'Feather Panels & Cut Heating',
          tradeOffSummary: '-6 Power · -6 Health',
          deltas: { power: -6, oxygen: 0, food: 0, health: -6, science: 0 },
          retractPanels: false,
          outcomeStory:
            'Maya feathered the panels halfway. Some power trickled in, though cold cabin air stiffened crew joints.',
          scienceTakeaway: 'Half-measures reduce storm drag without fully sealing delicate joints.',
        },
        {
          id: 'leave-panels-exposed',
          label: 'Leave Panels Out for Full Power Tonight',
          tradeOffSummary: '+10 Power tonight · -15 Crew Health, Storm Wear',
          deltas: { power: 10, oxygen: -4, food: 0, health: -15, science: 6 },
          retractPanels: false,
          outcomeStory:
            'Keeping the wings open kept lights blazing tonight, but heavy debris battered the motors and stressed air seals—tomorrow’s clean-up won’t be free!',
          scienceTakeaway:
            'Leaving arrays exposed yields short-term power at a serious hardware and crew-safety risk.',
        },
      ],
    };
  }

  // CHAPTER 2 (Sol 215): Consequence Ripple from Sol 214
  if (solIndex === 2) {
    return {
      id: 'story-sol215-aftermath',
      title: memory.retractedPanelsOn214
        ? `Sol ${displaySol}: Deep Battery Chill`
        : `Sol ${displaySol}: Sandblasted Array Joints`,
      category: 'Life Support',
      siteFilter: site,
      briefing: memory.retractedPanelsOn214
        ? 'Maya unfolded clean solar panels at dawn, but last night’s power loss left the O₂ scrubber cold and sluggish. How should she recover?'
        : 'Last night’s storm coated the exposed panels in fine grit and stressed a power relay. Maya needs a fast fix before noon:',
      nasaCitation: 'NASA ECLSS & Electrostatic Dust Mitigation',
      options: [
        {
          id: 'clean-or-warm-safe',
          label: memory.retractedPanelsOn214
            ? 'Warm Scrubber With Reserve Power'
            : 'Suit Up & Brush Panels With Rover',
          tradeOffSummary: memory.retractedPanelsOn214
            ? '+14 Oxygen, +4 Health · -14 Power'
            : '+14 Power, +8 Science · -10 Oxygen, -8 Health',
          deltas: memory.retractedPanelsOn214
            ? { power: -14, oxygen: 14, food: 0, health: 4, science: 0 }
            : { power: 14, oxygen: -10, food: 0, health: -8, science: 8 },
          outcomeStory: memory.retractedPanelsOn214
            ? 'Warming the electrolysis coils got fresh Oxygen bubbling right away—though Maya watched the battery gauge drop fast.'
            : 'Maya stepped outside beside the rover and brushed the glass clear! Power bounced back, at the cost of airlock O₂ and cosmic exposure.',
          scienceTakeaway:
            'Every recovery step in space trades one vital stockpile—battery watts, suit air, or crew exposure—for another.',
        },
        {
          id: 'balanced-ration',
          label: 'Run Half-Power Recovery',
          tradeOffSummary: '+4 Power · -4 Oxygen',
          deltas: { power: 4, oxygen: -4, food: 0, health: 0, science: 0 },
          outcomeStory: 'A gentle restart kept systems stable with small compromises.',
          scienceTakeaway: 'Gradual startups avoid voltage spikes on cold hardware.',
        },
        {
          id: 'save-batteries-conserve',
          label: memory.retractedPanelsOn214
            ? 'Route Cabin Air Through Greenhouse Instead'
            : 'Leave Grit & Conserve Crew Stamina',
          tradeOffSummary: memory.retractedPanelsOn214
            ? '+8 Oxygen, +8 Science · -10 Food'
            : '+8 Oxygen, +6 Food · -14 Power',
          deltas: memory.retractedPanelsOn214
            ? { power: 0, oxygen: 8, food: -10, health: 0, science: 8 }
            : { power: -14, oxygen: 8, food: 6, health: 4, science: 0 },
          outcomeStory: memory.retractedPanelsOn214
            ? 'Plant leaves scrubbed extra CO₂ without burning battery watts, though dry air stunted tonight’s salad harvest.'
            : 'Maya stayed safely indoors saving air and rations, letting the battery reserve absorb the dusty panel loss.',
          scienceTakeaway:
            'Living plants and battery banks both act as backup buffers—never for free.',
        },
      ],
    };
  }

  // CHAPTER 3 (Sol 216): Real NASA DONKI Solar Activity Radiation Crisis
  if (solIndex === 3) {
    return {
      id: 'story-sol216-donki-flare',
      title: `Sol ${displaySol}: ${forecast.flareClass} Solar Proton Surge`,
      category: 'Solar Weather',
      siteFilter: site,
      urgentSeconds: 10,
      briefing: `${liveTag} spots fast radiation particles racing toward Maya! You have 10 seconds to shield the habitat:`,
      nasaCitation: 'NASA DONKI Space Weather Database & OSDR Dosimetry',
      options: [
        {
          id: 'flood-water-shield',
          label: 'Pump Greenhouse Water Into Shield Walls',
          tradeOffSummary: '+12 Crew Health · -14 Power, -8 Food',
          deltas: { power: -14, oxygen: 0, food: -8, health: 12, science: 2 },
          outcomeStory:
            'Maya diverted irrigation water into the habitat’s outer bladder walls! Hydrogen atoms braked incoming protons and kept her safe, leaving crops thirsty.',
          scienceTakeaway:
            'Water (H₂O) is rich in hydrogen, making it one of NASA’s best shields against solar radiation!',
        },
        {
          id: 'huddle-tunnel',
          label: 'Shelter in Central Tunnel',
          tradeOffSummary: '+4 Health · -6 Oxygen',
          deltas: { power: 0, oxygen: -6, food: 0, health: 4, science: -4 },
          outcomeStory: 'Maya waited out the peak wave inside the regolith core.',
          scienceTakeaway: 'Regolith mass passively blocks cosmic rays without electrical draw.',
        },
        {
          id: 'scan-storm-rover',
          label: 'Keep Rover & Instruments Scanning Storm',
          tradeOffSummary: '+16 Science · -15 Crew Health, -8 Power',
          deltas: { power: -8, oxygen: 0, food: 0, health: -15, science: 16 },
          outcomeStory:
            'Maya kept the rover spectrometer running through the proton wave! NASA gained prized storm telemetry, while Maya’s dosimeter beeped in the red.',
          scienceTakeaway:
            'NASA flight controllers weigh every scientific gain against ALARA astronaut radiation limits.',
        },
      ],
    };
  }

  // CHAPTER 4 (Sol 217): Light-Time Delay Emergency (Zero Earth Help!)
  if (solIndex === 4) {
    const delayDesc =
      site === 'moon'
        ? '2.6 seconds round-trip—Houston can barely chime in before pressure drops!'
        : site === 'mars'
          ? '14 minutes round-trip! Earth cannot hear your SOS in time.'
          : '86 minutes round-trip! Houston is over an hour away by radio.';

    return {
      id: 'story-sol217-comms-leak',
      title: `Sol ${displaySol}: Airlock Gasket Leak!`,
      category: 'Comms Delay',
      siteFilter: site,
      requiresCommsDelay: true,
      commsDelayLabel: delayDesc,
      urgentSeconds: site === 'moon' ? undefined : 10,
      briefing: `Grit jammed the Greenhouse airlock seal! ${delayDesc} Maya has to make the call right now:`,
      nasaCitation: 'NASA Deep Space Network & Autonomous Crew Operations',
      options: [
        {
          id: 'maya-acts-now',
          label: 'Seal Hatch & Overdrive Scrubbers Now',
          tradeOffSummary: '+12 Oxygen, +4 Health · -14 Power, -10 Food',
          deltas: { power: -14, oxygen: 12, food: -10, health: 4, science: 2 },
          outcomeStory:
            'Without waiting for Earth, Maya slammed the bulkhead shut and boosted scrubbers. Cabin air stayed breathable while locked-off plants missed light.',
          scienceTakeaway:
            'Because radio waves travel at light speed, deep-space astronauts must handle emergencies autonomously.',
        },
        {
          id: 'quick-patch',
          label: 'Quick EVA Patch',
          tradeOffSummary: '+6 Food · -8 Oxygen, -8 Health',
          deltas: { power: -4, oxygen: -8, food: 6, health: -8, science: 4 },
          outcomeStory: 'Maya cleared the gasket outside while suit airlocks vented.',
          scienceTakeaway: 'Every EVA vents cabin air and exposes the suit to radiation.',
        },
        {
          id: 'wait-for-earth',
          label: 'Patch With Tape & Wait for Earth Checklist',
          tradeOffSummary: '+8 Power · -15 Oxygen, +6 Science',
          deltas: { power: 8, oxygen: -15, food: 0, health: -4, science: 6 },
          outcomeStory:
            'Saving wattage while waiting for Houston’s radio reply meant precious air hissed through the seal until Earth’s answer finally arrived.',
          scienceTakeaway:
            'Waiting minutes for ground instructions during a pressure leak drains life-support margins fast.',
        },
      ],
    };
  }

  // CHAPTER 5 (Sol 218): Biology & Food vs. Power / Science (NASA OSDR)
  if (solIndex === 5) {
    return {
      id: 'story-sol218-osdr-harvest',
      title: `Sol ${displaySol}: Greenhouse Flowering Window`,
      category: 'Biology & Food',
      siteFilter: site,
      briefing:
        'Maya’s dwarf tomatoes and leafy greens are blooming inside the geodesic farm! Boosting LEDs brings fresh meals, while freezing leaves aids NASA’s DNA study:',
      nasaCitation: 'NASA OSDR Spaceflight Plant Biology (VEGGIE)',
      options: [
        {
          id: 'full-grow-leds',
          label: 'Blast Grow-LEDs for Fresh Harvest',
          tradeOffSummary: '+16 Food, +4 Oxygen · -16 Power',
          deltas: { power: -16, oxygen: 4, food: 16, health: 4, science: 2 },
          outcomeStory:
            'Magenta grow-lights supercharged photosynthesis! Maya harvested crisp greens and extra O₂, though battery reserves took a heavy hit.',
          scienceTakeaway:
            'Plants absorb CO₂ and release Oxygen—acting like living life-support if you pay the wattage.',
        },
        {
          id: 'split-harvest',
          label: 'Half Harvest, Half Sample',
          tradeOffSummary: '+6 Food, +6 Science · -8 Power',
          deltas: { power: -8, oxygen: 0, food: 6, health: 0, science: 6 },
          outcomeStory: 'Maya balanced dinner rations with a modest science batch.',
          scienceTakeaway: 'Balanced rationing stretches greenhouse resources across long missions.',
        },
        {
          id: 'freeze-osdr-samples',
          label: 'Dim LEDs & Freeze Leaves for NASA Study',
          tradeOffSummary: '+16 Science, +10 Power · -12 Food',
          deltas: { power: 10, oxygen: 0, food: -12, health: -4, science: 16 },
          outcomeStory:
            'Dimming lights banked power and preserved genetic sprouts for NASA OSDR, leaving Maya on freeze-dried rations tonight.',
          scienceTakeaway:
            'NASA OSDR studies how spaceflight stress changes plant genes for future Earth-independent farms.',
        },
      ],
    };
  }

  // CHAPTER 6 (Sol 219): Solo EVA vs. Indoor Recovery
  if (solIndex === 6) {
    return {
      id: 'story-sol219-eva-choice',
      title: `Sol ${displaySol}: Core Sample vs. Crew Stamina`,
      category: 'Rover Science',
      siteFilter: site,
      briefing:
        site === 'europa'
          ? 'The thermal drill hit liquid brine meters beneath Europa’s ice! Sending Maya out for a core sample risks Jupiter radiation, while resting recovers health.'
          : site === 'moon'
            ? 'Maya spotted ancient water-ice crystal in a shadowed pit! Going on EVA yields air/science, while resting indoors preserves stamina.'
            : 'Scanners spotted an ancient riverbed outcrop just beyond the rover path! Should Maya suit up for a final EVA or stay indoors to rest?',
      nasaCitation: 'NASA OSDR Crew Health & EVA Radiation Management',
      options: [
        {
          id: 'rest-and-eat-indoors',
          label: 'Stay Inside, Rest & Repressurize',
          tradeOffSummary: '+14 Crew Health, +6 Oxygen · -10 Food, -6 Science',
          deltas: { power: 4, oxygen: 6, food: -10, health: 14, science: -6 },
          outcomeStory:
            'Maya cooked a warm meal inside and got full sleep before tomorrow’s supply lander descent. Her vitals bounced back strongly.',
          scienceTakeaway:
            'Adequate rest and nutrition protect astronaut immune systems after days of radiation stress.',
        },
        {
          id: 'send-rover-only',
          label: 'Send Rover Alone on Low Power',
          tradeOffSummary: '+8 Science · -8 Power',
          deltas: { power: -8, oxygen: -2, food: 0, health: 0, science: 8 },
          outcomeStory: 'The rover rolled out solo while Maya monitored from the hub.',
          scienceTakeaway: 'Robotic scouts handle high-risk terrain without exposing human crews.',
        },
        {
          id: 'hero-eva-expedition',
          label: 'Suit Up for High-Value Core EVA',
          tradeOffSummary: '+18 Science, +10 Oxygen/Ice · -14 Crew Health, -8 Power',
          deltas: { power: -8, oxygen: 10, food: -4, health: -14, science: 18 },
          outcomeStory:
            'Maya braved the suit airlock and hauled back priceless core tubes and fresh water-ice! Science soared, though radiation fatigue caught up with her.',
          scienceTakeaway:
            'Human geologists gather 10x richer samples than rovers—at the cost of EVA air and radiation dose.',
        },
      ],
    };
  }

  // CHAPTER 7 (Sol 220): Supply Lander Descent Finale!
  return {
    id: 'story-sol220-lander-finale',
    title: `Sol ${displaySol}: Supply Lander Descent on Pad 1!`,
    category: 'Comms Delay',
    siteFilter: site,
    briefing:
      'The cargo & relief lander is descending toward Pad 1! Maya can either fire full radar beacons to guide a rich science drop or cut all non-essential power for a safe landing.',
    nasaCitation: 'NASA Artemis / Mars Precision Landing & Hazard Avoidance',
    options: [
      {
        id: 'safe-minimal-landing',
        label: 'Cut Lab Power & Lock Safe Landing Beacon',
        tradeOffSummary: '+10 Crew Health, +8 Oxygen · -10 Power, -4 Science',
        deltas: { power: -10, oxygen: 8, food: 4, health: 10, science: -4 },
        outcomeStory:
          'Maya routed every spare watt into landing radar and cabin air. The lander touched down gently on Pad 1 with relief supplies!',
        scienceTakeaway:
          'NASA mission rules always prioritize safe crew & vehicle landing over last-minute science bonuses.',
      },
      {
        id: 'standard-landing',
        label: 'Hold Steady Descent Vector',
        tradeOffSummary: '+6 Science · -8 Power',
        deltas: { power: -8, oxygen: 0, food: 0, health: 2, science: 6 },
        outcomeStory: 'The lander touched down smoothly on Pad 1 right on schedule.',
        scienceTakeaway: 'Steady telemetry margins keep landings predictable.',
      },
      {
        id: 'full-telemetry-science-drop',
        label: 'Capture Full Plume Science During Landing',
        tradeOffSummary: '+18 Science · -14 Power, -10 Health',
        deltas: { power: -14, oxygen: -6, food: 0, health: -10, science: 18 },
        outcomeStory:
          'Maya ran every camera and dust sensor as retro-thrusters blasted the pad! Groundbreaking landing data streamed home as she sealed the hatch.',
        scienceTakeaway:
          'Studying rocket-plume dust kicks up vital engineering data for future heavy spacecraft pads.',
      },
    ],
  };
}
