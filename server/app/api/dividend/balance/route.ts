/**
 * 查询用户分红接口
 *
 * 功能：
 * 1. 查询用户可提取的分红
 * 2. 查询用户已提取的分红
 * 3. 查询用户的 $GAME 余额
 * 4. 查询分红池的整体统计
 *
 * 请求方式: GET /api/dividend/balance
 *
 * 查询参数:
 * - userAddress: 用户钱包地址（必需）
 *
 * 响应格式:
 * {
 *   "success": true,
 *   "userAddress": "0x...",
 *   "dividend": {
 *     "pending": {
 *       "wei": "7000000000000000000",
 *       "virtual": "7"
 *     },
 *     "claimed": {
 *       "wei": "3000000000000000000",
 *       "virtual": "3"
 *     },
 *     "gameBalance": {
 *       "wei": "100000000000000000000",
 *       "game": "100"
 *     },
 *     "totalEarnable": {
 *       "wei": "10000000000000000000",
 *       "virtual": "10"
 *     }
 *   },
 *   "poolStats": {
 *     "totalDividendPool": "1000000000000000000000",
 *     "totalClaimed": "300000000000000000000",
 *     "totalPending": "700000000000000000000",
 *     "totalDividendPerShare": "50000000000000000"
 *   },
 *   "timestamp": 1729876000000
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { isValidAddress, normalizeAddress } from '@/lib/address-utils'
import { createBlockchainClient, fromWei } from '@/lib/blockchain'

export async function GET(request: NextRequest) {
  try {
    // 从查询参数中获取 userAddress
    const userAddress = request.nextUrl.searchParams.get('userAddress')

    if (!userAddress) {
      console.warn('[Dividend Balance API] 缺少必需参数: userAddress')
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
      console.warn('[Dividend Balance API] 无效的钱包地址:', userAddress)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid user address format',
        },
        { status: 400 }
      )
    }

    const normalizedAddress = normalizeAddress(userAddress)
    console.log('[Dividend Balance API] 查询分红信息，用户地址:', normalizedAddress)

    // 获取分红池地址
    const dividendPoolAddress = process.env.GAME_DIVIDEND_POOL_ADDRESS
    if (!dividendPoolAddress) {
      console.error('[Dividend Balance API] GAME_DIVIDEND_POOL_ADDRESS 未配置')
      return NextResponse.json(
        {
          success: false,
          error: 'Dividend pool address not configured',
        },
        { status: 500 }
      )
    }

    // 创建区块链客户端并查询数据
    const blockchain = createBlockchainClient()

    // 查询用户的分红信息
    console.log('[Dividend Balance API] 查询用户分红信息...')
    const userDividendInfo = await blockchain.getUserDividendInfo(dividendPoolAddress, normalizedAddress)

    // 查询分红池的统计数据
    console.log('[Dividend Balance API] 查询分红池统计...')
    const poolStats = await blockchain.getDividendPoolStats(dividendPoolAddress)

    // 格式化返回数据
    const pendingWei = userDividendInfo.pending
    const claimedWei = userDividendInfo.claimed
    const gameBalanceWei = userDividendInfo.gameBalance

    const totalEarnableWei = (BigInt(pendingWei) + BigInt(claimedWei)).toString()

    console.log('[Dividend Balance API] 数据格式化完成')

    return NextResponse.json(
      {
        success: true,
        userAddress: normalizedAddress,
        dividend: {
          pending: {
            wei: pendingWei,
            virtual: fromWei(pendingWei, 18),
          },
          claimed: {
            wei: claimedWei,
            virtual: fromWei(claimedWei, 18),
          },
          gameBalance: {
            wei: gameBalanceWei,
            game: fromWei(gameBalanceWei, 18),
          },
          totalEarnable: {
            wei: totalEarnableWei,
            virtual: fromWei(totalEarnableWei, 18),
          },
        },
        poolStats: {
          totalDividendPool: poolStats.totalDividendPool,
          totalClaimed: poolStats.totalClaimed,
          totalPending: poolStats.totalPending,
          totalDividendPerShare: poolStats.totalDividendPerShare,
        },
        timestamp: Date.now(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Dividend Balance API] 处理请求失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to query dividend balance',
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
