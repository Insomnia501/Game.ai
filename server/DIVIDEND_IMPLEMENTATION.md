# 分红功能实现总结

## 📋 概述

本文档记录了分红系统的完整实现，包括三个新接口和一个现有接口的修改。该实现基于方案 B（前端调用合约），确保用户完全掌控自己的资金提现。

---

## 🎯 实现的功能

### 1️⃣ 修改激活订阅接口
**路由**: `POST /api/subscription/activate`
**文件**: `app/api/subscription/activate/route.ts`

**新增功能**：
- 用户激活订阅（支付 10 VIRTUAL）后，后端自动调用 `GameDividendPool.depositDividend()` 合约
- 将 10 VIRTUAL 的 70%（即 7 VIRTUAL）注入分红池
- 分红池中的每股分红（perShare）自动更新
- 所有 $GAME 代币持有者在下次 Claim 时能获得新增分红

**流程**：
1. 验证链上交易
2. 创建/更新订阅记录
3. 调用合约更新分红 → 两笔交易（approve + depositDividend）
4. 返回响应（包含 dividendUpdateTxHash）

**关键代码**：
```typescript
const dividendPoolAddress = process.env.GAME_DIVIDEND_POOL_ADDRESS
const dividendAmount = toWei('7') // 10 VIRTUAL 的 70%
const blockchain = createBlockchainClient()
const dividendTxResult = await blockchain.updateGameDividendPool(dividendPoolAddress, dividendAmount)
```

---

### 2️⃣ 查询分红接口（新建）
**路由**: `GET /api/dividend/balance`
**文件**: `app/api/dividend/balance/route.ts`

**功能**：
- 实时查询用户的分红信息
- 显示待提取分红、已提取分红、$GAME 余额
- 显示分红池的整体统计

**请求参数**：
```
GET /api/dividend/balance?userAddress=0x...
```

**响应格式**：
```json
{
  "success": true,
  "userAddress": "0x...",
  "dividend": {
    "pending": {
      "wei": "7000000000000000000",
      "virtual": "7"
    },
    "claimed": {
      "wei": "3000000000000000000",
      "virtual": "3"
    },
    "gameBalance": {
      "wei": "100000000000000000000",
      "game": "100"
    },
    "totalEarnable": {
      "wei": "10000000000000000000",
      "virtual": "10"
    }
  },
  "poolStats": {
    "totalDividendPool": "1000000000000000000000",
    "totalClaimed": "300000000000000000000",
    "totalPending": "700000000000000000000",
    "totalDividendPerShare": "50000000000000000"
  },
  "timestamp": 1729876000000
}
```

---

### 3️⃣ 提现接口（新建，方案 B）
**路由**: `POST /api/dividend/withdraw`
**文件**: `app/api/dividend/withdraw/route.ts`

**两种使用方式**：

#### 方式 A：获取交易签名数据（初始请求）
```json
POST /api/dividend/withdraw
{
  "userAddress": "0x..."
}
```

**响应**：
```json
{
  "success": true,
  "userAddress": "0x...",
  "availableAmount": "7.5",
  "transactionData": {
    "to": "0x分红池地址",
    "from": "0x用户地址",
    "data": "0x...",  // claimDividend() 编码数据
    "value": "0"
  },
  "instructions": {
    "step1": "使用您的钱包（如 MetaMask）连接到 Base 网络",
    "step2": "使用钱包的 '签名和发送交易' 功能",
    "step3": "复制上面的交易数据到钱包",
    "step4": "签名并发送交易",
    "step5": "交易确认后，您的分红将自动转入您的钱包"
  },
  "message": "请使用钱包签名并发送此交易"
}
```

#### 方式 B：记录提现结果（提现后）
```json
POST /api/dividend/withdraw
{
  "userAddress": "0x...",
  "transactionHash": "0x...",
  "amount": "5.5"
}
```

**响应**：
```json
{
  "success": true,
  "userAddress": "0x...",
  "transactionHash": "0x...",
  "claimedAmount": "5.5",
  "status": "pending",
  "message": "分红提现记录已保存，请在区块浏览器上查看交易状态",
  "explorerUrl": "https://sepolia.basescan.org/tx/0x..."
}
```

---

## 🔧 blockchain.ts 中的新增方法

### 1. `updateGameDividendPool()`
**功能**：调用 GameDividendPool 的 depositDividend() 方法

```typescript
async updateGameDividendPool(
  dividendPoolAddress: string,
  amount: string
): Promise<{ transactionHash: string; blockNumber?: number }>
```

**实现步骤**：
1. 向 VIRTUAL 代币发送 approve 交易
2. 等待 approve 确认
3. 向 GameDividendPool 发送 depositDividend 交易
4. 等待交易确认
5. 返回 depositDividend 的交易哈希

