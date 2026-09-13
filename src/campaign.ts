/**
 * Campaign (Phase 11 / R8): beat every character of the library, one after another, in an
 * order the player controls. The opponents are the library minus the player's own
 * character; step `i` of `n` plays at ladder point `1 + 5·i/(n−1)` (see
 * `interpolateDifficulty`). Progress lives in `localStorage` and is keyed by character id,
 * so the player may switch their own character mid-campaign. Whether the campaign is
 * currently *active* is session state owned by `main.ts`, not stored here.
 */
import type { Animal } from './piece-sets';

export interface CampaignState {
  /** Every library id, in the player's order. */
  order: string[];
  defeated: string[];
  skipped: string[];
  /** Failed attempts (loss or draw) per opponent id. */
  losses: Record<string, number>;
}

export interface CampaignStep {
  index: number; // 0-based
  total: number;
  animal: Animal;
  /** Ladder point in [1, 6]. */
  x: number;
}

export const CAMPAIGN_STORAGE_KEY = 'skm.campaign';
/** Attempts after which an opponent may be skipped. */
export const SKIP_AFTER = 3;

/** The default order — a joke "by intelligence", člověk as the final boss. */
export const DEFAULT_ORDER: readonly string[] = [
  'zizaly', 'mouchy', 'mravenci', 'vosy', 'slepice', 'pstrosi', 'mysky', 'zabky', 'kuzlata', 'oslici',
  'kravky', 'lamy', 'tucnaci', 'had', 'zraloci', 'kocky', 'jezevcici', 'veverky', 'clovek',
];

export function defaultCampaign(animals: readonly Animal[]): CampaignState {
  return { order: orderFor([], animals), defeated: [], skipped: [], losses: {} };
}

/** A full ordering: the given ids that exist, then the missing ones in default order. */
function orderFor(given: readonly string[], animals: readonly Animal[]): string[] {
  const ids = new Set(animals.map((a) => a.id));
  const order: string[] = [];
  for (const id of given) if (ids.has(id) && !order.includes(id)) order.push(id);
  for (const id of DEFAULT_ORDER) if (ids.has(id) && !order.includes(id)) order.push(id);
  for (const id of ids) if (!order.includes(id)) order.push(id);
  return order;
}

export function readCampaign(storage: Storage | null, animals: readonly Animal[]): CampaignState {
  const fallback = defaultCampaign(animals);
  let raw: string | null = null;
  try {
    raw = storage?.getItem(CAMPAIGN_STORAGE_KEY) ?? null;
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== 'object' || v === null) throw new Error('not an object');
    const o = v as Record<string, unknown>;
    const ids = new Set(animals.map((a) => a.id));
    const idList = (value: unknown): string[] =>
      Array.isArray(value) ? [...new Set(value.filter((x): x is string => typeof x === 'string' && ids.has(x)))] : [];
    const losses: Record<string, number> = {};
    if (typeof o.losses === 'object' && o.losses !== null) {
      for (const [id, n] of Object.entries(o.losses as Record<string, unknown>)) {
        if (ids.has(id) && typeof n === 'number' && Number.isFinite(n) && n > 0) losses[id] = Math.min(999, Math.floor(n));
      }
    }
    return { order: orderFor(idList(o.order), animals), defeated: idList(o.defeated), skipped: idList(o.skipped), losses };
  } catch {
    console.warn('Stored campaign is unreadable; starting over');
    return fallback;
  }
}

export function writeCampaign(storage: Storage | null, state: CampaignState): void {
  try {
    storage?.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Could not persist the campaign', err);
  }
}

/** The opponents of the campaign for this player, in order (the player's own character left out). */
export function campaignOpponents(state: CampaignState, animals: readonly Animal[], playerId: string): Animal[] {
  return state.order
    .filter((id) => id !== playerId)
    .map((id) => animals.find((a) => a.id === id))
    .filter((a): a is Animal => a !== undefined);
}

/** The step of the given opponent, or of the next undefeated one (null when all are done). */
export function campaignStep(state: CampaignState, animals: readonly Animal[], playerId: string, opponentId: string | null = null): CampaignStep | null {
  const opponents = campaignOpponents(state, animals, playerId);
  if (opponents.length === 0) return null;
  const index = opponentId !== null
    ? opponents.findIndex((a) => a.id === opponentId)
    : opponents.findIndex((a) => !state.defeated.includes(a.id) && !state.skipped.includes(a.id));
  if (index < 0) return null;
  const total = opponents.length;
  const x = total === 1 ? 6 : 1 + (5 * index) / (total - 1);
  return { index, total, animal: opponents[index], x };
}

export function isPassed(state: CampaignState, id: string): boolean {
  return state.defeated.includes(id) || state.skipped.includes(id);
}

export function canSkip(state: CampaignState, id: string): boolean {
  return !isPassed(state, id) && (state.losses[id] ?? 0) >= SKIP_AFTER;
}

/** Records a game against `opponentId`: a win defeats them, anything else counts an attempt. */
export function recordCampaignGame(state: CampaignState, opponentId: string, won: boolean): void {
  if (won) {
    if (!state.defeated.includes(opponentId)) state.defeated.push(opponentId);
    state.skipped = state.skipped.filter((id) => id !== opponentId);
    delete state.losses[opponentId];
  } else {
    state.losses[opponentId] = (state.losses[opponentId] ?? 0) + 1;
  }
}

export function skipOpponent(state: CampaignState, opponentId: string): void {
  if (!state.skipped.includes(opponentId)) state.skipped.push(opponentId);
}

/**
 * Moves `id` one place up (`delta` −1) or down (+1) among the *visible* opponents (the
 * player's own character sits in the order too but is not shown, so a swap goes past it).
 * Returns false when nothing moved.
 */
export function moveInOrder(state: CampaignState, id: string, delta: -1 | 1, playerId: string): boolean {
  const visible = state.order.filter((x) => x !== playerId);
  const at = visible.indexOf(id);
  const neighbour = visible[at + delta];
  if (at < 0 || neighbour === undefined) return false;
  const from = state.order.indexOf(id);
  const to = state.order.indexOf(neighbour);
  state.order.splice(from, 1);
  state.order.splice(to, 0, id);
  return true;
}

export function resetProgress(state: CampaignState): void {
  state.defeated = [];
  state.skipped = [];
  state.losses = {};
}

export function defeatedCount(state: CampaignState, animals: readonly Animal[], playerId: string): number {
  return campaignOpponents(state, animals, playerId).filter((a) => state.defeated.includes(a.id)).length;
}
