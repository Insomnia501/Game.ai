# GAME.ai - MVP 开发方案 V3.0
**游戏AI代理 - 第一阶段核心功能实现**

---

## 📋 变更说明（相比 V2.0）

### 第一阶段目标（MVP）
**第一阶段**专注于构建基础的游戏AI代理系统，建立内容贡献和代币激励框架：

1. **AI 游戏咨询服务**：参考 ChatGPT 对话界面，提供游戏攻略和策略建议
2. **内容上传系统**（基础版）：
   - ✅ 用户上传游戏攻略/经验获得 $GAME 代币奖励
   - ✅ 内容自动同步到 Notion 知识库
   - ✅ 奖励池管理和分配
3. **代币经济系统**：
   - ✅ 代币购买与交易（Bonding Curve）
   - ✅ 内容贡献激励分配
   - ✅ 实时分红计算和 Claim
   - ✅ 从链上读取数据为主，MongoDB 存储非关键数据

### 不在 MVP 范围内
- ❌ 复杂的内容评分系统
- ❌ 跨链桥接
- ❌ NFT 铸造
- ❌ 公开统计页面

---

## 🔍 Virtuals Protocol 核心机制解析

### 1. IAO 标准流程

#### 创建阶段
```
创建者操作：
├─ 支付 100 $VIRTUAL
├─ 填写代理信息（名称、Ticker、描述、头像）
└─ 触发链上创建

链上自动执行：
├─ Mint Agent NFT
├─ 创建 1,000,000,000 FERC20 代币
├─ 创建 Bonding Curve（与 $VIRTUAL 配对）
└─ 创建不可变的 Contribution Vault
```

#### 市值门槛
- **$4,200 ($4.2K)**: 代理在 Virtuals Forum 激活
- **$420,000 ($420K)**: "红丸升级" - 转换为 ERC20 + 创建 Uniswap V2 池
- **流动性锁定**: 10 年

#### 交易费用（1% Trading Fee）
**Post-Graduation（ERC20 阶段）**:
- 30% → 创作者
- 20% → Agent Affiliates（推广者）
- 50% → Agent SubDAO（持有者分红池）

### 2. SubDAO 收益分配机制

#### 收益来源
1. **Trading Fee**（交易费的 50%）
2. **Inference Fee**（AI 推理服务费用）- 这是我们的核心收益
3. **Protocol Emissions**（协议奖励）

#### 分配逻辑
```
用户支付 $VIRTUAL 使用 AI 服务
    ↓
扣除 Dify API 成本
    ↓
剩余利润（净收益）
    ↓
├─ 30% → 创作者钱包（直接转账）
└─ 70% → SubDAO 分红池
       ↓
    累积到池中，等待持有者 Claim
```

### 3. 实时增长的 Claim 分红机制

#### 核心设计
```solidity
contract GameDividendPool {
    // 全局状态
    uint256 public totalDividendPool;           // 累积的总分红池
    uint256 public totalDividendPerShare;       // 每个代币累积的分红（精度放大）
    mapping(address => uint256) public lastClaimedPerShare; // 用户上次提取时的 perShare

    IERC20 public gameToken;           // $GAME Token
    IERC20 public virtualToken;        // $VIRTUAL Token

    // AI 咨询收入流入时调用（70% 部分）
    function depositDividend(uint256 amount) external {
        virtualToken.transferFrom(msg.sender, address(this), amount);

        // 更新全局每股分红
        uint256 totalSupply = gameToken.totalSupply();
        totalDividendPerShare += (amount * 1e18) / totalSupply;
        totalDividendPool += amount;

        emit DividendDeposited(amount, totalDividendPerShare);
    }

    // 持有者主动提取分红
    function claimDividend() external {
        uint256 userBalance = gameToken.balanceOf(msg.sender);
        require(userBalance > 0, "No $GAME tokens held");

        // 计算用户应得分红
        uint256 newDividendPerShare = totalDividendPerShare - lastClaimedPerShare[msg.sender];
        uint256 claimable = (userBalance * newDividendPerShare) / 1e18;

        require(claimable > 0, "No dividends to claim");

        // 更新用户状态
        lastClaimedPerShare[msg.sender] = totalDividendPerShare;

        // 转账 $VIRTUAL 分红
        virtualToken.transfer(msg.sender, claimable);

        emit DividendClaimed(msg.sender, claimable);
    }

    // 查询用户可提取分红
    function getPendingDividend(address user) external view returns (uint256) {
        uint256 userBalance = gameToken.balanceOf(user);
        uint256 newDividendPerShare = totalDividendPerShare - lastClaimedPerShare[user];
        return (userBalance * newDividendPerShare) / 1e18;
    }
}
```

