import type { LogEntry } from '../hooks/useGame';
import styles from './MoveLog.module.css';

interface Props {
  log: LogEntry[];
}

/**
 * 对局记录。最新的一手排在最上面。
 * AI 给出的落子理由挂在整行的 title 上，鼠标悬停可见。
 */
export function MoveLog({ log }: Props) {
  const rows = log.map((entry, i) => ({ ...entry, n: i + 1 })).reverse();

  return (
    <div className={styles.panel}>
      <div className={styles.title}>对局记录</div>
      <div className={styles.list}>
        {rows.map((entry) => (
          <div key={entry.n} className={styles.row} title={entry.reason ?? undefined}>
            <span className={styles.index}>{entry.n}</span>
            <span
              className={`${styles.chip} ${entry.side === 'r' ? styles.chipRed : styles.chipBlue}`}
            >
              {entry.char}
            </span>
            <span className={styles.move}>{entry.move}</span>
            {entry.cap && <span className={styles.cap}>{entry.cap}</span>}
            {entry.fallback && <span className={styles.fallback}>兜底</span>}
          </div>
        ))}
        {log.length === 0 && <div className={styles.empty}>尚无着法。蓝方先行。</div>}
      </div>
    </div>
  );
}
