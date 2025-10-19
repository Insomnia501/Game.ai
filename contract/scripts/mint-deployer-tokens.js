/**
 * 给 deployer 分配 GAME 代币脚本
 * 用于后端开发测试
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("  🚀 为 Deployer 分配 GAME 代币");
  console.log("=".repeat(80) + "\n");

  // 获取签名者
  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 部署者地址:", deployer.address);

  // 读取部署信息
  const deploymentPath = path.join(__dirname, "../deployments/baseSepolia.json");

  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ 错误: 找不到部署文件:", deploymentPath);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const gameTokenAddress = deployment.contracts?.gameToken;

  if (!gameTokenAddress) {
    console.error("❌ 错误: 部署文件中找不到 gameToken 地址");
    process.exit(1);
  }

  console.log("📋 GAME Token 地址:", gameTokenAddress);

  // 获取 GAME Token 合约实例
  const GameToken = await hre.ethers.getContractAt("MockERC20", gameTokenAddress);

  console.log("\n💰 开始为 deployer 分配 GAME 代币...\n");

  try {
    // 分配 1,000,000 GAME 给 deployer
    const gameAmount = hre.ethers.utils.parseEther("1000000");

    // 获取当前 gas price 并提高 10%
    const gasPrice = await hre.ethers.provider.getGasPrice();
    const increasedGasPrice = gasPrice.mul(110).div(100);

    console.log("  ⏳ 执行 mint 交易...");
    console.log("    • 目标地址:", deployer.address);
    console.log("    • 金额: 1,000,000 GAME");
    console.log("    • Gas Price:", hre.ethers.utils.formatUnits(increasedGasPrice, "gwei"), "gwei");

    const tx = await GameToken.mint(deployer.address, gameAmount, {
      gasPrice: increasedGasPrice,
    });

    console.log("  ⏳ 等待交易确认...");
    console.log("    • Tx Hash:", tx.hash);

    const receipt = await tx.wait(1);

    console.log("\n  ✅ 交易成功！");
    console.log("    • Block Number:", receipt.blockNumber);
    console.log("    • Gas Used:", receipt.gasUsed.toString());

    // 验证余额
    console.log("\n🔍 验证 Deployer 余额...\n");
    const balance = await GameToken.balanceOf(deployer.address);
    const balanceFormatted = hre.ethers.utils.formatEther(balance);

    console.log("  ✅ Deployer GAME 余额:", balanceFormatted, "GAME");
    console.log("    • 原始值 (Wei):", balance.toString());

    console.log("\n" + "=".repeat(80));
    console.log("  ✨ GAME 代币分配完成！");
    console.log("=".repeat(80) + "\n");
  } catch (error) {
    console.error("\n❌ 错误:", error.message);
    console.error(error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
