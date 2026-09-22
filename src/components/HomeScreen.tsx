import type { AiPlayer } from '../api/types';
import type { GameMode } from '../hooks/useGame';
import { MODELS_API } from '../hooks/useModels';
import type { Side } from '../game/types';
import styles from './HomeScreen.module.css';

interface Props {
  mode: GameMode;
  playerSide: Side;
  pvePlayerId: string;
  redPlayerId: string;
  bluePlayerId: string;
  players: AiPlayer[];
  loading: boolean;
  error: string | null;
  onModeChange: (mode: GameMode) => void;
  onSideChange: (side: Side) => void;
  onPvePlayerChange: (id: string) => void;
  onRedPlayerChange: (id: string) => void;
  onBluePlayerChange: (id: string) => void;
  onStart: () => void;
}

const MODE_CARDS: Array<{ id: GameMode; title: string; tag: string; desc: string }> = [
  { id: 'pve', title: '人机对战', tag: '你执一方', desc: '你与所选模型面对面较量，可随时悔棋。' },
  { id: 'watch', title: 'AI 观战', tag: '双模型对弈', desc: '两个模型自动对弈，你只负责看棋与复盘。' },
];

const SIDE_CARDS: Array<{ id: Side; label: string }> = [
  { id: 'b', label: '蓝方 · 先行' },
  { id: 'r', label: '红方 · 后手' },
];

/** 棋手下拉框。加载中时禁用并显示占位项 */
function PlayerSelect({
  value,
  players,
  loading,
  onChange,
  variant,
}: {
  value: string;
  players: AiPlayer[];
  loading: boolean;
  onChange: (id: string) => void;
  variant?: 'red' | 'blue';
}) {
  const variantClass =
    variant === 'red' ? styles.selectRed : variant === 'blue' ? styles.selectBlue : '';
  return (
    <select
      className={`${styles.select} ${variantClass}`}
      value={loading ? '' : value}
      disabled={loading}
      onChange={(e) => onChange(e.target.value)}
    >
      {loading ? (
        <option value="">模型加载中…</option>
      ) : (
        players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code ? `${p.name}（${p.code}）` : p.name}
          </option>
        ))
      )}
    </select>
  );
}

/**
 * 首页：选模式、选阵营、选棋手。
 */
export function HomeScreen(props: Props) {
  const {
    mode,
    playerSide,
    pvePlayerId,
    redPlayerId,
    bluePlayerId,
    players,
    loading,
    error,
    onModeChange,
    onSideChange,
    onPvePlayerChange,
    onRedPlayerChange,
    onBluePlayerChange,
    onStart,
  } = props;

  const sourceText = loading
    ? ''
    : error
      ? `模型接口 ${MODELS_API} 未响应，当前使用内置演示清单。`
      : `模型清单来自后台接口 ${MODELS_API}。`;

  return (
    <div className={`${styles.page} rise-in`}>
      <div className={styles.header}>
        <div className={styles.title}>斗獸棋</div>
        <div className={styles.subtitleWrap}>
          <div className={styles.subtitle}>Jungle Chess</div>
          <div className={styles.chain}>象 › 狮 › 虎 › 豹 › 狗 › 狼 › 猫 › 鼠 › 象</div>
        </div>
      </div>

      <div className={styles.modeGrid}>
        {MODE_CARDS.map((card) => {
          const active = mode === card.id;
          return (
            <button
              key={card.id}
              type="button"
              className={`${styles.modeCard} ${active ? styles.modeCardActive : ''}`}
              onClick={() => onModeChange(card.id)}
            >
              <div className={styles.modeTitle}>{card.title}</div>
              <div className={styles.modeDesc}>{card.desc}</div>
              <div className={`${styles.modeTag} ${active ? styles.modeTagActive : ''}`}>
                {card.tag}
              </div>
            </button>
          );
        })}
      </div>

      {mode === 'pve' && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>选择你的阵营</div>
          <div className={styles.sideRow}>
            {SIDE_CARDS.map((card) => (
              <button
                key={card.id}
                type="button"
                className={`${styles.sideCard} ${playerSide === card.id ? styles.sideCardActive : ''}`}
                onClick={() => onSideChange(card.id)}
              >
                <span
                  className={`${styles.dot} ${card.id === 'r' ? styles.dotRed : styles.dotBlue}`}
                />
                {card.label}
              </button>
            ))}
          </div>

          <div className={styles.sectionLabel} style={{ margin: '26px 0 14px' }}>
            对手模型
          </div>
          <div className={styles.selectWrap}>
            <PlayerSelect
              value={pvePlayerId}
              players={players}
              loading={loading}
              onChange={onPvePlayerChange}
            />
            {loading && <div className={styles.hint}>正在从后台读取可用模型…</div>}
          </div>
        </div>
      )}

      {mode === 'watch' && (
        <>
          <div className={styles.watchGrid}>
            <div>
              <div className={styles.watchLabelRed}>红方模型 · 后手</div>
              <PlayerSelect
                value={redPlayerId}
                players={players}
                loading={loading}
                onChange={onRedPlayerChange}
                variant="red"
              />
            </div>
            <div>
              <div className={styles.watchLabelBlue}>蓝方模型 · 先行</div>
              <PlayerSelect
                value={bluePlayerId}
                players={players}
                loading={loading}
                onChange={onBluePlayerChange}
                variant="blue"
              />
            </div>
          </div>
          <div className={`${styles.source} ${error ? styles.sourceError : ''}`}>{sourceText}</div>
        </>
      )}

      <div className={styles.footer}>
        <button type="button" className={styles.startButton} onClick={onStart}>
          {mode === 'watch' ? '开始观战' : '开始对局'}
        </button>
        <div className={styles.rules}>
          棋盘 7×9，河流阻隔，陷阱失威，入巢即胜。狮虎可越河，唯鼠可涉水，鼠能克象而象不能伤鼠。
        </div>
      </div>
    </div>
  );
}
