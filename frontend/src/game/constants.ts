import type { Rank, Side } from './types';

export const ROWS = 9;
export const COLS_COUNT = 7;

/** 列号字母，A 在最左 */
export const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

/** 兽名 */
export const NAMES: Record<Rank, string> = {
  1: '鼠',
  2: '猫',
  3: '狼',
  4: '狗',
  5: '豹',
  6: '虎',
  7: '狮',
  8: '象',
};

/** 子力价值，用于兜底着法评估与展示 */
export const VAL: Record<Rank, number> = {
  1: 95,
  2: 55,
  3: 75,
  4: 95,
  5: 135,
  6: 185,
  7: 205,
  8: 235,
};

/** 对方阵营 */
export const opposite = (s: Side): Side => (s === 'r' ? 'b' : 'r');

/** 阵营中文名 */
export const SIDE_NAMES: Record<Side, string> = { r: '红方', b: '蓝方' };
