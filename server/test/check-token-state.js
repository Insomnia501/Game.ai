/**
 * 检查 Base Sepolia 上的代币和合约状态
 */

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

async function checkTokenState() {
  log('cyan', '\n' + '='.repeat(80))
  log('cyan', '  🔍 Base Sepolia 代币和合约状态检查')
  log('cyan', '='.repeat(80) + '\n')

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL
  const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY
  const gameTokenAddress = process.env.GAME_TOKEN_ADDRESS
  const chainId = process.env.CHAIN_ID

  log('blue', '📋 配置信息:')
  log('blue', `   RPC: ${rpcUrl}`)
  log('blue', `   Chain ID: ${chainId}`)
  log('blue', `   GAME Token: ${gameTokenAddress}`)
  log('blue', `   Deployer Key: ${deployerPrivateKey ? '✓ 配置' : '✗ 未配置'}\n`)

  if (!deployerPrivateKey) {
    log('red', '✗ 部署者私钥未配置')
    return
  }

  try {
    // 创建提供者
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
    const wallet = new ethers.Wallet(deployerPrivateKey, provider)
    const deployerAddress = await wallet.getAddress()

    log('cyan', '━'.repeat(80))
    log('cyan', '账户信息')
    log('cyan', '━'.repeat(80))

    log('blue', `Deployer Address: ${deployerAddress}`)

    // 检查原生代币余额（ETH）
    try {
      const ethBalance = await provider.getBalance(deployerAddress)
      const ethBalanceFormatted = ethers.utils.formatEther(ethBalance)
      log('green', `✓ ETH 余额: ${ethBalanceFormatted} ETH`)
    } catch (error) {
      log('red', `✗ 无法查询 ETH 余额: ${error.message}`)
    }

    // 检查 GAME 代币合约
    log('\n' + '━'.repeat(80))
    log('cyan', 'GAME 代币合约')
    log('cyan', '━'.repeat(80))

    const ERC20_ABI = [
      'function name() public view returns (string)',
      'function symbol() public view returns (string)',
      'function decimals() public view returns (uint8)',
      'function totalSupply() public view returns (uint256)',
      'function balanceOf(address account) public view returns (uint256)',
    ]

    try {
      const gameToken = new ethers.Contract(
        gameTokenAddress,
        ERC20_ABI,
        provider
      )

      try {
        const name = await gameToken.name()
        log('green', `✓ 代币名称: ${name}`)
      } catch (e) {
        log('yellow', `⚠ 无法读取代币名称`)
      }

      try {
        const symbol = await gameToken.symbol()
        log('green', `✓ 代币符号: ${symbol}`)
      } catch (e) {
        log('yellow', `⚠ 无法读取代币符号`)
      }

      try {
        const decimals = await gameToken.decimals()
        log('green', `✓ 小数位数: ${decimals}`)
      } catch (e) {
        log('yellow', `⚠ 无法读取小数位数`)
      }

      try {
        const balance = await gameToken.balanceOf(deployerAddress)
        const balanceFormatted = ethers.utils.formatUnits(balance, 18)
        log('green', `✓ Deployer GAME 余额: ${balanceFormatted} GAME`)

        if (balance.eq(0)) {
          log('yellow', '⚠️ Deployer 没有 GAME 代币')
          log('yellow', '   → 这可能是转账失败的原因')
        }
      } catch (e) {
        log('red', `✗ 无法查询 GAME 余额: ${e.message}`)
      }
    } catch (error) {
      log('red', `✗ 无法创建代币合约实例: ${error.message}`)
      log('yellow', '   → 合约可能未部署或地址错误')
    }

    // 检查网络连接
    log('\n' + '━'.repeat(80))
    log('cyan', '网络诊断')
    log('cyan', '━'.repeat(80))

    try {
      const network = await provider.getNetwork()
      log('green', `✓ 网络名称: ${network.name}`)
      log('green', `✓ Chain ID: ${network.chainId}`)
    } catch (error) {
      log('red', `✗ 网络检测失败: ${error.message}`)
    }

    try {
      const blockNumber = await provider.getBlockNumber()
      log('green', `✓ 当前区块: ${blockNumber}`)
    } catch (error) {
      log('red', `✗ 无法获取区块号: ${error.message}`)
    }

    try {
      const gasPrice = await provider.getGasPrice()
      const gasPriceGwei = ethers.utils.formatUnits(gasPrice, 'gwei')
      log('green', `✓ Gas 价格: ${gasPriceGwei} gwei`)
    } catch (error) {
      log('red', `✗ 无法获取 Gas 价格: ${error.message}`)
    }

    log('\n' + '━'.repeat(80))
  } catch (error) {
    log('red', `错误: ${error.message}`)
    console.error(error)
  }

  log('\n')
}

checkTokenState()
