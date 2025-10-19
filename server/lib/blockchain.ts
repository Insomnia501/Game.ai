/**
 * 区块链交互模块
 * 用于与智能合约交互，进行代币转账等操作
 */

import { ethers } from 'ethers'

/**
 * IERC20 标准接口 ABI
 */
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) public returns (bool)',
  'function balanceOf(address account) public view returns (uint256)',
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function allowance(address owner, address spender) public view returns (uint256)',
]

/**
 * GameDividendPool 合约 ABI（只需要调用的方法）
 */
const DIVIDEND_POOL_ABI = [
  'function depositDividend(uint256 amount) external',
  'function claimDividend() external nonReentrant returns (uint256 claimable)',
  'function getPendingDividend(address user) external view returns (uint256)',
  'function getUserDividendInfo(address user) external view returns (uint256 pending, uint256 claimed, uint256 gameBalance)',
  'function getPoolStats() external view returns (uint256 _totalDividendPool, uint256 _totalClaimed, uint256 _totalPending, uint256 _totalDividendPerShare)',
]

/**
 * 区块链客户端配置
 */
interface BlockchainConfig {
  rpcUrl: string
  privateKey: string
  chainId: number
}

/**
 * 区块链客户端类
 */
export class BlockchainClient {
  private provider: ethers.providers.JsonRpcProvider
  private signer: ethers.Signer
  private rpcUrl: string
  private privateKey: string

