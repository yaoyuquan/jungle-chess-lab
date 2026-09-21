import type { Side } from '../game/types';

/** 后端下发的 AI 棋手 */
export interface AiPlayer {
  id: string;
  name: string;
  code: string;
}

/** 发给后端的一条候选着法 */
export interface LegalMovePayload {
  i: number;
  from: [number, number];
  to: [number, number];
  text: string;
}

/** 棋盘格子的传输形态 */
export interface BoardCellPayload {
  rank: number;
  side: Side;
}

/** 请求 AI 走一步 */
export interface AiMoveRequest {
  playerId: string;
  side: Side;
  board: (BoardCellPayload | null)[][];
  moveNumber: number;
  legalMoves: LegalMovePayload[];
}

/** AI 的落子决定 */
export interface AiMoveResponse {
  index: number;
  reason: string;
  fallback: boolean;
}
