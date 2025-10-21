# 🚀 GAME.ai Backend 快速开始指南

## 前置要求

- Node.js >= 16.0.0
- MongoDB Atlas 账户（已配置）
- Base Sepolia 网络配置
- 测试 ETH（用于 Gas 费用）

---

## 1️⃣ 初始化项目

### 1.1 安装依赖
```bash
cd /path/to/Game/server
npm install
```

### 1.2 配置环境变量
编辑 `.env` 文件，添加 deployer 私钥：

```bash
# 从合约部署信息中获取 deployer 地址
# deployments/baseSepolia.json 中记录了 deployer: 0x123

# 设置 Deployer 私钥（从你的钱包管理工具中获取）
```

> ⚠️ **安全警告**: 不要在版本控制中提交真实的私钥，只在本地开发环境中使用

---

## 2️⃣ 启动开发服务器

```bash
npm run dev
```

输出应该类似于：
```
> next dev
  ▲ Next.js 14.0.0
  - Local:        http://localhost:3000
```

---

## 3️⃣ 测试 API 功能

### 方式一：使用提供的测试脚本

```bash
# 测试内容上传功能
node test/test-content-upload.js
```

### 方式二：使用 cURL

#### 3.1 上传游戏攻略

```bash
curl -X POST http://localhost:3000/api/content/upload \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x123",
    "gameTitle": "Elden Ring",
    "title": "玛格丽特 Boss 完整攻略",
    "content": "## Boss 攻略\n\n### 基本信息\n- 位置：艾尔登树前方\n- 弱点：雷电伤害\n- 推荐等级：30-40\n\n### 打法策略\n保持距离，观察攻击模式...",
    "tags": ["boss", "strategy", "main-boss"],
    "description": "包含所有阶段和装备推荐的完整攻略"
  }'
```

**成功响应** (201):
```json
{
  "success": true,
  "contentId": "550e8400-e29b-41d4-a716-446655440000",
  "rewardTxHash": "0x123",
  "message": "内容上传成功，已获得 1 GAME 代币奖励"
}
```

#### 3.2 查询用户已上传的内容

```bash
curl -X GET "http://localhost:3000/api/content/list?address=0x123&limit=10&skip=0"
```

**成功响应** (200):
```json
{
  "success": true,
  "total": 1,
  "contents": [
    {
      "contentId": "550e8400-e29b-41d4-a716-446655440000",
      "gameTitle": "Elden Ring",
      "title": "玛格丽特 Boss 完整攻略",
      "description": "包含所有阶段和装备推荐的完整攻略",
      "status": "approved",
      "queryCount": 0,
      "rewardAmount": "1",
      "rewardStatus": "distributed",
      "createdAt": "2025-10-19T10:30:00.000Z"
    }
  ]
}
```

#### 3.3 查询创作者统计

```bash
curl -X GET "http://localhost:3000/api/content/stats?address=0x123"
```

**成功响应** (200):
```json
{
  "success": true,
  "stats": {
    "totalContent": 1,
    "publishedContent": 1,
    "totalQueryCount": 0,
    "totalRewardEarned": "1",
    "distributedReward": "1",
    "pendingReward": "0"
  }
}
```

#### 3.4 查询订阅状态

```bash
curl -X GET "http://localhost:3000/api/subscription/status?address=0x123"
```

#### 3.5 激活订阅

```bash
curl -X POST http://localhost:3000/api/subscription/activate \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x123",
    "transactionHash": "0x123",
    "amount": "10"
  }'
```

#### 3.6 游戏咨询查询

```bash
curl -X POST http://localhost:3000/api/inference/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userAddress": "0x123",
    "question": "Elden Ring 中如何打败玛格丽特"
  }'
```

### 方式三：使用 Postman

1. 打开 Postman
2. 创建新的 Request
3. 选择 `POST` 方法
4. URL: `http://localhost:3000/api/content/upload`
5. Headers: `Content-Type: application/json`
6. Body (raw JSON):
```json
{
  "userAddress": "0x123",
  "gameTitle": "Elden Ring",
  "title": "玛格丽特 Boss 攻略",
  "content": "详细的攻略文本...",
  "tags": ["boss"],
  "description": "完整打法指南"
}
```
7. 点击 Send

---

## 4️⃣ 查看数据库

### 使用 MongoDB Atlas 网页界面

