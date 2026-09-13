/**
 * Stockfish behind a small typed interface. The engine runs in a Web Worker and speaks
 * UCI text; no UCI string leaves this module.
 *
 * Concurrency model:
 *  - UCI guarantees exactly one `bestmove` per `go`, in order, including for searches
 *    ended by `stop`. Outstanding searches are kept in a FIFO and each `bestmove` line is
 *    matched to the oldest one. A cancelled search resolves `null` when its `bestmove`
 *    arrives, so a stale reply can never be mistaken for a fresh one.
 *  - `stop()` returns a promise that resolves once every outstanding search has been
 *    consumed, so callers can sequence `setoption` / `ucinewgame` / a new `go` after it.
 */

export type UciMove = string; // "e2e4", "e7e8q"

export interface EngineOptions {
  skillLevel: number;
  /** Number of principal variations to report; default 1. Analysis uses 2. */
  multiPv?: number;
}

export interface SearchLimits {
  depth: number;
  movetimeMs: number;
}

export interface Search {
  /** Position the search was started from. */
  readonly fen: string;
  /** Resolves with the engine's move, or `null` when the search was cancelled. */
  readonly result: Promise<UciMove | null>;
}

export interface AnalysisLimits {
  depth: number;
  movetimeMs: number;
  /** 1-10: move feedback uses 2, the weak levels' "top N" choice up to 8. */
  multiPv: number;
}

/** One principal variation. `scoreCp` is mate-normalised (±(10000 - plies)) and from the side to move's point of view. */
export interface PvLine {
  multipv: number;
  scoreCp: number;
  pv: UciMove[];
}

export interface Analysis {
  readonly fen: string;
  /** Resolves with the final PV lines (sorted by multipv), or `null` when cancelled. */
  readonly result: Promise<PvLine[] | null>;
}

export const MATE_SCORE = 10_000;

/** Stockfish `score cp X` / `score mate M` → centipawns, mates mapped near ±MATE_SCORE. */
export function normaliseScore(kind: 'cp' | 'mate', value: number): number {
  if (kind === 'cp') return value;
  return value > 0 ? MATE_SCORE - value : -MATE_SCORE - value;
}

export interface Engine {
  /** Resolves after the UCI handshake (uciok → initial options → readyok). */
  readonly ready: Promise<void>;
  /** Caller guarantees no search is outstanding (see `stop()`). */
  setOptions(options: EngineOptions): void;
  /** ucinewgame + isready. Caller guarantees no search is outstanding. */
  newGame(): void;
  search(fen: string, limits: SearchLimits): Search;
  /** Full-information search (info lines parsed). Same FIFO and cancellation as search(). */
  analyse(fen: string, limits: AnalysisLimits): Analysis;
  /** Cancels outstanding searches; resolves when all of them have settled. */
  stop(): Promise<void>;
  dispose(): void;
}

interface SearchRecord {
  fen: string;
  cancelled: boolean;
  /** Search: resolves the bestmove. */
  resolveMove?: (move: UciMove | null) => void;
  /** Analysis: resolves the collected PV lines. */
  resolveLines?: (lines: PvLine[] | null) => void;
  lines: Map<number, PvLine>;
  multiPv: number;
}

/** Parses one `info … multipv N score cp|mate X … pv …` line; undefined for lines without a pv/score. */
function parseInfoLine(line: string): PvLine | undefined {
  const tokens = line.split(/\s+/);
  const scoreAt = tokens.indexOf('score');
  const pvAt = tokens.indexOf('pv');
  if (scoreAt < 0 || pvAt < 0 || pvAt < scoreAt) return undefined;
  const kind = tokens[scoreAt + 1];
  const value = Number(tokens[scoreAt + 2]);
  if ((kind !== 'cp' && kind !== 'mate') || !Number.isFinite(value)) return undefined;
  const multipvAt = tokens.indexOf('multipv');
  const multipv = multipvAt >= 0 ? Number(tokens[multipvAt + 1]) || 1 : 1;
  return { multipv, scoreCp: normaliseScore(kind, value), pv: tokens.slice(pvAt + 1) };
}

export interface EngineCreateOptions {
  /**
   * Expected byte size of the .wasm next to the worker script. The pre-check compares it
   * with the server's content-length (±5 %) so an empty, truncated or wrong file fails
   * fast instead of waiting for the handshake timeout.
   */
  expectedWasmBytes: number;
}

