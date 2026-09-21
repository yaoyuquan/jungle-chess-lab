import { describe, expect, it } from 'vitest';
import { apply, canCapture, genMoves, initBoard, resolveWinner, winnerOf } from './rules';
import { isDen, isWater, trapOf } from './terrain';
import { toCoord } from './coord';
import type { Board, Move, Piece, Rank, Side } from './types';

/** 造一个空棋盘，便于摆出特定局面 */
function emptyBoard(): (Piece | null)[][] {
  return Array.from({ length: 9 }, () => Array<Piece | null>(7).fill(null));
}

function put(b: (Piece | null)[][], r: number, c: number, rank: Rank, s: Side): void {
  b[r][c] = { r: rank, s };
}

/** 判断着法集合里是否含有某一步 */
function has(moves: Move[], f: [number, number], t: [number, number]): boolean {
  return moves.some((m) => m.f[0] === f[0] && m.f[1] === f[1] && m.t[0] === t[0] && m.t[1] === t[1]);
}

describe('地形', () => {
  it('水域是 3~5 行的 1、2、4、5 列', () => {
    expect(isWater(3, 1)).toBe(true);
    expect(isWater(5, 5)).toBe(true);
    expect(isWater(3, 0)).toBe(false);
    expect(isWater(3, 3)).toBe(false);
    expect(isWater(2, 1)).toBe(false);
    expect(isWater(6, 1)).toBe(false);
  });

  it('兽巢与陷阱位置正确', () => {
    expect(isDen(0, 3, 'r')).toBe(true);
    expect(isDen(8, 3, 'b')).toBe(true);
    expect(isDen(0, 3, 'b')).toBe(false);
    expect(trapOf(0, 2)).toBe('r');
    expect(trapOf(1, 3)).toBe('r');
    expect(trapOf(7, 3)).toBe('b');
    expect(trapOf(4, 4)).toBeNull();
  });

  it('棋谱坐标从下往上记行号', () => {
    expect(toCoord([0, 3])).toBe('D9');
    expect(toCoord([8, 3])).toBe('D1');
    expect(toCoord([2, 0])).toBe('A7');
  });
});

describe('初始布局', () => {
  it('双方各 8 子，摆位与设计稿一致', () => {
    const b = initBoard();
    let nr = 0;
    let nb = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 7; c++) {
        const p = b[r][c];
        if (!p) continue;
        if (p.s === 'r') nr++;
        else nb++;
      }
    }
    expect(nr).toBe(8);
    expect(nb).toBe(8);
    expect(b[0][0]).toEqual({ r: 7, s: 'r' });
    expect(b[2][6]).toEqual({ r: 8, s: 'r' });
    expect(b[8][6]).toEqual({ r: 7, s: 'b' });
    expect(b[6][6]).toEqual({ r: 1, s: 'b' });
  });
});

describe('入水与跳河', () => {
  it('鼠可以下水，其他兽不能', () => {
    const b = emptyBoard();
    put(b, 2, 1, 1, 'r');
    put(b, 2, 2, 5, 'r');
    const moves = genMoves(b, 'r');
    expect(has(moves, [2, 1], [3, 1])).toBe(true);
    expect(has(moves, [2, 2], [3, 2])).toBe(false);
  });

  it('虎狮可以纵向跳过整条河', () => {
    const b = emptyBoard();
    put(b, 2, 1, 6, 'r');
    put(b, 2, 4, 7, 'r');
    const moves = genMoves(b, 'r');
    expect(has(moves, [2, 1], [6, 1])).toBe(true);
    expect(has(moves, [2, 4], [6, 4])).toBe(true);
    expect(moves.find((m) => m.f[0] === 2 && m.f[1] === 1 && m.t[0] === 6)?.jump).toBe(true);
  });

  it('虎狮可以横向跳河', () => {
    const b = emptyBoard();
    put(b, 4, 0, 6, 'r');
    const moves = genMoves(b, 'r');
    expect(has(moves, [4, 0], [4, 3])).toBe(true);
  });

  it('水路上有鼠时跳河被阻断', () => {
    const b = emptyBoard();
    put(b, 2, 1, 6, 'r');
    put(b, 4, 1, 1, 'b');
    const moves = genMoves(b, 'r');
    expect(has(moves, [2, 1], [6, 1])).toBe(false);
  });

  it('水路上有己方棋子时同样被阻断', () => {
    const b = emptyBoard();
    put(b, 2, 4, 7, 'r');
    put(b, 5, 4, 1, 'r');
    const moves = genMoves(b, 'r');
    expect(has(moves, [2, 4], [6, 4])).toBe(false);
  });

  it('跳河落点上有可吃的对方子时可以吃', () => {
    const b = emptyBoard();
    put(b, 2, 1, 7, 'r');
    put(b, 6, 1, 3, 'b');
    expect(has(genMoves(b, 'r'), [2, 1], [6, 1])).toBe(true);
  });

  it('跳河落点上有更强的对方子时不能落', () => {
    const b = emptyBoard();
    put(b, 2, 1, 6, 'r');
    put(b, 6, 1, 8, 'b');
    expect(has(genMoves(b, 'r'), [2, 1], [6, 1])).toBe(false);
  });
});