1. 登录 [MongoDB Atlas](https://cloud.mongodb.com)
2. 进入 Vitals 项目
3. 点击 "Browse Collections"
4. 查看 `gameContent` 集合中的数据

### 使用命令行工具

```bash
# 连接到 MongoDB（需要配置连接字符串）
mongosh "mongodb+srv://buptdaniel2017_db_user:QV7CrAPlumTTuLDg@vitals.a2tde4l.mongodb.net/?retryWrites=true&w=majority&appName=Vitals"

# 切换数据库
use Vitals

# 查询 gameContent 集合
db.gameContent.find()

# 查询特定用户的内容
db.gameContent.find({ userAddress: "0x123" })

# 查看集合统计
db.gameContent.stats()
```

---

## 5️⃣ 监控和调试

### 查看日志

后端服务会输出详细的日志，显示各个操作的进行情况：

```
[Content Upload API] 收到请求 | 用户: 0x123 | 游戏: Elden Ring
[Content Upload API] 存储内容到数据库...
[Content Upload API] 内容已存储，ID: 550e8400-e29b-41d4-a716-446655440000
[Content Upload API] 准备转账 1 GAME 代币...
[Blockchain] 准备转账 ERC20 代币
[Blockchain] 代币地址: 0x123
[Blockchain] 接收地址: 0x123
[Blockchain] 转账数量: 1000000000000000000
[Blockchain] 执行转账交易...
[Blockchain] 交易已发送，Hash: 0x123
[Blockchain] 交易已确认，区块号: 12345678
[Content Upload API] 转账成功，TX Hash: 0x123
[Content Upload API] 数据库已更新，转账状态: distributed
```

### 调试技巧

1. **启用详细日志**：环境变量 `LOG_LEVEL=debug` 已在 `.env` 中设置

2. **检查合约地址**：确认 `.env` 中的合约地址与部署信息一致

3. **验证私钥**：使用以下命令验证私钥是否有效
```bash
node -e "
const ethers = require('ethers');
const pk = '0x123';
try {
  const wallet = new ethers.Wallet(pk);
  console.log('✓ 钱包地址:', wallet.address);
} catch(e) {
  console.log('✗ 私钥格式错误:', e.message);
}
"
```

4. **检查 Gas 余额**：确保 deployer 账户有足够的 Base Sepolia ETH

---

## 6️⃣ 常见问题


**A**: 编辑 `.env` 文件，添加有效的私钥：
```bash
```

### Q: 转账失败，提示 "Insufficient balance"

**A**: deployer 账户余额不足，需要向其中转入 $GAME 代币。可以通过以下步骤：
1. 获取 deployer 地址（见 deployments/baseSepolia.json）
2. 使用 Web3 工具或合约部署的初始化脚本转账代币

### Q: MongoDB 连接超时

**A**:
1. 检查网络连接
2. 确认 MongoDB Atlas 连接字符串正确
3. 查看防火墙设置（确保允许你的 IP）

### Q: API 返回 500 错误

**A**:
1. 检查服务器日志，查看具体错误信息
2. 验证所有环境变量都已正确配置
3. 确保数据库连接正常

### Q: 如何获取测试用的 $GAME 代币？

**A**:
1. 部署脚本中已配置初始分配
2. 或者从 deployer 账户转账到你的测试账户
3. 目前简化版本中，每上传一条内容会自动获得 1 GAME

---

## 7️⃣ 下一步

1. ✅ 内容上传功能已完成
2. 📋 考虑启用内容审核流程
3. 📋 集成 Notion API
4. 📋 实现 AI 咨询收入分配
5. 📋 完整的端到端测试

详见 `IMPLEMENTATION_SUMMARY.md` 中的下一步计划。

---

## 📚 参考资源

- [API 文档](./API_DOCUMENTATION.md)
- [实现总结](./IMPLEMENTATION_SUMMARY.md)
- [ethers.js 文档](https://docs.ethers.org/v5/)
- [Next.js 文档](https://nextjs.org/docs)
- [MongoDB 文档](https://docs.mongodb.com/)

---

## 🆘 获取帮助

如有问题，请：
1. 查看 API 文档
2. 检查服务器日志
3. 查看 MongoDB 数据库状态
4. 联系开发团队

---

**准备好了吗？开始使用 GAME.ai Backend！** 🎮
