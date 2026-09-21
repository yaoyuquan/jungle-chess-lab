import { COLS } from './constants';
import type { Pos } from './types';

/** 棋盘坐标转棋谱坐标：列用 A~G，行自下而上记为 1~9，故 (0,3) 记作 D9 */
export function toCoord(pos: Pos): string {
  return `${COLS[pos[1]]}${9 - pos[0]}`;
}
