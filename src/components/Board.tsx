import { COLS, NAMES } from '../game/constants';
import { denOf, isWater, trapOf } from '../game/terrain';
import type { Board as BoardType, Move } from '../game/types';
import styles from './Board.module.css';

interface Props {
  board: BoardType;
  sel: [number, number] | null;
  moves: Move[];
  interactive: boolean;
  /** 翻转棋盘，让红方显示在下方。玩家执红时用 */
  flipped?: boolean;
  onCell: (r: number, c: number) => void;
}

/** 单格的地形样式类 */
function terrainClass(r: number, c: number): string {
  if (isWater(r, c)) return styles.water;
  const den = denOf(r, c);
  if (den) return den === 'r' ? styles.denRed : styles.denBlue;
  const trap = trapOf(r, c);
  if (trap) return trap === 'r' ? styles.trapRed : styles.trapBlue;
  return '';
}

/**
 * 棋盘。7 列 × 9 行，四周带坐标轴。
 * <p>
 * flipped 只影响行的渲染顺序，棋盘坐标 (r,c) 与棋谱记法都保持不变，
 * 所以点击回调、着法高亮、对局记录都不需要跟着换算。
 */
export function Board({ board, sel, moves, interactive, flipped = false, onCell }: Props) {
  const legal = new Set(moves.map((m) => `${m.t[0]},${m.t[1]}`));

  // 默认第 0 行（红方底线）画在最上面；翻转后倒过来，红方就到了下方
  const rowOrder = board.map((_, r) => r);
  if (flipped) rowOrder.reverse();

  return (
    <div className={styles.wrap}>
      <div className={styles.colHeader}>
        <div />
        {COLS.map((label) => (
          <div key={label} className={styles.colLabel}>
            {label}
          </div>
        ))}
      </div>

      <div className={styles.body}>
        <div className={styles.rowLabels}>
          {rowOrder.map((r) => (
            <div key={r} className={styles.rowLabel}>
              {9 - r}
            </div>
          ))}
        </div>

        <div className={styles.grid}>
          {rowOrder.flatMap((r) =>
            board[r].map((piece, c) => {
              const den = denOf(r, c);
              const trap = trapOf(r, c);
              const isDot = legal.has(`${r},${c}`);
              const selected = sel !== null && sel[0] === r && sel[1] === c;
              const clickable = interactive && (Boolean(piece) || isDot);

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  className={`${styles.cell} ${terrainClass(r, c)} ${clickable ? styles.cellClickable : ''}`}
                  onClick={() => onCell(r, c)}
                >
                  {den && <span className={`${styles.glyph} ${styles.glyphDen}`}>巢</span>}
                  {!den && trap && <span className={`${styles.glyph} ${styles.glyphTrap}`}>陷</span>}

                  {piece && (
                    <span
                      className={`${styles.piece} ${piece.s === 'r' ? styles.pieceRed : styles.pieceBlue} ${
                        selected ? styles.pieceSelected : ''
                      }`}
                    >
                      <span className={styles.pieceChar}>{NAMES[piece.r]}</span>
                      <span className={styles.pieceRank}>{piece.r}</span>
                    </span>
                  )}

                  {isDot && !piece && <span className={styles.moveDot} />}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
