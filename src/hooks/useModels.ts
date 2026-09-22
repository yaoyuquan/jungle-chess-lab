import { useEffect, useState } from 'react';
import { listPlayers } from '../api/client';
import type { AiPlayer } from '../api/types';

export const MODELS_API = '/api/ai/models';

/**
 * 接口不可用时的内置棋手清单。
 * 保留这一份是为了后端没起来时前端仍然完整可玩（此时 AI 由后端兜底，玩家至少能看到界面）。
 */
export const FALLBACK_PLAYERS: AiPlayer[] = [
  { id: 'qingyun', name: '青云', code: 'QINGYUN' },
  { id: 'xuanji', name: '玄机', code: 'XUANJI' },
];

export interface ModelsState {
  players: AiPlayer[];
  loading: boolean;
  error: string | null;
}

/** 拉取棋手清单，失败时静默回落到内置清单 */
export function useModels(): ModelsState {
  const [state, setState] = useState<ModelsState>({ players: [], loading: true, error: null });

  useEffect(() => {
    const controller = new AbortController();
    listPlayers(controller.signal)
      .then((players) => {
        if (controller.signal.aborted) return;
        if (!players.length) throw new Error('empty');
        setState({ players, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        const message = e instanceof Error ? e.message : String(e);
        setState({ players: FALLBACK_PLAYERS, loading: false, error: message });
      });
    return () => controller.abort();
  }, []);

  return state;
}

