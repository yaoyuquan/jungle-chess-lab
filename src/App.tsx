import { useCallback, useEffect, useMemo, useState } from 'react';
import { GameScreen } from './components/GameScreen';
import { HomeScreen } from './components/HomeScreen';
import type { Side } from './game/types';
import type { GameMode, GameSetup } from './hooks/useGame';
import { useGame } from './hooks/useGame';
import { useModels } from './hooks/useModels';

/** 对局页容器。key 的变化会让整个 hook 重置，等于开一局新棋 */
function GameRoute({
  setup,
  players,
  onBack,
  onAbort,
}: {
  setup: GameSetup;
  players: ReturnType<typeof useModels>['players'];
  onBack: () => void;
  onAbort: (reason: string) => void;
}) {
  const game = useGame(setup, onAbort);
  return <GameScreen setup={setup} game={game} players={players} onBack={onBack} />;
}

/**
 * 应用根组件。只管两件事：首页的选择项，以及首页与对局页的切换。
 */
export function App() {
  const { players, loading, error } = useModels();

  const [screen, setScreen] = useState<'home' | 'game'>('home');
  const [mode, setMode] = useState<GameMode>('pve');
  const [playerSide, setPlayerSide] = useState<Side>('b');
  const [pvePlayerId, setPvePlayerId] = useState('');
  const [redPlayerId, setRedPlayerId] = useState('');
  const [bluePlayerId, setBluePlayerId] = useState('');
  // 每次开局自增，用作对局页的 key，确保新局从干净状态开始
  const [round, setRound] = useState(0);
  // 对局被中止时带回首页的提示语
  const [notice, setNotice] = useState<string | null>(null);

  // 棋手清单到位后填默认选项：人机默认第一位，观战默认两个席位各占一方
  useEffect(() => {
    if (!players.length) return;
    setPvePlayerId((cur) => cur || players[0].id);
    setRedPlayerId((cur) => cur || players[0].id);
    // 只有一位棋手时只能自己跟自己下
    setBluePlayerId((cur) => cur || (players[1] ?? players[0]).id);
  }, [players]);

  const setup: GameSetup = useMemo(() => {
    if (mode === 'watch') {
      return { mode, playerSide, redPlayerId, bluePlayerId };
    }
    // 人机对战里只有一个 AI，它执玩家的对立面
    return {
      mode,
      playerSide,
      redPlayerId: playerSide === 'r' ? '' : pvePlayerId,
      bluePlayerId: playerSide === 'b' ? '' : pvePlayerId,
    };
  }, [mode, playerSide, pvePlayerId, redPlayerId, bluePlayerId]);

  const startGame = () => {
    setNotice(null);
    setRound((n) => n + 1);
    setScreen('game');
  };

  // AI 那一步要不到就中止对局：回首页，把原因摆出来，不在棋盘上兜底
  const abortGame = useCallback((reason: string) => {
    setNotice(reason);
    setScreen('home');
  }, []);

  return (
    <div className="app-shell">
      {screen === 'home' ? (
        <HomeScreen
          mode={mode}
          playerSide={playerSide}
          pvePlayerId={pvePlayerId}
          redPlayerId={redPlayerId}
          bluePlayerId={bluePlayerId}
          players={players}
          loading={loading}
          error={error}
          notice={notice}
          onModeChange={setMode}
          onSideChange={setPlayerSide}
          onPvePlayerChange={setPvePlayerId}
          onRedPlayerChange={setRedPlayerId}
          onBluePlayerChange={setBluePlayerId}
          onStart={startGame}
        />
      ) : (
        <GameRoute
          key={round}
          setup={setup}
          players={players}
          onBack={() => setScreen('home')}
          onAbort={abortGame}
        />
      )}
    </div>
  );
}