#### 机制优势
✅ **Gas 成本极低**: 只有用户 Claim 时才消耗 Gas
✅ **实时更新**: 每次 AI 咨询收入立即更新 `totalDividendPerShare`
✅ **精确计算**: 基于用户持有量计算应得分红
✅ **可扩展**: 支持无限数量的持有者

---

## 🎯 MVP 核心模块设计（简化版）

### 模块一：智能合约系统

#### 1.1 需要开发的合约

**GameInferencePayment 合约**
- 用户支付 $VIRTUAL 使用 AI 游戏咨询服务
- 扣除 API 成本后：30% 给内容创作者，70% 给分红池
- 支持动态调整服务费用（初始 10 $VIRTUAL/月 或 0.1 $VIRTUAL/次查询）

**GameDividendPool 合约**
- 管理分红池累积（来自 AI 咨询收入的 70%）
- 提供 Claim 功能供 $GAME 持有者提取分红
- 实时计算每个用户的可提取分红

**ContentRewardPool 合约**
- 管理内容贡献者的奖励分配
- 根据内容质量和采用率分配 $GAME 代币
- 与 Notion 知识库集成（后端触发奖励分配）

---

### 模块二：AI 游戏咨询服务

#### 2.0 订阅与付费模式

**核心设计**（MVP 阶段）：
- **包月订阅**：用户支付 10 $VIRTUAL，获得整月无限制的 AI 游戏咨询权限
- **按次付费**（可选）：用户支付 0.1 $VIRTUAL 单次查询游戏攻略
- 后端维护：订阅状态（active/inactive）+ 到期时间
- 支付后，用户在订阅期内可无需签名地无限使用 AI 咨询

**AI 知识库内容**：
- 用户上传的游戏攻略/经验（存储在 Notion）
- 通用游戏 LLM 知识库（通过 Dify 集成）
- 支持多种游戏查询（单机、MOBA、MMO、独立游戏等）

**订阅流程**：
```
玩家用户点击"开通游戏咨询订阅"
  ↓
支付 10 $VIRTUAL（链上交易）
  ↓
获得 transactionHash
  ↓
调用 POST /api/subscription/activate
  ↓
后端验证交易 → 激活订阅
  ↓
订阅有效期：30 天（从激活时起）
  ↓
用户可在此期间无限使用 AI 游戏咨询（无需再签名）
  ↓
到期前 7 天：前端提示续期
  ↓
到期：服务停止，需重新支付
```

**内容贡献者流程**：
```
游戏玩家/攻略创作者上传游戏攻略
  ↓
后端检查内容质量和格式
  ↓
通过审核 → 自动上传到 Notion
  ↓
Dify AI 知识库自动同步更新
  ↓
内容被查询使用 → 记录使用次数
  ↓
根据内容质量/采用率 → 分配 $GAME 代币奖励
  ↓
奖励直接转到创作者钱包
```

#### 2.1 后端 API 设计（Next.js API Routes）

**API 1: 获取用户订阅状态**
```typescript
GET /api/subscription/status?address=0x123

Response:
{
  "isActive": true,
  "expiresAt": 1729876000,        // Unix timestamp
  "daysRemaining": 15,
  "transactionHash": "0x123",
  "startedAt": 1729271200
}

逻辑：
1. 查询数据库中用户的订阅记录
2. 检查 expiresAt 是否大于当前时间
3. 返回订阅状态
```

**API 2: 激活/续期订阅**
```typescript
POST /api/subscription/activate

Request Body:
{
  "userAddress": "0x123",
  "transactionHash": "0x123",     // 支付交易哈希
  "amount": "10"                   // 支付金额（验证用）
}

Response:
{
  "success": true,
  "expiresAt": 1729876000,
  "message": "订阅已激活，有效期30天"
}

逻辑：
1. 验证 transactionHash 是否有效（查询链上事件）
2. 验证转账金额是否正确（10 $VIRTUAL）
3. 验证接收地址是否正确（合约地址）
4. 更新数据库：
   - 设置 status = "active"
   - 设置 expiresAt = 当前时间 + 30 天
   - 记录 transactionHash 和 startedAt
5. 返回新的到期时间
```

