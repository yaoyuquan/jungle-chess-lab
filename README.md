# 斗獸棋 Jungle Chess Lab

斗兽棋（Jungle Chess）对弈平台的**前端**，支持**人机对战**与 **AI 观战**两种模式。
UI 来自 claude.ai/design 的设计稿 `斗兽棋.dc.html`，视觉与交互 1:1 还原。

AI 服务在另一个仓库：**[chess-lab-server](https://github.com/yaoyuquan/chess-lab-server)**
（Java 25 + Spring Boot 4）。模型密钥、棋手人设、提示词都在那边配，不经过前端。

## 架构

规则与 AI 分居两端：

| 层 | 职责 |
|---|---|
| **前端**（本仓库）React + TypeScript | 完整规则引擎、对局状态、悔棋历史、胜负判定，以及全部交互 |
| **后端** chess-lab-server | **无状态 AI 服务**：调用模型在前端给出的候选着法里选一条 |

每一手 AI 回合，前端把当前棋盘和自己算好的**合法着法编号列表**发给后端，
后端把它们塞进提示词让模型返回一个编号。后端不生成着法、不判胜负，因此规则永远只有一份实现，
就在 `src/game/`。

**前端不兜底**。棋盘上的每一手都得是模型真正下的，要不到就把话说清楚，而不是拿别的东西顶上：

| 情形 | 前端怎么做 |
|---|---|
| 棋手清单拉不到（后端没起、断网、清单为空） | 首页横幅写明原因，下拉框置灰，「开始对局」不可点 |
| 对局中后端不可用（请求失败、非 2xx） | 中止对局 → 回首页，提示「AI 服务不可用（原因），对局中止」 |
| 响应带 `fallback: true`（模型没配密钥 / 调用失败，后端改用启发式） | 中止对局 → 回首页，提示「模型未能给出着法」 |
| 响应的 `index` 越界 | 中止对局 → 回首页，提示编号越界 |

后端启发式给出的仍是合法着法，但那不是模型的棋，前端不拿它充数。
**所以后端必须起着**，否则只能停在首页。

## 快速开始

需要 **Node 20+**。

```bash
npm install
npm run dev        # 默认 5173，已配好 /api → localhost:8080 代理
```

打开 http://localhost:5173 即可。**后端必须同时起着**——棋手清单和每一手 AI 落子都来自它，
拉不到清单首页就开不了局（见 chess-lab-server 的 README）：

```bash
cd ../chess-lab-server
ANTHROPIC_API_KEY=sk-ant-... mvn spring-boot:run     # 默认 8080
```

后端地址写在 `vite.config.ts` 的 proxy 里，换端口改那一处。
生产部署时 `/api` 由反向代理转到后端，前端代码里不出现后端域名。

## 依赖的接口

完整文档见 `chess-lab-server/doc/api.md`。前端只用到两个端点（`src/api/client.ts`）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/ai/models` | 棋手清单，给首页下拉框用 |
| POST | `/api/jungle/ai/move` | 在候选着法里选一条 |

**路径里带棋种**：着法决策挂在 `/api/<棋种>/ai/` 下，斗兽棋是 `/api/jungle/ai/`；
棋手清单与棋种无关，留在 `/api/ai/models`。后端以后要加围棋、国际象棋，路径按这个约定分叉。

```jsonc
// POST /api/jungle/ai/move
{
  "playerId": "xuanji",
  "side": "r",
  "board": [[{"rank":7,"side":"r"}, null, "…"], "…"],   // 9 行 × 7 列，空格为 null
  "moveNumber": 12,
  "legalMoves": [{ "i": 0, "from": [2,0], "to": [3,0], "text": "鼠 A7→A6 入水" }]
}
// → { "index": 0, "reason": "先让鼠下水封住对方通路。", "fallback": false }
// fallback 为 true 表示模型没决策成功、后端用启发式顶的，前端视同失败并中止对局
```

三个要点：

- **`legalMoves[].text` 必须带上**。它原样进提示词，缺了模型只能看到纯坐标，棋力明显变差。
  前端由 `describeMove()` 生成，形如 `豹 C7→D7 吃狼`。
- **`fallback: true` 不算成功**。那是后端启发式选的棋，不是模型的判断，
  前端收到就中止对局回首页，不会把它记进棋谱。
- **一手棋可能要等 3 分钟**。后端调模型不设超时也不重试：带长思考的推理模型实测 170–220s，
  不带思考的约 12s。前端用 `fetch` + `AbortController`，**不设超时**，只在开新局 / 悔棋 /
  卸载时主动 abort（`useGame.cancelPending`）。别给它加 timeout，砍断只会白等一场。

## 棋盘坐标

`board[行][列]`，9 行 × 7 列。行 0 是红方底线（红巢 `(0,3)`），行 8 是蓝方底线（蓝巢 `(8,3)`），
**蓝方先行**。棋谱坐标列用 A~G、行自下而上记 1~9，故 `(0,3)` 记作 `D9`。
棋谱记法只出现在界面和 `text` 字段里，接口传参一律用 `[行, 列]`。

兽力等级 `rank`：1 鼠、2 猫、3 狼、4 狗、5 豹、6 虎、7 狮、8 象。阵营 `side`：`r` 红、`b` 蓝。

## 棋盘朝向

默认第 0 行（红方底线）画在最上方，蓝方在下。**玩家执红时棋盘整体翻转**，让自己的阵营在下方，
双方面板也跟着换序。观战模式没有「自己」，保持默认朝向。

翻转只改变行的渲染顺序，棋盘坐标 `(r, c)` 与棋谱记法都不变，
所以点击回调、着法高亮、对局记录都无需换算——`豹 C7 → D7` 在两种朝向下记法完全一致。

## 测试

```bash
npm test        # 24 个规则用例：入水/跳河/鼠克象/陷阱/兽巢/胜负判定
npm run build   # tsc -b + vite build
```

规则引擎是纯函数，单测全落在 `src/game/rules.test.ts`，不需要后端。

## 目录

```
src/
├── game/       规则引擎：terrain（水/巢/陷阱）、rules（走法生成与胜负）、coord、constants
│               + rules.test.ts
├── api/        接口类型与客户端（唯一接触后端的地方）
├── hooks/      useGame（对局状态机）、useModels（棋手清单与降级）
└── components/ HomeScreen / GameScreen / Board / SidePanel / MoveLog
```
