/**
 * "Sova čte nahlas" (U1, non-reader pilot): pre-recorded narration of a lesson step's text,
 * generated deterministically by `scripts/lesson-audio/build.mjs` (Windows SAPI, the same
 * voice and text normalisation as the lesson-video pipeline — see `src/lessons/pronounce.ts`)
 * and served from the same Cloudflare R2 bucket/domain as the lesson videos
 * (https://videa.zvirecisachy.cz), under the `lesson-audio/` prefix — the binaries are never
 * committed to git (owner decision, 2026-09-28); only the small `audio-manifest.json` (text ->
 * content hash) is, imported straight into the bundle so it needs no runtime fetch and no CDN
 * invalidation of its own — a rebuild always ships the manifest that matches what was uploaded.
 *
 * Mirrors src/sounds.ts: `fetch()` + `decodeAudioData` (never an `<audio>` element, so the CSP
 * directive is `connect-src`, not `media-src`), the shared AudioContext that sounds.ts unlocks
 * on the first pointerdown/keydown, and "never throws" — a 404, a CORS failure, an undecodable
 * format or an old browser without Web Audio all just mean the read-aloud button stays hidden,
 * never an error the child sees. Reading now needs the network (R2), unlike before when the
 * clips were same-origin and could be served by the service worker's cache — a clip simply
 * won't play offline; the button hides once the fetch fails, exactly like any other failure.
 *
 * Only texts actually recorded (resolved with the "kuzlata" character — same default as the
 * video pipeline) have audio. `hasAudio` looks the *exact* text up in the manifest, so a child
 * using a different piece set only hears the sentences whose wording does not depend on which
 * animal they picked; the ones that name it ("u tebe žabka …") stay silent and the button
 * hides, by design (see the README's note).
 *
 * `speak()` uses a generation counter (bumped by `stopSpeaking()`) so a clip whose fetch/decode
 * is still in flight when the step changes (or the lesson closes) never starts after being
 * superseded — without it, two clips could briefly overlap and the newer one could not be
 * stopped, because `current` would already have been overwritten by the stale one.
 */
import { getSharedAudioContext } from '../sounds';
import manifestJson from './audio-manifest.json';
import { pronounce } from './pronounce';

/** Same R2 bucket/domain as the lesson videos (src/lessons/videos.ts); different prefix. */
const AUDIO_BASE_URL = 'https://videa.zvirecisachy.cz/lesson-audio/';

export const SPEAK_STORAGE_KEY = 'skm.speak';

