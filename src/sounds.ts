/**
 * Sound effects (branch feat-sounds). Ten short, soft, child-friendly cues synthesised by
 * scripts/make-sounds.py (own work, no third-party audio — see that script's header and
 * docs/security-review.md) and shipped from public/sounds/ as same-origin files.
 *
 * iOS/Safari autoplay rules: an AudioContext must be created (or resumed) inside a user
 * gesture, so nothing plays before the first pointerdown/keydown on the page — including
 * during the intro splash, which the child may not have touched yet. `init()` arms a
 * one-shot listener for that first gesture; only then does it create the AudioContext and
 * start fetching + decoding the sound files (lazily, so the splash itself never blocks on
 * network). Until that has happened `play()` is a silent no-op, as it is if anything here
 * ever throws (blocked audio, an old browser without Web Audio, a fetch/decode failure,
 * an autoplay-policy rejection) — a missing sound effect must never break the game.
 */

export type SoundName =
  | 'move'
  | 'opponent-move'
  | 'capture'
  | 'check'
  | 'win'
  | 'loss'
  | 'puzzle-solved'
  | 'lesson-correct'
  | 'lesson-wrong'
  | 'piece-drop';

const SOUND_NAMES: readonly SoundName[] = [
  'move',
  'opponent-move',
  'capture',
  'check',
  'win',
  'loss',
  'puzzle-solved',
  'lesson-correct',
  'lesson-wrong',
  'piece-drop',
];

/** Tried in this order per sound; whichever the browser can decode wins (Safari cannot do .ogg/Opus, so .m4a is its fallback; .wav is what make-sounds.py ships when ffmpeg was unavailable at build time). */
const FORMATS = ['ogg', 'm4a', 'wav'];

export const SOUND_STORAGE_KEY = 'skm.sounds';

/** Default ON; anything unexpected in storage (garbage, an old value) also reads as ON. */
export function readSoundSetting(storage: Storage | null): boolean {
  try {
    return storage?.getItem(SOUND_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function writeSoundSetting(storage: Storage | null, enabled: boolean): void {
  try {
    storage?.setItem(SOUND_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch (err) {
    console.warn('Could not persist the sound setting', err);
  }
}

interface SoundsState {
  enabled: () => boolean;
  baseUrl: string;
  ctx: AudioContext | null;
  buffers: Map<SoundName, AudioBuffer | null>;
  loading: Map<SoundName, Promise<AudioBuffer | null>>;
  unlocked: boolean;
}

let state: SoundsState | null = null;

/**
 * Sets everything up: from now on `play(name)` works once the first user gesture has been
 * seen. `enabled` is read fresh on every play (so the Nastavení toggle takes effect at
 * once, no re-init needed). Safe to call more than once (a no-op after the first call).
 */
export function initSounds(baseUrl: string, enabled: () => boolean): void {
  if (state) return;
  try {
    state = { enabled, baseUrl, ctx: null, buffers: new Map(), loading: new Map(), unlocked: false };
    const unlock = (): void => {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      unlockNow();
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
  } catch (err) {
    console.warn('Could not set up sound effects', err);
    state = null;
  }
}

function unlockNow(): void {
  if (!state || state.unlocked) return;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return; // no Web Audio API: sounds stay silently unavailable
    state.ctx = new Ctor();
    state.unlocked = true;
    if (state.ctx.state === 'suspended') void state.ctx.resume().catch(() => undefined);
    // Warm the cache so the *first* play of each sound is not delayed by a fetch.
    for (const name of SOUND_NAMES) void loadBuffer(name);
  } catch (err) {
    console.warn('Could not unlock audio', err);
  }
}

async function loadBuffer(name: SoundName): Promise<AudioBuffer | null> {
  if (!state?.ctx) return null;
  const cached = state.buffers.get(name);
  if (cached !== undefined) return cached;
  const pending = state.loading.get(name);
  if (pending) return pending;

  const promise = (async (): Promise<AudioBuffer | null> => {
    const ctx = state?.ctx;
    if (!ctx) return null;
    for (const ext of FORMATS) {
      try {
        const res = await fetch(`${state!.baseUrl}sounds/${name}.${ext}`);
        if (!res.ok) continue;
        const bytes = await res.arrayBuffer();
        const buffer = await ctx.decodeAudioData(bytes);
        return buffer;
      } catch {
        continue; // this format isn't there, or the browser can't decode it — try the next
      }
    }
    return null;
  })();

  state.loading.set(name, promise);
  const result = await promise.catch(() => null);
  state.buffers.set(name, result);
  state.loading.delete(name);
  return result;
}

/** Plays `name` at a gentle default volume if sounds are on, unlocked and the file decoded. Never throws. */
export function play(name: SoundName, volume = 0.9): void {
  try {
    if (!state || !state.unlocked || !state.ctx || !state.enabled()) return;
    const ctx = state.ctx;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    void loadBuffer(name).then((buffer) => {
      if (!buffer || !state?.ctx || state.ctx !== ctx) return;
      try {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = Math.max(0, Math.min(1, volume));
        source.connect(gain).connect(ctx.destination);
        source.start();
      } catch (err) {
        console.warn(`Could not play sound "${name}"`, err);
      }
    });
  } catch (err) {
    console.warn(`Could not play sound "${name}"`, err);
  }
}
