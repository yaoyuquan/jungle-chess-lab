# CLAUDE.md

AI 对弈平台的**前端**。目前只有斗兽棋（Jungle Chess），后续会跟着后端加围棋与国际象棋。
AI 服务（Java 25 + Spring Boot 4）在另一个仓库 `chess-lab-server`，本地通常在 `../chess-lab-server`。

## 常用命令

```bash
npm test                          # 24 个规则单测（vitest），纯函数，不需要后端
npm run test:watch
npm run dev                       # 5173，/api 代理到 localhost:8080
npm run build                     # tsc -b + vite build
npx tsc --noEmit                  # 只做类型检查
```

需要 **Node 20+**。

## 这个前端是什么

**规则引擎完整地长在这里**，后端只是个无状态的「选着法」服务。

每个 AI 回合，前端用 `genMoves()` 算出全部合法着法，编号后连同棋盘一起发给后端，
后端把这些着法塞进提示词让模型返回一个编号。所以：

- **规则只有一份实现，在 `src/game/`。** 走法生成、吃子判定、胜负判定都不要指望后端。
  后端 `FallbackPicker` 里那套子力价值只服务于它的兜底启发式，不是规则。
- **对局永远走得下去**，三层兜底，任何一层都不该被"顺手"去掉：

| 情形 | 兜在哪 |
|---|---|
| 模型返回越界编号 / 调用失败 / 没配密钥 | 后端启发式，响应 `fallback: true` |
| 后端整个不可用 | `useGame` 的 `.catch()` 就地随机落子 |
| 棋手清单拉不到 | `useModels.FALLBACK_PLAYERS` 内置清单 |

另外 `commit(legal[res.index] ?? legal[0], …)` 那个 `?? legal[0]` 也是兜底的一环：
后端承诺 `index` 必定合法，但前端不拿这个承诺赌一次崩溃。

## 代码地图

```
src/
├── game/          规则引擎，纯函数，不碰 React 也不碰网络
│   ├── types.ts       Side / Rank / Piece / Pos / Board / Move
│   ├── terrain.ts     isWater / isDen / trapOf / denOf / inBoard
│   ├── constants.ts   ROWS / COLS / NAMES 兽名 / VAL 子力价值 / opposite
│   ├── coord.ts       toCoord：棋盘坐标 → 棋谱坐标（(0,3) → D9）
│   ├── rules.ts       initBoard / canCapture / genMoves / apply / winnerOf / resolveWinner
│   │                  / describeMove
│   └── rules.test.ts  24 个用例
├── api/
│   ├── types.ts       请求 / 响应 DTO，与 chess-lab-server/doc/api.md 一一对应
│   └── client.ts      唯一接触后端的文件
├── hooks/
│   ├── useGame.ts     对局状态机：落子、悔棋、AI 回合调度、在途请求取消
│   └── useModels.ts   棋手清单 + 降级
└── components/    HomeScreen（选模式/阵营/棋手）、GameScreen、Board、SidePanel、MoveLog
                   每个组件配一个同名 .module.css
```

读一遍 `game/rules.ts` 和 `hooks/useGame.ts` 就掌握了全部业务逻辑，别的都是壳。

## 接口约定

完整文档在 `../chess-lab-server/doc/api.md`，改接口前先读那份。

| 方法 | 路径 | 前端调用处 |
|---|---|---|
| GET | `/api/ai/models` | `listPlayers()` |
| POST | `/api/jungle/ai/move` | `requestAiMove()` |

**路径里带棋种**：着法决策挂 `/api/<棋种>/ai/`，斗兽棋是 `/api/jungle/ai/`；
棋手清单与棋种无关，留在 `/api/ai/models`。加围棋、国际象棋时照这个约定分叉，
别把棋种塞进请求体当参数。

几条容易踩的：

- **`legalMoves[].text` 一定要带。** 它原样进提示词（`豹 C7→D7 吃狼`），
  缺了模型只能看到纯坐标，棋力肉眼可见地掉。由 `describeMove()` 生成。
- **不要给 AI 请求加超时。** 后端调模型不设超时也不重试，推理型模型一手 170–220s 是常态。
  只在开新局 / 悔棋 / 卸载时主动 abort（`useGame.cancelPending`），靠 `runIdRef` 丢弃在途响应。
- **响应的 `index` 是着法的 `i` 值，不是数组下标。** 现在前端按 0 起连续编号，两者恰好一致，
  真要改成不连续编号，`commit(legal[res.index])` 这行得跟着改成按 `i` 查找。
- 后端地址只出现在 `vite.config.ts` 的 proxy 里，**代码里不许写死域名或端口**。

## 改动时要守的几条

- **规则改动必须配单测。** `rules.test.ts` 覆盖入水/跳河/鼠克象/陷阱/兽巢/胜负，
  改 `canCapture` 或 `genMoves` 时先想清楚动的是哪一条，再补用例。
- **`canCapture` 里的判断顺序不能调换**：水陆隔离 → 陷阱 → 鼠克象 → 比兽力。
  换了顺序会让「陷阱里的象被鼠吃」这类边角情形悄悄出错，注释里写了原因。
- **棋盘朝向只是渲染层的事。** 玩家执红时整块棋盘翻转，但坐标 `(r, c)` 与棋谱记法都不变，
  点击回调、着法高亮、对局记录都不做换算。别把翻转下沉到 `game/` 里。
- **`useGame` 的 `key` 重置法**：`App` 用自增的 `round` 当 `GameRoute` 的 key，
  开新局靠整个 hook 重建，而不是手动把状态一项项清空。加新状态时不用管重置。
- 历史栈上限 `HISTORY_LIMIT = 60`，悔棋一次回退到**上一次轮到玩家**的局面（跳过 AI 那手）。

## 代码规约

- React 19 + TypeScript 5.7 + Vite 6，函数组件 + hooks，不引状态管理库。
- 样式一律 CSS Module（`X.module.css`），全局变量在 `src/styles/global.css`。不用 CSS-in-JS。
- `game/` 下全是纯函数，不 import React、不发请求；`Board` 等类型带 `readonly`，
  改棋盘一律返回新对象（`apply()` 就是这么做的）。
- 类型放 `types.ts`，`import type` 导入。
- **注释必须独占一行**，不允许和代码同行。
- 注释、界面文案、日志一律中文。注释多写"为什么这么定"，别复述代码在做什么。
- 单测用 vitest，每个 `it` 配一句中文描述；测试不打网络。
