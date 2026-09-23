import { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../hooks/useGame';
import styles from './MoveLog.module.css';

interface Props {
  log: LogEntry[];
  /** 生成要复制的整份棋谱。按需调用，免得每次渲染都拼一遍长文本 */
  getCopyText: () => string;
}

type CopyStatus = 'idle' | 'done' | 'fail';

const COPY_LABELS: Record<CopyStatus, string> = {
  idle: '复制',
  done: '已复制',
  fail: '复制失败',
};

/** 复制结果提示停留的时长 */
const COPY_FEEDBACK_MS = 1500;

/**
 * 对局记录。最新的一手排在最上面。
 * AI 给出的落子理由挂在整行的 title 上，鼠标悬停可见。
 */
export function MoveLog({ log, getCopyText }: Props) {
  const rows = log.map((entry, i) => ({ ...entry, n: i + 1 })).reverse();
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const showStatus = (status: CopyStatus) => {
    setCopyStatus(status);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopyStatus('idle'), COPY_FEEDBACK_MS);
  };

  const handleCopy = () => {
    // 非安全上下文（非 localhost 的 http）下 clipboard 不存在，直接提示失败
    if (!navigator.clipboard) {
      showStatus('fail');
      return;
    }
    navigator.clipboard.writeText(getCopyText()).then(
      () => showStatus('done'),
      () => showStatus('fail'),
    );
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>对局记录</div>
        <button
          type="button"
          className={`${styles.copyButton} ${copyStatus === 'fail' ? styles.copyFail : ''}`}
          onClick={handleCopy}
          disabled={log.length === 0}
        >
          {COPY_LABELS[copyStatus]}
        </button>
      </div>
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
          </div>
        ))}
        {log.length === 0 && <div className={styles.empty}>尚无着法。蓝方先行。</div>}
      </div>
    </div>
  );
}