/** Default OFF: read-aloud is an opt-in pilot, unlike the sound effects. */
export function readSpeakSetting(storage: Storage | null): boolean {
  try {
    return storage?.getItem(SPEAK_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function writeSpeakSetting(storage: Storage | null, enabled: boolean): void {
  try {
    storage?.setItem(SPEAK_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch (err) {
    console.warn('Could not persist the read-aloud setting', err);
  }
}

interface ManifestFile {
  voice: string;
  entries: Record<string, string>;
}

/** Bundled at build time (resolveJsonModule, tsconfig.json) — always present, no fetch, no "still loading" state. */
const MANIFEST: ReadonlyMap<string, string> = new Map(Object.entries((manifestJson as ManifestFile).entries ?? {}));

interface VoiceState {
  enabled: () => boolean;
  /** Decoded-buffer cache, insertion-ordered so the first key is the least recently used. */
  buffers: Map<string, AudioBuffer>;
  loading: Map<string, Promise<AudioBuffer | null>>;
  current: AudioBufferSourceNode | null;
  /** Bumped by `stopSpeaking()`; a pending `loadBuffer().then(...)` only plays if it still matches. */
  generation: number;
}

let state: VoiceState | null = null;

const FORMATS = ['ogg', 'm4a'];
/** Decoded PCM is ~1 MB/clip; keep only the most recently used few, not all 1000+ forever. */
const MAX_CACHED_BUFFERS = 10;

/**
 * `enabled` is read fresh on every `speak()` call (the "Zvuky" toggle gates narration too, same
 * as sound effects) — this module never manages its own gesture-unlock listener, it reuses the
 * one src/sounds.ts already sets up. Safe to call more than once.
 */
export function initVoice(enabled: () => boolean): void {
  if (state) return;
  state = { enabled, buffers: new Map(), loading: new Map(), current: null, generation: 0 };
}

/** Whether narration is allowed to play at all right now (the "Zvuky" toggle) — for the 🔊 button's visibility. */
export function voiceEnabled(): boolean {
  try {
    return state?.enabled() ?? false;
  } catch {
    return false;
  }
}

/** Normalises `text` (same as the generator) and looks it up in the bundled manifest. */
export function hasAudio(text: string): boolean {
  if (!text) return false;
  try {
    return MANIFEST.has(pronounce(text));
  } catch {
    return false;
  }
}

function hashFor(text: string): string | null {
  try {
    return MANIFEST.get(pronounce(text)) ?? null;
  } catch {
    return null;
  }
}

/** Bumps a key to most-recently-used. */
function cacheGet(hash: string): AudioBuffer | undefined {
  if (!state) return undefined;
  const val = state.buffers.get(hash);
  if (val !== undefined) {
    state.buffers.delete(hash);
    state.buffers.set(hash, val);
  }
  return val;
}

/** Inserts as most-recently-used, evicting the least-recently-used entries past `MAX_CACHED_BUFFERS`. */
function cacheSet(hash: string, value: AudioBuffer): void {
  if (!state) return;
  state.buffers.delete(hash);
  state.buffers.set(hash, value);
  while (state.buffers.size > MAX_CACHED_BUFFERS) {
    const oldest = state.buffers.keys().next().value;
    if (oldest === undefined) break;
    state.buffers.delete(oldest);
  }
}

async function loadBuffer(hash: string): Promise<AudioBuffer | null> {
  const ctx = getSharedAudioContext();
  if (!state || !ctx) return null;
  const cached = cacheGet(hash);
  if (cached !== undefined) return cached;
  const pending = state.loading.get(hash);
  if (pending) return pending;

  const promise = (async (): Promise<AudioBuffer | null> => {
    for (const ext of FORMATS) {
      try {
        const res = await fetch(`${AUDIO_BASE_URL}${hash}.${ext}`);
        if (!res.ok) continue;
        const bytes = await res.arrayBuffer();
        return await ctx.decodeAudioData(bytes);
      } catch {
        continue; // this format isn't there, the browser can't decode it, a CORS/network failure — try the next
      }
    }
    return null;
  })();
  state.loading.set(hash, promise);
  const result = await promise.catch(() => null);
  // A failed load (network hiccup, transient 5xx, CORS misconfiguration) is never cached, so
  // the next `speak()` retries instead of the clip staying silent forever.
  if (result) cacheSet(hash, result);
  state.loading.delete(hash);
  return result;
}

/** Stops the clip currently playing (or about to start), if any. Always call on a step change, a lesson close, or "Zvuky"/"Sova čte nahlas" turning off. */
export function stopSpeaking(): void {
  if (!state) return;
  state.generation++; // invalidates any in-flight loadBuffer().then(...) from a previous speak()
  if (!state.current) return;
  try {
    state.current.stop();
  } catch {
    // already stopped/ended
  }
  state.current = null;
}

/** Plays `text`'s recorded audio if it exists, Zvuky is on and the page has been unlocked. Never throws. */
export function speak(text: string): void {
  try {
    if (!state) return;
    stopSpeaking(); // stop whatever is playing/pending first — also bumps the generation
    if (!state.enabled()) return;
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    // iOS/Safari: resume() must run synchronously inside the user-gesture call stack, same as
    // src/sounds.ts's play() — doing it after an `await` would be too late to count as "in the
    // gesture" and the clip would silently never play on iPhone.
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
    const hash = hashFor(text);
    if (!hash) return;
    const gen = state.generation;
    void loadBuffer(hash).then((buffer) => {
      if (!buffer || !state || state.generation !== gen) return; // superseded by a later speak()/stopSpeaking()
      const liveCtx = getSharedAudioContext();
      if (!liveCtx || liveCtx !== ctx) return;
      try {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.addEventListener('ended', () => {
          if (state?.current === source) state.current = null;
        });
        source.start();
        state.current = source;
      } catch (err) {
        console.warn('Could not play the read-aloud clip', err);
      }
    });
  } catch (err) {
    console.warn('Could not play the read-aloud clip', err);
  }
}
