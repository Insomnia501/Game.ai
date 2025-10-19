const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 包月订阅完整测试脚本
 * 用于测试新的 GameInferencePayment 包月订阅合约
 *
 * 测试流程：
 * 1. 准备测试数据（代币余额）
 * 2. 用户进行包月订阅支付
 * 3. 收益自动分配（30% 创作者，70% 分红池）
 * 4. 验证统计数据
 * 5. 用户提取分红
 */

// ============ 工具函数 ============

/**
 * 等待账户 nonce 稳定
 * 在网络中有待处理交易时，nonce 不会增加
 */
async function waitForNonceStable(signer, maxWait = 60000) {
  const startTime = Date.now();
  let lastNonce = -1;
  let stableCount = 0;

  while (Date.now() - startTime < maxWait) {
    const currentNonce = await hre.ethers.provider.getTransactionCount(signer.address);

    if (currentNonce === lastNonce) {
      stableCount++;
      if (stableCount >= 3) {
        return true; // Nonce 已稳定
      }
    } else {
      lastNonce = currentNonce;
      stableCount = 0;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return false;
}

/**
 * 带重试机制的交易执行函数
 * 处理 nonce 冲突和其他临时错误
 */
async function executeTransaction(txFn, description, maxRetries = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const tx = await txFn();
      const receipt = await tx.wait();
      return receipt;
    } catch (error) {
      lastError = error;
      const errorCode = error.code;
      const errorMsg = error.message || "";

      // 对于 nonce 错误，等待后重试
      if (errorCode === "NONCE_EXPIRED" || errorMsg.includes("nonce")) {
        if (attempt < maxRetries) {
          console.log(`    ⚠️  ${description} 遇到 nonce 冲突，${3 * attempt} 秒后重试（第 ${attempt + 1}/${maxRetries} 次）...`);
          await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
          continue;
        }
      }

      // 对于 gas 估算错误，也重试
      if (errorCode === "UNPREDICTABLE_GAS_LIMIT") {
        if (attempt < maxRetries) {
          console.log(`    ⚠️  ${description} 遇到 gas 估算问题，${2 * attempt} 秒后重试（第 ${attempt + 1}/${maxRetries} 次）...`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          continue;
        }
      }

      // 其他错误直接返回
      throw error;
    }
  }

  throw lastError;
}

async function main() {
  console.log("\n🧪 GAME.ai 包月订阅测试脚本开始...\n");

  const signers = await hre.ethers.getSigners();

  if (signers.length < 3) {
    console.error("❌ 错误：需要至少 3 个账号（deployer, user1, user2）");
    console.error("请确保 .env 文件中配置了 PRIVATE_KEY, PRIVATE_KEY_USER1, PRIVATE_KEY_USER2");
    process.exit(1);
  }

  const deployer = signers[0];
  const user1 = signers[1];
  const user2 = signers[2];

  console.log("📍 账户信息:");
  console.log("  部署者:     ", deployer.address);
  console.log("  测试用户 1: ", user1.address);
  console.log("  测试用户 2: ", user2.address);
  console.log();

  // 等待账户 nonce 稳定（避免之前的待处理交易干扰）
  console.log("⏳ 等待账户 nonce 稳定（最多 60 秒）...");
  const deployerStable = await waitForNonceStable(deployer);

  if (!deployerStable) {
    console.log("⚠️  警告：部署者账户的 nonce 仍未稳定，可能有待处理交易");
    console.log("💡 提示：脚本会自动重试交易，但如果继续失败，请稍候后重试\n");
  } else {
    console.log("✅ 账户 nonce 已稳定\n");
  }

  // ============ 加载合约地址和部署信息 ============

  const deploymentPath = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);

  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ 未找到部署文件！");
    console.error("请先运行部署脚本:");
    console.error("npm run deploy:sepolia");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  console.log("📋 已加载部署信息:");
  console.log("  GameInferencePayment: ", deployment.contracts.inferencePayment);
  console.log("  GameDividendPool:     ", deployment.contracts.dividendPool);
  console.log("  VIRTUAL Token:        ", deployment.contracts.virtualToken);
  console.log("  GAME Token:           ", deployment.contracts.gameToken || "未部署");
  console.log();

  // ============ 获取合约实例 ============

  const InferencePayment = await hre.ethers.getContractAt(
    "GameInferencePayment",
    deployment.contracts.inferencePayment
  );

  const DividendPool = await hre.ethers.getContractAt(
    "GameDividendPool",
    deployment.contracts.dividendPool
  );

  const VirtualToken = await hre.ethers.getContractAt(
    "MockERC20",
    deployment.contracts.virtualToken
  );

  const GameToken = deployment.contracts.gameToken
    ? await hre.ethers.getContractAt("MockERC20", deployment.contracts.gameToken)
    : null;

  // ============ 阶段 1: 准备测试数据 ============

  console.log("📦 阶段 1: 准备测试数据\n");

  // 1.1 为用户分配 $GAME 代币（用于分红池）
  if (GameToken) {
    console.log("  💰 为用户分配 $GAME 代币（分红池持有）...");
    try {
      const gameAmount = hre.ethers.utils.parseEther("100000"); // 每个用户 10 万 $GAME

      // 获取当前 gas price 并提高 10%
      const gasPrice = await hre.ethers.provider.getGasPrice();
      const increasedGasPrice = gasPrice.mul(110).div(100);

      // 使用重试机制分配代币给 user1
      await executeTransaction(
        () => GameToken.mint(user1.address, gameAmount, { gasPrice: increasedGasPrice }),
        "GAME mint for user1"
      );

      // 等待 1 秒避免 nonce 冲突
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 使用重试机制分配代币给 user2
      await executeTransaction(
        () => GameToken.mint(user2.address, gameAmount, { gasPrice: increasedGasPrice }),
        "GAME mint for user2"
      );

      console.log("    ✅ User1 获得 100,000 GAME");
      console.log("    ✅ User2 获得 100,000 GAME\n");
    } catch (error) {
      console.log("    ⚠️  分配 GAME 失败:", error.message);
      console.log("    继续进行测试\n");
    }
  }

  // 1.2 为用户分配 $VIRTUAL 代币（用于订阅支付）
  console.log("  💳 为用户分配 $VIRTUAL 代币（用于订阅支付）...");
  try {
    const virtualAmount = hre.ethers.utils.parseEther("200"); // 每个用户 200 $VIRTUAL

    // 获取当前 gas price 并提高 10%
    const gasPrice = await hre.ethers.provider.getGasPrice();
    const increasedGasPrice = gasPrice.mul(110).div(100);

    // 使用重试机制分配代币给 user1
    await executeTransaction(
      () => VirtualToken.mint(user1.address, virtualAmount, { gasPrice: increasedGasPrice }),
      "VIRTUAL mint for user1"
    );

    // 等待 1 秒避免 nonce 冲突
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 使用重试机制分配代币给 user2
    await executeTransaction(
      () => VirtualToken.mint(user2.address, virtualAmount, { gasPrice: increasedGasPrice }),
      "VIRTUAL mint for user2"
    );

    console.log("    ✅ User1 获得 200 VIRTUAL");
    console.log("    ✅ User2 获得 200 VIRTUAL\n");
  } catch (error) {
    console.log("    ❌ 分配 VIRTUAL 失败:", error.message);
    console.log("    跳过测试\n");
    process.exit(1);
  }

  // ============ 阶段 2: 获取订阅费用 ============

  console.log("💬 阶段 2: 获取订阅参数\n");

  const subscriptionFee = await InferencePayment.getMonthlySubscriptionFee();
  console.log("  📊 月度订阅费用: ", hre.ethers.utils.formatEther(subscriptionFee), "VIRTUAL");
  console.log("  • 创作者分成 (30%): ", hre.ethers.utils.formatEther(subscriptionFee.mul(30).div(100)), "VIRTUAL");
  console.log("  • 分红池分成 (70%): ", hre.ethers.utils.formatEther(subscriptionFee.mul(70).div(100)), "VIRTUAL\n");

  // ============ 阶段 3: 用户进行包月订阅 ============

  console.log("📱 阶段 3: 用户进行包月订阅支付\n");

  // 3.1 User1 第一次订阅
  console.log("  🎯 User1 进行包月订阅 - 订阅 1...");
  try {
    const user1VirtualBefore = await VirtualToken.balanceOf(user1.address);
    console.log("    User1 VIRTUAL 余额: ", hre.ethers.utils.formatEther(user1VirtualBefore));

    // 获取最新费用（防止费用变更导致的问题）
    const currentFee = await InferencePayment.getMonthlySubscriptionFee();

    // 授权时使用大额度（避免精确值导致的问题）
    const gasPrice = await hre.ethers.provider.getGasPrice();
    const increasedGasPrice = gasPrice.mul(110).div(100);

    const approveAmount = currentFee.mul(2); // 授权 2 倍金额以应对费用变更
    const approveTx1 = await VirtualToken.connect(user1).approve(
      InferencePayment.address,
      approveAmount,
      { gasPrice: increasedGasPrice }
    );
    await approveTx1.wait();
    console.log("    ✅ 授权成功");

    // 订阅
    const tx1 = await InferencePayment.connect(user1).subscribeMonthly({ gasPrice: increasedGasPrice });
    const receipt1 = await tx1.wait();
    console.log("    ✅ 订阅成功!");
    console.log("       交易哈希: ", receipt1.transactionHash);

    const user1VirtualAfter = await VirtualToken.balanceOf(user1.address);
    console.log("       新余额:   ", hre.ethers.utils.formatEther(user1VirtualAfter), "VIRTUAL\n");
  } catch (error) {
    console.log("    ❌ 订阅失败:", error.message);
    console.log("    跳过后续测试\n");
    process.exit(1);
  }

  // 3.2 User2 订阅
  console.log("  🎯 User2 进行包月订阅 - 订阅 1...");
  try {
    const currentFee2 = await InferencePayment.getMonthlySubscriptionFee();

    // 等待 2 秒避免与前一个交易冲突
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 获取更高的 gas price（更激进的 15% 提升）
    const gasPrice = await hre.ethers.provider.getGasPrice();
    const increasedGasPrice = gasPrice.mul(115).div(100);

    const approveAmount2 = currentFee2.mul(3); // 3 倍授权更安全
    const approveTx2 = await executeTransaction(
      () => VirtualToken.connect(user2).approve(InferencePayment.address, approveAmount2, { gasPrice: increasedGasPrice }),
      "User2 approve"
    );

    // 等待 1 秒
    await new Promise(resolve => setTimeout(resolve, 1000));

    const tx2 = await executeTransaction(
      () => InferencePayment.connect(user2).subscribeMonthly({ gasPrice: increasedGasPrice }),
      "User2 subscribe"
    );
    console.log("    ✅ 订阅成功!\n");
  } catch (error) {
    console.log("    ❌ 订阅失败:", error.message, "\n");
  }

  // 3.3 User1 再订阅一次
  console.log("  🎯 User1 进行包月订阅 - 订阅 2（续费）...");
  try {
    const currentFee3 = await InferencePayment.getMonthlySubscriptionFee();

    // 等待 2 秒避免与前一个交易冲突
    await new Promise(resolve => setTimeout(resolve, 2000));

    const gasPrice = await hre.ethers.provider.getGasPrice();
    const increasedGasPrice = gasPrice.mul(115).div(100);

    const approveAmount3 = currentFee3.mul(3);
    const approveTx3 = await executeTransaction(
      () => VirtualToken.connect(user1).approve(InferencePayment.address, approveAmount3, { gasPrice: increasedGasPrice }),
      "User1 approve for renewal"
    );

    // 等待 1 秒
    await new Promise(resolve => setTimeout(resolve, 1000));

    const tx3 = await executeTransaction(
      () => InferencePayment.connect(user1).subscribeMonthly({ gasPrice: increasedGasPrice }),
      "User1 renew subscription"
    );
    console.log("    ✅ 续费成功!\n");
  } catch (error) {
    console.log("    ❌ 续费失败:", error.message, "\n");
  }

  // ============ 阶段 4: 验证统计数据 ============

  console.log("📊 阶段 4: 验证统计数据\n");

  // 4.1 查询 InferencePayment 统计
  const stats = await InferencePayment.getStats();
  console.log("  📈 订阅统计 (GameInferencePayment):");
  console.log("    • 总订阅次数:     ", stats[0].toString());
  console.log("    • 总收入:         ", hre.ethers.utils.formatEther(stats[1]), "VIRTUAL");
  console.log("    • 创作者累计收益: ", hre.ethers.utils.formatEther(stats[2]), "VIRTUAL (30%)");
  console.log("    • 分红池累计分配: ", hre.ethers.utils.formatEther(stats[3]), "VIRTUAL (70%)\n");

  // 4.2 查询分红池统计
  const poolStats = await DividendPool.getPoolStats();
  console.log("  💰 分红池统计 (GameDividendPool):");
  console.log("    • 累积分红池:     ", hre.ethers.utils.formatEther(poolStats[0]), "VIRTUAL");
  console.log("    • 累计已提取:     ", hre.ethers.utils.formatEther(poolStats[1]), "VIRTUAL");
  console.log("    • 待提取分红:     ", hre.ethers.utils.formatEther(poolStats[2]), "VIRTUAL");
  console.log("    • 每股累积分红:   ", poolStats[3].toString(), "(精度 1e18)\n");

  // ============ 阶段 5: 查询用户可提取分红 ============

  console.log("🔍 阶段 5: 查询用户可提取分红\n");

  const pendingUser1 = await DividendPool.getPendingDividend(user1.address);
  const pendingUser2 = await DividendPool.getPendingDividend(user2.address);

  console.log("  User1 可提取分红: ", hre.ethers.utils.formatEther(pendingUser1), "VIRTUAL");
  console.log("  User2 可提取分红: ", hre.ethers.utils.formatEther(pendingUser2), "VIRTUAL\n");

  // ============ 阶段 6: 用户提取分红 ============

  console.log("💸 阶段 6: 用户提取分红\n");

  let user1VirtualBefore = hre.ethers.BigNumber.from(0);
  let user1VirtualAfter = hre.ethers.BigNumber.from(0);
  let user1Claimed = hre.ethers.BigNumber.from(0);

  // 6.1 User1 提取分红
  console.log("  🎁 User1 提取分红...");
  try {
    const gasPrice = await hre.ethers.provider.getGasPrice();
    const increasedGasPrice = gasPrice.mul(110).div(100);

    user1VirtualBefore = await VirtualToken.balanceOf(user1.address);
    const tx4 = await DividendPool.connect(user1).claimDividend({ gasPrice: increasedGasPrice });
    await tx4.wait();
    user1VirtualAfter = await VirtualToken.balanceOf(user1.address);
    user1Claimed = user1VirtualAfter.sub(user1VirtualBefore);
    console.log("    ✅ 提取成功!");
    console.log("       提取金额: ", hre.ethers.utils.formatEther(user1Claimed), "VIRTUAL");
    console.log("       新余额:   ", hre.ethers.utils.formatEther(user1VirtualAfter), "VIRTUAL\n");
  } catch (error) {
    console.log("    ⚠️  提取失败:", error.message);
    user1VirtualAfter = await VirtualToken.balanceOf(user1.address);
    console.log("       当前余额: ", hre.ethers.utils.formatEther(user1VirtualAfter), "VIRTUAL\n");
  }

  // 6.2 User2 提取分红
  let user2VirtualBefore = hre.ethers.BigNumber.from(0);
  let user2VirtualAfter = hre.ethers.BigNumber.from(0);
  let user2Claimed = hre.ethers.BigNumber.from(0);

  console.log("  🎁 User2 提取分红...");
  try {
    const gasPrice = await hre.ethers.provider.getGasPrice();
    const increasedGasPrice = gasPrice.mul(110).div(100);

    user2VirtualBefore = await VirtualToken.balanceOf(user2.address);
    const tx5 = await DividendPool.connect(user2).claimDividend({ gasPrice: increasedGasPrice });
    await tx5.wait();
    user2VirtualAfter = await VirtualToken.balanceOf(user2.address);
    user2Claimed = user2VirtualAfter.sub(user2VirtualBefore);
    console.log("    ✅ 提取成功!");
    console.log("       提取金额: ", hre.ethers.utils.formatEther(user2Claimed), "VIRTUAL");
    console.log("       新余额:   ", hre.ethers.utils.formatEther(user2VirtualAfter), "VIRTUAL\n");
  } catch (error) {
    console.log("    ⚠️  提取失败:", error.message);
    user2VirtualAfter = await VirtualToken.balanceOf(user2.address);
    console.log("       当前余额: ", hre.ethers.utils.formatEther(user2VirtualAfter), "VIRTUAL\n");
  }

  // ============ 阶段 7: 测试管理功能 ============

  console.log("⚙️  阶段 7: 测试管理功能\n");

  // 7.1 查询当前订阅费用
  console.log("  📋 获取当前订阅费用...");
  try {
    const currentFee = await InferencePayment.getMonthlySubscriptionFee();
    console.log("    ✅ 当前月度费用: ", hre.ethers.utils.formatEther(currentFee), "VIRTUAL\n");
  } catch (error) {
    console.log("    ❌ 查询失败:", error.message, "\n");
  }

  // 7.2 更新订阅费用（需要创作者权限）
  console.log("  💰 尝试更新订阅费用 (deployer 作为 owner)...");
  try {
    const gasPrice = await hre.ethers.provider.getGasPrice();
    const increasedGasPrice = gasPrice.mul(110).div(100);

    const newFee = hre.ethers.utils.parseEther("15"); // 新费用为 15 VIRTUAL
    const updateTx = await InferencePayment.updateSubscriptionFee(newFee, { gasPrice: increasedGasPrice });
    await updateTx.wait();

    const updatedFee = await InferencePayment.getMonthlySubscriptionFee();
    console.log("    ✅ 费用已更新!");
    console.log("       新费用: ", hre.ethers.utils.formatEther(updatedFee), "VIRTUAL\n");
  } catch (error) {
    console.log("    ❌ 更新失败:", error.message, "\n");
  }

  // ============ 阶段 8: 最终统计 ============

  console.log("✨ 阶段 8: 最终统计\n");

  const finalStats = await InferencePayment.getStats();
  const finalPoolStats = await DividendPool.getPoolStats();

  const testResult = {
    timestamp: new Date().toISOString(),
    network: hre.network.name,
    contractAddresses: {
      inferencePayment: deployment.contracts.inferencePayment,
      dividendPool: deployment.contracts.dividendPool,
      virtualToken: deployment.contracts.virtualToken,
      gameToken: deployment.contracts.gameToken,
    },
    testData: {
      subscriptions: finalStats[0].toString(),
      totalRevenue: hre.ethers.utils.formatEther(finalStats[1]),
      creatorEarned: hre.ethers.utils.formatEther(finalStats[2]),
      dividendDistributed: hre.ethers.utils.formatEther(finalStats[3]),
      poolTotal: hre.ethers.utils.formatEther(finalPoolStats[0]),
      totalClaimed: hre.ethers.utils.formatEther(finalPoolStats[1]),
      pendingDividend: hre.ethers.utils.formatEther(finalPoolStats[2]),
    },
    userResults: {
      user1: {
        address: user1.address,
        virtualBalance: hre.ethers.utils.formatEther(user1VirtualAfter),
        claimedDividend: hre.ethers.utils.formatEther(user1Claimed),
      },
      user2: {
        address: user2.address,
        virtualBalance: hre.ethers.utils.formatEther(user2VirtualAfter),
        claimedDividend: hre.ethers.utils.formatEther(user2Claimed),
      },
    },
  };

  console.log("═══════════════════════════════════════════════════════════");
  console.log("✅ 包月订阅测试完成！");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("\n📊 最终统计数据:");
  console.log("\n  📱 订阅信息:");
  console.log("    • 总订阅次数:         ", finalStats[0].toString());
  console.log("    • 总收入:             ", hre.ethers.utils.formatEther(finalStats[1]), "VIRTUAL");
  console.log("    • 创作者累计收益:     ", hre.ethers.utils.formatEther(finalStats[2]), "VIRTUAL (30%)");
  console.log("    • 分红池累计分配:     ", hre.ethers.utils.formatEther(finalStats[3]), "VIRTUAL (70%)");

  console.log("\n  💰 分红信息:");
  console.log("    • 分红池总额:         ", hre.ethers.utils.formatEther(finalPoolStats[0]), "VIRTUAL");
  console.log("    • 用户已提取:         ", hre.ethers.utils.formatEther(finalPoolStats[1]), "VIRTUAL");
  console.log("    • 待提取分红:         ", hre.ethers.utils.formatEther(finalPoolStats[2]), "VIRTUAL");

  console.log("\n  👥 用户结果:");
  console.log("    User1:");
  console.log("      • 地址:             ", user1.address);
  console.log("      • 剩余 VIRTUAL:     ", hre.ethers.utils.formatEther(user1VirtualAfter));
  console.log("      • 获得分红:         ", hre.ethers.utils.formatEther(user1Claimed), "VIRTUAL");

  console.log("\n    User2:");
  console.log("      • 地址:             ", user2.address);
  console.log("      • 剩余 VIRTUAL:     ", hre.ethers.utils.formatEther(user2VirtualAfter));
  console.log("      • 获得分红:         ", hre.ethers.utils.formatEther(user2Claimed), "VIRTUAL");

  console.log("\n═══════════════════════════════════════════════════════════\n");

  // 保存测试结果
  const resultPath = path.join(__dirname, "..", "test-results", `subscription-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(resultPath), { recursive: true });
  fs.writeFileSync(resultPath, JSON.stringify(testResult, null, 2));
  console.log("📄 测试结果已保存到: ", resultPath, "\n");
}

main()
  .then(() => {
    console.log("✨ 测试执行完成\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ 测试执行出错:", error.message);
    console.error(error);
    process.exit(1);
  });