describe('吃子规则', () => {
  it('鼠能吃象，象不能吃鼠', () => {
    const b = emptyBoard();
    const rat: Piece = { r: 1, s: 'r' };
    const eleph: Piece = { r: 8, s: 'b' };
    put(b, 2, 0, 1, 'r');
    put(b, 2, 1, 8, 'b');
    expect(canCapture(b as Board, rat, 2, 0, 2, 1)).toBe(true);
    expect(canCapture(b as Board, eleph, 2, 1, 2, 0)).toBe(false);
  });

  it('岸上的子吃不到水里的鼠，水里的鼠也吃不到岸上的子', () => {
    const b = emptyBoard();
    put(b, 3, 1, 1, 'b');
    put(b, 2, 1, 8, 'r');
    const eleph = b[2][1]!;
    const rat = b[3][1]!;
    expect(canCapture(b as Board, eleph, 2, 1, 3, 1)).toBe(false);
    expect(canCapture(b as Board, rat, 3, 1, 2, 1)).toBe(false);
  });

  it('水里的鼠可以吃水里的鼠', () => {
    const b = emptyBoard();
    put(b, 3, 1, 1, 'r');
    put(b, 3, 2, 1, 'b');
    expect(canCapture(b as Board, b[3][1]!, 3, 1, 3, 2)).toBe(true);
  });

  it('踩进对方陷阱的棋子可被任意棋子吃掉', () => {
    const b = emptyBoard();
    put(b, 0, 2, 8, 'b');
    put(b, 0, 1, 2, 'r');
    expect(canCapture(b as Board, b[0][1]!, 0, 1, 0, 2)).toBe(true);
  });

  it('自己踩在自家陷阱里不会失去威势', () => {
    const b = emptyBoard();
    put(b, 0, 2, 2, 'r');
    put(b, 0, 1, 3, 'b');
    expect(canCapture(b as Board, b[0][1]!, 0, 1, 0, 2)).toBe(true);
    put(b, 0, 1, 1, 'b');
    expect(canCapture(b as Board, b[0][1]!, 0, 1, 0, 2)).toBe(false);
  });

  it('同级可以互吃，低级吃不掉高级', () => {
    const b = emptyBoard();
    put(b, 4, 0, 5, 'r');
    put(b, 4, 3, 5, 'b');
    expect(canCapture(b as Board, b[4][0]!, 4, 0, 4, 3)).toBe(true);
    b[4][3] = { r: 6, s: 'b' };
    expect(canCapture(b as Board, b[4][0]!, 4, 0, 4, 3)).toBe(false);
  });
});

describe('兽巢', () => {
  it('棋子不能走进自己的巢', () => {
    const b = emptyBoard();
    put(b, 1, 3, 3, 'r');
    expect(has(genMoves(b, 'r'), [1, 3], [0, 3])).toBe(false);
  });

  it('棋子可以走进对方的巢', () => {
    const b = emptyBoard();
    put(b, 7, 3, 3, 'r');
    expect(has(genMoves(b, 'r'), [7, 3], [8, 3])).toBe(true);
  });

  it('入巢即判胜', () => {
    const b = emptyBoard();
    put(b, 7, 3, 3, 'r');
    put(b, 0, 0, 1, 'b');
    const next = apply(b as Board, { f: [7, 3], t: [8, 3] });
    expect(winnerOf(next)).toBe('r');
  });
});

describe('胜负判定', () => {
  it('一方被吃光则对方胜', () => {
    const b = emptyBoard();
    put(b, 4, 0, 5, 'r');
    expect(winnerOf(b as Board)).toBe('r');
  });

  it('对方无合法着法则本方胜', () => {
    const b = emptyBoard();
    // 蓝方只剩一只猫，被两只红象堵死在角落，猫吃不动象也无处可走
    put(b, 8, 0, 2, 'b');
    put(b, 7, 0, 8, 'r');
    put(b, 8, 1, 8, 'r');
    expect(genMoves(b as Board, 'b').length).toBe(0);
    expect(resolveWinner(b as Board, 'r')).toBe('r');
  });

  it('正常开局尚未分出胜负', () => {
    expect(winnerOf(initBoard())).toBeNull();
    expect(resolveWinner(initBoard(), 'b')).toBeNull();
  });
});

describe('开局着法', () => {
  it('蓝方开局有合法着法且不含进入自家巢的走子', () => {
    const moves = genMoves(initBoard(), 'b');
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => !isDen(m.t[0], m.t[1], 'b'))).toBe(true);
  });
});
