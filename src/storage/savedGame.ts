import type { GameSetup, GameState } from '../hooks/useGame';
import type { Board, Side } from '../game/types';

/**
 * 进行中对局的本地存档，让 F5 刷新后能回到原局面。
 * 只存在当前浏览器里，不上传后端；读写失败（隐私模式、配额满）一律当作没有存档。
 */
export interface SavedGame {
  setup: GameSetup;
  state: GameState;
  paused: boolean;
  speed: number;
}

const STORAGE_KEY = 'jungle-chess-lab:game';

/** 存档格式变了就升版本号，旧存档直接作废，不做迁移 */
const VERSION = 1;

/**
 * 悔棋栈里每个快照的 log 必然是当前 log 的前缀，只记长度即可。
 * AI 的落子理由动辄上百字，60 个快照各存一份完整记录很容易撑爆 localStorage 的配额。
 */
interface StoredSnapshot {
  board: Board;
  turn: Side;
  captured: Record<Side, number[]>;
  logLen: number;
}

interface StoredGame {
  v: typeof VERSION;
  setup: GameSetup;
  paused: boolean;
  speed: number;
  board: Board;
  turn: Side;
  log: GameState['log'];
  winner: Side | null;
  captured: Record<Side, number[]>;
  hist: StoredSnapshot[];
}

/** 转成存档字符串。选中的棋子和可走高亮属于瞬时交互，不入档 */
export function serializeGame({ setup, state, paused, speed }: SavedGame): string {
  const data: StoredGame = {
    v: VERSION,
    setup,
    paused,
    speed,
    board: state.board,
    turn: state.turn,
    log: state.log,
    winner: state.winner,
    captured: state.captured,
    hist: state.hist.map((snap) => ({
      board: snap.board,
      turn: snap.turn,
      captured: snap.captured,
      logLen: snap.log.length,
    })),
  };
  return JSON.stringify(data);
}

/** 解析存档字符串。格式不认识就返回 null，宁可开新局也不拿残档硬恢复 */
export function parseGame(raw: string | null): SavedGame | null {
  if (!raw) return null;
  let data: StoredGame;
  try {
    data = JSON.parse(raw) as StoredGame;
  } catch {
    return null;
  }
  if (
    !data ||
    data.v !== VERSION ||
    !data.setup ||
    !Array.isArray(data.board) ||
    !Array.isArray(data.log) ||
    !Array.isArray(data.hist)
  ) {
    return null;
  }

  return {
    setup: data.setup,
    paused: data.paused,
    speed: data.speed,
    state: {
      board: data.board,
      turn: data.turn,
      sel: null,
      moves: [],
      log: data.log,
      winner: data.winner,
      captured: data.captured,
      hist: data.hist.map((snap) => ({
        board: snap.board,
        turn: snap.turn,
        captured: snap.captured,
        log: data.log.slice(0, snap.logLen),
      })),
    },
  };
}

export function loadGame(): SavedGame | null {
  try {
    return parseGame(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveGame(saved: SavedGame): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeGame(saved));
  } catch {
    // 存不下就算了，只是刷新后恢复不了，不影响当前对局
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 同上，清不掉最多是下次打开时多恢复一次
  }
}
