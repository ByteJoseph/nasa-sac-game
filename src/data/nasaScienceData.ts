import type {
  DifficultyMode,
  DilemmaCard,
  GlossaryEntry,
  OutpostSite,
  SolForecast,
  SpaceWeatherSnapshot,
} from '../types/game';

export const SCIENCE_GLOSSARY: Record<string, GlossaryEntry> = {
  Sol: {
    term: 'Sol',
    shortMeaning: 'One planetary day at your outpost',
    kidExplanation:
      'On Mars, a "Sol" is 24 hours and 39 minutes—just a tiny bit longer than a day on Earth! We count mission days in Sols.',
    nasaFact: 'NASA Perseverance rover has logged over 1,300 Sols in Jezero Crater.',
  },
  'Radiation (mSv)': {
    term: 'Radiation (mSv)',
    shortMeaning: 'Invisible high-energy particles from the Sun and deep space',
    kidExplanation:
      'Earth has a thick air blanket and magnetic shield that block space radiation. On Mars, solar storms send fast particles (measured in millisieverts, mSv) that astronauts must block with water walls or soil.',
    nasaFact: 'NASA OSDR studies how space radiation affects cells and how shielding protects astronauts.',
  },
  'Light-Time Delay': {
    term: 'Light-Time Delay',
    shortMeaning: 'How long radio messages take to travel between Mars and Earth',
    kidExplanation:
      'Radio waves travel at the speed of light, but Mars is millions of kilometers away! Messages to Earth take 4 to 22 minutes each way—so Martian astronauts cannot wait for Earth in an emergency.',
    nasaFact: 'At average Mars distance, a round-trip radio question takes about 14 minutes.',
  },
  Electrolysis: {
    term: 'Electrolysis',
    shortMeaning: 'Using electricity to split Martian carbon dioxide to make breathable Oxygen',
    kidExplanation:
      'Think of it like using solar power to unlock Oxygen atoms trapped inside thin Martian air (CO2)! It gives us fresh air, but costs heavy electrical power.',
    nasaFact: 'NASA’s MOXIE experiment aboard Perseverance proved we can make Oxygen right from Martian CO2.',
  },
  Regolith: {
    term: 'Regolith',
    shortMeaning: 'Crushed rock and iron-rich dust covering Mars',
    kidExplanation:
      'Mars dirt is called regolith. It is dusty and clings to solar panels, but piling thick bags of regolith over a shelter acts like a heavy blanket against space radiation!',
    nasaFact: 'NASA tests 3D-printing Martian landing pads and radiation shelters directly from regolith.',
  },
  CME: {
    term: 'CME (Coronal Mass Ejection)',
    shortMeaning: 'A giant cloud of solar plasma and magnetic fields blasted from the Sun',
    kidExplanation:
      'When the Sun has a huge magnetic snap, it flings a super-fast cloud of particles across space. When it hits Mars, radiation spikes and crews shelter behind water walls.',
    nasaFact: 'NASA’s DONKI database tracks CMEs and solar flares in real time to warn astronauts.',
  },
  'Dust Opacity': {
    term: 'Dust Opacity',
    shortMeaning: 'How much Martian dust is floating in the sky blocking sunlight',
    kidExplanation:
      'Mars winds can lift fine rust-colored dust miles into the air. Higher dust opacity means dimmer sunlight reaching your solar panels—so your battery charges much slower!',
    nasaFact: 'NASA Perseverance MEDA sensors measure dust opacity (tau) every Sol in Jezero Crater.',
  },
};

export interface NasaDatasetCitation {
  id: string;
  name: string;
  agencySystem: string;
  whatItMeasures: string;
  howItShapesGameplay: string;
  referenceUrl: string;
}

