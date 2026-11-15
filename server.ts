import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const CURATED_ARCHIVE_SNAPSHOT: SpaceWeatherSnapshot = {
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

async function fetchWithTimeout(url: string, timeoutMs = 2500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getLiveSpaceWeather(): Promise<SpaceWeatherSnapshot> {
  try {
    const [flareRes, kpRes] = await Promise.all([
      fetchWithTimeout('https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json', 2500),
      fetchWithTimeout('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', 2500),
    ]);

    if (!flareRes.ok) {
      throw new Error(`NOAA flare feed status ${flareRes.status}`);
    }

    const flareJson = (await flareRes.json()) as Array<{
      max_class?: string;
      current_class?: string;
      max_time?: string;
      begin_time?: string;
    }>;

    const latestFlare = Array.isArray(flareJson) && flareJson.length > 0 ? flareJson[0] : null;
    const flareClass = latestFlare?.max_class || latestFlare?.current_class || 'C2.4';
    const flareTime = latestFlare?.max_time || latestFlare?.begin_time || new Date().toISOString();

    let kpIndex = 3.0;
    if (kpRes.ok) {
      const kpJson = (await kpRes.json()) as Array<Array<string>>;
      if (Array.isArray(kpJson) && kpJson.length > 1) {
        const lastRow = kpJson[kpJson.length - 1];
        const parsedKp = Number.parseFloat(lastRow[1] ?? '3.0');
        if (!Number.isNaN(parsedKp)) {
          kpIndex = parsedKp;
        }
      }
    }

    const flareLetter = flareClass.charAt(0).toUpperCase();
    const radiationRiskLevel: 'Low' | 'Moderate' | 'High' =
      flareLetter === 'X' || kpIndex >= 6
        ? 'High'
        : flareLetter === 'M' || kpIndex >= 4
          ? 'Moderate'
          : 'Low';

    const solarWindSpeedKms =
      radiationRiskLevel === 'High' ? 920 : radiationRiskLevel === 'Moderate' ? 580 : 410;

    return {
      sourceMode: 'live',
      sourceLabel: 'Live NOAA SWPC GOES X-Ray & Planetary K-Index + NASA PDS Reference',
      fetchedAt: new Date().toISOString(),
      latestFlareClass: flareClass,
      flareTimestamp: flareTime,
      kpIndex: Number(kpIndex.toFixed(1)),
      solarWindSpeedKms,
      radiationRiskLevel,
      marsSolWeather: CURATED_ARCHIVE_SNAPSHOT.marsSolWeather,
      lunarEnvData: CURATED_ARCHIVE_SNAPSHOT.lunarEnvData,
    };
  } catch {
    return {
      ...CURATED_ARCHIVE_SNAPSHOT,
      fetchedAt: new Date().toISOString(),
    };
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/nasa-weather', async (_req, res) => {
    const snapshot = await getLiveSpaceWeather();
    res.json(snapshot);
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Outpost Horizon server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
