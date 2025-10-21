# GAME.ai 合约测试指南

## 📋 概览

本目录包含 GAME.ai 智能合约的完整测试脚本。测试脚本用于验证包月订阅合约的所有功能。

---

## 📂 测试脚本说明

### 脚本文件结构

```
scripts/
├── deploy-mock.js              # 部署 mock ERC20 代币（VIRTUAL 和 GAME）
├── deploy.js                   # 部署主合约（GameInferencePayment 和 GameDividendPool）
├── diagnose-sepolia.js         # 诊断脚本（检查网络连接和合约状态）
└── test-subscription.js        # 📌 完整的包月订阅测试脚本（新）
```

### 脚本说明

#### 1. `deploy-mock.js`
**用途**: 部署模拟的 ERC20 代币
**功能**:
- 部署 MockERC20 合约作为 VIRTUAL 代币
- 部署 MockERC20 合约作为 GAME 代币
- 保存部署信息到 `deployments/` 目录

**使用**:
```bash
npm run deploy:sepolia:mock
```

#### 2. `deploy.js`
**用途**: 部署主合约
**功能**:
- 部署 GameDividendPool（分红池）合约
- 部署 GameInferencePayment（订阅支付）合约
- 初始化合约参数
- 保存部署信息到 `deployments/` 目录

**使用**:
```bash
npm run deploy:sepolia
```

#### 3. `diagnose-sepolia.js`
**用途**: 诊断网络和合约状态
**功能**:
- 检查 RPC 连接
- 验证私钥配置
- 检查账户余额
- 查询已部署合约信息

**使用**:
```bash
npm run diagnose:sepolia
```

#### 4. `test-subscription.js` ⭐ (新增)
**用途**: 完整的包月订阅测试（现在的标准测试脚本）
**测试流程**:
1. **准备阶段** - 为用户分配测试代币
2. **订阅阶段** - 用户进行包月订阅支付
3. **统计阶段** - 验证收益分配（30% 创作者，70% 分红池）
4. **查询阶段** - 查询用户可提取分红
5. **提取阶段** - 用户提取分红
6. **管理阶段** - 测试管理功能（更新费用）
7. **最终阶段** - 输出完整的测试结果

**使用**:
```bash
npm run test:subscription
```

**测试覆盖**:
- ✅ 用户订阅支付 (`subscribeMonthly()`)
- ✅ 收益分配 (30/70 分成)
- ✅ 统计数据追踪
- ✅ 分红池功能
- ✅ 分红提取
- ✅ 管理功能（更新费用）

---

## 🚀 快速开始

### 前提条件

1. **安装依赖**
   ```bash
   cd Game/contract
   npm install --legacy-peer-deps
   ```

2. **配置环境**
   - 编辑 `.env` 文件
   - 设置 BASE_SEPOLIA_RPC_URL
   - 设置 VIRTUAL_TOKEN_ADDRESS, GAME_TOKEN_ADDRESS

### 标准测试流程

**第一次运行（完整部署）**:

```bash
# 1. 编译合约
npm run compile

# 2. 部署 mock 代币（如果还没有）
npm run deploy:sepolia:mock

# 3. 部署主合约
npm run deploy:sepolia

# 4. 运行完整测试
npm run test:subscription
```

**后续测试（仅运行测试）**:

```bash
# 直接运行测试
npm run test:subscription
```

---

## 📊 测试结果

测试完成后，结果将保存到：

```
Game/contract/test-results/
└── subscription-{timestamp}.json
```

每个测试结果包含：
- 合约地址
- 订阅统计（总次数、总收入、收益分配）
- 分红池统计（总额、已提取、待提取）
- 用户结果（余额、获得分红）

### 示例输出

```
═══════════════════════════════════════════════════════════
✅ 包月订阅测试完成！
═══════════════════════════════════════════════════════════

📊 最终统计数据:

  📱 订阅信息:
    • 总订阅次数:         3
    • 总收入:             30 VIRTUAL
    • 创作者累计收益:     9 VIRTUAL (30%)
    • 分红池累计分配:     21 VIRTUAL (70%)

  💰 分红信息:
    • 分红池总额:         21 VIRTUAL
    • 用户已提取:         21 VIRTUAL
    • 待提取分红:         0 VIRTUAL

  👥 用户结果:
    User1:
      • 地址:             0x123
      • 剩余 VIRTUAL:     150
      • 获得分红:         14 VIRTUAL

    User2:
      • 地址:             0x123
      • 剩余 VIRTUAL:     180
      • 获得分红:         7 VIRTUAL
```

---

## 🔧 环境变量配置

### `.env` 文件示例

```
# Base Sepolia Network
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Account Private Keys

# Token Addresses (from deploy:sepolia:mock)
VIRTUAL_TOKEN_ADDRESS=0x123
GAME_TOKEN_ADDRESS=0x123
```

---

## 📝 测试说明

### 账户角色

1. **Deployer (signer[0])**
   - 部署合约
   - 是 GameInferencePayment 的创作者/owner
   - 可以更新合约参数
   - 从收费中获得 30% 收益

2. **User1 (signer[1])**
   - 测试用户
   - 进行订阅支付
   - 获得分红

3. **User2 (signer[2])**
   - 测试用户
   - 进行订阅支付
   - 获得分红

### 测试数据

- **用户初始代币**: 200 VIRTUAL 每个用户
- **月度订阅费**: 10 VIRTUAL
- **创作者分成**: 30%
- **分红池分成**: 70%
- **测试订阅次数**: 3 次（User1 两次，User2 一次）

---

## ⚠️ 常见问题

### Q: 为什么需要 3 个私钥？
A:

### Q: 如何重新部署合约？
A:
```bash
npm run clean
npm run compile
npm run deploy:sepolia:mock
npm run deploy:sepolia
```

### Q: 测试失败了怎么办？
A:
1. 检查 `.env` 文件配置
2. 运行 `npm run diagnose:sepolia` 诊断
3. 确保账户有足够余额
4. 检查合约部署是否成功

### Q: 如何只测试特定功能？
A: 编辑 `test-subscription.js` 注释掉不需要的测试阶段

---

## 🗑️ 已删除的旧脚本

以下脚本已被替换或删除：

- ❌ `test-sepolia.js` - 针对旧的单次支付模式
- ❌ `test-step-by-step.js` - 逐步测试脚本（已整合到 test-subscription.js）
- ❌ `test-user2-consultation.js` - 单用户测试（已整合）

**为什么删除？**
这些脚本是为旧的 `payForInference()` 函数编写的。现在我们使用了新的 `subscribeMonthly()` 包月订阅模式，所以这些脚本已过期。

---

## 📖 相关文档

- [合约 README](./README.md) - 合约项目文档
- [部署指南](./DEPLOYMENT.md) - 如有此文件
- [Hardhat 文档](https://hardhat.org/) - 更多信息

---

## ✅ 检查清单

在运行测试前，请检查：

- [ ] 已安装依赖 (`npm install`)
- [ ] `.env` 文件已配置
- [ ] RPC URL 可访问
- [ ] 账户有余额（交易费用）
- [ ] Mock 代币已部署
- [ ] 主合约已部署

---

**最后更新**: 2025-10-19
**当前版本**: 1.0.0
**测试脚本**: test-subscription.js
