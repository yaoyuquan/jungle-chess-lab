/** 阵营：r = 红方（棋盘上方，巢在 0 行），b = 蓝方（棋盘下方，巢在 8 行，先行） */
export type Side = 'r' | 'b';

/** 兽力等级：1 鼠 … 8 象 */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** 棋子。r 是兽力等级，s 是阵营 */
export interface Piece {
  r: Rank;
  s: Side;
}

/** 棋盘坐标 [行, 列]，行 0..8（0 为红方底线），列 0..6 */
export type Pos = readonly [number, number];

/** 棋盘：9 行 × 7 列，空格为 null */
export type Board = readonly (Piece | null)[][];

/** 一步着法。jump 为真表示虎/狮跳河 */
export interface Move {
  readonly f: Pos;
  readonly t: Pos;
  readonly jump?: boolean;
}
