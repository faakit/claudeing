/**
 * Offline renders of the real mix, for measuring what the game actually outputs (nobody can listen
 * while building this): the same graph, sampler, music, sfx and ambience code as the live engine,
 * driven tick by tick inside an OfflineAudioContext. Debug tool only (loaded on demand).
 */
import { Ambience } from './ambience';
import { instrumentFiles, jingleInstruments } from './assets';
import { SampleBank } from './bank';
import type { AmbienceTargets } from './director';
import { K_MUSIC, K_SFX, buildGraph } from './graph';
import { MusicPlayer } from './music';
import { SfxPlayer } from './sfx';
import { midiToHz } from './theory';
import type { MusicSlot } from './types';

export interface RenderOptions {
  seconds: number;
  slot?: MusicSlot;
  indoor?: boolean;
  /** 0 day .. 1 night. */
  night?: number;
  /** Settings sliders (defaults are the game's defaults). */
  music?: number;
  sfx?: number;
  cues?: { cue: string; at: number }[];
  ambience?: Partial<AmbienceTargets> & { rain?: number };
  /** Rainy-day arrangement and game year (variation sections from year two). */
  rain?: boolean;
  year?: number;
  sampleRate?: number;
}

export interface RenderResult {
  sampleRate: number;
  /** Interleaved stereo, 16-bit PCM, base64 (compact to hand back to the test runner). */
  pcm16: string;
  realtimeRatio: number;
  stats: Record<string, unknown>;
}

const TICK = 0.1;

export async function renderOffline(base: string, o: RenderOptions): Promise<RenderResult> {
  const sr = o.sampleRate ?? 48000;
  const frames = Math.ceil(o.seconds * sr);
  const ctx = new OfflineAudioContext(2, frames, sr);
  const g = buildGraph(ctx);
  g.musicBus.gain.value = (o.music ?? 0.6) * K_MUSIC;
  g.sfxBus.gain.value = (o.sfx ?? 0.8) * K_SFX;
  const night = o.night ?? 0;
  g.dayBus.gain.value = 1 - night;
  g.dayWet.gain.value = 1 - night;
  g.nightBus.gain.value = night;
  g.nightWet.gain.value = night;
  const bank = new SampleBank(base);
  const music = new MusicPlayer(
    ctx,
    bank,
    { dry: { day: g.dayBus, night: g.nightBus, both: g.bothBus }, wet: { day: g.dayWet, night: g.nightWet, both: g.bothWet }, sfx: g.sfxBus },
    (m, when, dur, vel, dest) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = midiToHz(m);
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(0.12 * vel, when + 0.01);
      env.gain.setTargetAtTime(0, when + dur, 0.1);
      osc.connect(env).connect(dest);
      osc.start(when);
      osc.stop(when + dur + 0.5);
    },
  );
  const sfx = new SfxPlayer(ctx, bank, g.sfxBus);
  const amb = new Ambience(ctx, bank, g.ambienceBus);
  // Same thunder ducking as the live engine.
  amb.onShot = (name, when, dur) => {
    if (name !== 'thunder') return;
    g.duck.gain.cancelScheduledValues(when);
    g.duck.gain.setTargetAtTime(0.5, when, 0.15);
    g.duck.gain.setTargetAtTime(1, when + Math.min(dur, 3), 0.8);
  };
  const loads: Promise<unknown>[] = [sfx.preload()];
  if (o.slot) loads.push(music.preload(o.slot));
  for (const k of Object.keys(o.ambience ?? {})) loads.push(amb.preload(k));
  for (const i of jingleInstruments()) for (const z of instrumentFiles(i)) loads.push(bank.load(ctx, z.file, z.onset));
  await Promise.all(loads);
  music.setMood({ rain: o.rain, year: o.year }, 0);
  if (o.slot) music.setSlot(o.slot, !!o.indoor, 0);
  for (const [k, v] of Object.entries(o.ambience ?? {})) amb.set(k, v ?? 0);
  const cues = [...(o.cues ?? [])].sort((a, b) => a.at - b.at);
  const quantum = 128 / sr;
  for (let t = 0; t < o.seconds - TICK; t += TICK) {
    const at = Math.round(t / quantum) * quantum;
    void ctx.suspend(at).then(() => {
      const now = ctx.currentTime;
      music.tick(now, { enabled: true, day: night < 0.99, night: night > 0.01 });
      amb.tick(now, true);
      while (cues.length && cues[0]!.at <= now + 1e-6) {
        const c = cues.shift()!;
        if (!music.jingle(c.cue, now)) sfx.play(c.cue, now);
      }
      void ctx.resume();
    });
  }
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  const ms = performance.now() - t0;
  const l = buf.getChannelData(0);
  const r = buf.getChannelData(1);
  const pcm = new Int16Array(l.length * 2);
  for (let i = 0; i < l.length; i++) {
    pcm[2 * i] = Math.max(-32768, Math.min(32767, Math.round(l[i]! * 32767)));
    pcm[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(r[i]! * 32767)));
  }
  const bytes = new Uint8Array(pcm.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return {
    sampleRate: sr,
    pcm16: btoa(bin),
    realtimeRatio: o.seconds / (ms / 1000),
    stats: { music: music.stats, sfx: sfx.stats, residentMB: bank.residentBytes() / 1e6 },
  };
}
