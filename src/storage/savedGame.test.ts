import { describe, expect, it } from 'vitest';
import { apply, initBoard } from '../game/rules';
import type { GameState, LogEntry } from '../hooks/useGame';
import type { SavedGame } from './savedGame';
import { parseGame, serializeGame } from './savedGame';

const LOG: LogEntry[] = [
  { side: 'b', char: '鼠', move: 'A3 → A4', cap: '' },
  { side: 'r', char: '狼', move: 'C7 → C6', cap: '', reason: '先占中路' },
  { side: 'b', char: '豹', move: 'E3 → E4', cap: '' },
];

/** 走了三手的人机对局，悔棋栈里有三个快照 */
function sample(): SavedGame {
  const b0 = initBoard();
  const b1 = apply(b0, { f: [6, 0], t: [5, 0] });
  const b2 = apply(b1, { f: [2, 2], t: [3, 2] });
  const b3 = apply(b2, { f: [6, 4], t: [5, 4] });
  const empty = { r: [], b: [] };
  const state: GameState = {
    board: b3,
    turn: 'r',
    sel: [2, 0],
    moves: [{ f: [2, 0], t: [3, 0] }],
    log: LOG,
    winner: null,
    captured: empty,
    hist: [
      { board: b0, turn: 'b', captured: empty, log: [] },
      { board: b1, turn: 'r', captured: empty, log: LOG.slice(0, 1) },
      { board: b2, turn: 'b', captured: empty, log: LOG.slice(0, 2) },
    ],
  };
  return {
    setup: { mode: 'pve', playerSide: 'b', redPlayerId: 'some-model', bluePlayerId: '' },
    state,
    paused: false,
    speed: 700,
  };
}

describe('对局存档', () => {
  it('存档后再读出，局面、记录、悔棋栈与设置都原样恢复', () => {
    const saved = sample();
    const restored = parseGame(serializeGame(saved));
    expect(restored).not.toBeNull();
    expect(restored!.setup).toEqual(saved.setup);
    expect(restored!.paused).toBe(false);
    expect(restored!.speed).toBe(700);
    expect(restored!.state.board).toEqual(saved.state.board);
    expect(restored!.state.turn).toBe('r');
    expect(restored!.state.log).toEqual(LOG);
    expect(restored!.state.hist).toEqual(saved.state.hist);
  });

  it('悔棋快照的记录只存长度，不重复存整份记录', () => {
    const raw = serializeGame(sample());
    expect(raw.split('先占中路').length - 1).toBe(1);
  });

  it('选中的棋子和可走高亮不入档', () => {
    const restored = parseGame(serializeGame(sample()));
    expect(restored!.state.sel).toBeNull();
    expect(restored!.state.moves).toEqual([]);
  });

  it('没有存档、内容损坏或版本不符时返回 null', () => {
    expect(parseGame(null)).toBeNull();
    expect(parseGame('{不是 JSON')).toBeNull();
    expect(parseGame('null')).toBeNull();
    const other = JSON.parse(serializeGame(sample()));
    other.v = 999;
    expect(parseGame(JSON.stringify(other))).toBeNull();
  });
});
