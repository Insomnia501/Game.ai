/**
 * RPC 连接诊断脚本
 * 用于测试和诊断 Base Sepolia RPC 连接问题
 */

const axios = require('axios')
const { ethers } = require('ethers')
require('dotenv').config()

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(color, text) {
  console.log(`${colors[color]}${text}${colors.reset}`)
}

async function diagnoseRPC() {
  log('cyan', '\n' + '='.repeat(80))
  log('cyan', '  🔍 Base Sepolia RPC 连接诊断')
  log('cyan', '='.repeat(80) + '\n')

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY
  const chainId = process.env.CHAIN_ID || '84532'

  log('blue', '📋 环境配置:')
  log('blue', `   RPC URL: ${rpcUrl}`)
  log('blue', `   Chain ID: ${chainId}`)
  log('blue', `   Deployer Key: ${deployerKey ? '✓ 已配置' : '✗ 未配置'}\n`)

  // 测试 1: 网络连接
  log('cyan', '━'.repeat(80))
  log('cyan', '测试 1: 网络连接')
  log('cyan', '━'.repeat(80))

  try {
    const response = await axios.post(
      rpcUrl,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_chainId',
        params: [],
      },
      { timeout: 5000 }
    )

    if (response.data.error) {
      log('red', `✗ RPC 调用出错: ${response.data.error.message}`)
    } else {
      log('green', `✓ RPC 连接成功`)
      log('green', `  Chain ID: 0x${parseInt(response.data.result, 16)}`)
    }
  } catch (error) {
    log('red', `✗ 网络连接失败: ${error.message}`)
    log('yellow', '   可能的原因:')
    log('yellow', '   • 网络不可达')
    log('yellow', '   • URL 错误')
    log('yellow', '   • 防火墙阻止')
  }

  // 测试 2: ethers.js 提供者
  log('\n' + '━'.repeat(80))
  log('cyan', '测试 2: ethers.js 提供者连接')
  log('cyan', '━'.repeat(80))

  try {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
    const network = await provider.getNetwork()
    log('green', `✓ ethers.js 提供者连接成功`)
    log('green', `  网络名称: ${network.name}`)
    log('green', `  Chain ID: ${network.chainId}`)
  } catch (error) {
    log('red', `✗ ethers.js 连接失败: ${error.message}`)
    log('yellow', '   这可能是 ethers.js 特有的问题')
  }

  // 测试 3: 钱包和签名者
  log('\n' + '━'.repeat(80))
  log('cyan', '测试 3: 钱包和签名者')
  log('cyan', '━'.repeat(80))

  if (!deployerKey) {
    log('red', '✗ DEPLOYER_PRIVATE_KEY 未配置')
  } else {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
      const wallet = new ethers.Wallet(deployerKey, provider)
      const address = await wallet.getAddress()
      log('green', `✓ 钱包创建成功`)
      log('green', `  地址: ${address}`)
    } catch (error) {
      log('red', `✗ 钱包创建失败: ${error.message}`)
    }
  }

  // 测试 4: 获取 Gas 价格
  log('\n' + '━'.repeat(80))
  log('cyan', '测试 4: 获取 Gas 价格')
  log('cyan', '━'.repeat(80))

  try {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
    const gasPrice = await provider.getGasPrice()
    log('green', `✓ 获取 Gas 价格成功`)
    log('green', `  Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`)
  } catch (error) {
    log('red', `✗ 获取 Gas 价格失败: ${error.message}`)
  }

  // 测试 5: 替代 RPC 端点
  log('\n' + '━'.repeat(80))
  log('cyan', '测试 5: 测试替代 RPC 端点')
  log('cyan', '━'.repeat(80))

  const alternativeRpcs = [
    { name: 'Quicknode', url: 'https://base-sepolia.g.alchemy.com/v2/demo' },
    { name: 'Alchemy (示例)', url: 'https://base-sepolia.g.alchemy.com/v2/demo' },
    { name: 'Ankr', url: 'https://rpc.ankr.space/base_sepolia' },
    { name: '官方 (直接)', url: 'https://sepolia.base.org' },
  ]

  for (const rpc of alternativeRpcs) {
    try {
      const response = await axios.post(
        rpc.url,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_chainId',
          params: [],
        },
        { timeout: 3000 }
      )

      if (response.data.result) {
        log('green', `✓ ${rpc.name}: 可用`)
      } else {
        log('yellow', `⚠ ${rpc.name}: 无效响应`)
      }
    } catch (error) {
      log('red', `✗ ${rpc.name}: 不可用 (${error.message.substring(0, 40)})`)
    }
  }

  // 最终建议
  log('\n' + '━'.repeat(80))
  log('cyan', '📝 诊断建议')
  log('cyan', '━'.repeat(80))

  log('yellow', '\n✓ 如果所有测试都失败:')
  log('yellow', '  1. 检查网络连接 (ping 8.8.8.8)')
  log('yellow', '  2. 检查 VPN 是否启用')
  log('yellow', '  3. 尝试使用替代 RPC 端点')
  log('yellow', '  4. 检查防火墙设置')

  log('yellow', '\n✓ 推荐的 Base Sepolia RPC 端点:')
  log('yellow', '  • Alchemy: https://base-sepolia.g.alchemy.com/v2/<YOUR_KEY>')
  log('yellow', '  • Infura: https://base-sepolia.infura.io/v3/<YOUR_KEY>')
  log('yellow', '  • Quicknode: https://base-sepolia.quicknode.pro/...')

  log('\n' + '━'.repeat(80) + '\n')
}

diagnoseRPC().catch((err) => {
  log('red', `诊断失败: ${err.message}`)
  process.exit(1)
})