**API 3: 上传游戏攻略**
```typescript
POST /api/content/upload

Request Body:
{
  "userAddress": "0x123",
  "gameTitle": "Elden Ring",           // 游戏名称
  "title": "Boss 攻略：玛格丽特，无名女王",
  "content": "完整的攻略文本...",
  "tags": ["boss", "strategy"],
  "description": "详细的Boss打法指南"
}

Response:
{
  "success": true,
  "contentId": "uuid",
  "status": "pending_review",
  "message": "内容已提交审核，预计 24 小时内完成"
}

核心逻辑：
1. 验证用户钱包地址有效
2. 检查内容长度和格式
3. 内容进入审核队列
4. 通过审核后自动上传到 Notion
5. 用户获得奖励（稍后发放）
```

**API 4: AI 游戏咨询（自动检查订阅）**
```typescript
POST /api/inference/chat

Request Body:
{
  "userAddress": "0x123",
  "question": "Elden Ring 中如何打败玛格丽特",
  "conversationId": "uuid"  // 可选，用于多轮对话
}

Response:
{
  "answer": "玛格丽特是个标志性BOSS...",
  "conversationId": "uuid",
  "subscriptionStatus": {
    "isActive": true,
    "daysRemaining": 15
  }
}

核心逻辑：
1. 检查用户的订阅状态
2. 若 status != "active" 或 expiresAt < 当前时间
   → 返回错误 "Subscription expired"
3. 若订阅有效
   → 直接调用 Dify API（无需其他验证）
   → 返回 AI 游戏建议和攻略
4. 后端记录查询，触发 AI 收入分配流程
5. 对话记录由 Dify API 自动保存和管理
```

#### 2.2 前端缓存策略

使用 React Query + LocalStorage：
```typescript
// 查询用户订阅状态（每 5 分钟刷新）
const { data: subscriptionStatus } = useQuery({
  queryKey: ['subscription-status', userAddress],
  queryFn: () => fetch(`/api/subscription/status?address=${userAddress}`).then(r => r.json()),
  staleTime: 1000 * 60 * 5,           // 5 分钟过期
  cacheTime: 1000 * 60 * 10,          // 10 分钟缓存
  refetchInterval: 1000 * 60 * 5,     // 每 5 分钟主动刷新
});

// 缓存对话历史（本地 7 天过期）
const { data: history } = useQuery({
  queryKey: ['inference-history', userAddress],
  queryFn: () => fetchChatHistory(userAddress),
  staleTime: 1000 * 60 * 60 * 24,
  cacheTime: 1000 * 60 * 60 * 24 * 7,
});

// 实时查询可提取分红
const { data: pendingDividend } = useQuery({
  queryKey: ['pending-dividend', userAddress],
  queryFn: () => dividendContract.getPendingDividend(userAddress),
  refetchInterval: 10000, // 每10秒刷新
});
```

#### 2.3 数据库设计

**MongoDB 集合：subscriptions**
```typescript
{
  _id: ObjectId,
  userAddress: "0x123",           // 用户钱包地址（唯一索引）
  status: "active" | "inactive",  // 订阅状态
  expiresAt: 1729876000,          // Unix timestamp，订阅到期时间
  startedAt: 1729271200,          // Unix timestamp，当前订阅开始时间
  transactionHash: "0x123",       // 支付交易哈希（用于验证）
  renewedAt: 1729271200,          // Unix timestamp，最后续期时间
  createdAt: 1729271200,          // 记录创建时间
  updatedAt: 1729271200           // 记录更新时间
}

索引：
- 主键索引：userAddress（唯一）
- 普通索引：expiresAt（用于查询过期订阅）
- 普通索引：status
```

**MongoDB 集合：gameContent**
```typescript
{
  _id: ObjectId,
  contentId: "uuid",
  userAddress: "0x123",                    // 创作者地址
  gameTitle: "Elden Ring",                 // 游戏名称
  title: "Boss 攻略：玛格丽特，无名女王",
  content: "完整的攻略文本...",
  tags: ["boss", "strategy"],
  status: "pending_review" | "approved" | "rejected",
  notionPageId: "...",                     // Notion 页面 ID
  queryCount: 0,                           // 被查询的次数
  rewardAmount: "0",                       // 获得的 $GAME 代币
  rewardStatus: "pending" | "claimed" | "distributed",
  createdAt: 1729271200,
  updatedAt: 1729271200
}

索引：
- 主键索引：contentId（唯一）
- 普通索引：userAddress
- 普通索引：status
- 普通索引：gameTitle
```

**说明**：
- 对话记录由 Dify API 保存，无需本地数据库存储
- 内容审核后的版本存储在 Notion，MongoDB 只保存元数据
- 查询计数和奖励分配在后端定期批量更新

---

### 模块三：Web 应用界面（新版设计）

