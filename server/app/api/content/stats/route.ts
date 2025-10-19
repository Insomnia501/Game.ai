/**
 * 获取创作者统计信息 API 路由
 *
 * 功能：
 * 1. 获取用户的内容创作统计
 * 2. 包括总内容数、总收益、待领取奖励等
 *
 * 请求方式: GET /api/content/stats?address=0x...
 *
 * 响应格式:
 * {
 *   "success": true,
 *   "stats": {
 *     "totalContent": 5,
 *     "publishedContent": 4,
 *     "totalQueryCount": 50,
 *     "totalRewardEarned": "5", // 单位：GAME
 *     "distributedReward": "5",
 *     "pendingReward": "0"
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { isValidAddress, normalizeAddress } from '@/lib/address-utils'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userAddress = searchParams.get('address')

    // 参数验证
    if (!userAddress) {
      console.warn('[Content Stats API] 缺少必需参数: address')
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: address',
        },
        { status: 400 }
      )
    }

    // 验证地址格式
    if (!isValidAddress(userAddress)) {
      console.warn('[Content Stats API] 无效的钱包地址:', userAddress)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid wallet address format',
        },
        { status: 400 }
      )
    }

    const normalizedAddress = normalizeAddress(userAddress)
    console.log('[Content Stats API] 查询创作者统计，地址:', normalizedAddress)

    // 连接数据库
    const db = await connectDB()

    // 查询所有内容
    const contents = await db
      .collection('gameContent')
      .find({
        userAddress: normalizedAddress,
      })
      .toArray()

    // 计算统计数据
    const totalContent = contents.length
    const publishedContent = contents.filter((doc: any) => doc.status === 'approved').length
    const totalQueryCount = contents.reduce((sum: number, doc: any) => sum + (doc.queryCount || 0), 0)

    // 计算奖励统计
    let totalRewardEarned = '0'
    let distributedReward = '0'
    let pendingReward = '0'

    contents.forEach((doc: any) => {
      const reward = BigInt(doc.rewardAmount || '0')
      totalRewardEarned = (BigInt(totalRewardEarned) + reward).toString()

      if (doc.rewardStatus === 'distributed') {
        distributedReward = (BigInt(distributedReward) + reward).toString()
      } else if (doc.rewardStatus === 'pending') {
        pendingReward = (BigInt(pendingReward) + reward).toString()
      }
    })

    console.log('[Content Stats API] 统计完成', {
      totalContent,
      publishedContent,
      totalQueryCount,
      totalRewardEarned,
    })

    return NextResponse.json(
      {
        success: true,
        stats: {
          totalContent,
          publishedContent,
          totalQueryCount,
          totalRewardEarned,
          distributedReward,
          pendingReward,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Content Stats API] 处理请求失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to query content stats',
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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
