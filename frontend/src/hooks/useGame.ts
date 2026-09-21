import { useCallback, useEffect, useRef, useState } from 'react';
import { requestAiMove } from '../api/client';
import type { BoardCellPayload, LegalMovePayload } from '../api/types';
import { NAMES, opposite } from '../game/constants';
import { toCoord } from '../game/coord';
import { apply, describeMove, genMoves, initBoard, resolveWinner } from '../game/rules';
import { isDen } from '../game/terrain';
import type { Board, Move, Side } from '../game/types';

export type GameMode = 'pve' | 'watch';

/** 观战模式下每步之间的额外间隔。大模型自身的响应耗时才是节奏主导，这里只是再放缓一点 */
export const SPEEDS = { slow: 1200, normal: 700, fast: 280 } as const;

/** 人机对战里 AI 起手的思考延迟，让落子不至于瞬发得突兀 */
const PVE_DELAY = 420;

/** 历史栈上限，与设计稿一致 */
const HISTORY_LIMIT = 60;

export interface LogEntry {
  side: Side;
  char: string;
  move: string;
  cap: string;
  reason?: string;
  fallback?: boolean;
}

interface Snapshot {
  board: Board;
  turn: Side;
  captured: Record<Side, number[]>;
  log: LogEntry[];
}

export interface GameSetup {
  mode: GameMode;
  playerSide: Side;
  redPlayerId: string;
  bluePlayerId: string;
}

export interface GameState {
  board: Board;
  turn: Side;
  sel: [number, number] | null;
  moves: Move[];
  log: LogEntry[];
  winner: Side | null;
  captured: Record<Side, number[]>;
  hist: Snapshot[];
}

function freshState(): GameState {
  return {
    board: initBoard(),
    turn: 'b',
    sel: null,
    moves: [],
    log: [],
    winner: null,
    captured: { r: [], b: [] },
    hist: [],
  };
}

/** 把棋盘转成接口需要的形态 */
function toPayloadBoard(board: Board): (BoardCellPayload | null)[][] {
  return board.map((row) => row.map((p) => (p ? { rank: p.r, side: p.s } : null)));
}

/** 给着法编号并附上中文描述 */
function toPayloadMoves(board: Board, moves: Move[]): LegalMovePayload[] {
  return moves.map((m, i) => ({
    i,
    from: [m.f[0], m.f[1]],
    to: [m.t[0], m.t[1]],
    text: describeMove(board, m),
  }));
}

export interface UseGameResult {
  state: GameState;
  thinking: boolean;
  paused: boolean;
  speed: number;
  aiError: string | null;
  onCell: (r: number, c: number) => void;
  undo: () => void;
  restart: () => void;
  setPaused: (paused: boolean) => void;
  setSpeed: (speed: number) => void;
  canUndo: boolean;
}

/**
 * 对局状态机。规则判定全部在本地完成，只有「AI 选哪一步」需要问后端。
 */
