import type { AiPlayer } from '../api/types';
import type { GameSetup, UseGameResult } from '../hooks/useGame';
import { SPEEDS } from '../hooks/useGame';
import { SIDE_NAMES } from '../game/constants';
import type { Side } from '../game/types';
import { Board } from './Board';
import { MoveLog } from './MoveLog';
import { SidePanel } from './SidePanel';
import styles from './GameScreen.module.css';

interface Props {
  setup: GameSetup;
  game: UseGameResult;
  players: AiPlayer[];
  onBack: () => void;
}

const SPEED_BUTTONS: Array<{ label: string; value: number }> = [
  { label: '慢', value: SPEEDS.slow },
  { label: '中', value: SPEEDS.normal },
  { label: '快', value: SPEEDS.fast },
];

/**
 * 对局页：左侧双方面板、中间棋盘、右侧对局记录。
 */
export function GameScreen({ setup, game, players, onBack }: Props) {
  const { state, thinking, paused, speed } = game;
  const { mode, playerSide } = setup;

  const findPlayer = (id: string) => players.find((p) => p.id === id);
  const humanSide: Side | null = mode === 'pve' ? playerSide : null;

  const panelFor = (side: Side) => {
    if (humanSide === side) {
      return { role: '玩家', modelName: '你', modelNote: '手动落子' };
    }
    const player = findPlayer(side === 'r' ? setup.redPlayerId : setup.bluePlayerId);
    return {
      role: 'AI',
      modelName: player?.name ?? '未知棋手',
      modelNote: '',
    };
  };

  const red = panelFor('r');
  const blue = panelFor('b');

  let statusText: string;
  let statusClass: string;
  if (state.winner) {
    statusText = `${state.winner === 'r' ? '红方' : '蓝方'} 胜`;
    statusClass = state.winner === 'r' ? styles.statusRed : styles.statusBlue;
  } else {
    statusText = `${state.turn === 'r' ? '红方' : '蓝方'}${thinking ? ' 思考中…' : ' 行棋'}`;
    statusClass = state.turn === 'r' ? styles.statusRed : styles.statusBlue;
  }

  // 复制出去的棋谱要能脱离页面单独看懂，所以把模式、双方棋手、结果都带上；
  // AI 的落子理由页面上只在悬停时可见，复制时一并写出
  const buildRecordText = () => {
    const playerLine = (side: Side) => {
      const info = side === 'r' ? red : blue;
      return `${SIDE_NAMES[side]}：${info.modelName}（${info.role}）`;
    };
    const result = state.winner ? `${SIDE_NAMES[state.winner]}胜` : '未分胜负';
    const lines = [
      `斗兽棋 · ${mode === 'watch' ? 'AI 观战' : '人机对战'}`,
      playerLine('r'),
      playerLine('b'),
      `结果：${result}（共 ${state.log.length} 手）`,
      '',
    ];
    state.log.forEach((entry, i) => {
      const cap = entry.cap ? ` ${entry.cap}` : '';
      lines.push(`${i + 1}. ${SIDE_NAMES[entry.side]} ${entry.char} ${entry.move}${cap}`);
      if (entry.reason) lines.push(`   理由：${entry.reason}`);
    });
    return lines.join('\n');
  };

  const interactive = mode === 'pve' && !state.winner && state.turn === playerSide;

  // 玩家执红时把棋盘翻过来，让自己的阵营在下方；观战模式没有「自己」，保持默认朝向
  const flipped = mode === 'pve' && playerSide === 'r';
  // 面板顺序跟着棋盘走，上面的面板对应上方的阵营
  const panelOrder: Side[] = flipped ? ['b', 'r'] : ['r', 'b'];

  return (
    <div className={`${styles.page} rise-in-fast`}>
      <div className={styles.topBar}>
        <div className={styles.topLeft}>
          <button type="button" className={styles.backButton} onClick={onBack}>
            ← 返回
          </button>
          <div className={styles.brand}>斗獸棋</div>
          <div className={styles.modeLabel}>{mode === 'watch' ? 'AI 观战' : '人机对战'}</div>
        </div>
        <div className={`${styles.status} ${statusClass} ${thinking ? 'breathe' : ''}`}>
          {statusText}
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.sideColumn}>
          {panelOrder.map((side) => {
            const info = side === 'r' ? red : blue;
            return (
              <SidePanel
                key={side}
                side={side}
                active={state.turn === side && !state.winner}
                role={info.role}
                modelName={info.modelName}
                modelNote={info.modelNote}
                captured={state.captured[side]}
              />
            );
          })}
        </div>

        <div className={styles.center}>
          <Board
            board={state.board}
            sel={state.sel}
            moves={state.moves}
            interactive={interactive}
            flipped={flipped}
            onCell={game.onCell}
          />

          <div className={styles.controls}>
            {mode === 'watch' ? (
              <>
                <button
                  type="button"
                  className={`${styles.button} ${!paused ? styles.buttonPrimary : ''}`}
                  onClick={() => game.setPaused(!paused)}
                >
                  {paused ? '继续' : '暂停'}
                </button>
                {SPEED_BUTTONS.map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    className={`${styles.button} ${speed === btn.value ? styles.buttonPrimary : ''}`}
                    onClick={() => game.setSpeed(btn.value)}
                  >
                    {btn.label}
                  </button>
                ))}
              </>
            ) : (
              <button
                type="button"
                className={styles.button}
                onClick={game.undo}
                disabled={!game.canUndo}
              >
                悔棋
              </button>
            )}
            <button type="button" className={styles.button} onClick={game.restart}>
              重新开局
            </button>
          </div>
        </div>

        <MoveLog log={state.log} getCopyText={buildRecordText} />
      </div>
    </div>
  );
}
