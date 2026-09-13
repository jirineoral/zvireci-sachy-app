/**
 * Where the intro's animals come from: the character library (light/dark PNG files) and
 * the player's own sets (PNG blobs → object URLs, revoked by the caller when done). Two
 * sides are drawn at random per run; they may be the same character (light vs dark), as
 * the game allows.
 */
import type { Animal } from '../piece-sets';
import type { UserSet } from '../user-sets';

export type Role = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
export type SideUrls = Partial<Record<Role, string>>;

export interface IntroSide {
  label: string;
  urls: SideUrls;
}

export interface IntroPool {
  /** Draws (light side, dark side) for one run. */
  draw(): { light: IntroSide; dark: IntroSide };
  /** Revokes the object URLs created for user sets. */
  release(): void;
}

const ROLES: readonly Role[] = ['K', 'Q', 'R', 'B', 'N', 'P'];

export function buildIntroPool(opts: {
  baseUrl: string;
  libraryFolder: string | null;
  animals: readonly Animal[];
  userSets: readonly UserSet[];
}): IntroPool | null {
  const lights: IntroSide[] = [];
  const darks: IntroSide[] = [];
  const objectUrls: string[] = [];

  if (opts.libraryFolder) {
    for (const a of opts.animals) {
      const side = (variant: 'light' | 'dark'): IntroSide => ({
        label: `${a.id}/${variant}`,
        urls: Object.fromEntries(ROLES.map((r) => [r, `${opts.baseUrl}piece-sets/${opts.libraryFolder}/${a.id}/${variant}/${r}.png`])),
      });
      lights.push(side('light'));
      darks.push(side('dark'));
    }
  }
  for (const set of opts.userSets) {
    const side = (color: 'w' | 'b'): IntroSide | null => {
      const urls: SideUrls = {};
      for (const r of ROLES) {
        const blob = set.pieces[`${color}${r}` as keyof typeof set.pieces];
        if (!blob) continue;
        const url = URL.createObjectURL(blob);
        objectUrls.push(url);
        urls[r] = url;
      }
      return Object.keys(urls).length > 0 ? { label: `user:${set.name}/${color}`, urls } : null;
    };
    const w = side('w');
    const b = side('b');
    if (w) lights.push(w);
    if (b) darks.push(b);
  }
  if (lights.length === 0 || darks.length === 0) {
    for (const url of objectUrls) URL.revokeObjectURL(url);
    return null;
  }
  const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
  return {
    draw: () => ({ light: pick(lights), dark: pick(darks) }),
    release: () => {
      for (const url of objectUrls) URL.revokeObjectURL(url);
    },
  };
}
