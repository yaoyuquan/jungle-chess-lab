import { NAMES } from '../game/constants';
import type { Rank, Side } from '../game/types';
import styles from './SidePanel.module.css';

interface Props {
  side: Side;
  active: boolean;
  role: string;
  modelName: string;
  modelNote: string;
  captured: number[];
}

/**
 * 单侧阵营面板：角色、棋手、俘虏。
 * 轮到该方行棋时边框会亮起来。
 */
export function SidePanel({ side, active, role, modelName, modelNote, captured }: Props) {
  const isRed = side === 'r';
  const activeClass = active ? (isRed ? styles.panelActiveRed : styles.panelActiveBlue) : '';
  // 俘虏的是对方的子，所以 chip 用对方的颜色
  const chipClass = isRed ? styles.chipBlue : styles.chipRed;

  return (
    <div className={`${styles.panel} ${activeClass}`}>
      <div className={styles.head}>
        <span className={`${styles.name} ${isRed ? styles.nameRed : styles.nameBlue}`}>
          {isRed ? '红方' : '蓝方'}
        </span>
        <span className={styles.role}>{role}</span>
      </div>
      <div className={styles.model}>{modelName}</div>
      {modelNote && <div className={styles.desc}>{modelNote}</div>}
      <div className={styles.captured}>
        {captured.map((rank, i) => (
          <span key={`${rank}-${i}`} className={`${styles.chip} ${chipClass}`}>
            {NAMES[rank as Rank]}
          </span>
        ))}
      </div>
    </div>
  );
}