---

### 2. `getUserDividendInfo()`
**功能**：查询用户的分红信息

```typescript
async getUserDividendInfo(
  dividendPoolAddress: string,
  userAddress: string
): Promise<{
  pending: string
  claimed: string
  gameBalance: string
}>
```

---

### 3. `getDividendPoolStats()`
**功能**：查询分红池的统计数据

```typescript
async getDividendPoolStats(
  dividendPoolAddress: string
): Promise<{
  totalDividendPool: string
  totalClaimed: string
  totalPending: string
  totalDividendPerShare: string
}>
```

---

## 🗄️ 数据库变更

### 新增集合：dividendWithdrawals
存储分红提现历史记录

**字段**：
- `withdrawalId`: 提现唯一 ID（UUID）
- `userAddress`: 用户地址
- `transactionHash`: 提现交易哈希
- `claimedAmount`: 提现金额
- `status`: 状态（pending / confirmed）
- `createdAt`: 创建时间
- `updatedAt`: 更新时间

**索引**：
- `withdrawalId` (unique)
- `userAddress`
- `transactionHash`
- `createdAt`
- `status`

### 修改集合：subscriptions
新增字段：
- `dividendUpdateTxHash`: 分红更新交易哈希（可选）

---

## 📊 分红机制流程

```
用户激活订阅 (10 VIRTUAL)
        ↓
验证链上交易
        ↓
更新数据库订阅记录
        ↓
调用合约 depositDividend(7 VIRTUAL)
        ├─ 1️⃣ Approve (VIRTUAL token)
        └─ 2️⃣ DepositDividend (GameDividendPool)
        ↓
分红池 perShare 更新
        ↓
$GAME 持有者下次 Claim 时获得新增分红
```

---

## 🔐 安全考虑

1. **前端调用优势**：
   - ✅ 用户完全掌控，不需要信任后端私钥
   - ✅ 交易由用户钱包签名
   - ✅ 符合 Web3 最佳实践

2. **验证机制**：
   - ✅ 地址格式验证（所有接口）
   - ✅ 链上交易验证（激活订阅时）
   - ✅ 可提现金额验证（提现时）

3. **错误处理**：
   - ✅ 分红更新失败不中断订阅激活
   - ✅ 提现失败仅返回错误，不丢失数据
   - ✅ 完整的日志记录用于调试

---

## 🚀 部署检查清单

- [x] 编译通过（npm run build）
- [x] 环境变量配置：
  - [x] `GAME_DIVIDEND_POOL_ADDRESS`
  - [x] `GAME_TOKEN_ADDRESS`
  - [x] `VIRTUAL_TOKEN_ADDRESS`
  - [x] `DEPLOYER_PRIVATE_KEY`
  - [x] `BASE_SEPOLIA_RPC_URL`
- [x] 数据库集合和索引创建
- [x] 所有接口单元测试
- [ ] 集成测试
- [ ] 生产环境部署

---

## 📝 使用示例

### 示例 1：激活订阅（自动更新分红）
```bash
curl -X POST http://localhost:3000/api/subscription/activate \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0xUser123",
    "transactionHash": "0x...",
    "amount": "10"
  }'
```

### 示例 2：查询分红信息
```bash
curl "http://localhost:3000/api/dividend/balance?userAddress=0xUser123"
```

### 示例 3：获取提现交易数据（前端用钱包签名）
```bash
curl -X POST http://localhost:3000/api/dividend/withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0xUser123"
  }'
```

### 示例 4：记录提现结果
```bash
curl -X POST http://localhost:3000/api/dividend/withdraw \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0xUser123",
    "transactionHash": "0x...",
    "amount": "5.5"
  }'
```

---

## 🎓 关键设计原则

1. **链上优先**：分红数据从合约查询，保证数据准确性
2. **后端代理**：订阅时自动触发分红更新，无需用户手动操作
3. **用户掌控**：提现完全由用户决定，后端仅生成签名数据
4. **容错机制**：各步骤独立，一个环节失败不影响其他流程
5. **完整日志**：详细的控制台日志便于问题追踪

---

## 📚 相关文件

- `/server/lib/blockchain.ts` - 区块链交互模块（新增 3 个方法）
- `/server/app/api/subscription/activate/route.ts` - 修改激活订阅接口
- `/server/app/api/dividend/balance/route.ts` - 新建查询分红接口
- `/server/app/api/dividend/withdraw/route.ts` - 新建提现接口
- `/server/lib/mongodb.ts` - 新增 dividendWithdrawals 集合
- `/server/.env` - 配置文件（确保 GAME_DIVIDEND_POOL_ADDRESS 已配置）

---

## ✅ 实现状态

所有功能已实现并编译通过。可以进行测试和部署。
