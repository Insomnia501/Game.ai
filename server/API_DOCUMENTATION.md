# GAME.ai Backend API 文档

## 概述

本文档描述 GAME.ai 后端服务提供的所有 REST API。所有 API 均基于 Next.js 14 实现，部署在 Base Sepolia 测试网络上。

---

## 基础信息

- **基础 URL**: `http://localhost:3000/api` (本地开发)
- **生产环境**: TBD
- **响应格式**: JSON
- **编码**: UTF-8

---

## 1. 订阅管理

### 1.1 查询订阅状态

**端点**: `GET /api/subscription/status`

**参数**:
```
address: 0x123 (必需) - 用户钱包地址
```

**响应示例**:
```json
{
  "isActive": true,
  "expiresAt": 1729876000,
  "daysRemaining": 15,
  "transactionHash": "0x123",
  "startedAt": 1729271200
}
```

**说明**:
- 检查用户当前的订阅状态
- `isActive`: 订阅是否有效
- `expiresAt`: 订阅过期时间（Unix 时间戳，秒）
- `daysRemaining`: 剩余天数

---

### 1.2 激活/续期订阅

**端点**: `POST /api/subscription/activate`

**请求体**:
```json
{
  "userAddress": "0x123",
  "transactionHash": "0x123",
  "amount": "10"
}
```

**响应示例**:
```json
{
  "success": true,
  "expiresAt": 1729876000,
  "message": "订阅已激活，有效期30天"
}
```

**说明**:
- 激活新订阅或续期现有订阅
- 需要提供链上交易的哈希值进行验证
- 金额必须为 10 $VIRTUAL
- 订阅有效期为 30 天

---

## 2. AI 游戏咨询

### 2.1 游戏咨询查询

**端点**: `POST /api/inference/chat`

**请求体**:
```json
{
  "userAddress": "0x123",
  "question": "Elden Ring 中如何打败玛格丽特",
  "conversationId": "uuid" // 可选，用于多轮对话
}
```

**响应示例**:
```json
{
  "answer": "玛格丽特是个标志性BOSS...",
  "conversationId": "uuid",
  "messageId": "msg-123",
  "taskId": "task-456",
  "subscriptionStatus": {
    "isActive": true,
    "daysRemaining": 15
  }
}
```

**说明**:
- 需要用户有有效的订阅
- 调用 Dify AI 进行推理
- 支持多轮对话（通过 `conversationId`）
- 对话记录自动保存到数据库

---

## 3. 内容管理

### 3.1 上传游戏攻略

**端点**: `POST /api/content/upload`

**请求体**:
```json
{
  "userAddress": "0x123",
  "gameTitle": "Elden Ring",
  "title": "Boss 攻略：玛格丽特，无名女王",
  "content": "完整的攻略文本...",
  "tags": ["boss", "strategy"],
  "description": "详细的Boss打法指南"
}
```

**响应示例**:
```json
{
  "success": true,
  "contentId": "550e8400-e29b-41d4-a716-446655440000",
  "rewardTxHash": "0x123",
  "message": "内容上传成功，已获得 1 GAME 代币奖励"
}
```

**说明**:
- 用户上传游戏攻略/经验获得 $GAME 代币奖励
- 默认每条内容奖励 1 GAME 代币
- 奖励由 deployer 账户直接转账
- 内容直接批准，无需审核（简化版本）
- 内容存储在 MongoDB 中

**参数说明**:
- `gameTitle`: 游戏名称（必需）
- `title`: 攻略标题（必需，最多 500 字符）
- `content`: 攻略内容（必需，最多 50000 字符）
- `tags`: 内容标签（可选，数组）
- `description`: 内容描述（可选）

---

### 3.2 获取用户内容列表

**端点**: `GET /api/content/list`

**参数**:
```
address: 0x123 (必需) - 用户钱包地址
limit: 20 (可选) - 每页数量，最多 100，默认 20
skip: 0 (可选) - 跳过的记录数，默认 0
```

**响应示例**:
```json
{
  "success": true,
  "total": 5,
  "contents": [
    {
      "contentId": "550e8400-e29b-41d4-a716-446655440000",
      "gameTitle": "Elden Ring",
      "title": "Boss 攻略",
      "description": "详细的攻略",
      "status": "approved",
      "queryCount": 10,
      "rewardAmount": "1",
      "rewardStatus": "distributed",
      "createdAt": "2025-10-19T10:30:00Z"
    }
  ]
}
```

**说明**:
- 查询指定用户上传的所有内容
- 支持分页
- 按创建时间逆序排列

---

### 3.3 获取创作者统计

**端点**: `GET /api/content/stats`

**参数**:
```
address: 0x123 (必需) - 用户钱包地址
```

