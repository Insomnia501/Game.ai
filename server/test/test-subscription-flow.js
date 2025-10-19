/**
 * 测试订阅流程脚本
 * 1. 用户1 转 10 VIRTUAL 代币给收款合约
 * 2. 使用交易哈希调用 API 激活订阅
 */

const ethers = require('ethers')
require('dotenv').config()

// 配置参数
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || process.env.BASE_RPC_URL
const PRIVATE_KEY_USER1 = process.env.PRIVATE_KEY_USER1
const VIRTUAL_TOKEN_ADDRESS = process.env.VIRTUAL_TOKEN_ADDRESS
const INFERENCE_PAYMENT_ADDRESS = process.env.INFERENCE_PAYMENT_ADDRESS

// 测试用户地址
const USER1_ADDRESS = '0x31ca0eecbCF9442e0f9A00ae66aea3622119ccf1'

// ERC20 ABI (用于转账)
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
]

async function testSubscriptionFlow() {
  console.log('════════════════════════════════════════')
  console.log('🧪 测试订阅激活完整流程')
  console.log('════════════════════════════════════════')
  console.log('')

  try {
    // 1. 验证配置
    console.log('📋 验证配置...')
    console.log(`✓ RPC URL: ${RPC_URL}`)
    console.log(`✓ 用户1地址: ${USER1_ADDRESS}`)
    console.log(`✓ VIRTUAL 代币地址: ${VIRTUAL_TOKEN_ADDRESS}`)
    console.log(`✓ 收款合约地址: ${INFERENCE_PAYMENT_ADDRESS}`)
    console.log('')

    // 2. 创建 Provider 和钱包
    console.log('🔐 初始化钱包...')
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
    const wallet = new ethers.Wallet(PRIVATE_KEY_USER1, provider)
    console.log(`✓ 钱包地址: ${wallet.address}`)
    console.log('')

    // 3. 检查余额
    console.log('💰 检查用户1的 VIRTUAL 代币余额...')
    const tokenContract = new ethers.Contract(VIRTUAL_TOKEN_ADDRESS, ERC20_ABI, wallet)
    const balance = await tokenContract.balanceOf(USER1_ADDRESS)
    console.log(`✓ VIRTUAL 余额: ${ethers.utils.formatUnits(balance, 18)} VIRTUAL`)
    console.log('')

    // 4. 转账 10 VIRTUAL
    console.log('💸 转账 10 VIRTUAL 到收款合约...')
    console.log(`  From: ${USER1_ADDRESS}`)
    console.log(`  To: ${INFERENCE_PAYMENT_ADDRESS}`)
    console.log(`  Amount: 10 VIRTUAL`)
    console.log('')

    const amount = ethers.utils.parseUnits('10', 18) // 10 VIRTUAL with 18 decimals
    const tx = await tokenContract.transfer(INFERENCE_PAYMENT_ADDRESS, amount)
    console.log(`✓ 交易已发送，哈希: ${tx.hash}`)
    console.log('')

    // 5. 等待交易确认
    console.log('⏳ 等待交易确认...')
    const receipt = await tx.wait()

    if (!receipt) {
      console.error('❌ 交易确认失败')
      return
    }

    // 使用交易哈希（tx.hash）而不是 receipt.hash
    const txHash = tx.hash
    console.log(`✓ 交易已确认`)
    console.log(`  区块号: ${receipt.blockNumber}`)
    console.log(`  交易哈希: ${txHash}`)
    console.log(`  Gas 使用: ${receipt.gasUsed}`)
    console.log('')

    // 6. 调用 API 2 激活订阅
    console.log('🚀 调用 API 2 激活订阅...')
    console.log(`  用户地址: ${USER1_ADDRESS}`)
    console.log(`  交易哈希: ${txHash}`)
    console.log(`  金额: 10`)
    console.log('')

    const apiResponse = await fetch('http://localhost:3000/api/subscription/activate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userAddress: USER1_ADDRESS,
        transactionHash: txHash,
        amount: '10',
      }),
    })

    const responseData = await apiResponse.json()

    console.log(`✓ API 响应状态: ${apiResponse.status}`)
    console.log(`✓ API 响应数据:`)
    console.log(JSON.stringify(responseData, null, 2))
    console.log('')

    // 7. 验证激活结果
    if (responseData.success) {
      console.log('✅ 订阅激活成功！')
      console.log(`  到期时间: ${new Date(responseData.expiresAt * 1000).toISOString()}`)
      console.log(`  剩余天数: 30`)
    } else {
      console.error('❌ 订阅激活失败')
      console.error(`  错误: ${responseData.error}`)
      if (responseData.details) {
        console.error(`  详情: ${responseData.details}`)
      }
    }

    console.log('')
    console.log('════════════════════════════════════════')
    console.log('✅ 测试流程完成')
    console.log('════════════════════════════════════════')

  } catch (error) {
    console.error('❌ 错误:', error.message)
    if (error.response) {
      console.error('响应数据:', error.response.data)
    }
  }
}

// 运行测试
testSubscriptionFlow().catch(console.error)