export const NASA_DATASET_CITATIONS: NasaDatasetCitation[] = [
  {
    id: 'donki',
    name: 'NASA DONKI (Space Weather Database)',
    agencySystem: 'Moon to Mars Space Weather Analysis Office · Goddard Space Flight Center',
    whatItMeasures:
      'Real-time and archived Solar Flares (C, M, and X class), Coronal Mass Ejections (CME speeds in km/s), and Solar Energetic Particle events.',
    howItShapesGameplay:
      'Drives daily radiation hazard (mSv) and solar flare storm warnings. When an M- or X-class flare arrives on Mars, skipping your Radiation Shelter causes sharp Crew Health loss.',
    referenceUrl: 'https://kauai.ccmc.gsfc.nasa.gov/DONKI/',
  },
  {
    id: 'osdr',
    name: 'NASA OSDR (Open Science Data Repository)',
    agencySystem: 'Biological & Physical Sciences Division · Ames Research Center',
    whatItMeasures:
      'Astronaut radiation dosimetry, immune & cellular stress studies (e.g., OSD-314), and spaceflight plant growth hydroponic lighting/water experiments (VEGGIE / Advanced Plant Habitat).',
    howItShapesGameplay:
      'Shapes Greenhouse power-to-food efficiency, why LED hydroponics recycle small amounts of Oxygen, and why unshielded radiation compounds crew fatigue across Martian Sols.',
    referenceUrl: 'https://osdr.nasa.gov/bio/',
  },
  {
    id: 'mars-meda',
    name: 'NASA Perseverance MEDA & MOXIE',
    agencySystem: 'Mars 2020 Jezero Crater Weather Station & Oxygen Generator',
    whatItMeasures:
      'Surface temperatures (-76°C to -12°C), thin 685 Pa CO2 air pressure (<1% of Earth), dust opacity (tau), and CO2-to-O2 electrolysis power draw.',
    howItShapesGameplay:
      'Models Martian dust storms cutting Solar Budgets, CO2-scrubber power costs, and authentic 14-minute round-trip light-time comms delays where Mars crews must decide without Earth.',
    referenceUrl: 'https://science.nasa.gov/mission/mars-2020-perseverance/',
  },
];

export const SITE_PROFILES: Record<
  OutpostSite,
  {
    name: string;
    shortName: string;
    region: string;
    commsDelayText: string;
    keyChallenge: string;
    solarNote: string;
    nasaSourceTag: string;
  }
> = {
  mars: {
    name: 'Jezero Crater · Mars',
    shortName: 'Mars (Jezero)',
    region: 'Ancient River Delta Basin',
    commsDelayText: '14 min round-trip',
    keyChallenge: 'Sudden dust storms dim sunlight and comms delays stop Earth from answering fast.',
    solarNote: '43% of Earth sunlight; dust opacity can drop solar yield.',
    nasaSourceTag: 'NASA Perseverance MEDA & MOXIE',
  },
};