#### 3.1 工程与技术栈
- **工程位置**: `game/web`（Vercel 部署用独立前端仓）
- **框架**: Next.js 14（App Router）
- **样式系统**: Tailwind CSS + shadcn/ui（统一主题与组件库）
- **Web3 适配**: Wagmi v2 + Viem，Metamask 连接首选；后续可扩展 WalletConnect
- **状态管理**: React Query（数据拉取）+ Zustand（全局 UI 状态）
- **图表与可视化**: Recharts（里程碑进度、指标卡）
- **部署目标**: Vercel（Preview/Production 双环境）

#### 3.2 全局布局与导航
- 顶部 **AppBar**：左侧放置 LOGO 与 “GAME.ai”，中部导航项 `AI 咨询`、`创作者贡献`，右侧是 `Connect Wallet` 按钮。
- **钱包连接组件**：默认显示 “连接钱包”，使用 Metamask 注入 provider；连接后展示地址缩写与头像组件（展示 ENS 图标或 Jazzicon），点击进入个人中心。
- **主题要求**：深浅主题切换、移动端汉堡菜单、自适应到 768px 以下。

#### 3.3 页面蓝图

**界面 1：主页仪表盘**  
`路径: /`
```
核心模块：
├─ HeroSection：展示 GAME.ai LOGO、标语、副标题
├─ MetricCards：当前价格、市值、持有者指标（Holding Count）、总交易量
├─ MilestoneProgress：里程碑进度条（激活 $4.2K、红丸 $420K）
├─ CTAButtons：包含 "购买 $VIRTUAL"（外链跳转 Virtuals 官网，_blank）与 "了解订阅"
├─ MarketHighlights：最近 24h 变化或交易摘要（可置灰等待数据）
```
数据来源：
- 价格、市值、交易量：通过后端代理读取 Virtuals Bonding Curve & Subgraph。
- 持有者指标：链上 `totalSupply` 与持币地址列表。

**界面 2：AI 咨询对话**  
`路径: /ai`
```
布局参考 ChatGPT：
├─ ConversationList：左侧栏展示最近 20 条对话（本地缓存 + Mongo 历史）
├─ ChatWindow：中间区域滚动的对话气泡（用户右对齐、AI 左对齐）
├─ Composer：底部输入框 + 发送按钮，支持 Enter 发送、Shift+Enter 换行
└─ 订阅引导条：当接口返回 403（订阅失效）时，在对话区顶部显示提醒条，引导去个人中心续费
```
注意：页面本身不显示订阅状态，仅在请求被拒绝时提示；聊天请求直接调用 `POST /api/inference/chat`。

**界面 3：创作者贡献弹窗**  
`路径: /creator`
```
触发方式：
1. 用户点击导航栏“创作者贡献”
2. 页面加载后立即打开 ContributionModal（可复用在其他页面）

ContributionModal 内容：
├─ 文本域（必填，最多 50,000 字符）
├─ 游戏标题输入框（必填）
├─ 标签多选（可选）
├─ “上传攻略” 按钮
├─ 成功提示页：展示 "上传成功，1 $GAME 奖励已发送" 与交易哈希超链接

交互体验：
- 上传前校验所有必填项
- 调用 `POST /api/content/upload`，成功后关闭弹窗并 toast 提示
- 无需在页面展示 ContentForm、ContentList、EarningPanel 等面板
```

**界面 4：个人中心**  
`路径: /me`
```
核心区块：
├─ SubscriptionCard：当前订阅状态、到期时间、"立即订阅/续费" 按钮（调用链上支付 + /api/subscription/activate）
├─ DividendCard：可提取分红（VIRTUAL）、累计已提取，`Claim` 按钮触发 `POST /api/dividend/withdraw`
├─ WalletInfo：显示已连接地址、链网络状态
├─ 最近操作日志：展示最近一次订阅、分红领取时间（可选）
```

#### 3.4 关键前端流程
1. **钱包连接**：用户点击连接 → Wagmi 调用 Metamask → 成功后全局状态记录地址，导航栏显示头像并允许访问 `/me`。
2. **主页指标拉取**：SSR/ISR 调用后端指标 API 获取价格、市值、持有者数、总交易量；并更新 MilestoneProgress。
3. **AI 对话**：用户在 `/ai` 输入问题 → 调用推理接口 → 成功时渲染回答、缓存到 ConversationList → 若返回订阅错误，引导用户前往 `/me` 续费。
4. **创作者投稿**：从导航进入 `/creator`，填写弹窗表单 → 提交后收到成功提示与奖励信息，弹窗关闭；如链上交易失败，则保留弹窗并提示重试。
5. **个人中心**：进入 `/me` 时并行请求订阅状态 `/api/subscription/status` 与分红信息 `/api/dividend/balance`，按钮分别触发合约交易及后端记录，成功后刷新卡片。

