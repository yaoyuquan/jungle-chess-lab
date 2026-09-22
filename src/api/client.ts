import type { AiMoveRequest, AiMoveResponse, AiPlayer } from './types';

const BASE = '/api';

/**
 * 着法决策的路径带棋种，斗兽棋是 /api/jungle/ai/；
 * 棋手清单与棋种无关，留在 /api/ai/models。
 */
const JUNGLE = '/jungle';

/** 统一的 JSON 请求。非 2xx 时尽量带上后端给的 message */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) detail = body.message;
    } catch {
      // 响应体不是 JSON，保留原始状态码
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

/** 拉取棋手清单 */
export function listPlayers(signal?: AbortSignal): Promise<AiPlayer[]> {
  return request<AiPlayer[]>('/ai/models', { signal });
}

/** 请求 AI 在候选着法中选一条 */
export function requestAiMove(payload: AiMoveRequest, signal?: AbortSignal): Promise<AiMoveResponse> {
  return request<AiMoveResponse>(`${JUNGLE}/ai/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
}
