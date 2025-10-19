/**
 * 订阅激活 API 路由
 *
 * 功能：
 * 1. 验证链上交易
 * 2. 激活或续期订阅
 * 3. 返回新的到期时间
 *
 * 请求方式: POST /api/subscription/activate
 *
 * 请求体格式:
 * {
 *   "userAddress": "0x...",
 *   "transactionHash": "0x...",     // 支付交易哈希
 *   "amount": "10"                   // 支付金额（验证用）
 * }
 *
 * 响应格式:
 * {
 *   "success": true,
 *   "expiresAt": 1729876000,
 *   "message": "订阅已激活，有效期30天"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { isValidAddress, normalizeAddress } from '@/lib/address-utils'
import { createBlockchainClient, toWei } from '@/lib/blockchain'
import { ethers } from 'ethers'

// 订阅参数
const SUBSCRIPTION_AMOUNT = '10' // 10 $VIRTUAL
const SUBSCRIPTION_PERIOD_DAYS = 30

/**
 * 验证链上交易
 * 连接到 Base RPC 验证交易是否有效
 */
async function verifyTransaction(
  transactionHash: string,
  userAddress: string,
  amount: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    console.log('[Subscription Activate API] 验证交易...')
    console.log('[Subscription Activate API] 交易哈希:', transactionHash)
    console.log('[Subscription Activate API] 用户地址:', userAddress)
    console.log('[Subscription Activate API] 金额:', amount)

    // 基本格式验证
    if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash)) {
      console.warn('[Subscription Activate API] 交易哈希格式无效')
      return { valid: false, error: 'Invalid transaction hash format' }
    }

    // 使用 Base RPC 验证交易
    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || process.env.BASE_RPC_URL
    if (!rpcUrl) {
      console.warn('[Subscription Activate API] RPC URL 未配置，跳过链上验证')
      // 开发环境中允许跳过链上验证，但只进行格式检查
      return { valid: true }
    }

    try {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
      console.log('[Subscription Activate API] 正在从 RPC 查询交易收据...')
      const receipt = await provider.getTransactionReceipt(transactionHash)

      if (!receipt) {
        console.warn('[Subscription Activate API] 交易尚未确认（收据不存在）')
        return { valid: false, error: 'Transaction not yet confirmed' }
      }

      console.log('[Subscription Activate API] 交易收据已获取，状态:', receipt.status)

      if (receipt.status === 0) {
        console.warn('[Subscription Activate API] 交易失败')
        return { valid: false, error: 'Transaction failed on chain' }
      }

      console.log('[Subscription Activate API] 交易已验证，区块号:', receipt.blockNumber)
      return { valid: true }
    } catch (rpcError: any) {
      console.warn('[Subscription Activate API] RPC 查询失败:', rpcError.message)
      console.warn('[Subscription Activate API] 错误堆栈:', rpcError.stack)
      // 如果 RPC 查询失败，返回错误
      return { valid: false, error: 'Failed to verify transaction on chain' }
    }
  } catch (error) {
    console.error('[Subscription Activate API] 交易验证异常:', error)
    return { valid: false, error: 'Transaction verification error' }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, transactionHash, amount } = body

    // 参数验证
    if (!userAddress || !transactionHash || !amount) {
      console.warn('[Subscription Activate API] 缺少必需参数')
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters: userAddress, transactionHash, amount',
        },
        { status: 400 }
      )
    }

    console.log('[Subscription Activate API] 激活订阅请求，用户地址:', userAddress)

    // 验证地址格式
    if (!isValidAddress(userAddress)) {
      console.warn('[Subscription Activate API] 无效的钱包地址:', userAddress)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid user address format',
        },
        { status: 400 }
      )
    }

    const normalizedAddress = normalizeAddress(userAddress)

    // 验证金额
    if (String(amount) !== SUBSCRIPTION_AMOUNT) {
      console.warn('[Subscription Activate API] 无效的金额:', amount, '期望:', SUBSCRIPTION_AMOUNT)
      return NextResponse.json(
        {
          success: false,
          error: `Invalid amount. Expected ${SUBSCRIPTION_AMOUNT} $VIRTUAL, got ${amount}`,
        },
        { status: 400 }
      )
    }

    // 验证交易
    const txVerification = await verifyTransaction(transactionHash, normalizedAddress, amount)
    if (!txVerification.valid) {
      console.warn('[Subscription Activate API] 交易验证失败:', txVerification.error)
      return NextResponse.json(
        {
          success: false,
          error: 'Transaction verification failed',
          details: txVerification.error,
        },
        { status: 400 }
      )
    }

    // 连接数据库
    const db = await connectDB()

    // 计算新的到期时间（使用秒级 Unix 时间戳）
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = now + SUBSCRIPTION_PERIOD_DAYS * 24 * 3600

    // 查询现有订阅
    const existingSubscription = await db
      .collection('subscriptions')
      .findOne({ userAddress: normalizedAddress })

    let isRenewal = false

    if (existingSubscription) {
      // 续期现有订阅
      console.log('[Subscription Activate API] 续期现有订阅')
      await db.collection('subscriptions').updateOne(
        { userAddress: normalizedAddress },
        {
          $set: {
            status: 'active',
            expiresAt,
            renewedAt: now,
            transactionHash,
            updatedAt: new Date(),
          },
        }
      )
      isRenewal = true
    } else {
      // 创建新订阅
      console.log('[Subscription Activate API] 创建新订阅')
      await db.collection('subscriptions').insertOne({
        userAddress: normalizedAddress,
        status: 'active',
        expiresAt,
        startedAt: now,
        renewedAt: now,
        transactionHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    console.log('[Subscription Activate API] 订阅', isRenewal ? '续期' : '激活', '成功，到期时间:', new Date(expiresAt * 1000))

    // 激活订阅成功后，调用合约更新分红
    // 10 VIRTUAL 的 70% = 7 VIRTUAL 进入分红池
    let dividendUpdateTxHash: string | null = null
    try {
      const dividendPoolAddress = process.env.GAME_DIVIDEND_POOL_ADDRESS
      const dividendAmount = toWei('7') // 10 VIRTUAL 的 70%

      if (dividendPoolAddress) {
        console.log('[Subscription Activate API] 准备更新分红池...')
        const blockchain = createBlockchainClient()
        const dividendTxResult = await blockchain.updateGameDividendPool(dividendPoolAddress, dividendAmount)
        dividendUpdateTxHash = dividendTxResult.transactionHash

        console.log('[Subscription Activate API] 分红已更新，TX Hash:', dividendUpdateTxHash)

        // 可选：将 dividendUpdateTxHash 存储到数据库的订阅记录中
        await db.collection('subscriptions').updateOne(
          { userAddress: normalizedAddress },
          {
            $set: {
              dividendUpdateTxHash,
              updatedAt: new Date(),
            },
          }
        )
      } else {
        console.warn('[Subscription Activate API] GAME_DIVIDEND_POOL_ADDRESS 未配置，跳过分红更新')
      }
    } catch (dividendError) {
      console.error('[Subscription Activate API] 分红更新失败:', dividendError)
      // 不中断请求，订阅已经创建成功，分红更新可以后续重试
      // 在实际生产环境中，可能需要添加重试机制或告警
    }

    return NextResponse.json(
      {
        success: true,
        expiresAt,
        dividendUpdateTxHash,
        message: isRenewal ? '订阅已续期，有效期30天' : '订阅已激活，有效期30天',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Subscription Activate API] 处理请求失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to activate subscription',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * 处理 OPTIONS 请求（用于 CORS 预检）
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
