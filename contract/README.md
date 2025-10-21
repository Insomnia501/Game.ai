# GAME.ai Smart Contracts

基于 Hardhat 的 GAME.ai 游戏 AI 代理智能合约项目。

## 📋 项目概述

GAME.ai 是一个基于 Virtuals Protocol 的去中心化游戏 AI 代理项目。本仓库包含所有智能合约的源代码、部署脚本和测试。

## 🏗️ 项目结构

```
.
├── contracts/              # Solidity 智能合约源代码
│   ├── GameInferencePayment.sol      # AI 游戏咨询支付合约
│   ├── GameDividendPool.sol          # $GAME 代币持有者分红池
│   ├── GameContentRewardPool.sol     # 内容创作者奖励池（未来）
│   └── mocks/
│       └── MockERC20.sol             # 测试用 Mock ERC20
├── scripts/                # Hardhat 部署脚本
│   ├── deploy.js                     # 主网部署脚本
│   ├── deploy-mock.js                # Mock 版本部署
│   ├── test-sepolia.js               # Sepolia 测试脚本
│   └── ...
├── test/                   # 智能合约单元测试
│   ├── GameInferencePayment.test.js
│   ├── GameDividendPool.test.js
│   └── fixtures.js
├── typechain-types/        # 自动生成的 TypeScript 类型
├── deployments/            # 部署地址和 ABI 记录
├── hardhat.config.js       # Hardhat 配置文件
├── package.json            # 项目依赖
├── tsconfig.json           # TypeScript 配置
└── README.md              # 本文件
```

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 环境配置

复制 `.env.example` 创建 `.env` 文件：

```bash
cp .env.example .env
```

然后编辑 `.env` 填入你的配置：

```
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ETHERSCAN_API_KEY=your_api_key_here
```

### 编译合约

```bash
npm run compile
```

### 运行测试

```bash
# 本地测试
npm run test

# 查看 Gas 报告
npm run test:gas

# 生成覆盖率报告
npm run test:coverage
```

### 部署到 Base Sepolia

```bash
# 部署 Mock 版本（用于测试）
npm run deploy:sepolia:mock

# 部署正式版本
npm run deploy:sepolia
```

### 在 Base Sepolia 测试

```bash
npm run test:sepolia
```

## 📝 合约说明

### GameInferencePayment.sol

**用途**: AI 游戏咨询支付合约

**功能**:
- 接收用户支付的 $VIRTUAL（AI 咨询费用）
- 自动分配收益：
  - 30% 给创作者
  - 70% 给分红池
- 支持动态调整服务费用

**关键方法**:
- `payForInference()` - 用户支付使用 AI 咨询
- `_distributeRevenue()` - 内部收益分配
- `updateServiceFee()` - 更新服务费用

### GameDividendPool.sol

**用途**: $GAME 代币持有者分红池合约

**功能**:
- 管理分红池累积
- 计算每个 $GAME 持有者的应得分红
- 支持用户主动 Claim 分红

**关键方法**:
- `depositDividend()` - 存入分红
- `claimDividend()` - 持有者提取分红
- `getPendingDividend()` - 查询待提取分红

### GameContentRewardPool.sol (未来)

**用途**: 内容创作者奖励池合约

**功能**:
- 管理创作者的 $GAME 代币奖励
- 根据内容质量和查询次数分配奖励
- 支持批量分配

## 🔐 安全考虑

- 所有合约都使用 OpenZeppelin 的审计过的库
- 使用 `ReentrancyGuard` 防护重入攻击
- 使用 `Ownable` 进行权限管理
- 所有关键操作都有事件日志

## 🧪 测试覆盖

```bash
npm run test
```

目标覆盖率: > 90%

## 📊 Gas 优化

合约已进行 Gas 优化，使用以下策略：

- 批量操作减少存储操作
- 优化数据结构和循环
- 使用 view/pure 函数减少 Gas 消耗

运行 Gas 报告：

```bash
npm run test:gas
```

## 🌐 网络配置

### Base Sepolia (测试网)
- RPC: https://sepolia.base.org
- Chain ID: 84532
- 用途: 开发和测试

### Base Mainnet (主网)
- RPC: https://mainnet.base.org
- Chain ID: 8453
- 用途: 生产环境

## 📚 相关文档

- [合约文档](../../../doc/CONTRACT_DOCUMENTATION.md)
- [部署指南](../../../doc/BASE_SEPOLIA_TESTING_GUIDE.md)
- [MVP 开发方案](../../../doc/MVP_PLAN_V3.md)

## 🤝 贡献指南

1. 创建新分支进行开发
2. 确保所有测试通过
3. 提交 Pull Request
4. 等待审核和合并

## 📄 许可证

MIT

## 👥 联系方式

- GitHub Issues: 报告 Bug 或提出功能建议
- 文档: 查看 `doc/` 目录了解更多信息

---

**最后更新**: 2025-10-19