#### 3.5 响应式与可访问性
- 桌面端采用三栏布局（导航/内容/附加信息），移动端切换为单列。
- 所有主要按钮具备 `aria-label` 与键盘可达性；Modal 支持 ESC 关闭与焦点捕获。
- Loading 与错误状态以 Skeleton、Toast 呈现，确保用户知晓链上交易等待。

## 🔧 技术架构图

```
┌─────────────────────────────────────────────────────────┐
│                     用户界面层                            │
│  Next.js 14 + Wagmi + RainbowKit + shadcn/ui           │
│  ├─ 首页仪表盘（代理信息 + 指标卡 + 里程碑进度）         │
│  ├─ AI 咨询页面（ChatGPT 风格对话）                       │
│  ├─ 创作者贡献弹窗（文本投稿 + 奖励提示）                │
│  └─ 个人中心页面（订阅管理 + 分红 Claim）                │
├─────────────────────────────────────────────────────────┤
│                     缓存层                               │
│  React Query + LocalStorage                            │
├─────────────────────────────────────────────────────────┤
│                   后端服务层                             │
│  Next.js API Routes                                     │
│  ├─ /api/inference/chat     (调用 Dify API)           │
│  ├─ /api/content/upload     (处理内容上传)             │
│  ├─ /api/content/review     (内容审核)                 │
│  ├─ /api/subscription/*     (订阅管理)                 │
│  └─ Notion API 集成 (自动上传内容)                    │
├─────────────────────────────────────────────────────────┤
│              知识库管理层                               │
│  ├─ Notion (游戏攻略文档库)                             │
│  └─ Dify AI (LLM 推理引擎)                              │
├─────────────────────────────────────────────────────────┤
│                    智能合约层                            │
│  ┌─────────────────┐  ┌──────────────────┐            │
│  │ Virtuals 标准   │  │  GAME.ai 自定义   │            │
│  ├─────────────────┤  ├──────────────────┤            │
│  │ AgentFactory    │  │ InferencePayment │            │
│  │ Bonding Curve   │  │ DividendPool     │            │
│  │ $GAME Token     │  │ ContentRewardPool│            │
│  │ Uniswap V2      │  └──────────────────┘            │
│  └─────────────────┘                                   │
├─────────────────────────────────────────────────────────┤
│              数据库层                                   │
│  MongoDB Atlas                                         │
│  ├─ subscriptions (订阅记录)                            │
│  ├─ gameContent (内容元数据)                            │
│  └─ inferenceLog (查询日志)                             │
├─────────────────────────────────────────────────────────┤
│                   区块链层                               │
│  Base Network (Ethereum L2)                            │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 MVP 开发路线图（4 周）

### 第 1 周：环境搭建 + 智能合约开发

#### Day 1-2: 项目基础设施
- [x] 创建 Next.js 14 项目（App Router）
- [x] 配置 Hardhat / Foundry（智能合约开发环境）
- [x] 配置 Wagmi + RainbowKit（钱包连接）
- [x] 配置 Tailwind CSS + shadcn/ui
- [x] 获取 Base Sepolia 测试币
- [x] 研究 Virtuals Protocol 的 AgentFactory 合约接口

#### Day 3-4: 智能合约开发
- [x] 开发 VitalsInferencePayment 合约
- [x] 开发 VitalsDividendPool 合约
- [x] 编写单元测试（Hardhat Test）
- [x] 本地测试网测试（Hardhat Node）

#### Day 5-7: 部署到 Base Sepolia + 创建 Agent
- [x] 在 Virtuals Protocol 创建 Vitals Agent（获得 $VITAL 代币地址）
- [x] 部署自定义合约到 Base Sepolia
- [x] 验证合约（Basescan）
- [x] 准备测试钱包和测试代币

---

### 第 2 周：前端核心功能开发

#### Day 1-2: 全局框架 + 主页仪表盘
- [ ] 集成 Wagmi + RainbowKit，完成 Metamask 连接流程
- [ ] 搭建 AppBar（LOGO、导航、钱包按钮）
- [ ] 实现首页 `/` 指标卡（价格、市值、持有者、交易量）
- [ ] 实现 MilestoneProgress 组件（$4.2K / $420K）
- [ ] 配置 “购买 $VIRTUAL” 外链 CTA 与基本响应式布局

#### Day 3-4: AI 咨询聊天界面
- [ ] 开发 ConversationList（最近对话侧栏，桌面与移动折叠）
- [ ] 开发 ChatWindow（消息气泡 + 自动滚动）
- [ ] 开发 ChatComposer（输入框、快捷键、发送状态）
- [ ] 集成 `/api/inference/chat`，处理订阅过期错误提醒
- [ ] 本地缓存对话历史（localStorage + React Query）

#### Day 5-7: 创作者弹窗 + 个人中心
- [ ] 实现 `/creator` 页面并自动打开 ContributionModal
  - [ ] 表单校验（游戏标题、正文、标签）
  - [ ] 提交成功 Toast + 交易哈希提示
- [ ] 开发 `/me` 个人中心卡片
  - [ ] SubscriptionCard（状态、到期时间、续订按钮）
  - [ ] DividendCard（可提取金额、Claim 流程）
  - [ ] WalletInfo 区块（地址/网络）
- [ ] 优化移动端弹窗与个人中心布局

---

### 第 3 周：后端集成 + 核心流程打通

#### Day 1-2: Dify API 集成 + 内容上传处理
- [ ] 创建 /api/inference/chat API Route（游戏咨询）
- [ ] 创建 /api/content/upload API Route（内容上传）
- [ ] 创建 /api/content/review API Route（内容审核）
- [ ] 集成 Notion API（自动上传内容）
- [ ] 调用 Dify API（你提供的接口）
- [ ] 错误处理和重试机制

#### Day 3-4: 收益分配和奖励机制
- [ ] 实现 AI 咨询收入的 70% 自动分配到 DividendPool
- [ ] 实现内容创作者奖励分配逻辑
- [ ] 根据内容质量和查询次数计算奖励
- [ ] 定期批量处理奖励（每天/每周）

#### Day 5-7: 完整流程测试
- [ ] 端到端测试：购买 $GAME 代币
- [ ] 端到端测试：订阅 → 游戏咨询 → 获得回答
- [ ] 端到端测试：内容上传 → 审核 → 获得奖励
- [ ] 端到端测试：收益分配 → Claim 分红
- [ ] 多用户场景测试
- [ ] UI/UX 优化和移动端适配

---

### 第 4 周：测试 + Demo 准备

#### Day 1-2: 完整测试
- [ ] 完整的用户旅程测试
- [ ] Gas 优化
- [ ] 安全性检查
- [ ] 修复已知 Bug

#### Day 3-4: Demo 数据准备
- [ ] 准备 5 个测试钱包
- [ ] 预先购买 $GAME 代币
- [ ] 预先上传几条游戏攻略（作为内容创作者）
- [ ] 预先进行几次 AI 游戏咨询
- [ ] 确保分红池有余额可供 Claim
- [ ] 准备演示脚本

#### Day 5-7: Pitch Deck 和视频
- [ ] 制作 Pitch Deck（5-8 页）
  - [ ] 问题：游戏社区的集体智慧没有价值化
  - [ ] 解决方案：GAME.ai 的 UGC + AI + 代币经济
  - [ ] 市场机会：游戏玩家基数大，内容需求高
  - [ ] 商业模式：订阅费 + 内容激励 + 代币价值
  - [ ] 竞争优势：Virtuals Protocol + 社区驱动
- [ ] 录制 Demo 视频（2-5 分钟）
- [ ] 准备口头演讲稿

---

## 🎬 Demo Day 演示流程（5 分钟）

### 分钟 1: 问题与方案 (60s)
**展示内容**：
- **问题**：游戏社区的集体智慧（攻略、经验、策略）没有被价值化
- **现象**：玩家免费上传到各大平台，内容创作者收入微薄
- **传统方案缺陷**：大型游戏平台垄断内容，中心化存储
- **GAME.ai 方案**：UGC + AI + 代币经济 + 社区分红
  - 玩家上传攻略 → 获得 $GAME 代币
  - 订阅玩家 → 获得 AI 咨询服务
  - $GAME 持有者 → 获得平台收益的 70% 分红

### 分钟 2: 首页指标演示 (60s)
**操作流程**：
1. 打开网站，展示 GAME.ai LOGO 与标语
2. 连接 MetaMask 钱包，导航栏头像显示成功连接
3. 讲解指标卡：当前价格、市值、持有者数、总交易量
4. 展示里程碑进度条（距离 $4.2K 激活 / $420K 红丸的进度）
5. 点击 “购买 $VIRTUAL” 按钮（跳转 Virtuals 官网）说明资金入口

### 分钟 3: 创作者贡献演示 (90s)
**操作流程**：
1. 切换到 `/creator` 页面自动弹出投稿 Modal
2. 输入游戏标题与正文内容，选择标签
3. 点击 “上传攻略” → 等待链上奖励发放
4. 弹出成功提示：“上传成功，1 $GAME 奖励已发送” 并附交易哈希链接
5. 说明奖励资金来源与 Notion/Dify 自动同步

### 分钟 4: 游戏咨询演示 (90s)
**操作流程**：
1. 切换到 `/ai` 聊天界面
2. 选择已有对话或创建新对话，展示 ConversationList
3. 输入问题："Elden Ring 中如何打败玛格丽特？"
4. 调用后端 → 实时展示 AI 回答
5. 演示多轮对话与滚动交互
6. 若订阅过期时的提醒条逻辑（引导前往个人中心续费）

### 分钟 5: 收益与未来愿景 (60s)
**操作流程和展示**：
1. 切换到 `/me` 个人中心
2. 展示 SubscriptionCard（状态、到期时间、续订按钮）
3. 展示 DividendCard（可提取分红，点击 Claim 并完成交易）
4. 简述奖励到账反馈与活动日志
5. **未来愿景**：
   - 多游戏支持（单机、MOBA、MMO、独立游戏等）
   - 内容创作者排行榜和竞赛
   - DEX 上的自由交易（$420K 红丸升级后）
   - 社区治理和投票（$GAME 持有者）
   - 跨链桥接和生态扩展

---

## 📝 MVP 功能清单（Checklist）

### 智能合约
- [ ] GameInferencePayment 合约开发
- [ ] GameDividendPool 合约开发
- [ ] ContentRewardPool 合约开发
- [ ] 单元测试（覆盖率 > 90%）
- [ ] 部署到 Base Sepolia
- [ ] 合约验证（Basescan）
- [ ] 在 Virtuals Protocol 创建 GAME Agent

### 前端应用
- [ ] 钱包连接（RainbowKit + Wagmi）
- [ ] 首页仪表盘（/）
  - [ ] HeroSection & LOGO 展示
  - [ ] MetricCards（价格、市值、持有者、交易量）
  - [ ] MilestoneProgress 组件（$4.2K / $420K）
  - [ ] CTAButtons（购买 $VIRTUAL 外链、了解订阅）
- [ ] AI 咨询页面（/ai）
  - [ ] ConversationList 组件
  - [ ] ChatWindow 组件
  - [ ] ChatComposer 组件
  - [ ] 订阅过期提醒条（403 时显示）
  - [ ] 对话缓存与状态管理
- [ ] 创作者贡献界面（/creator）
  - [ ] ContributionModal（表单校验、字符限制）
  - [ ] 成功提示与奖励哈希链接
  - [ ] Modal 弹层的移动端适配
- [ ] 个人中心页面（/me）
  - [ ] SubscriptionCard（状态、到期、续订按钮）
  - [ ] DividendCard（可提取金额、Claim）
  - [ ] WalletInfo / ActivityList 区块

### 后端服务
- [ ] /api/inference/chat（Dify 集成，游戏咨询）
- [ ] /api/content/upload（内容上传处理）
- [ ] /api/content/review（内容审核逻辑）
- [ ] /api/subscription/status（查询订阅状态）
- [ ] /api/subscription/activate（激活订阅）
- [ ] Notion API 集成（自动上传审核通过的内容）
- [ ] 订阅验证逻辑
- [ ] 错误处理和日志

### 核心流程
- [ ] 首页指标展示与购买 $VIRTUAL 外链引导流程
- [ ] 订阅 / 续费流程（个人中心触发链上支付）
- [ ] 游戏咨询查询流程（调用 Dify API）
- [ ] 内容上传 → 审核 → 奖励分配流程
- [ ] AI 咨询收入分配流程（70% 分红池，30% 创作者）
- [ ] 内容创作者奖励分配流程
- [ ] 分红 Claim 流程

### 测试
- [ ] 智能合约单元测试
- [ ] 前端组件测试
- [ ] 端到端测试（E2E）
- [ ] 多用户场景测试（订阅者、创作者、投资者）

### 数据库
- [ ] MongoDB subscriptions 集合
- [ ] MongoDB gameContent 集合
- [ ] 数据库索引优化

### Demo 准备
- [ ] 测试账户准备（5 个钱包，不同角色）
- [ ] 测试代币获取（$VIRTUAL、$GAME）
- [ ] 预上传几条游戏攻略内容
- [ ] 演示脚本编写
- [ ] Pitch Deck（5-8 页）
- [ ] 视频 Demo（2-5 分钟）

---

## ⚠️ 关键风险与应对策略

### 风险 1: 内容质量控制和审核效率

**风险描述**:
- UGC 内容质量参差不齐，审核成本高
- 恶意或低质量内容可能损害 AI 知识库质量
- 审核延迟可能影响创作者体验

**应对策略**:
1. **MVP 阶段采用人工审核**（快速迭代）
2. **建立内容评分体系**（社区投票、使用次数等）
3. **内容入库前进行质量检测**（长度、格式、关键词等）
4. **未来升级为半自动审核**（AI 初审 + 人工复审）

### 风险 2: Dify API 成本超预期和服务质量

**风险描述**:
- 每次游戏咨询的成本可能超过预期
- 用户可能恶意刷接口
- AI 回答质量不稳定

**应对策略**:
1. **动态调整服务费用**（合约支持修改费率）
2. **实现速率限制和配额管理**（每用户、每小时的查询次数）
3. **监控 API 成本**，定期优化提示词
4. **备用方案**：直接调用 OpenAI/Claude API
5. **内容库充足后**，利用 RAG 技术提升质量

### 风险 3: 代币经济失衡和投机问题

**风险描述**:
- 代币价格波动可能导致用户流失
- 内容创作激励不足导致内容库增长缓慢
- 投机者大量买卖导致价格剧烈波动

**应对策略**:
1. **完善激励机制**（确保创作者获得合理奖励）
2. **引入买入时的流动性锁定**（减少抛售）
3. **定期发布平台数据**（透明度）
4. **监控鲸鱼钱包操作**，防止操纵

### 风险 4: Virtuals Protocol 集成复杂度

**风险描述**:
- AgentFactory 接口可能与文档不一致
- Bonding Curve 可能有未知的限制
- 市值门槛机制可能有变化

**应对策略**:
1. **第一周优先研究和测试** Virtuals 合约
2. 在 Base Sepolia 上**先创建测试 Agent**，验证流程
3. 保持与 Virtuals 社区的沟通

### 风险 5: Gas 费用过高

**风险描述**:
- Base 网络虽然便宜，但频繁的内容奖励和分红分配可能累积高 Gas 费

**应对策略**:
1. **优化合约代码**（减少存储操作）
2. **批量处理奖励分配**（每天或每周一次）
3. **用户主动 Claim**（而非主动推送分红）
4. 监控 Gas Price，在低峰时段操作

---

## 🔑 关键合约地址（Base Network）

### Virtuals Protocol 核心合约
- **$VIRTUAL Token (Base)**: `0x123`
- **Creator Vault**: `0x123`

### GAME.ai 自定义合约（待部署）
- **GameInferencePayment**: `0x123`（第 1 周部署）
- **GameDividendPool**: `0x123`（第 1 周部署）
- **ContentRewardPool**: `0x123`（第 1 周部署）
- **$GAME Token**: `0x123`（通过 Virtuals Protocol 创建 GAME Agent 自动生成）

---

## 🎯 成功标准

MVP 成功的标志：
1. ✅ 用户可以购买/出售 $GAME 代币（通过 Bonding Curve）
2. ✅ 用户可以订阅 AI 游戏咨询服务（10 $VIRTUAL/月）
3. ✅ AI 回答基于用户上传的游戏攻略和知识库（高质量）
4. ✅ 创作者可以上传游戏攻略并获得 $GAME 代币奖励
5. ✅ AI 咨询收入自动分配（70% 分红池，30% 创作者）
6. ✅ $GAME 持有者可以 Claim 分红收益
7. ✅ 所有关键数据从链上读取，MongoDB 仅存储非关键数据
8. ✅ ChatGPT 风格的简洁对话界面
9. ✅ 完整的 Notion 集成和知识库管理
10. ✅ 完整的 Demo 演示流程（5 分钟，展示所有核心功能）
11. ✅ Pitch Deck 和视频 Demo 完成
12. ✅ 支持多个用户角色（普通玩家、内容创作者、投资者）

---

## 📊 第一阶段的预期指标

**达成目标**（第 1 个月内）：
- 📈 市值达到 $4.2K → GAME Agent 在 Virtuals Forum 激活
- 👥 至少 20 名内容创作者上传攻略
- 📝 至少 50 篇游戏攻略/经验内容
- 💰 至少 10 名订阅用户
- 🎮 支持至少 5 款热门游戏

**后续目标**（阶段二）：
- 📈 市值达到 $420K → 红丸升级为 ERC20
- 👥 100+ 内容创作者
- 📝 1000+ 游戏内容
- 💰 500+ 订阅用户
- 🎮 20+ 支持的游戏

---

**准备好了吗？让我们开始构建 GAME.ai - 游戏社区的 AI 知识库！🚀**
