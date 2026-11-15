class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.08,
    delaySec = 0,
    slideToFreq?: number
  ): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideToFreq), now + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  public playPowerAdjust(level: number): void {
    const baseFreq = 320 + level * 95;
    this.playTone(baseFreq, 0.09, 'triangle', 0.07);
  }

  public playSolLaunch(): void {
    this.playTone(392, 0.14, 'sine', 0.08, 0);
    this.playTone(523.25, 0.18, 'sine', 0.08, 0.09);
  }

  public playDilemmaAlert(highRisk: boolean): void {
    if (highRisk) {
      this.playTone(260, 0.16, 'sawtooth', 0.05, 0, 220);
      this.playTone(260, 0.18, 'sawtooth', 0.05, 0.2, 200);
    } else {
      this.playTone(440, 0.12, 'triangle', 0.06, 0);
      this.playTone(554, 0.14, 'triangle', 0.06, 0.1);
    }
  }

  public playChoiceConfirm(): void {
    this.playTone(480, 0.1, 'sine', 0.07, 0);
    this.playTone(640, 0.15, 'sine', 0.07, 0.08);
  }

  public playVictory(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.28, 'triangle', 0.08, idx * 0.11);
    });
  }

  public playFailure(): void {
    this.playTone(310, 0.22, 'triangle', 0.07, 0, 240);
    this.playTone(220, 0.35, 'triangle', 0.07, 0.2, 140);
  }

  public playCountdownTick(urgent: boolean): void {
    this.playTone(urgent ? 880 : 620, 0.06, 'sine', urgent ? 0.06 : 0.035);
  }

  public playCutsceneCue(mood: 'calm' | 'alert' | 'triumph' = 'calm'): void {
    if (mood === 'alert') {
      this.playTone(196, 0.28, 'sawtooth', 0.045, 0, 146.8);
      this.playTone(293.66, 0.22, 'triangle', 0.04, 0.08);
    } else if (mood === 'triumph') {
      this.playTone(440, 0.22, 'triangle', 0.06, 0);
      this.playTone(554.37, 0.24, 'triangle', 0.06, 0.09);
      this.playTone(659.25, 0.34, 'sine', 0.07, 0.18);
    } else {
      this.playTone(329.63, 0.24, 'sine', 0.055, 0);
      this.playTone(493.88, 0.3, 'sine', 0.05, 0.1);
    }
  }
}

export const soundEngine = new SoundEngine();