**响应示例**:
```json
{
  "success": true,
  "stats": {
    "totalContent": 5,
    "publishedContent": 4,
    "totalQueryCount": 50,
    "totalRewardEarned": "5",
    "distributedReward": "5",
    "pendingReward": "0"
  }
}
```

**说明**:
- `totalContent`: 上传的总内容数
- `publishedContent`: 已批准的内容数
- `totalQueryCount`: 所有内容被查询的总次数
- `totalRewardEarned`: 获得的总 GAME 代币数
- `distributedReward`: 已分发的奖励
- `pendingReward`: 待分发的奖励

---

## 4. 错误处理

### 常见错误码

| 状态码 | 说明 |
|-------|------|
| 400 | 请求参数错误或缺少必需参数 |
| 401 | 认证失败（如 Dify API 密钥无效） |
| 403 | 禁止访问（如订阅已过期） |
| 404 | 资源不存在 |
| 429 | 请求过于频繁（速率限制） |
| 500 | 服务器内部错误 |
| 503 | 服务不可用 |
| 504 | 请求超时 |

### 错误响应示例

```json
{
  "success": false,
  "error": "Subscription has expired",
  "code": "SUBSCRIPTION_INACTIVE",
  "details": "..."
}
```

---

## 5. CORS 支持

所有 API 端点均支持 CORS 预检请求（OPTIONS）。

**CORS 配置**:
- `Access-Control-Allow-Origin`: `*` (允许所有来源)
- `Access-Control-Allow-Methods`: 取决于具体端点
- `Access-Control-Allow-Headers`: `Content-Type, Authorization`

---

## 6. 环境变量配置

### 必需变量

```bash
# 数据库
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=Vitals

# 区块链
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
CHAIN_ID=84532

# 智能合约地址
GAME_TOKEN_ADDRESS=0x123
VIRTUAL_TOKEN_ADDRESS=0x123
GAME_INFERENCE_PAYMENT_ADDRESS=0x123
GAME_DIVIDEND_POOL_ADDRESS=0x123

# AI 服务
DIFY_API_KEY=app-...
DIFY_API_BASE_URL=https://api.dify.ai/v1

# 应用设置
SUBSCRIPTION_PRICE_VIRTUAL=10
CONSULTATION_PRICE_VIRTUAL=0.1
```

---

## 7. 使用示例

### Node.js / JavaScript

```javascript
const axios = require('axios')

const BASE_URL = 'http://localhost:3000/api'

// 上传内容
async function uploadContent() {
  const response = await axios.post(`${BASE_URL}/content/upload`, {
    userAddress: '0x123',
    gameTitle: 'Elden Ring',
    title: 'Boss 攻略',
    content: '详细的攻略...',
    tags: ['boss', 'strategy'],
    description: '完整的打法指南',
  })

  console.log(response.data)
}

// 查询订阅状态
async function checkSubscription() {
  const response = await axios.get(`${BASE_URL}/subscription/status`, {
    params: {
      address: '0x123',
    },
  })

  console.log(response.data)
}

uploadContent()
checkSubscription()
```

### Python

```python
import requests

BASE_URL = 'http://localhost:3000/api'

# 上传内容
response = requests.post(
    f'{BASE_URL}/content/upload',
    json={
        'userAddress': '0x123',
        'gameTitle': 'Elden Ring',
        'title': 'Boss 攻略',
        'content': '详细的攻略...',
        'tags': ['boss', 'strategy'],
        'description': '完整的打法指南',
    }
)

print(response.json())
```

### cURL

```bash
# 上传内容
curl -X POST http://localhost:3000/api/content/upload \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x123",
    "gameTitle": "Elden Ring",
    "title": "Boss 攻略",
    "content": "详细的攻略...",
    "tags": ["boss", "strategy"],
    "description": "完整的打法指南"
  }'

# 查询订阅状态
curl -X GET "http://localhost:3000/api/subscription/status?address=0x123"
```

---

## 8. 注意事项

1. **地址格式**: 所有以太坊地址必须是有效的 40 字符十六进制字符串（前缀 `0x`）
2. **时间戳**: 所有时间戳均以秒为单位的 Unix 时间戳表示
3. **代币精度**: 所有代币数额以最小单位（Wei）表示，假设 ERC20 使用 18 位小数
4. **费用**: 所有交易都会产生 Gas 费用，由 deployer 账户承担

---

## 9. API 路线图

### 已实现
- ✅ 订阅管理（查询、激活）
- ✅ AI 游戏咨询
- ✅ 内容上传
- ✅ 内容列表
- ✅ 创作者统计

### 计划中
- 📋 内容审核管理
- 📋 Notion 集成
- 📋 AI 咨询收入分配
- 📋 内容创作者奖励分配
- 📋 分红领取接口
- 📋 高级分析和排行榜

---

## 10. 支持与反馈

如有问题或建议，请联系开发团队。
