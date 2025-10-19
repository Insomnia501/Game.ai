const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 开始部署 GAME.ai 智能合约...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("部署账户:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", hre.ethers.utils.formatEther(balance), "ETH\n");

  // ============ 配置参数 ============

  // $VIRTUAL 代币地址（Base Sepolia 或 Base Mainnet）
  const VIRTUAL_TOKEN_ADDRESS = process.env.VIRTUAL_TOKEN_ADDRESS || "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b";

  // $GAME 代币地址（通过 mock 部署脚本获得）
  const GAME_TOKEN_ADDRESS = process.env.GAME_TOKEN_ADDRESS;

  if (!GAME_TOKEN_ADDRESS) {
    console.log("⚠️  警告: 未设置 GAME_TOKEN_ADDRESS");
    console.log("请先运行 npm run deploy:sepolia:mock，然后设置 .env 中的 GAME_TOKEN_ADDRESS\n");
  }

  // ============ 部署分红池合约 ============

  console.log("📦 部署 GameDividendPool...");
  const GameDividendPool = await hre.ethers.getContractFactory("GameDividendPool");
  const dividendPool = await GameDividendPool.deploy(
    GAME_TOKEN_ADDRESS || hre.ethers.constants.AddressZero, // 如果未设置，使用零地址（仅用于测试）
    VIRTUAL_TOKEN_ADDRESS
  );
  await dividendPool.deployed();
  const dividendPoolAddress = dividendPool.address;
  console.log("✅ GameDividendPool 部署成功:", dividendPoolAddress, "\n");

  // ============ 部署 AI 推理支付合约 ============

  console.log("📦 部署 GameInferencePayment...");
  const GameInferencePayment = await hre.ethers.getContractFactory("GameInferencePayment");
  const inferencePayment = await GameInferencePayment.deploy(
    VIRTUAL_TOKEN_ADDRESS,
    dividendPoolAddress,
    deployer.address // 创作者地址
  );
  await inferencePayment.deployed();
  const inferencePaymentAddress = inferencePayment.address;
  console.log("✅ GameInferencePayment 部署成功:", inferencePaymentAddress, "\n");

  // ============ 保存部署地址 ============

  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      virtualToken: VIRTUAL_TOKEN_ADDRESS,
      gameToken: GAME_TOKEN_ADDRESS || "未设置",
      dividendPool: dividendPoolAddress,
      inferencePayment: inferencePaymentAddress,
    },
    monthlySubscriptionFee: hre.ethers.utils.formatEther(await inferencePayment.getMonthlySubscriptionFee()) + " VIRTUAL",
  };

  const deploymentPath = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("📄 部署信息已保存到:", deploymentPath, "\n");

  // ============ 验证合约（如果在测试网或主网） ============

  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("⏳ 等待区块确认后验证合约...\n");
    // ethers v5 中使用 provider.waitForTransaction()
    const dividendTx = dividendPool.deployTransaction;
    const inferenceTx = inferencePayment.deployTransaction;
    if (dividendTx) await hre.ethers.provider.waitForTransaction(dividendTx.hash, 5);
    if (inferenceTx) await hre.ethers.provider.waitForTransaction(inferenceTx.hash, 5);

    try {
      console.log("🔍 验证 GameDividendPool...");
      await hre.run("verify:verify", {
        address: dividendPoolAddress,
        constructorArguments: [
          GAME_TOKEN_ADDRESS || hre.ethers.constants.AddressZero,
          VIRTUAL_TOKEN_ADDRESS,
        ],
      });
      console.log("✅ GameDividendPool 验证成功\n");
    } catch (error) {
      console.log("❌ GameDividendPool 验证失败:", error.message, "\n");
    }

    try {
      console.log("🔍 验证 GameInferencePayment...");
      await hre.run("verify:verify", {
        address: inferencePaymentAddress,
        constructorArguments: [
          VIRTUAL_TOKEN_ADDRESS,
          dividendPoolAddress,
          deployer.address,
        ],
      });
      console.log("✅ GameInferencePayment 验证成功\n");
    } catch (error) {
      console.log("❌ GameInferencePayment 验证失败:", error.message, "\n");
    }
  }

  // ============ 部署总结 ============

  console.log("═══════════════════════════════════════════");
  console.log("✨ 部署完成！");
  console.log("═══════════════════════════════════════════");
  console.log("网络:", hre.network.name);
  console.log("创作者:", deployer.address);
  console.log("\n📋 合约地址:");
  console.log("  $VIRTUAL Token:", VIRTUAL_TOKEN_ADDRESS);
  console.log("  $GAME Token:", GAME_TOKEN_ADDRESS || "⚠️  未设置");
  console.log("  DividendPool:", dividendPoolAddress);
  console.log("  InferencePayment:", inferencePaymentAddress);
  console.log("\n⚙️  配置信息:");
  console.log("  月度订阅费用:", hre.ethers.utils.formatEther(await inferencePayment.getMonthlySubscriptionFee()), "VIRTUAL");
  console.log("  创作者分成: 30%");
  console.log("  持有者分成: 70%");
  console.log("═══════════════════════════════════════════\n");

  if (!GAME_TOKEN_ADDRESS) {
    console.log("📝 下一步操作:");
    console.log("1. 在 Virtuals Protocol 创建 AI Agent");
    console.log("2. 获取 $GAME 代币地址");
    console.log("3. 更新 .env 中的 GAME_TOKEN_ADDRESS");
    console.log("4. 重新部署合约或更新前端配置\n");
  } else {
    console.log("📝 部署信息已保存:");
    console.log("1. 合约地址已保存到: deployments/baseSepolia.json");
    console.log("2. 可以开始运行测试: npm run test:subscription\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
