// King + pawn vs king: an exact bitbase by retrograde iteration (authoring-time only; used by
// check-lessons.mjs for the `keysquares` choose fact, docs/phase-22-plan.md, level 6).
// White has the king and the pawn. Solved in well under a second; cross-checked against the
// Lichess tablebase on the level 4/6 key-square positions (same wins/draws).
//
// Squares are 0..63 (a1 = 0, h8 = 63). A promotion wins unless the new queen/rook is taken
// at once or every choice stalemates (K+Q / K+R vs K is otherwise a known win).
const F = (s) => s & 7;
const R = (s) => s >> 3;
const adj = (a, b) => a !== b && Math.abs(F(a) - F(b)) <= 1 && Math.abs(R(a) - R(b)) <= 1;
const KING = [];
for (let s = 0; s < 64; s++) KING[s] = [...Array(64).keys()].filter((t) => adj(s, t));
const pawnAttacks = (p, t) => R(t) === R(p) + 1 && Math.abs(F(t) - F(p)) === 1;
const idx = (stm, wk, bk, wp) => ((stm * 64 + wk) * 64 + bk) * 64 + wp;
const WIN = new Uint8Array(2 * 64 * 64 * 64);
const LEGAL = new Uint8Array(2 * 64 * 64 * 64);
let solved = false;

function legal(stm, wk, bk, wp) {
  if (R(wp) < 1 || R(wp) > 6) return false;
  if (wk === bk || wk === wp || bk === wp || adj(wk, bk)) return false;
  return !(stm === 0 && pawnAttacks(wp, bk)); // white to move with black in check: illegal
}

/** White has just promoted on `q` (black to move): does a queen or a rook win? */
function promotionWins(wk, bk, q) {
  if (adj(bk, q) && !adj(wk, q)) return false; // the new piece is taken
  for (const kind of ['q', 'r']) {
    const attacks = (t) => {
      if (t === q) return false;
      const straight = F(t) === F(q) || R(t) === R(q);
      const diag = Math.abs(F(t) - F(q)) === Math.abs(R(t) - R(q));
      if (!(straight || (kind === 'q' && diag))) return false;
      const df = Math.sign(F(t) - F(q));
      const dr = Math.sign(R(t) - R(q));
      for (let s = q; ; ) {
        s = (R(s) + dr) * 8 + F(s) + df;
        if (s === t) return true;
        if (s === wk) return false;
      }
    };
    const hasMove = KING[bk].some((t) => !adj(t, wk) && (t === q ? !adj(wk, q) : !attacks(t)));
    if (hasMove || attacks(bk)) return true; // not stalemate (mate or a normal KQK/KRK win)
  }
  return false;
}

export function solveKpk() {
  if (solved) return;
  for (let stm = 0; stm < 2; stm++) for (let wk = 0; wk < 64; wk++) for (let bk = 0; bk < 64; bk++) for (let wp = 8; wp < 56; wp++) if (legal(stm, wk, bk, wp)) LEGAL[idx(stm, wk, bk, wp)] = 1;
  for (let changed = true; changed; ) {
    changed = false;
    for (let wk = 0; wk < 64; wk++) for (let bk = 0; bk < 64; bk++) for (let wp = 8; wp < 56; wp++) {
      let i = idx(0, wk, bk, wp);
      if (LEGAL[i] && !WIN[i]) {
        let w = KING[wk].some((t) => t !== wp && !adj(t, bk) && LEGAL[idx(1, t, bk, wp)] && WIN[idx(1, t, bk, wp)]);
        const one = wp + 8;
        if (!w && one !== wk && one !== bk) {
          if (R(one) === 7) w = promotionWins(wk, bk, one);
          else {
            w = LEGAL[idx(1, wk, bk, one)] === 1 && WIN[idx(1, wk, bk, one)] === 1;
            const two = wp + 16;
            if (!w && R(wp) === 1 && two !== wk && two !== bk) w = LEGAL[idx(1, wk, bk, two)] === 1 && WIN[idx(1, wk, bk, two)] === 1;
          }
        }
        if (w) { WIN[i] = 1; changed = true; }
      }
      i = idx(1, wk, bk, wp);
      if (LEGAL[i] && !WIN[i]) {
        let any = false;
        let allWin = true;
        for (const t of KING[bk]) {
          if (adj(t, wk) || pawnAttacks(wp, t)) continue;
          if (t === wp && adj(wk, wp)) continue;
          any = true;
          if (t === wp || !WIN[idx(0, wk, t, wp)]) { allWin = false; break; }
        }
        if (any ? allWin : pawnAttacks(wp, bk)) { WIN[i] = 1; changed = true; } // no move: mate wins, stalemate draws
      }
    }
  }
  solved = true;
}

export const squareIndex = (name) => (name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 97);
export const squareName = (s) => String.fromCharCode(97 + F(s)) + (R(s) + 1);

/**
 * Key squares of a white pawn: squares where the white king wins against every legal black
 * king square, with either side to move — except when black to move simply takes an
 * unguarded pawn. (For a rook pawn this strict test also fails when the black king stands in
 * front of the pawn; lessons do not use it for rook pawns.)
 */
export function keySquares(pawn) {
  solveKpk();
  const wp = squareIndex(pawn);
  const out = [];
  for (let wk = 0; wk < 64; wk++) {
    if (wk === wp) continue;
    let anyLegal = false;
    let ok = true;
    for (let bk = 0; bk < 64 && ok; bk++) for (const stm of [0, 1]) {
      if (!LEGAL[idx(stm, wk, bk, wp)]) continue;
      anyLegal = true;
      if (WIN[idx(stm, wk, bk, wp)]) continue;
      if (stm === 1 && adj(bk, wp) && !adj(wk, wp)) continue; // the pawn simply hangs
      ok = false;
    }
    if (anyLegal && ok) out.push(squareName(wk));
  }
  return out;
}
