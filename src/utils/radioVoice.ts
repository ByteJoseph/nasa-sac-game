type RadioListener = (transmitting: boolean) => void;

function normalizeForRadioSpeech(raw: string): string {
  return raw
    .replace(/O₂/g, 'oxygen')
    .replace(/CO₂/g, 'carbon dioxide')
    .replace(/H₂O/g, 'water')
    .replace(/(\d+)m\b/g, '$1 minute')
    .replace(/(\d+)s\b/g, '$1 seconds')
    .replace(/—/g, ', ')
    .replace(/·/g, ', ');
}

const FEMALE_VOICE_EXCLUSIONS =
  /female|woman|girl|samantha|victoria|karen|zira|aria|jenny|tessa|moira|fiona|kate|serena|veena|allison|ava|susan|helena|hazel|libby|sonia|google us english/i;

const MECHANICAL_VOICE_EXCLUSIONS = /espeak|festival|mbrola|flite|robot|zarvox|trinoids|albert|whisper/i;

const MALE_VOICE_PRIORITY: RegExp[] = [
  /google uk english male/i,
  /microsoft (andrew|brian|christopher|guy|davis|eric|roger|steffan|ryan).*natural/i,
  /microsoft (david|mark|george|ryan|richard)/i,
  /\b(daniel|alex|aaron|arthur|oliver|thomas|lee|gordon|rishi|fred|ralph)\b/i,
  /\bmale\b/i,
];

class RadioVoiceEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private carrierSource: AudioBufferSourceNode | null = null;
  private carrierGain: GainNode | null = null;
  private voiceSource: AudioBufferSourceNode | null = null;
  private muted = false;
  private transmitting = false;
  private activeToken = 0;
  private activeAbort: AbortController | null = null;
  private watchdogTimer: number | null = null;
  private outroDelayTimer: number | null = null;
  private livenessTimer: number | null = null;
  private cachedVoice: SpeechSynthesisVoice | null = null;
  private listeners = new Set<RadioListener>();
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private rawAudioCache = new Map<string, ArrayBuffer>();
  private inFlightFetches = new Map<string, Promise<ArrayBuffer | null>>();
  private ttsBackendAvailable = true;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.pickPreferredMaleVoice();
      window.speechSynthesis.addEventListener?.('voiceschanged', () => {
        this.pickPreferredMaleVoice();
      });
    }
  }

  private getAudioContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.noiseBuffer) {
      this.noiseBuffer = this.buildRadioNoiseBuffer(this.ctx);
    }
    return this.ctx;
  }

  private buildRadioNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.08 * white) / 1.08;
      data[i] = white * 0.4 + last * 0.9;
    }
    return buffer;
  }

  private pickPreferredMaleVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const english = voices.filter((v) => /^en[-_]/i.test(v.lang) || v.lang.toLowerCase() === 'en');
    const pool = english.length > 0 ? english : voices;
    const nonMechanical = pool.filter((v) => !MECHANICAL_VOICE_EXCLUSIONS.test(v.name));
    const cleanPool = nonMechanical.length > 0 ? nonMechanical : pool;
    const maleCandidates = cleanPool.filter((v) => !FEMALE_VOICE_EXCLUSIONS.test(v.name));
    const searchPool = maleCandidates.length > 0 ? maleCandidates : cleanPool;

    for (const pattern of MALE_VOICE_PRIORITY) {
      const match = searchPool.find((v) => pattern.test(v.name));
      if (match) {
        this.cachedVoice = match;
        return match;
      }
    }
    this.cachedVoice = searchPool[0] ?? null;
    return this.cachedVoice;
  }

  private setTransmitting(next: boolean): void {
    if (this.transmitting === next) return;
    this.transmitting = next;
    this.listeners.forEach((cb) => cb(next));
  }

  public subscribe(listener: RadioListener): () => void {
    this.listeners.add(listener);
    listener(this.transmitting);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public isTransmitting(): boolean {
    return this.transmitting;
  }

  public unlock(): void {
    this.getAudioContext();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.pickPreferredMaleVoice();
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stop(false);
    }
  }

  private playQuindarTone(freq: number, durationSec: number, gainPeak = 0.055): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.01);
    gain.gain.setValueAtTime(gainPeak, now + Math.max(0.02, durationSec - 0.02));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  private playSquelchBurst(durationSec = 0.05, gainPeak = 0.036): void {
    const ctx = this.getAudioContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.Q.setValueAtTime(1.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now, Math.random() * 0.8);
    src.stop(now + durationSec + 0.02);
  }

  private startCarrierStatic(): void {
    this.stopCarrierStatic();
    const ctx = this.getAudioContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1350, now);
    filter.Q.setValueAtTime(1.3, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.014, now + 0.08);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);

    this.carrierSource = src;
    this.carrierGain = gain;
  }

  private stopCarrierStatic(): void {
    if (this.carrierGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.carrierGain.gain.cancelScheduledValues(now);
        this.carrierGain.gain.setValueAtTime(this.carrierGain.gain.value, now);
        this.carrierGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      } catch {
        // Ignore cleanup race
      }
    }
    const oldSrc = this.carrierSource;
    if (oldSrc) {
      window.setTimeout(() => {
        try {
          oldSrc.stop();
          oldSrc.disconnect();
        } catch {
          // Already stopped
        }
      }, 75);
    }
    this.carrierSource = null;
    this.carrierGain = null;
  }

  private stopVoiceSource(): void {
    const src = this.voiceSource;
    this.voiceSource = null;
    if (src) {
      src.onended = null;
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Already stopped
      }
    }
  }

  private clearTimers(): void {
    if (this.watchdogTimer !== null) {
      window.clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.outroDelayTimer !== null) {
      window.clearTimeout(this.outroDelayTimer);
      this.outroDelayTimer = null;
    }
    if (this.livenessTimer !== null) {
      window.clearTimeout(this.livenessTimer);
      this.livenessTimer = null;
    }
  }

  public stop(playOutro = false): void {
    this.activeToken += 1;
    this.clearTimers();
    if (this.activeAbort) {
      this.activeAbort.abort();
      this.activeAbort = null;
    }
    this.stopVoiceSource();
    this.currentUtterance = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore synthesis cancel errors
      }
    }
    this.stopCarrierStatic();
    if (playOutro && !this.muted) {
      this.playSquelchBurst(0.045, 0.03);
      this.playQuindarTone(2475, 0.13, 0.05);
    }
    this.setTransmitting(false);
  }

  private async fetchGeminiTtsWav(cleanText: string): Promise<ArrayBuffer | null> {
    if (!this.ttsBackendAvailable || this.muted || !cleanText) return null;

    const cached = this.rawAudioCache.get(cleanText);
    if (cached) return cached.slice(0);

    const existing = this.inFlightFetches.get(cleanText);
    if (existing) {
      const buf = await existing;
      return buf ? buf.slice(0) : null;
    }

    const promise = (async (): Promise<ArrayBuffer | null> => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 9000);
      try {
        const res = await fetch('/api/radio-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText }),
          signal: controller.signal,
        });
        if (!res.ok) {
          if (res.status === 503) {
            this.ttsBackendAvailable = false;
          }
          return null;
        }
        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength < 64) return null;
        if (this.rawAudioCache.size >= 40) {
          const oldest = this.rawAudioCache.keys().next().value;
          if (oldest) this.rawAudioCache.delete(oldest);
        }
        this.rawAudioCache.set(cleanText, arrayBuf);
        return arrayBuf.slice(0);
      } catch {
        return null;
      } finally {
        window.clearTimeout(timeoutId);
        this.inFlightFetches.delete(cleanText);
      }
    })();

    this.inFlightFetches.set(cleanText, promise);
    return promise;
  }

  public prefetch(lines: string[]): void {
    if (this.muted || !this.ttsBackendAvailable) return;
    for (const raw of lines) {
      const clean = normalizeForRadioSpeech(raw).trim();
      if (clean && !this.rawAudioCache.has(clean) && !this.inFlightFetches.has(clean)) {
        this.fetchGeminiTtsWav(clean).catch(() => {});
      }
    }
  }

  private speakFallbackBrowserVoice(
    clean: string,
    token: number,
    finishTransmission: () => void
  ): void {
    const canSpeak =
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined';

    if (!canSpeak) {
      this.outroDelayTimer = window.setTimeout(finishTransmission, 450);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    this.currentUtterance = utterance;
    const voice = this.cachedVoice ?? this.pickPreferredMaleVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'en-US';
    }
    // Keep natural 1.0 pitch so OS voices stay warm and human without robotic pitch-shift artifacts
    utterance.rate = 0.99;
    utterance.pitch = 1.0;
    utterance.volume = 0.96;

    utterance.onend = finishTransmission;
    utterance.onerror = finishTransmission;

    const words = clean.split(/\s+/).length;
    const maxWaitMs = Math.max(4500, words * 560 + 1800);
    this.watchdogTimer = window.setTimeout(finishTransmission, maxWaitMs);

    try {
      window.speechSynthesis.speak(utterance);
      this.livenessTimer = window.setTimeout(() => {
        if (token !== this.activeToken) return;
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          finishTransmission();
        }
      }, 900);
    } catch {
      finishTransmission();
    }
  }

  public speak(
    rawText: string,
    options?: {
      speaker?: 'control' | 'maya';
      onEnd?: () => void;
    }
  ): void {
    const clean = normalizeForRadioSpeech(rawText).trim();
    const onEnd = options?.onEnd;

    this.stop(false);
    const token = this.activeToken;

    if (this.muted || !clean) {
      onEnd?.();
      return;
    }

    this.setTransmitting(true);
    // Authentic NASA Quindar Intro Chirp (2524 Hz) + soft squelch + radio carrier hiss
    this.playSquelchBurst(0.05, 0.036);
    this.playQuindarTone(2524, 0.14, 0.055);
    this.startCarrierStatic();

    const finishTransmission = () => {
      if (token !== this.activeToken) return;
      this.clearTimers();
      this.stopVoiceSource();
      this.currentUtterance = null;
      this.stopCarrierStatic();
      this.playSquelchBurst(0.05, 0.034);
      this.playQuindarTone(2475, 0.13, 0.052);
      this.setTransmitting(false);
      onEnd?.();
    };

    const playDecodedVoice = async () => {
      const wavData = await this.fetchGeminiTtsWav(clean);
      if (token !== this.activeToken) return;

      const ctx = this.getAudioContext();
      if (wavData && ctx) {
        try {
          const audioBuffer = await ctx.decodeAudioData(wavData);
          if (token !== this.activeToken) return;

          const src = ctx.createBufferSource();
          src.buffer = audioBuffer;

          // Warm NASA S-Band communications EQ chain: natural human timbre, zero mechanical harshness
          const highPass = ctx.createBiquadFilter();
          highPass.type = 'highpass';
          highPass.frequency.value = 230;

          const presence = ctx.createBiquadFilter();
          presence.type = 'peaking';
          presence.frequency.value = 1550;
          presence.Q.value = 0.85;
          presence.gain.value = 2.6;

          const lowPass = ctx.createBiquadFilter();
          lowPass.type = 'lowpass';
          lowPass.frequency.value = 3900;

          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.value = -18;
          compressor.ratio.value = 3.2;

          const outGain = ctx.createGain();
          outGain.gain.value = 1.05;

          src.connect(highPass);
          highPass.connect(presence);
          presence.connect(lowPass);
          lowPass.connect(compressor);
          compressor.connect(outGain);
          outGain.connect(ctx.destination);

          this.voiceSource = src;
          src.onended = finishTransmission;
          this.watchdogTimer = window.setTimeout(
            finishTransmission,
            Math.ceil(audioBuffer.duration * 1000) + 1200
          );
          src.start(ctx.currentTime + 0.04);
          return;
        } catch {
          // Fall back to browser male voice if decode fails
        }
      }

      if (token !== this.activeToken) return;
      this.speakFallbackBrowserVoice(clean, token, finishTransmission);
    };

    // Wait 140ms after Quindar intro beep so the voice enters cleanly like Houston CAPCOM
    this.outroDelayTimer = window.setTimeout(() => {
      if (token !== this.activeToken) return;
      void playDecodedVoice();
    }, 140);
  }
}

export const radioVoice = new RadioVoiceEngine();
