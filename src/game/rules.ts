import { NAMES, opposite } from './constants';
import { toCoord } from './coord';
import { inBoard, isDen, isWater, trapOf } from './terrain';
import type { Board, Move, Piece, Rank, Side } from './types';

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** 初始布局。红方占 0~2 行，蓝方占 6~8 行 */
export function initBoard(): Board {
  const b: (Piece | null)[][] = Array.from({ length: 9 }, () => Array<Piece | null>(7).fill(null));
  const put = (r: number, c: number, rank: Rank, s: Side) => {
    b[r][c] = { r: rank, s };
  };
  put(0, 0, 7, 'r');
  put(0, 6, 6, 'r');
  put(1, 1, 4, 'r');
  put(1, 5, 2, 'r');
  put(2, 0, 1, 'r');
  put(2, 2, 5, 'r');
  put(2, 4, 3, 'r');
  put(2, 6, 8, 'r');
  put(8, 0, 6, 'b');
  put(8, 6, 7, 'b');
  put(7, 1, 2, 'b');
  put(7, 5, 4, 'b');
  put(6, 0, 8, 'b');
  put(6, 2, 3, 'b');
  put(6, 4, 5, 'b');
  put(6, 6, 1, 'b');
  return b;
}

/**
 * 攻方棋子能否走到 / 吃掉 (dr,dc) 上的棋子。
 * 规则顺序不可调换：水陆隔离先于陷阱，陷阱先于鼠象特例。
 */
export function canCapture(
  board: Board,
  att: Piece,
  ar: number,
  ac: number,
  dr: number,
  dc: number,
): boolean {
  const def = board[dr][dc];
  if (!def) return true;
  if (def.s === att.s) return false;
  const attInWater = isWater(ar, ac);
  const defInWater = isWater(dr, dc);
  // 水陆隔离：岸上的子吃不到水里的鼠，水里的鼠也上不了岸吃子
  if (attInWater !== defInWater) return false;
  // 守方踩在攻方阵营的陷阱里，失去全部威势
  if (trapOf(dr, dc) === att.s) return true;
  // 鼠克象，象不能伤鼠
  if (att.r === 1 && def.r === 8) return true;
  if (att.r === 8 && def.r === 1) return false;
  return att.r >= def.r;
}

/** 生成 side 一方的全部合法着法 */
export function genMoves(board: Board, side: Side): Move[] {
  const out: Move[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 7; c++) {
      const p = board[r][c];
      if (!p || p.s !== side) continue;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (!inBoard(nr, nc)) continue;
        // 任何棋子都不能走进自己的巢
        if (isDen(nr, nc, side)) continue;
        if (isWater(nr, nc)) {
          if (p.r === 1) {
            // 只有鼠能下水
            if (canCapture(board, p, r, c, nr, nc)) out.push({ f: [r, c], t: [nr, nc] });
          } else if (p.r === 6 || p.r === 7) {
            // 虎与狮沿该方向跳过整条河，水路上有任何棋子（含鼠）即被阻断
            let jr = nr;
            let jc = nc;
            let blocked = false;
            while (inBoard(jr, jc) && isWater(jr, jc)) {
              if (board[jr][jc]) {
                blocked = true;
                break;
              }
              jr += dr;
              jc += dc;
            }
            if (
              !blocked &&
              inBoard(jr, jc) &&
              !isDen(jr, jc, side) &&
              canCapture(board, p, r, c, jr, jc)
            ) {
              out.push({ f: [r, c], t: [jr, jc], jump: true });
            }
          }
          continue;
        }
        if (canCapture(board, p, r, c, nr, nc)) out.push({ f: [r, c], t: [nr, nc] });
      }
    }
  }
  return out;
}

/** 落子，返回新棋盘。不做合法性校验，调用方负责 */
export function apply(board: Board, mv: Move): Board {
  const nb = board.map((row) => row.slice());
  const p = nb[mv.f[0]][mv.f[1]];
  nb[mv.f[0]][mv.f[1]] = null;
  nb[mv.t[0]][mv.t[1]] = p;
  return nb;
}

/** 判断棋盘上是否已分出胜负：有子入巢，或一方被吃光 */
export function winnerOf(board: Board): Side | null {
  if (board[0][3]) return board[0][3]!.s;
  if (board[8][3]) return board[8][3]!.s;
  let nr = 0;
  let nb = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 7; c++) {
      const p = board[r][c];
      if (!p) continue;
      if (p.s === 'r') nr++;
      else nb++;
    }
  }
  if (!nr) return 'b';
  if (!nb) return 'r';
  return null;
}

/**
 * 在 mover 落子之后判定胜负。
 * 除了棋盘本身的胜负，还要补判「对方无合法着法则本方胜」。
 */
export function resolveWinner(board: Board, mover: Side): Side | null {
  const w = winnerOf(board);
  if (w) return w;
  if (genMoves(board, opposite(mover)).length === 0) return mover;
  return null;
}

/** 着法的中文描述，如「豹 C7→D7 吃狼」，用于日志与发给 AI 的提示词 */
export function describeMove(board: Board, mv: Move): string {
  const p = board[mv.f[0]][mv.f[1]];
  const target = board[mv.t[0]][mv.t[1]];
  const name = p ? NAMES[p.r] : '?';
  let text = `${name} ${toCoord(mv.f)}→${toCoord(mv.t)}`;
  if (target) text += ` 吃${NAMES[target.r]}`;
  else if (p && isDen(mv.t[0], mv.t[1], opposite(p.s))) text += ' 入巢';
  else if (mv.jump) text += ' 跳河';
  else if (isWater(mv.t[0], mv.t[1])) text += ' 入水';
  return text;
}

export { toCoord };