// 30 s: a legitimate 7 MB load on a slow mobile link must not disable a working engine.
// The pre-check below covers the fast-fail cases (missing / wrong-size file); corruption
// with the right size still falls through to this timeout — accepted.
const HANDSHAKE_TIMEOUT_MS = 30_000;
const PRECHECK_TIMEOUT_MS = 5_000;
const WASM_SIZE_TOLERANCE = 0.05;

/**
 * HEAD request for the .wasm before the worker is created. Resolves when the file looks
 * reachable (or the server cannot tell us: 405/501, missing content-length); rejects when
 * it is missing, unreachable or has an unexpected size.
 */
async function precheckWasm(wasmUrl: string, expectedBytes: number): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PRECHECK_TIMEOUT_MS);
  try {
    const response = await fetch(wasmUrl, { method: 'HEAD', cache: 'no-store', signal: controller.signal });
    if (response.status === 405 || response.status === 501) return; // host refuses HEAD: unknown, proceed
    if (!response.ok) throw new Error(`Engine wasm not reachable: HTTP ${response.status} for ${wasmUrl}`);
    // SPA hosts (and Vite dev) answer unknown paths with index.html and status 200.
    const type = response.headers.get('content-type') ?? '';
    if (type.includes('text/html')) {
      throw new Error(`Engine wasm not reachable: ${wasmUrl} answered with HTML (missing file / SPA fallback)`);
    }
    // With transfer compression (GitHub Pages, most CDNs) content-length is the encoded
    // size, so the check only applies to uncompressed answers.
    const encoding = (response.headers.get('content-encoding') ?? 'identity').toLowerCase();
    if (encoding !== 'identity') return; // size unknown, proceed
    const length = Number(response.headers.get('content-length'));
    if (!Number.isFinite(length) || length <= 0) return; // unknown, proceed
    if (Math.abs(length - expectedBytes) > expectedBytes * WASM_SIZE_TOLERANCE) {
      throw new Error(`Engine wasm has unexpected size ${length} (expected ~${expectedBytes}) at ${wasmUrl}`);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Engine wasm pre-check timed out after ${PRECHECK_TIMEOUT_MS} ms`);
    }
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    clearTimeout(timer);
  }
}

export function createEngine(
  workerUrl: string,
  onError: (err: Error) => void,
  options: EngineCreateOptions,
): Engine {
  // The glue script finds its .wasm by replacing .js with .wasm next to itself.
  const wasmUrl = workerUrl.replace(/\.js$/, '.wasm');
  let worker: Worker | null = null;
  let handshakeTimer: ReturnType<typeof setTimeout> | null = null;
  const outstanding: SearchRecord[] = [];
  const drainWaiters: Array<() => void> = [];
  let disposed = false;

  let resolveReady!: () => void;
  let rejectReady!: (err: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // Surfaced through onError; this catch only prevents an unhandled rejection.
  ready.catch(() => undefined);

  // Gate for isready/readyok round-trips issued after the handshake (ucinewgame).
  let readyGate: Promise<void> = Promise.resolve();
  let resolveReadyGate: (() => void) | null = null;

  const fail = (err: Error): void => {
    if (disposed) return;
    rejectReady(err);
    onError(err);
  };

  const post = (command: string): void => {
    if (disposed || !worker) return;
    worker.postMessage(command);
  };

  const settleOutstandingIfDrained = (): void => {
    if (outstanding.length > 0) return;
    for (const waiter of drainWaiters.splice(0)) waiter();
  };

  const onMessage = (event: MessageEvent<unknown>): void => {
    if (typeof event.data !== 'string') return;
    const line = event.data;

    if (line === 'uciok') {
      post('setoption name UCI_LimitStrength value false');
      post('isready');
      return;
    }
    if (line === 'readyok') {
      if (handshakeTimer !== null) clearTimeout(handshakeTimer);
      handshakeTimer = null;
      resolveReady();
      if (resolveReadyGate) {
        resolveReadyGate();
        resolveReadyGate = null;
      }
      return;
    }
    if (line.startsWith('info ')) {
      // info lines belong to the search at the head of the FIFO (UCI is sequential).
      const head = outstanding[0];
      if (head?.resolveLines && !head.cancelled) {
        const pv = parseInfoLine(line);
        if (pv && pv.multipv <= head.multiPv) head.lines.set(pv.multipv, pv);
      }
      return;
    }
    if (line.startsWith('bestmove ')) {
      const record = outstanding.shift();
      if (!record) {
        console.error('Engine sent a bestmove with no search outstanding', line);
        return;
      }
      const move = line.split(/\s+/)[1];
      if (record.cancelled) {
        record.resolveMove?.(null);
        record.resolveLines?.(null);
      } else if (!move || move === '(none)') {
        console.error('Engine returned no move', line, record.fen);
        record.resolveMove?.(null);
        record.resolveLines?.(null);
      } else {
        record.resolveMove?.(move);
        record.resolveLines?.(Array.from(record.lines.values()).sort((a, b) => a.multipv - b.multipv));
      }
      settleOutstandingIfDrained();
    }
    // Everything else (`id`, `option`, `info string` …) is ignored.
  };

  const startWorker = (): void => {
    if (disposed) return;
    worker = new Worker(workerUrl);
    worker.onmessage = onMessage;
    worker.onerror = (event: ErrorEvent) => {
      fail(new Error(`Engine worker error: ${event.message || 'unknown'}`));
    };
    worker.onmessageerror = () => {
      fail(new Error('Engine worker message could not be deserialized'));
    };
    handshakeTimer = setTimeout(
      () => fail(new Error(`Engine handshake timed out after ${HANDSHAKE_TIMEOUT_MS} ms`)),
      HANDSHAKE_TIMEOUT_MS,
    );
    post('uci');
  };

  precheckWasm(wasmUrl, options.expectedWasmBytes).then(startWorker, fail);

  const awaitGates = (): Promise<void> => ready.then(() => readyGate);

  const settleRecord = (record: SearchRecord, dropFromQueue: boolean): void => {
    if (dropFromQueue) {
      const index = outstanding.indexOf(record);
      if (index >= 0) outstanding.splice(index, 1);
    }
    record.resolveMove?.(null);
    record.resolveLines?.(null);
    settleOutstandingIfDrained();
  };

  /** Queues a record and posts `position` + the go command once the gates are open. */
  const startJob = (record: SearchRecord, goCommand: string): void => {
    outstanding.push(record);
    awaitGates()
      .then(() => {
        if (disposed || record.cancelled) {
          settleRecord(record, true); // cancelled before it was ever sent: nothing will answer it
          return;
        }
        post(`position fen ${record.fen}`);
        post(goCommand);
      })
      .catch((err) => {
        console.error('search failed to start', err);
        settleRecord(record, true);
      });
  };

  return {
    ready,

    setOptions(options: EngineOptions): void {
      if (outstanding.length > 0) {
        console.error('setoption while a search is outstanding — controller sequencing bug');
      }
      awaitGates()
        .then(() => {
          post(`setoption name Skill Level value ${options.skillLevel}`);
          if (options.multiPv !== undefined) post(`setoption name MultiPV value ${options.multiPv}`);
        })
        .catch((err) => console.error('setOptions failed', err));
    },

    newGame(): void {
      if (outstanding.length > 0) {
        console.error('ucinewgame while a search is outstanding — controller sequencing bug');
      }
      const previousGate = readyGate;
      readyGate = new Promise<void>((resolve) => {
        previousGate
          .then(() => ready)
          .then(() => {
            resolveReadyGate = resolve;
            post('ucinewgame');
            post('isready');
          })
          .catch((err) => {
            console.error('newGame failed', err);
            resolve();
          });
      });
    },

    search(fen: string, limits: SearchLimits): Search {
      let resolve!: (move: UciMove | null) => void;
      const result = new Promise<UciMove | null>((r) => {
        resolve = r;
      });
      const record: SearchRecord = { fen, cancelled: false, resolveMove: resolve, lines: new Map(), multiPv: 1 };
      startJob(record, `go depth ${limits.depth} movetime ${limits.movetimeMs}`);
      return { fen, result };
    },

    analyse(fen: string, limits: AnalysisLimits): Analysis {
      let resolve!: (lines: PvLine[] | null) => void;
      const result = new Promise<PvLine[] | null>((r) => {
        resolve = r;
      });
      const record: SearchRecord = { fen, cancelled: false, resolveLines: resolve, lines: new Map(), multiPv: limits.multiPv };
      startJob(record, `go depth ${limits.depth} movetime ${limits.movetimeMs}`);
      return { fen, result };
    },

    stop(): Promise<void> {
      if (outstanding.length === 0) return Promise.resolve();
      for (const record of outstanding) record.cancelled = true;
      post('stop');
      return new Promise<void>((resolve) => drainWaiters.push(resolve));
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (handshakeTimer !== null) clearTimeout(handshakeTimer);
      worker?.terminate();
      for (const record of outstanding.splice(0)) {
        record.resolveMove?.(null);
        record.resolveLines?.(null);
      }
      settleOutstandingIfDrained();
    },
  };
}
