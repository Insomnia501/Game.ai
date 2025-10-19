const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Mock 代币部署脚本
 * 用于 Base Sepolia 测试：部署 Mock $VIRTUAL 和 Mock $WATCH 代币
 * 这两个 Mock 代币将代替 Virtuals Protocol 的真实代币用于测试
 */

async function main() {
  console.log("🚀 开始部署 Mock 代币到 Base Sepolia...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("部署账户:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", hre.ethers.utils.formatEther(balance), "ETH\n");

  // ============ 部署 Mock $VIRTUAL 代币 ============

  console.log("📦 部署 Mock $VIRTUAL 代币...");
  const MockVIRTUAL = await hre.ethers.getContractFactory("MockERC20");
  const virtualToken = await MockVIRTUAL.deploy(
    "Virtual Token",
    "VIRTUAL",
    hre.ethers.utils.parseEther("1000000") // 初始供应量：100 万 VIRTUAL
  );
  await virtualToken.deployed();
  const virtualAddress = virtualToken.address;
  console.log("✅ Mock $VIRTUAL 部署成功:", virtualAddress);
  console.log("   初始供应量: 1,000,000 VIRTUAL\n");

  // ============ 部署 Mock $GAME 代币 ============

  console.log("📦 部署 Mock $GAME 代币...");
  const MockGAME = await hre.ethers.getContractFactory("MockERC20");
  const gameToken = await MockGAME.deploy(
    "GAME Token",
    "GAME",
    hre.ethers.utils.parseEther("1000000000") // 初始供应量：10 亿 GAME
  );
  await gameToken.deployed();
  const gameAddress = gameToken.address;
  console.log("✅ Mock $GAME 部署成功:", gameAddress);
  console.log("   初始供应量: 1,000,000,000 GAME\n");

  // ============ 保存部署地址 ============

  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    mockTokens: {
      virtualToken: virtualAddress,
      gameToken: gameAddress,
    },
    nextSteps: {
      1: "复制这两个地址到 .env 文件中的 VIRTUAL_TOKEN_ADDRESS 和 GAME_TOKEN_ADDRESS",
      2: "运行 npm run deploy:sepolia 部署主合约",
    }
  };

  const deploymentPath = path.join(__dirname, "..", "deployments", `${hre.network.name}-mock.json`);
  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("📄 部署信息已保存到:", deploymentPath, "\n");

  // ============ 部署总结 ============

  console.log("═══════════════════════════════════════════");
  console.log("✨ Mock 代币部署完成！");
  console.log("═══════════════════════════════════════════");
  console.log("网络:", hre.network.name);
  console.log("\n📋 Mock 代币地址:");
  console.log("  $VIRTUAL Mock:", virtualAddress);
  console.log("  $GAME Mock:", gameAddress);
  console.log("\n📝 下一步操作:");
  console.log("1️⃣  将以下内容添加到 .env 文件:");
  console.log(`   VIRTUAL_TOKEN_ADDRESS=${virtualAddress}`);
  console.log(`   GAME_TOKEN_ADDRESS=${gameAddress}`);
  console.log("\n2️⃣  运行主合约部署:");
  console.log("   npm run deploy:sepolia");
  console.log("═══════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