  constructor(config: BlockchainConfig) {
    this.rpcUrl = config.rpcUrl
    this.privateKey = config.privateKey
    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl)
    this.signer = new ethers.Wallet(config.privateKey, this.provider)
    // 注意：chainId 目前未使用，可在未来需要时启用
  }

  /**
   * 执行原始 JSON-RPC 调用
   */
  private async callJsonRpc(method: string, params: any[]): Promise<any> {
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
    })

    const data = await response.json()
    if (data.error) {
      throw new Error(`JSON-RPC Error: ${data.error.message}`)
    }
    return data.result
  }

  /**
   * 转账 ERC20 代币
   * @param tokenAddress 代币合约地址
   * @param toAddress 接收地址
   * @param amount 转账数量（单位：Wei）
   * @returns 交易哈希
   */
  async transferERC20(
    tokenAddress: string,
    toAddress: string,
    amount: string
  ): Promise<{ transactionHash: string; blockNumber?: number }> {
    try {
      console.log('[Blockchain] 准备转账 ERC20 代币')
      console.log('[Blockchain] 代币地址:', tokenAddress)
      console.log('[Blockchain] 接收地址:', toAddress)
      console.log('[Blockchain] 转账数量:', amount)

      // 验证地址格式
      if (!ethers.utils.isAddress(tokenAddress)) {
        throw new Error('Invalid token address format')
      }
      if (!ethers.utils.isAddress(toAddress)) {
        throw new Error('Invalid recipient address format')
      }

      // 使用底层JSON-RPC调用而不是ethers.js Contract接口
      // 以避免网络检测的问题
      console.log('[Blockchain] 使用 JSON-RPC 构建转账交易...')

      // 创建钱包用于签名
      const wallet = new ethers.Wallet(this.privateKey)

      // 使用直接的 JSON-RPC 调用而不是通过 provider 接口
      // 这样可以避免 ethers.js 的网络检测问题
      console.log('[Blockchain] 通过原始 JSON-RPC 获取交易数据...')

      let nonce: number
      let gasPriceWei: ethers.BigNumber

      try {
        // 直接调用 JSON-RPC
        const nonceHex = await this.callJsonRpc('eth_getTransactionCount', [wallet.address, 'latest'])
        nonce = parseInt(nonceHex, 16)
        console.log('[Blockchain] 获取 Nonce:', nonce)
      } catch (error) {
        console.warn('[Blockchain] 无法获取 Nonce，使用默认值 0')
        nonce = 0
      }

      try {
        const gasPriceHex = await this.callJsonRpc('eth_gasPrice', [])
        gasPriceWei = ethers.BigNumber.from(gasPriceHex)
        console.log('[Blockchain] 获取 Gas Price:', ethers.utils.formatUnits(gasPriceWei, 'gwei'), 'gwei')
      } catch (error) {
        console.warn('[Blockchain] 无法获取 Gas Price，使用默认值 1 gwei')
        gasPriceWei = ethers.utils.parseUnits('1', 'gwei')
      }

      const gasLimit = ethers.BigNumber.from('100000')

      console.log('[Blockchain] 交易参数:')
      console.log('  • Nonce:', nonce)
      console.log('  • Gas Price:', ethers.utils.formatUnits(gasPriceWei, 'gwei'), 'gwei')
      console.log('  • Gas Limit:', gasLimit.toString())

      // 构建 transfer() 函数调用数据
      const iface = new ethers.utils.Interface(ERC20_ABI)
      const data = iface.encodeFunctionData('transfer', [toAddress, amount])

      // 构建交易对象
      const tx = {
        to: tokenAddress,
        from: wallet.address,
        nonce: nonce,
        gasLimit: gasLimit,
        gasPrice: gasPriceWei,
        data: data,
      }

      console.log('[Blockchain] 签名交易...')
      // 签名交易
      const signedTx = await wallet.signTransaction(tx)

      console.log('[Blockchain] 发送签名的交易到网络...')
      // 直接通过 JSON-RPC 发送原始交易，避免 provider 的网络检测
      const txHash = await this.callJsonRpc('eth_sendRawTransaction', [signedTx])
      console.log('[Blockchain] 交易已发送，Hash:', txHash)

      console.log('[Blockchain] 等待交易确认...')
      // 等待交易确认（最多等待 60 秒）
      const maxAttempts = 30
      let receipt: any = null

      for (let i = 0; i < maxAttempts; i++) {
        try {
          const receiptData = await this.callJsonRpc('eth_getTransactionReceipt', [txHash])
          if (receiptData) {
            receipt = receiptData
            console.log('[Blockchain] 交易已确认，区块号:', parseInt(receiptData.blockNumber, 16))
            break
          }
        } catch (error) {
          console.warn('[Blockchain] 等待确认中...', i + 1)
        }
        // 等待 2 秒后重试
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      return {
        transactionHash: txHash,
        blockNumber: receipt ? parseInt(receipt.blockNumber, 16) : undefined,
      }
    } catch (error) {
      const errorMsg = (error as Error).message
      console.error('[Blockchain] 转账失败:', errorMsg)
      throw error
    }
  }

  /**
   * 检查 ERC20 代币余额
   * @param tokenAddress 代币合约地址
   * @param address 账户地址
   * @returns 余额（单位：Wei）
   */
  async getERC20Balance(tokenAddress: string, address: string): Promise<string> {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider)
      const balance = await tokenContract.balanceOf(address)
      return balance.toString()
    } catch (error) {
      console.error('[Blockchain] 查询余额失败:', error)
      throw error
    }
  }

  /**
   * 获取 Deployer 地址
   */
  async getSignerAddress(): Promise<string> {
    return await this.signer.getAddress()
  }

  /**
   * 获取网络信息
   */
  async getNetworkInfo() {
    const network = await this.provider.getNetwork()
    return {
      chainId: network.chainId,
      name: network.name,
    }
  }

  /**
   * 调用 GameDividendPool 的 depositDividend 方法，更新分红
   * @param dividendPoolAddress 分红池合约地址
   * @param amount VIRTUAL 代币金额（Wei 单位）
   * @returns 交易哈希
   */
  async updateGameDividendPool(
    dividendPoolAddress: string,
    amount: string
  ): Promise<{ transactionHash: string; blockNumber?: number }> {
    try {
      console.log('[Blockchain] 准备调用 GameDividendPool.depositDividend()')
      console.log('[Blockchain] 分红池地址:', dividendPoolAddress)
      console.log('[Blockchain] 分红金额:', amount)

      // 验证地址格式
      if (!ethers.utils.isAddress(dividendPoolAddress)) {
        throw new Error('Invalid dividend pool address format')
      }

      // 创建钱包用于签名
      const wallet = new ethers.Wallet(this.privateKey)

      let nonce: number
      let gasPriceWei: ethers.BigNumber

      try {
        const nonceHex = await this.callJsonRpc('eth_getTransactionCount', [wallet.address, 'latest'])
        nonce = parseInt(nonceHex, 16)
        console.log('[Blockchain] 获取 Nonce:', nonce)
      } catch (error) {
        console.warn('[Blockchain] 无法获取 Nonce，使用默认值 0')
        nonce = 0
      }

      try {
        const gasPriceHex = await this.callJsonRpc('eth_gasPrice', [])
        gasPriceWei = ethers.BigNumber.from(gasPriceHex)
        console.log('[Blockchain] 获取 Gas Price:', ethers.utils.formatUnits(gasPriceWei, 'gwei'), 'gwei')
      } catch (error) {
        console.warn('[Blockchain] 无法获取 Gas Price，使用默认值 1 gwei')
        gasPriceWei = ethers.utils.parseUnits('1', 'gwei')
      }

      const gasLimit = ethers.BigNumber.from('150000') // depositDividend 需要更多 gas

      console.log('[Blockchain] 交易参数:')
      console.log('  • Nonce:', nonce)
      console.log('  • Gas Price:', ethers.utils.formatUnits(gasPriceWei, 'gwei'), 'gwei')
      console.log('  • Gas Limit:', gasLimit.toString())

      // 需要先调用 VIRTUAL 代币的 approve，授权 dividendPool 使用我们的代币
      console.log('[Blockchain] 构建 approve 交易...')
      const virtualTokenAddress = process.env.VIRTUAL_TOKEN_ADDRESS
      if (!virtualTokenAddress) {
        throw new Error('VIRTUAL_TOKEN_ADDRESS environment variable is not set')
      }

      // 构建 approve 交易数据
      const iface = new ethers.utils.Interface(ERC20_ABI)
      const approveData = iface.encodeFunctionData('approve', [dividendPoolAddress, amount])

      const approveTx = {
        to: virtualTokenAddress,
        from: wallet.address,
        nonce: nonce,
        gasLimit: ethers.BigNumber.from('100000'),
        gasPrice: gasPriceWei,
        data: approveData,
      }

      console.log('[Blockchain] 签名 approve 交易...')
      const signedApproveTx = await wallet.signTransaction(approveTx)

      console.log('[Blockchain] 发送 approve 交易...')
      const approveTxHash = await this.callJsonRpc('eth_sendRawTransaction', [signedApproveTx])
      console.log('[Blockchain] Approve 交易已发送，Hash:', approveTxHash)

      // 等待 approve 交易确认
      console.log('[Blockchain] 等待 approve 交易确认...')
      for (let i = 0; i < 30; i++) {
        try {
          const receiptData = await this.callJsonRpc('eth_getTransactionReceipt', [approveTxHash])
          if (receiptData) {
            console.log('[Blockchain] Approve 交易已确认')
            break
          }
        } catch (error) {
          console.warn('[Blockchain] 等待 approve 确认中...', i + 1)
        }
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      // 现在构建 depositDividend 交易
      console.log('[Blockchain] 构建 depositDividend 交易...')
      const depositIface = new ethers.utils.Interface(DIVIDEND_POOL_ABI)
      const depositData = depositIface.encodeFunctionData('depositDividend', [amount])

      const depositTx = {
        to: dividendPoolAddress,
        from: wallet.address,
        nonce: nonce + 1, // Nonce 需要递增
        gasLimit: ethers.BigNumber.from('150000'),
        gasPrice: gasPriceWei,
        data: depositData,
      }

      console.log('[Blockchain] 签名 depositDividend 交易...')
      const signedDepositTx = await wallet.signTransaction(depositTx)

      console.log('[Blockchain] 发送 depositDividend 交易...')
      const depositTxHash = await this.callJsonRpc('eth_sendRawTransaction', [signedDepositTx])
      console.log('[Blockchain] Deposit 交易已发送，Hash:', depositTxHash)

      // 等待 deposit 交易确认
      console.log('[Blockchain] 等待 depositDividend 交易确认...')
      let receipt: any = null
      for (let i = 0; i < 30; i++) {
        try {
          const receiptData = await this.callJsonRpc('eth_getTransactionReceipt', [depositTxHash])
          if (receiptData) {
            receipt = receiptData
            console.log('[Blockchain] Deposit 交易已确认，区块号:', parseInt(receiptData.blockNumber, 16))
            break
          }
        } catch (error) {
          console.warn('[Blockchain] 等待 deposit 确认中...', i + 1)
        }
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      return {
        transactionHash: depositTxHash,
        blockNumber: receipt ? parseInt(receipt.blockNumber, 16) : undefined,
      }
    } catch (error) {
      const errorMsg = (error as Error).message
      console.error('[Blockchain] 分红更新失败:', errorMsg)
      throw error
    }
  }

  /**
   * 查询用户的分红信息
   * @param dividendPoolAddress 分红池合约地址
   * @param userAddress 用户地址
   * @returns 用户分红信息
   */
  async getUserDividendInfo(
    dividendPoolAddress: string,
    userAddress: string
  ): Promise<{
    pending: string
    claimed: string
    gameBalance: string
  }> {
    try {
      console.log('[Blockchain] 查询用户分红信息')
      console.log('[Blockchain] 分红池地址:', dividendPoolAddress)
      console.log('[Blockchain] 用户地址:', userAddress)

      // 验证地址格式
      if (!ethers.utils.isAddress(dividendPoolAddress)) {
        throw new Error('Invalid dividend pool address format')
      }
      if (!ethers.utils.isAddress(userAddress)) {
        throw new Error('Invalid user address format')
      }

      // 创建合约实例并调用 view 函数
      const contract = new ethers.Contract(dividendPoolAddress, DIVIDEND_POOL_ABI, this.provider)
      const result = await contract.getUserDividendInfo(userAddress)

      console.log('[Blockchain] 用户分红信息查询成功')
      console.log('[Blockchain] 待提取分红:', result.pending.toString())
      console.log('[Blockchain] 已提取分红:', result.claimed.toString())
      console.log('[Blockchain] GAME 余额:', result.gameBalance.toString())

      return {
        pending: result.pending.toString(),
        claimed: result.claimed.toString(),
        gameBalance: result.gameBalance.toString(),
      }
    } catch (error) {
      const errorMsg = (error as Error).message
      console.error('[Blockchain] 查询分红信息失败:', errorMsg)
      throw error
    }
  }

  /**
   * 查询分红池的统计数据
   * @param dividendPoolAddress 分红池合约地址
   * @returns 分红池统计信息
   */
  async getDividendPoolStats(
    dividendPoolAddress: string
  ): Promise<{
    totalDividendPool: string
    totalClaimed: string
    totalPending: string
    totalDividendPerShare: string
  }> {
    try {
      console.log('[Blockchain] 查询分红池统计信息')

      // 验证地址格式
      if (!ethers.utils.isAddress(dividendPoolAddress)) {
        throw new Error('Invalid dividend pool address format')
      }

      const contract = new ethers.Contract(dividendPoolAddress, DIVIDEND_POOL_ABI, this.provider)
      const result = await contract.getPoolStats()

      console.log('[Blockchain] 分红池统计信息查询成功')

      return {
        totalDividendPool: result._totalDividendPool.toString(),
        totalClaimed: result._totalClaimed.toString(),
        totalPending: result._totalPending.toString(),
        totalDividendPerShare: result._totalDividendPerShare.toString(),
      }
    } catch (error) {
      const errorMsg = (error as Error).message
      console.error('[Blockchain] 查询分红池统计失败:', errorMsg)
      throw error
    }
  }
}

/**
 * 创建区块链客户端实例
 */
export function createBlockchainClient(): BlockchainClient {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY
  const chainId = parseInt(process.env.CHAIN_ID || '84532')

  if (!rpcUrl) {
    throw new Error('BASE_SEPOLIA_RPC_URL environment variable is not set')
  }

  if (!privateKey) {
    throw new Error('DEPLOYER_PRIVATE_KEY environment variable is not set')
  }

  return new BlockchainClient({
    rpcUrl,
    privateKey,
    chainId,
  })
}

/**
 * 将字符串数字转换为 Wei（ERC20 标准通常是 18 位小数）
 * @param amount 数字（如 "1"）
 * @param decimals 小数位数（默认 18）
 * @returns Wei 格式的字符串
 */
export function toWei(amount: string, decimals: number = 18): string {
  return ethers.utils.parseUnits(amount, decimals).toString()
}

/**
 * 将 Wei 转换为字符串数字
 * @param wei Wei 格式的字符串
 * @param decimals 小数位数（默认 18）
 * @returns 普通数字字符串
 */
export function fromWei(wei: string, decimals: number = 18): string {
  return ethers.utils.formatUnits(wei, decimals)
}