export function buildSolForecast(
  sol: number,
  _site: OutpostSite,
  difficulty: DifficultyMode,
  weather: SpaceWeatherSnapshot
): SolForecast {
  const flareLetter = weather.latestFlareClass.charAt(0).toUpperCase();
  const baseRadOffset = flareLetter === 'X' ? 6 : flareLetter === 'M' ? 3 : 0;
  const diffRadBoost = difficulty === 'commander' ? 4 : 0;

  // Mars Jezero Crater schedule
  const marsSchedule: Array<Omit<SolForecast, 'sol'>> = [
    {
      title: 'Clear Jezero Morning',
      weatherSummary: 'Thin rusty sky with light breezes. Solar arrays hum steadily.',
      solarBudget: 5,
      radiationMsv: 7 + baseRadOffset + diffRadBoost,
      flareClass: weather.latestFlareClass || 'C3.5',
      dustStormActive: false,
      lunarShadowDip: false,
      nasaContextNote: `Perseverance MEDA: High ${weather.marsSolWeather.highTempC}°C / Low ${weather.marsSolWeather.lowTempC}°C · ${weather.marsSolWeather.pressurePa} Pa CO2 air.`,
    },
    {
      title: 'Regional Dust Plume',
      weatherSummary: 'Mars winds lift fine dust across the crater, dimming solar panels sharply!',
      solarBudget: 3,
      radiationMsv: 8 + diffRadBoost,
      flareClass: 'C4.0',
      dustStormActive: true,
      lunarShadowDip: false,
      nasaContextNote: 'MEDA dust opacity jumps above tau 1.6, cutting sunlight reaching flat solar arrays.',
    },
    {
      title: 'Solar Proton Alert (DONKI)',
      weatherSummary: 'An M-class solar eruption reaches Mars orbit. Thin Mars air only blocks a tiny slice.',
      solarBudget: 5,
      radiationMsv: 20 + baseRadOffset + diffRadBoost,
      flareClass: flareLetter === 'X' ? weather.latestFlareClass : 'M8.1',
      dustStormActive: false,
      lunarShadowDip: false,
      nasaContextNote: 'Unlike Earth, Mars lacks a global magnetic field—astronauts rely on water walls and regolith.',
    },
    {
      title: 'Clearing Delta Breeze',
      weatherSummary: 'Dust settles off the panels, opening a window for hydroponics and rover geology.',
      solarBudget: difficulty === 'cadet' ? 6 : 5,
      radiationMsv: 9 + diffRadBoost,
      flareClass: 'C2.8',
      dustStormActive: false,
      lunarShadowDip: false,
      nasaContextNote: 'NASA OSDR hydroponic experiments test how crops recover after dim-light cycles.',
    },
    {
      title: 'Dust Haze + CME Gust',
      weatherSummary: 'Double squeeze: lingering dust limits power while a CME raises radiation!',
      solarBudget: 4,
      radiationMsv: 22 + baseRadOffset + diffRadBoost,
      flareClass: 'X1.4',
      dustStormActive: true,
      lunarShadowDip: false,
      nasaContextNote: 'Real mission planners must choose between powering shields, oxygen MOXIE units, or heat.',
    },
    {
      title: 'Deep Cold & Thin Air',
      weatherSummary: 'Overnight low plunges to -82°C; life support and batteries work harder.',
      solarBudget: 4,
      radiationMsv: 12 + diffRadBoost,
      flareClass: 'M1.9',
      dustStormActive: false,
      lunarShadowDip: false,
      nasaContextNote: 'Perseverance MEDA measures 60°C+ daily temperature swings between Martian afternoon and dawn.',
    },
    {
      title: 'Supply Lander Descent Sol',
      weatherSummary: 'Final Sol! Hold steady life support and shielding until the cargo pod touches down.',
      solarBudget: 5,
      radiationMsv: 14 + baseRadOffset + diffRadBoost,
      flareClass: 'M5.0',
      dustStormActive: false,
      lunarShadowDip: false,
      nasaContextNote: 'With a 14-minute round-trip light delay, your crew leads landing prep autonomously.',
    },
  ];

  return { sol, ...marsSchedule[(sol - 1) % marsSchedule.length] };
}

