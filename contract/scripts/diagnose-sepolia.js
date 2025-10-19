const hre = require("hardhat");
const path = require("path");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("诊断账户:", deployer.address);
  
  const deploymentPath = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ 未找到部署文件");
    process.exit(1);
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  
  const VirtualToken = await hre.ethers.getContractAt(
    "MockERC20",
    deployment.contracts.virtualToken
  );
  
  const InferencePayment = await hre.ethers.getContractAt(
    "GameInferencePayment",
    deployment.contracts.inferencePayment
  );
  
  const balance = await VirtualToken.balanceOf(deployer.address);
  console.log("用户 VIRTUAL 余额:", hre.ethers.utils.formatEther(balance));
  
  const serviceFee = await InferencePayment.serviceFee();
  console.log("服务费用:", hre.ethers.utils.formatEther(serviceFee));
  
  const allowance = await VirtualToken.allowance(deployer.address, InferencePayment.address);
  console.log("已授权额度:", hre.ethers.utils.formatEther(allowance));
  
  // 尝试批准
  console.log("\n正在授权...");
  try {
    const approveTx = await VirtualToken.approve(InferencePayment.address, serviceFee);
    await approveTx.wait();
    console.log("✅ 授权成功");
    
    const newAllowance = await VirtualToken.allowance(deployer.address, InferencePayment.address);
    console.log("新的授权额度:", hre.ethers.utils.formatEther(newAllowance));
  } catch (e) {
    console.log("❌ 授权失败:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
