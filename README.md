# GAME.ai

GAME.ai 旨在把游戏社区的集体智慧转化为可持续的 AI 服务：玩家上传攻略即可获得 $GAME 激励，订阅用户依托 Dify 与链上知识库获取实时策略，代币持有者共享平台收入。项目基于 Virtuals Protocol 构建，围绕“内容贡献 → AI 服务 → 收益分配”的闭环运营。

## 仓库结构

```
GAME.ai/
├── contract/   智能合约工程（Hardhat + TypeScript）
├── server/     后端 API（Next.js App Router + MongoDB + Dify 集成）
└── web/        前端应用（Next.js 14 + Wagmi + RainbowKit）
```

### contract/
- 合约：`GameInferencePayment.sol`（订阅支付）、`GameDividendPool.sol`（分红池）。
- 测试：`test/` 使用 Hardhat + Mocha。
- 部署脚本：`scripts/`。
- 常用命令：
  ```bash
  cd contract
  npm install
  npm run compile
  npm test
  npm run deploy:sepolia
  ```

### server/
- API 路由：
  - `/api/subscription/*` 订阅激活与状态查询
  - `/api/inference/chat` 调用 Dify 聊天接口
  - `/api/content/*` 创作者上传、列表、统计
  - `/api/dividend/*` 分红查询与记录
- 工具模块位于 `lib/`，封装 MongoDB 连接、区块链交互、Dify SDK。
- 启动：
  ```bash
  cd server
  npm install
  npm run dev
  npm run build && npm start
  ```
  `.env` 需配置 Base RPC、私钥、合约地址、Dify/Notion/MongoDB 等凭据。

### web/
- 页面：
  - `/` 指标仪表盘（价格、市值、里程碑、操作入口）
  - `/ai` 游戏咨询聊天（Markdown 回复、打字机效果）
  - `/creator` 创作者投稿弹窗（链上奖励展示）
  - `/me` 个人中心（订阅续费、分红 Claim）
- 运行：
  ```bash
  cd web
  npm install
  npm run dev
  ```
- `.env.local` 示例：
  ```env
  NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
  NEXT_PUBLIC_INFERENCE_PAYMENT_ADDRESS=<GameInferencePayment 地址>
  NEXT_PUBLIC_DIVIDEND_POOL_ADDRESS=<GameDividendPool 地址>
  NEXT_PUBLIC_VIRTUAL_TOKEN_ADDRESS=<VIRTUAL 代币地址>
  ```

## Virtuals Protocol 背景

### 项目概述
GAME.ai 基于 Virtuals Protocol，面向游戏玩家提供 AI 游戏咨询、攻略聚合与收益分配服务。玩家贡献内容可获 $GAME 激励，订阅用户支付 $VIRTUAL 获取咨询服务，平台收益按比例返还代币持有者。

### 核心创新点
1. **UGC 驱动的 AI 知识库**：玩家上传攻略、经验、策略，内容经审核后同步到 Notion 与 Dify。
2. **订阅制 AI 咨询服务**：10 $VIRTUAL/月的包月模式，任何订阅者都可调用专属游戏咨询代理。
3. **代币激励体系**：内容贡献奖励 + $GAME 持有者 70% 收益分红，形成内容与价值循环。

## 运作模式

### 阶段一：代理创建与启动
1. 锁定 100 $VIRTUAL 创建 GAME AI 代理。
2. 发行 10 亿 FERC20 $GAME 代币。
3. 建立 $VIRTUAL ↔ $GAME 联合曲线，提供初始流动性。
4. 预留 10% $GAME 构建内容奖励池。

### 阶段二：内容贡献与积累（FERC20 阶段）
- 玩家上传攻略 → 平台审核 → 自动同步至 Notion → Dify 知识库实时更新。
- 奖励依据内容质量、采用率发放，奖励池持续补充。
- 联合曲线内允许购买/出售 $GAME，目标市值 4,200 → 420,000 美元。

### 阶段三：订阅服务与分红（激活阶段）
- 玩家订阅 AI 游戏咨询（10 $VIRTUAL/月），后台验证交易并激活服务。
- 扣除成本后：30% 收益回馈创作者，70% 汇入分红池，持有者可随时 Claim。
- 市值门槛：$4.2K 激活代理，$420K 触发“红丸”升级。

### 阶段四：生态成熟（ERC20 阶段）
- 升级至 ERC20，部署 Uniswap V2 流动性池并锁定 10 年。
- 扩展多游戏支持、内容评分、跨链桥接、社区治理等能力。

## 代币经济模型

### $GAME 代币设计
- **总供应量**：10 亿，FERC20 标准。
- **发行机制**：联合曲线，市值达 $420K 后升级为 ERC20。

#### 获取方式
1. 通过联合曲线使用 $VIRTUAL 购买。
2. 上传攻略/经验获得奖励。
3. 推荐、排行榜、早期贡献等激励活动。

#### 使用场景
- 持有分红：享受 AI 咨询收入 70% 分配。
- 治理权：决定功能路线与上架游戏。
- 质押增益、高级功能、未来跨链等扩展。

### 经济闭环示意
```
玩家上传攻略 → Notion & Dify 更新 → AI 质量提升 → 订阅增长
      ↓                                  ↑
   创作者获 $GAME 奖励 ← 订阅收入分配（70% 分红 / 30% 创作者）
```

### 市值增长策略
- 冲刺 $4.2K：早期创作者加成、双倍奖励、推荐激励、免费试用。
- 冲刺 $420K：KOL 合作、内容竞赛、知识库扩张、红丸倒计时、社区投票。

## 技术架构
1. **内容层**：上传接口 + 人工审核（MVP）。
2. **AI 层**：Dify LLM + Notion 知识库同步。
3. **后端层（server/）**：订阅管理、AI 调度、内容上传、分红 API。
4. **区块链层**：Base Sepolia，包含 $GAME 代币、订阅支付、分红池，集成 Virtuals Protocol (IAO/ACP)。
5. **数据库层**：MongoDB Atlas、Notion。
6. **前端层（web/）**：Next.js + Wagmi + Tailwind。

## 功能总览
- **UGC 激励**：创作者上传内容，Server 校验后调用合约发放奖励。
- **AI 订阅**：前端调用 `GameInferencePayment` 支付 10 $VIRTUAL；Server 验证交易并记录订阅。
- **分红 Claim**：前端连接 `GameDividendPool` 获取与领取分红，Server 提供查询及记录。
- **指标面板**：展示价格、市值、持有者、交易量与里程碑进度。

## 开发指南
1. 在 Base Sepolia 部署合约并记录地址（`contract/`）。
2. 填写 `server/.env`：Base RPC、私钥、合约地址、Dify、Notion、MongoDB。
3. 填写 `web/.env.local`：后端地址、合约地址、$VIRTUAL 合约地址。
4. 依次启动 `server` 与 `web`，验证基础流程（订阅、上传、分红）。
5. 按 `MVP_PLAN_V3.md` 迭代扩展功能（如内容评分、更多游戏支持、治理面板）。

## 参考文档
- [Virtuals Protocol Whitepaper](https://whitepaper.virtuals.io/)
- `contract/README.md`、`server/README_BACKEND.md`、`MVP_PLAN_V3.md`

欢迎 Issue / PR 共同完善 GAME.ai。EOF
