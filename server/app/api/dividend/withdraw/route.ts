/**
 * 分红提现接口 - 方案 B（前端调用）
 *
 * 功能：
 * 1. 查询用户可提现的分红金额
 * 2. 返回提现交易数据，供前端签名调用
 * 3. 记录提现历史（可选）
 *
 * 请求方式: POST /api/dividend/withdraw
 *
 * 请求体格式:
 * {
 *   "userAddress": "0x...",
 *   "transactionHash": "0x...",  // 可选：用户前端签名后的交易哈希，用于记录
 *   "amount": "5.5"              // 可选：指定提现金额，不指定则提现全部
 * }
 *
 * 响应格式（初始请求，生成签名数据）:
 * {
 *   "success": true,
 *   "userAddress": "0x...",
 *   "availableAmount": "7.5",    // 可提现金额
 *   "requestedAmount": "5.5",    // 请求的提现金额
 *   "transactionData": {
 *     "to": "0x分红池地址",
 *     "from": "0x用户地址",
 *     "data": "0x...",           // claimDividend() 的编码数据
 *     "value": "0"
 *   },
 *   "message": "请使用钱包签名并发送此交易"
 * }
 *
 * 响应格式（记录提现）:
 * {
 *   "success": true,
 *   "userAddress": "0x...",
 *   "transactionHash": "0x...",
 *   "claimedAmount": "5.5",
 *   "status": "confirmed",
 *   "timestamp": 1729876000000,
 *   "message": "分红提现已记录"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { isValidAddress, normalizeAddress } from '@/lib/address-utils'
import { createBlockchainClient, fromWei } from '@/lib/blockchain'
import { ethers } from 'ethers'
import { v4 as uuidv4 } from 'uuid'

// GameDividendPool 合约的 claimDividend() 方法签名
const CLAIM_DIVIDEND_SIGNATURE = 'claimDividend()'
const DIVIDEND_POOL_ABI = [
  'function claimDividend() external nonReentrant returns (uint256 claimable)',
]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, transactionHash, amount } = body

    if (!userAddress) {
      console.warn('[Dividend Withdraw API] 缺少必需参数: userAddress')
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: userAddress',
        },
        { status: 400 }
      )
    }

    // 验证地址格式
    if (!isValidAddress(userAddress)) {
      console.warn('[Dividend Withdraw API] 无效的钱包地址:', userAddress)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid user address format',
        },
        { status: 400 }
      )
    }

    const normalizedAddress = normalizeAddress(userAddress)
    console.log('[Dividend Withdraw API] 分红提现请求，用户地址:', normalizedAddress)

    // 获取分红池地址
    const dividendPoolAddress = process.env.GAME_DIVIDEND_POOL_ADDRESS
    if (!dividendPoolAddress) {
      console.error('[Dividend Withdraw API] GAME_DIVIDEND_POOL_ADDRESS 未配置')
      return NextResponse.json(
        {
          success: false,
          error: 'Dividend pool address not configured',
        },
        { status: 500 }
      )
    }

    // 如果有交易哈希，说明这是记录提现结果的请求
    if (transactionHash) {
      return handleWithdrawalRecord(normalizedAddress, transactionHash, amount)
    }

    // 否则生成签名数据
    return generateWithdrawalSignatureData(normalizedAddress, dividendPoolAddress)
  } catch (error) {
    console.error('[Dividend Withdraw API] 处理请求失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process dividend withdrawal',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * 生成用于前端签名的交易数据
 */
async function generateWithdrawalSignatureData(userAddress: string, dividendPoolAddress: string) {
  try {
    console.log('[Dividend Withdraw API] 生成提现签名数据')

    // 查询用户可提现的分红金额
    const blockchain = createBlockchainClient()
    const userDividendInfo = await blockchain.getUserDividendInfo(dividendPoolAddress, userAddress)

    const pendingAmount = userDividendInfo.pending
    if (pendingAmount === '0') {
      console.warn('[Dividend Withdraw API] 用户没有可提现的分红')
      return NextResponse.json(
        {
          success: false,
          error: 'No dividends available to withdraw',
        },
        { status: 400 }
      )
    }

    // 构建 claimDividend() 的调用数据
    const iface = new ethers.utils.Interface(DIVIDEND_POOL_ABI)
    const callData = iface.encodeFunctionData(CLAIM_DIVIDEND_SIGNATURE, [])

    console.log('[Dividend Withdraw API] 签名数据生成完成')
    console.log('[Dividend Withdraw API] 可提现金额:', fromWei(pendingAmount, 18), 'VIRTUAL')

    return NextResponse.json(
      {
        success: true,
        userAddress,
        availableAmount: fromWei(pendingAmount, 18),
        transactionData: {
          to: dividendPoolAddress,
          from: userAddress,
          data: callData,
          value: '0',
        },
        instructions: {
          step1: '使用您的钱包（如 MetaMask）连接到 Base 网络',
          step2: '使用钱包的 "签名和发送交易" 功能',
          step3: '复制上面的交易数据到钱包',
          step4: '签名并发送交易',
          step5: '交易确认后，您的分红将自动转入您的钱包',
        },
        note: '此接口仅生成交易数据，实际交易由您的钱包执行。请确保您了解交易内容再签名。',
        message: '请使用钱包签名并发送此交易',
      },
      { status: 200 }
    )
  } catch (error) {
    const errorMsg = (error as Error).message
    console.error('[Dividend Withdraw API] 生成签名数据失败:', errorMsg)
    throw error
  }
}

/**
 * 记录提现结果
 */
async function handleWithdrawalRecord(
  userAddress: string,
  transactionHash: string,
  claimedAmount?: string
) {
  try {
    console.log('[Dividend Withdraw API] 记录提现结果')
    console.log('[Dividend Withdraw API] 交易哈希:', transactionHash)

    // 基本格式验证
    if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash)) {
      console.warn('[Dividend Withdraw API] 交易哈希格式无效')
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid transaction hash format',
        },
        { status: 400 }
      )
    }

    // 连接数据库
    const db = await connectDB()

    // 创建提现记录
    const withdrawalRecord = {
      withdrawalId: uuidv4(),
      userAddress,
      transactionHash,
      claimedAmount: claimedAmount || 'unknown',
      status: 'pending', // 状态：pending (待确认) / confirmed (已确认)
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // 使用 upsert 操作：如果记录存在则更新，不存在则创建
    await db.collection('dividendWithdrawals').insertOne(withdrawalRecord)

    console.log('[Dividend Withdraw API] 提现记录已保存')

    return NextResponse.json(
      {
        success: true,
        userAddress,
        transactionHash,
        claimedAmount: claimedAmount || 'unknown',
        status: 'pending',
        message: '分红提现记录已保存，请在区块浏览器上查看交易状态',
        explorerUrl: `https://sepolia.basescan.org/tx/${transactionHash}`,
      },
      { status: 200 }
    )
  } catch (error) {
    const errorMsg = (error as Error).message
    console.error('[Dividend Withdraw API] 记录提现失败:', errorMsg)
    throw error
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