export function useGame(setup: GameSetup): UseGameResult {
  const { mode, playerSide, redPlayerId, bluePlayerId } = setup;

  const [state, setState] = useState<GameState>(freshState);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<number>(SPEEDS.normal);
  const [thinking, setThinking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // 每次开局 / 悔棋都会让 runId 自增，用来丢弃在途的 AI 响应
  const runIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  /** 取消在途的 AI 请求 */
  const cancelPending = useCallback(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setThinking(false);
  }, []);

  /** 落子并推进对局 */
  const commit = useCallback((mv: Move, extra?: { reason?: string; fallback?: boolean }) => {
    setState((s) => {
      const piece = s.board[mv.f[0]][mv.f[1]];
      if (!piece) return s;
      const target = s.board[mv.t[0]][mv.t[1]];
      const board = apply(s.board, mv);
      const captured: Record<Side, number[]> = { r: s.captured.r.slice(), b: s.captured.b.slice() };
      if (target) captured[piece.s].push(target.r);

      let cap = '';
      if (target) cap = `吃${NAMES[target.r]}`;
      else if (isDen(mv.t[0], mv.t[1], opposite(piece.s))) cap = '入巢';

      const log = s.log.concat([
        {
          side: piece.s,
          char: NAMES[piece.r],
          move: `${toCoord(mv.f)} → ${toCoord(mv.t)}`,
          cap,
          reason: extra?.reason,
          fallback: extra?.fallback,
        },
      ]);
      const hist = s.hist
        .concat([{ board: s.board, turn: s.turn, captured: s.captured, log: s.log }])
        .slice(-HISTORY_LIMIT);

      return {
        board,
        turn: opposite(piece.s),
        sel: null,
        moves: [],
        log,
        hist,
        captured,
        winner: resolveWinner(board, piece.s),
      };
    });
  }, []);

  const isAiTurn = !state.winner && (mode === 'watch' || state.turn !== playerSide);

  // AI 回合：等一个节奏间隔后向后端要一步棋
  useEffect(() => {
    if (!isAiTurn) return;
    if (mode === 'watch' && paused) return;

    const legal = genMoves(state.board, state.turn);
    if (legal.length === 0) {
      // 本方已无路可走，直接判负
      setState((s) => (s.winner ? s : { ...s, winner: opposite(s.turn) }));
      return;
    }

    const runId = runIdRef.current;
    const delay = mode === 'watch' ? speed : PVE_DELAY;
    const board = state.board;
    const turn = state.turn;
    const moveNumber = state.log.length + 1;

    const timer = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      setThinking(true);
      requestAiMove(
        {
          playerId: turn === 'r' ? redPlayerId : bluePlayerId,
          side: turn,
          board: toPayloadBoard(board),
          moveNumber,
          legalMoves: toPayloadMoves(board, legal),
        },
        controller.signal,
      )
        .then((res) => {
          if (runId !== runIdRef.current || controller.signal.aborted) return;
          setAiError(null);
          commit(legal[res.index] ?? legal[0], { reason: res.reason, fallback: res.fallback });
        })
        .catch((e: unknown) => {
          if (runId !== runIdRef.current || controller.signal.aborted) return;
          // 后端彻底不可用时就地随机落子，保证观战不会停死
          const message = e instanceof Error ? e.message : String(e);
          setAiError(message);
          commit(legal[Math.floor(Math.random() * legal.length)], {
            reason: `AI 服务不可用（${message}），本地随机落子。`,
            fallback: true,
          });
        })
        .finally(() => {
          if (runId === runIdRef.current) setThinking(false);
        });
    }, delay);

    return () => clearTimeout(timer);
  }, [
    isAiTurn,
    mode,
    paused,
    speed,
    state.board,
    state.turn,
    state.log.length,
    redPlayerId,
    bluePlayerId,
    commit,
  ]);

  // 组件卸载时取消在途请求
  useEffect(() => cancelPending, [cancelPending]);

  /** 点击棋盘 */
  const onCell = useCallback(
    (r: number, c: number) => {
      if (mode === 'watch' || state.winner || state.turn !== playerSide) return;

      const target = state.moves.find((m) => m.t[0] === r && m.t[1] === c);
      if (target) {
        commit(target);
        return;
      }

      const piece = state.board[r][c];
      if (piece && piece.s === playerSide) {
        const moves = genMoves(state.board, playerSide).filter(
          (m) => m.f[0] === r && m.f[1] === c,
        );
        setState((s) => ({ ...s, sel: [r, c], moves }));
        return;
      }
      setState((s) => ({ ...s, sel: null, moves: [] }));
    },
    [commit, mode, playerSide, state.board, state.moves, state.turn, state.winner],
  );

  /** 悔棋：回退到上一次轮到玩家的局面 */
  const undo = useCallback(() => {
    if (mode === 'watch') return;
    cancelPending();
    setState((s) => {
      const hist = s.hist.slice();
      let snap: Snapshot | null = null;
      while (hist.length) {
        snap = hist.pop() ?? null;
        if (snap && snap.turn === playerSide) break;
      }
      if (!snap) return s;
      return {
        board: snap.board,
        turn: snap.turn,
        captured: snap.captured,
        log: snap.log,
        hist,
        sel: null,
        moves: [],
        winner: null,
      };
    });
  }, [cancelPending, mode, playerSide]);

  /** 重新开局 */
  const restart = useCallback(() => {
    cancelPending();
    setPaused(false);
    setAiError(null);
    setState(freshState());
  }, [cancelPending]);

  return {
    state,
    thinking: thinking && !(mode === 'watch' && paused),
    paused,
    speed,
    aiError,
    onCell,
    undo,
    restart,
    setPaused,
    setSpeed,
    canUndo: mode === 'pve' && state.hist.length > 0,
  };
}