export const DILEMMA_POOL: DilemmaCard[] = [
  {
    id: 'solar-flare-shelter',
    title: 'Sudden Solar Proton Surge',
    category: 'Solar Weather',
    siteFilter: 'both',
    briefing:
      'NASA DONKI instruments spot fast solar protons arriving ahead of schedule. Every choice forces a sacrifice between battery power, air/food production, or crew radiation dose.',
    nasaCitation: 'NASA DONKI Solar Energetic Particle (SEP) & OSDR Dosimetry',
    options: [
      {
        id: 'water-wall',
        label: 'Pump Water into Shield Walls',
        tradeOffSummary: '-14 Power, -6 Food/Water · +10 Crew Health',
        deltas: { power: -14, oxygen: 0, food: -6, health: 10, science: 0 },
        outcomeStory:
          'You pumped greenhouse irrigation water into the habitat’s outer bladder walls. Hydrogen in water excels at stopping solar protons—crew radiation stayed tiny, though crops got thirstier.',
        scienceTakeaway: 'Water (H2O) is packed with hydrogen atoms that brake incoming space radiation!',
      },
      {
        id: 'regolith-bunker',
        label: 'Huddle in Regolith Core & Pause Lab',
        tradeOffSummary: '+8 Power · -8 Oxygen, -6 Science',
        deltas: { power: 8, oxygen: -8, food: 0, health: 4, science: -6 },
        outcomeStory:
          'Everyone packed into the cramped regolith-covered central tunnel and shut down non-essential science gear. Power held steady, though extra breathing in a small space dipped Oxygen.',
        scienceTakeaway: 'Thick regolith piles stop cosmic rays passively without spending battery watts.',
      },
      {
        id: 'keep-science-running',
        label: 'Keep Rover Scanning the Storm',
        tradeOffSummary: '+14 Science · -14 Crew Health, -8 Power',
        deltas: { power: -8, oxygen: 0, food: 0, health: -14, science: 14 },
        outcomeStory:
          'Your team kept the radiation sensors and rover spectrometer active outside! You captured prized storm data, at the cost of higher radiation exposure and drained batteries.',
        scienceTakeaway: 'Space agencies weigh science gains against ALARA ("As Low As Reasonably Achievable") radiation limits.',
      },
    ],
  },
  {
    id: 'mars-comms-delay-leak',
    title: 'Airlock Seal Warning During Light-Time Delay',
    category: 'Comms Delay',
    siteFilter: 'mars',
    requiresCommsDelay: true,
    commsDelayLabel: 'Earth Signal: 7m 12s each way (14m 24s round-trip)',
    briefing:
      'A tiny grit grain jammed the Greenhouse airlock gasket! You sent an alert to Houston, but Mars is 130 million km from Earth—Flight Control cannot hear you for 7 minutes. You must act NOW.',
    nasaCitation: 'NASA Deep Space Network & Autonomous Mars Operations',
    options: [
      {
        id: 'seal-and-purge',
        label: 'Seal Greenhouse & Overdrive Scrubbers',
        tradeOffSummary: '+10 Oxygen · -15 Power, -10 Food',
        deltas: { power: -15, oxygen: 10, food: -10, health: 2, science: 0 },
        outcomeStory:
          'Before Earth even got your ping, you sealed the hatch and blasted the Oxygen scrubbers. Crew air stayed crisp, though locked-off plants missed light and batteries took a hit.',
        scienceTakeaway: 'Because light speed is finite, Mars crews need autonomous training for urgent repairs.',
      },
      {
        id: 'eva-patch-now',
        label: 'Send Two Astronauts Out to Patch Gasket',
        tradeOffSummary: '+6 Food, +6 Science · -10 Oxygen, -10 Health',
        deltas: { power: -4, oxygen: -10, food: 6, health: -10, science: 6 },
        outcomeStory:
          'Suited astronauts stepped into the 6.5 mbar CO2 air and brushed dust from the seal. You saved the crops and logged seal data, but suit airlocks vented Oxygen and added radiation dose.',
        scienceTakeaway: 'Opening an airlock always vents a bit of precious cabin air and exposes EVA suits to space.',
      },
      {
        id: 'slow-leak-ration',
        label: 'Patch with Tape & Wait for Earth Advice',
        tradeOffSummary: '+6 Power · -14 Oxygen, +4 Science',
        deltas: { power: 6, oxygen: -14, food: 0, health: -4, science: 4 },
        outcomeStory:
          'Waiting 14 minutes for Houston’s checklist saved battery watts, yet air hissed steadily through the gasket until Flight Control’s reply finally arrived.',
        scienceTakeaway: 'Waiting for Earth guidance during a Martian leak costs valuable cabin pressure!',
      },
    ],
  },
  {
    id: 'osdr-plant-vs-air',
    title: 'OSDR Hydroponic Growth Spurt',
    category: 'Biology & Food',
    siteFilter: 'both',
    briefing:
      'Your dwarf tomatoes and leafy greens (modeled on NASA VEGGIE/OSDR plant trials) are ready to flower! Boosting grow-LEDs yields fresh food, but competes directly with Power and Water.',
    nasaCitation: 'NASA OSDR Plant Biology & Controlled Environment Agriculture',
    options: [
      {
        id: 'full-spectrum-leds',
        label: 'Run Full-Spectrum Grow Lights',
        tradeOffSummary: '+16 Food, +4 Oxygen · -16 Power',
        deltas: { power: -16, oxygen: 4, food: 16, health: 2, science: 4 },
        outcomeStory:
          'Bright magenta-white LEDs supercharged photosynthesis! Leaves produced fresh salad and bonus Oxygen, though the electrical bill noticeably drained your battery bank.',
        scienceTakeaway: 'Plants absorb CO2 and release O2, acting like living air-scrubbers—if you pay the power cost.',
      },
      {
        id: 'harvest-for-science',
        label: 'Sample Leaves for OSDR DNA Study',
        tradeOffSummary: '+14 Science, +4 Food · -6 Power, -5 Health',
        deltas: { power: -6, oxygen: 0, food: 4, health: -5, science: 14 },
        outcomeStory:
          'Your crew froze half the young sprouts for NASA’s genetic stress archive. Science jumped forward, though astronauts ate freeze-dried rations instead of fresh greens.',
        scienceTakeaway: 'NASA OSDR researchers compare space-grown plant genes to Earth crops to improve future farms.',
      },
      {
        id: 'dim-eco-cycle',
        label: 'Dim Lights to Save Battery',
        tradeOffSummary: '+12 Power · -10 Food, -4 Oxygen',
        deltas: { power: 12, oxygen: -4, food: -10, health: 0, science: 0 },
        outcomeStory:
          'Dimming the greenhouse banked surplus Power for tomorrow’s storms, but slow plant growth left the pantry leaner tonight.',
        scienceTakeaway: 'Every watt sent to lights is a watt unavailable for heaters or radiation shields.',
      },
    ],
  },
  {
    id: 'mars-dust-cleaning',
    title: 'Dust Layer on Solar Arrays',
    category: 'Life Support',
    siteFilter: 'mars',
    briefing:
      'Fine iron-oxide dust settled over your solar wings after wind gusts. Leaving it cuts tomorrow’s energy, but cleaning it costs crew time, airlock Oxygen, or battery power.',
    nasaCitation: 'NASA InSight & Opportunity Solar Dust Attenuation Data',
    options: [
      {
        id: 'electrostatic-pulse',
        label: 'Fire Electrostatic Dust Shields',
        tradeOffSummary: '+12 Power (net recovery) · -8 Oxygen, -6 Health',
        deltas: { power: 12, oxygen: -8, food: 0, health: -6, science: 4 },
        outcomeStory:
          'High-voltage ripples shook rust dust off the glass! Power jumped back up, while crew stayed busy recalibrating breakers and cycling air filters.',
        scienceTakeaway: 'NASA tests Electrodynamic Dust Shields (EDS) that lift sticky dust using electric waves.',
      },
      {
        id: 'rover-brush-eva',
        label: 'Send Rover + Crew Brush Team',
        tradeOffSummary: '+10 Power, +10 Science · -12 Oxygen, -8 Food',
        deltas: { power: 10, oxygen: -12, food: -8, health: -4, science: 10 },
        outcomeStory:
          'Astronauts brushed panels clean and collected dust grains for grain-size analysis! Great science and watts, at a heavy Oxygen and calorie cost.',
        scienceTakeaway: 'Physical EVA work burns extra Oxygen and food energy compared to resting indoors.',
      },
      {
        id: 'conserve-and-wait',
        label: 'Wait for Martian Wind Gusts',
        tradeOffSummary: '+6 Oxygen, +6 Food · -14 Power',
        deltas: { power: -14, oxygen: 6, food: 6, health: 2, science: 0 },
        outcomeStory:
          'Keeping the crew inside conserved air and rations, though dusty panels forced your outpost to dip deeply into battery reserves.',
        scienceTakeaway: 'NASA’s Spirit and Opportunity rovers sometimes relied on lucky dust-devil winds to clean panels!',
      },
    ],
  },
  {
    id: 'moxie-oxygen-push',
    title: 'CO2 Scrubber Filter Clog',
    category: 'Life Support',
    siteFilter: 'both',
    briefing:
      'Fine Martian regolith tracked inside the airlock is clogging the main CO2 scrubber fan! You have three ways to restore clean breathing air—none of them free.',
    nasaCitation: 'NASA ECLSS (Environmental Control & Life Support System)',
    options: [
      {
        id: 'backup-electrolysis',
        label: 'Fire Backup Electrolysis Stack',
        tradeOffSummary: '+14 Oxygen · -16 Power',
        deltas: { power: -16, oxygen: 14, food: 0, health: 2, science: 0 },
        outcomeStory:
          'Spinning up the high-draw backup Oxygen generator cleared the cabin air rapidly, pulling a big chunk out of your main battery bank.',
        scienceTakeaway: 'On the ISS and future Mars bases, backup O2 systems demand serious electrical wattage.',
      },
      {
        id: 'manual-filter-swap',
        label: 'Hand-Clean Filters & Recycle Cartridges',
        tradeOffSummary: '+6 Oxygen, +6 Power · -8 Health, -6 Food',
        deltas: { power: 6, oxygen: 6, food: -6, health: -8, science: 4 },
        outcomeStory:
          'The crew worked overtime scrubbing dusty filters in masks. You saved battery power, but breathing dusty cabin air tired everyone out.',
        scienceTakeaway: 'Preventing tiny Martian dust from entering living quarters is a top NASA engineering challenge.',
      },
      {
        id: 'greenhouse-vent-share',
        label: 'Route Air Through Greenhouse Canopies',
        tradeOffSummary: '+8 Oxygen, +8 Science · -10 Food',
        deltas: { power: -4, oxygen: 8, food: -10, health: 0, science: 8 },
        outcomeStory:
          'Venting cabin air across leafy plants let biology absorb CO2 while filters got a quick wipe—though dry air slowed edible pod growth.',
        scienceTakeaway: 'Bioregenerative life support blends machines with living plants for long missions.',
      },
    ],
  },
  {
    id: 'osdr-crew-sleep-radiation',
    title: 'Crew Fatigue & Radiation Recovery',
    category: 'Biology & Food',
    siteFilter: 'both',
    briefing:
      'NASA OSDR crew health monitors show elevated stress markers after cramped indoor shifts. Boosting crew wellness uses extra calories, air, or pauses science.',
    nasaCitation: 'NASA OSDR Twins Study & Human Research Program',
    options: [
      {
        id: 'fresh-meal-rest',
        label: 'Serve Fresh Harvest & Lower Cabin Work',
        tradeOffSummary: '+14 Crew Health · -12 Food, -8 Science',
        deltas: { power: 0, oxygen: -4, food: -12, health: 14, science: -8 },
        outcomeStory:
          'Warm fresh-grown meals and extra sleep reset crew morale and immune markers! Food stores dipped and today’s lab log stayed shorter.',
        scienceTakeaway: 'Fresh nutrition and steady sleep rhythms keep astronaut immune systems resilient.',
      },
      {
        id: 'oxygen-rich-exercise',
        label: 'Run High-O2 Cardio & Shield Check',
        tradeOffSummary: '+10 Crew Health, +6 Science · -12 Oxygen, -8 Power',
        deltas: { power: -8, oxygen: -12, food: -4, health: 10, science: 6 },
        outcomeStory:
          'Treadmill workouts in high-oxygen air kept bones strong and generated valuable exercise physiology data for NASA, burning extra O2 and watts.',
        scienceTakeaway: 'Astronauts exercise daily to fight muscle and bone loss in Mars gravity (3/8g).',
      },
      {
        id: 'push-double-shift',
        label: 'Push Double Shift for Sample Return',
        tradeOffSummary: '+15 Science, +6 Power · -12 Crew Health, -6 Food',
        deltas: { power: 6, oxygen: -4, food: -6, health: -12, science: 15 },
        outcomeStory:
          'Your team powered through extra geology logs and packed sample tubes! Science soared, but weary astronauts took a clear toll.',
        scienceTakeaway: 'Pushing crews past safe fatigue limits increases mistakes and health risk.',
      },
    ],
  },
];

export function pickDilemmaForSol(
  sol: number,
  site: OutpostSite,
  forecast: SolForecast,
  usedIds: string[]
): DilemmaCard {
  const siteMatching = DILEMMA_POOL.filter(
    (d) => (d.siteFilter === 'both' || d.siteFilter === site) && !usedIds.includes(d.id)
  );
  const pool =
    siteMatching.length > 0
      ? siteMatching
      : DILEMMA_POOL.filter((d) => d.siteFilter === 'both' || d.siteFilter === site);

  if (forecast.radiationMsv >= 18) {
    const radCard =
      pool.find((d) => d.siteFilter === site && d.category === 'Solar Weather') ??
      pool.find((d) => d.category === 'Solar Weather');
    if (radCard) return radCard;
  }
  if (forecast.dustStormActive) {
    const dustCard = pool.find((d) => d.id === 'mars-dust-cleaning');
    if (dustCard) return dustCard;
  }
  if (sol === 4 || sol === 6) {
    const commsCard =
      pool.find((d) => d.requiresCommsDelay && d.siteFilter === site) ??
      pool.find((d) => d.requiresCommsDelay);
    if (commsCard) return commsCard;
  }

  return pool[(sol - 1) % pool.length];
}
