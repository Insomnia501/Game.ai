const hre = require("hardhat");

async function main() {
  const signers = await hre.ethers.getSigners();

  if (signers.length < 3) {
    console.error("❌ 错误：需要至少 3 个账号");
    process.exit(1);
  }

  const deployer = signers[0];
  const user1 = signers[1];
  const user2 = signers[2];

  console.log("\n📍 账户 Nonce 检查:");
  console.log("═══════════════════════════════════════════\n");

  const deployerNonce = await hre.ethers.provider.getTransactionCount(deployer.address);
  console.log("部署者 (" + deployer.address + ")");
  console.log("  当前 Nonce: ", deployerNonce);

  const user1Nonce = await hre.ethers.provider.getTransactionCount(user1.address);
  console.log("\n用户 1 (" + user1.address + ")");
  console.log("  当前 Nonce: ", user1Nonce);

  const user2Nonce = await hre.ethers.provider.getTransactionCount(user2.address);
  console.log("\n用户 2 (" + user2.address + ")");
  console.log("  当前 Nonce: ", user2Nonce);

  console.log("\n💡 说明：");
  console.log("  - Nonce 是账户发送的交易计数");
  console.log("  - 如果有待处理交易，Nonce 会保持不变，直到交易完成");
  console.log("  - 运行测试前，所有账户的 Nonce 应该是稳定的");
  console.log("\n═══════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
