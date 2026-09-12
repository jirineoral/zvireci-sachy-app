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

export interface Engine {
  /** Resolves after the UCI handshake (uciok → initial options → readyok). */
  readonly ready: Promise<void>;
  /** Caller guarantees no search is outstanding (see `stop()`). */
  setOptions(options: EngineOptions): void;
  /** ucinewgame + isready. Caller guarantees no search is outstanding. */
  newGame(): void;
  search(fen: string, limits: SearchLimits): Search;
  /** Cancels outstanding searches; resolves when all of them have settled. */
  stop(): Promise<void>;
  dispose(): void;
}

interface SearchRecord {
  fen: string;
  cancelled: boolean;
  resolve: (move: UciMove | null) => void;
}

const HANDSHAKE_TIMEOUT_MS = 10_000;

export function createEngine(workerUrl: string, onError: (err: Error) => void): Engine {
  const worker = new Worker(workerUrl);
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

  const handshakeTimer = setTimeout(
    () => fail(new Error(`Engine handshake timed out after ${HANDSHAKE_TIMEOUT_MS} ms`)),
    HANDSHAKE_TIMEOUT_MS,
  );

  const post = (command: string): void => {
    if (disposed) return;
    worker.postMessage(command);
  };

  const settleOutstandingIfDrained = (): void => {
    if (outstanding.length > 0) return;
    for (const waiter of drainWaiters.splice(0)) waiter();
  };

  worker.onmessage = (event: MessageEvent<unknown>) => {
    if (typeof event.data !== 'string') return;
    const line = event.data;

    if (line === 'uciok') {
      post('setoption name UCI_LimitStrength value false');
      post('isready');
      return;
    }
    if (line === 'readyok') {
      clearTimeout(handshakeTimer);
      resolveReady();
      if (resolveReadyGate) {
        resolveReadyGate();
        resolveReadyGate = null;
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
        record.resolve(null);
      } else if (!move || move === '(none)') {
        console.error('Engine returned no move', line, record.fen);
        record.resolve(null);
      } else {
        record.resolve(move);
      }
      settleOutstandingIfDrained();
    }
    // `info …` and everything else is ignored.
  };

  worker.onerror = (event: ErrorEvent) => {
    fail(new Error(`Engine worker error: ${event.message || 'unknown'}`));
  };
  worker.onmessageerror = () => {
    fail(new Error('Engine worker message could not be deserialized'));
  };

  post('uci');

  const awaitGates = (): Promise<void> => ready.then(() => readyGate);

  return {
    ready,

    setOptions(options: EngineOptions): void {
      if (outstanding.length > 0) {
        console.error('setoption while a search is outstanding — controller sequencing bug');
      }
      awaitGates()
        .then(() => post(`setoption name Skill Level value ${options.skillLevel}`))
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
      const record: SearchRecord = { fen, cancelled: false, resolve };
      awaitGates()
        .then(() => {
          if (disposed || record.cancelled) {
            // Cancelled before it was ever sent: nothing will answer it.
            const index = outstanding.indexOf(record);
            if (index >= 0) outstanding.splice(index, 1);
            record.resolve(null);
            settleOutstandingIfDrained();
            return;
          }
          post(`position fen ${fen}`);
          post(`go depth ${limits.depth} movetime ${limits.movetimeMs}`);
        })
        .catch((err) => {
          console.error('search failed to start', err);
          const index = outstanding.indexOf(record);
          if (index >= 0) outstanding.splice(index, 1);
          record.resolve(null);
          settleOutstandingIfDrained();
        });
      outstanding.push(record);
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
      clearTimeout(handshakeTimer);
      worker.terminate();
      for (const record of outstanding.splice(0)) record.resolve(null);
      settleOutstandingIfDrained();
    },
  };
}
