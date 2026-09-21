import type { Side } from './types';

/** 水域：3~5 行的 1、2、4、5 列，构成两条河 */
export function isWater(r: number, c: number): boolean {
  return r >= 3 && r <= 5 && (c === 1 || c === 2 || c === 4 || c === 5);
}

/** side 一方的兽巢。红巢在 (0,3)，蓝巢在 (8,3) */
export function isDen(r: number, c: number, s: Side): boolean {
  return c === 3 && r === (s === 'r' ? 0 : 8);
}

/** 若 (r,c) 是陷阱，返回该陷阱所属阵营；该阵营可在此格吃掉任何对方棋子 */
export function trapOf(r: number, c: number): Side | null {
  if ((r === 0 && (c === 2 || c === 4)) || (r === 1 && c === 3)) return 'r';
  if ((r === 8 && (c === 2 || c === 4)) || (r === 7 && c === 3)) return 'b';
  return null;
}

/** (r,c) 是否是某一方的巢，返回所属阵营 */
export function denOf(r: number, c: number): Side | null {
  if (c !== 3) return null;
  if (r === 0) return 'r';
  if (r === 8) return 'b';
  return null;
}

/** 坐标是否在棋盘内 */
export function inBoard(r: number, c: number): boolean {
  return r >= 0 && r <= 8 && c >= 0 && c <= 6;
}
