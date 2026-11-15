import type {
  CoreResources,
  DifficultyMode,
  ModuleAllocation,
  OutpostSite,
  ResourceDeltas,
  SolForecast,
} from '../types/game';

export const TOTAL_SOLS = 7;

export function clampResource(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getInitialResources(site: OutpostSite, difficulty: DifficultyMode): CoreResources {
  const base = difficulty === 'cadet' ? 76 : 66;
  if (site === 'moon') {
    return {
      power: base + 4,
      oxygen: base,
      food: base - 2,
      health: base + 4,
      science: 0,
    };
  }
  if (site === 'europa') {
    return {
      power: base - 6,
      oxygen: base + 2,
      food: base,
      health: base - 2,
      science: 0,
    };
  }
  return {
    power: base - 2,
    oxygen: base - 2,
    food: base + 2,
    health: base + 2,
    science: 0,
  };
}

export function getModuleUsedPower(alloc: ModuleAllocation): number {
  return alloc.scrubber + alloc.greenhouse + alloc.shield + alloc.lab;
}

export function calculatePowerAllocationDeltas(
  alloc: ModuleAllocation,
  forecast: SolForecast,
  site: OutpostSite,
  difficulty: DifficultyMode
): ResourceDeltas {
  const used = getModuleUsedPower(alloc);
  const netPowerUnits = forecast.solarBudget - used;

  // Unspent units charge battery (+7 each). Overdriving drains battery (-11 each).
  const powerDelta = netPowerUnits >= 0 ? netPowerUnits * 7 : netPowerUnits * 11;

  // Crew daily baseline consumption
  const crewOxygenUse = difficulty === 'cadet' ? 12 : 14;
  const crewFoodUse = difficulty === 'cadet' ? 11 : 13;

  // Site-specific O2 production (Moon water ice, Mars MOXIE CO2, Europa sub-ice water electrolysis)
  const scrubberGainByLevel =
    site === 'moon'
      ? [0, 10, 19, 27]
      : site === 'europa'
        ? [0, 11, 20, 28]
        : [0, 9, 17, 25];

  const greenhouseFoodByLevel = [0, 8, 16, 23];
  const greenhouseOxygenBonus = alloc.greenhouse >= 2 ? 2 : 0;

  // Science Lab runs rover/ice-drill airlocks, costing minor oxygen (-2 per power level above 0)
  const labOxygenCost = alloc.lab > 0 ? alloc.lab * 2 : 0;
  const scienceGainByLevel = site === 'europa' ? [0, 12, 22, 30] : [0, 11, 20, 28];

  // Radiation math: Incoming forecast.radiationMsv minus Shield mitigation
  const shieldBlockRatio = [0.1, 0.45, 0.78, 0.94][alloc.shield] ?? 0.1;
  const sitePassiveBonus = site === 'mars' ? 0.08 : site === 'europa' ? 0.05 : 0;
  const totalBlock = Math.min(0.96, shieldBlockRatio + sitePassiveBonus);
  const unshieldedMsv = Math.round(forecast.radiationMsv * (1 - totalBlock));

  const healthDelta =
    unshieldedMsv <= 4
      ? 2
      : unshieldedMsv <= 9
        ? -4
        : unshieldedMsv <= 16
          ? -11
          : -19;

  return {
    power: powerDelta,
    oxygen: scrubberGainByLevel[alloc.scrubber] + greenhouseOxygenBonus - crewOxygenUse - labOxygenCost,
    food: greenhouseFoodByLevel[alloc.greenhouse] - crewFoodUse,
    health: healthDelta,
    science: scienceGainByLevel[alloc.lab],
  };
}

export function getLiveTradeOffHint(
  alloc: ModuleAllocation,
  deltas: ResourceDeltas,
  forecast: SolForecast,
  site: OutpostSite
): string {
  const used = getModuleUsedPower(alloc);
  if (used > forecast.solarBudget) {
    return `Trade-Off: Overdriving ${used - forecast.solarBudget} extra unit(s) boosts systems now, but drains ${Math.abs(deltas.power)}% Battery Reserve.`;
  }
  if (deltas.health <= -11) {
    const hazard = site === 'europa' ? 'Jupiter belt radiation' : 'solar radiation';
    return `Warning: Low Shielding against ${forecast.radiationMsv} mSv ${hazard} will cost ${Math.abs(deltas.health)}% Crew Health!`;
  }
  if (deltas.oxygen < -6) {
    return `Trade-Off: Low O₂ Scrubber power (plus ${alloc.lab > 0 ? 'Lab airlock use' : 'crew breathing'}) will drop Oxygen by ${Math.abs(deltas.oxygen)}%.`;
  }
  if (deltas.food < -5) {
    return `Trade-Off: Dimming Hydroponics saves watts today, at a cost of ${Math.abs(deltas.food)}% Food stores.`;
  }
  if (alloc.lab >= 2) {
    return `Trade-Off: High Rover Lab power yields +${deltas.science}% Science, while airlocks vent -${alloc.lab * 2}% Oxygen.`;
  }
  return `Balanced Plan: Unspent power recharges +${deltas.power}% Battery while holding life support steady.`;
}

export function applyDeltas(
  current: CoreResources,
  deltas: ResourceDeltas
): { next: CoreResources; secondaryNotes: string[] } {
  const secondaryNotes: string[] = [];
  let power = current.power + deltas.power;
  let oxygen = current.oxygen + deltas.oxygen;
  let food = current.food + deltas.food;
  let health = current.health + deltas.health;
  const science = clampResource(current.science + deltas.science);

  if (power <= 0) {
    power = 0;
    oxygen -= 12;
    health -= 10;
    secondaryNotes.push('Battery brownout! Backup heaters failed, draining -12% Oxygen and -10% Crew Health.');
  }
  if (oxygen <= 15 && oxygen > 0) {
    health -= 6;
    secondaryNotes.push('Low Oxygen warning! Crew stamina dropped (-6% Health).');
  } else if (oxygen <= 0) {
    oxygen = 0;
    health -= 22;
    secondaryNotes.push('Critical Air Shortage! Emergency masks activated (-22% Crew Health).');
  }
  if (food <= 12 && food > 0) {
    health -= 4;
    secondaryNotes.push('Low Food & Water rations slowed crew recovery (-4% Health).');
  } else if (food <= 0) {
    food = 0;
    health -= 16;
    secondaryNotes.push('Rations depleted! Crew fatigued (-16% Health).');
  }

  return {
    next: {
      power: clampResource(power),
      oxygen: clampResource(oxygen),
      food: clampResource(food),
      health: clampResource(health),
      science,
    },
    secondaryNotes,
  };
}

export function getResourceStatusLabel(value: number): 'GOOD' | 'FAIR' | 'LOW' | 'CRITICAL' {
  if (value >= 65) return 'GOOD';
  if (value >= 38) return 'FAIR';
  if (value >= 18) return 'LOW';
  return 'CRITICAL';
}

export function getMissionRank(resources: CoreResources, site: OutpostSite): {
  rank: string;
  summary: string;
} {
  const avgSurvival = Math.round(
    (resources.power + resources.oxygen + resources.food + resources.health) / 4
  );
  const score = Math.round(avgSurvival * 0.55 + resources.science * 0.45);
  const sector =
    site === 'moon' ? 'Artemis Lunar' : site === 'mars' ? 'Jezero Mars' : 'Europa Clipper';

  if (score >= 80) {
    return {
      rank: `${sector} Pioneer`,
      summary: 'Outstanding engineering balance! Your crew thrived and sent home landmark NASA science.',
    };
  }
  if (score >= 62) {
    return {
      rank: 'Mission Commander',
      summary: 'Strong leadership under pressure. Every system survived extreme deep-space constraints.',
    };
  }
  if (score >= 45) {
    return {
      rank: 'Flight Engineer',
      summary: 'You brought the crew safely through 7 Sols with smart last-minute trade-offs!',
    };
  }
  return {
    rank: 'Junior Cadet',
    summary: 'Outpost survived on thin margins! Try balancing battery reserves earlier next mission.',
  };
}
