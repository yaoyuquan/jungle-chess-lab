import { useEffect, useState } from 'react';
import { listPlayers } from '../api/client';
import type { AiPlayer } from '../api/types';

export const MODELS_API = '/api/ai/models';

export interface ModelsState {
  players: AiPlayer[];
  loading: boolean;
  error: string | null;
}

/**
 * 拉取棋手清单。
 * 拉不到就是拉不到：不提供内置清单，让首页把错误摆出来并挡住「开始」，
 * 免得玩家开了一局才发现对面根本没人。
 */
export function useModels(): ModelsState {
  const [state, setState] = useState<ModelsState>({ players: [], loading: true, error: null });

  useEffect(() => {
    const controller = new AbortController();
    listPlayers(controller.signal)
      .then((players) => {
        if (controller.signal.aborted) return;
        if (!players.length) throw new Error('清单为空');
        setState({ players, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        const message = e instanceof Error ? e.message : String(e);
        setState({ players: [], loading: false, error: message });
      });
    return () => controller.abort();
  }, []);

  return state;
}
