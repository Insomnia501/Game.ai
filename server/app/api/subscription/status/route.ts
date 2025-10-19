/**
 * 订阅状态查询 API 路由
 *
 * 功能：查询用户当前的订阅状态
 *
 * 请求方式: GET /api/subscription/status?address=0x...
 *
 * 响应格式:
 * {
 *   "isActive": true,
 *   "expiresAt": 1729876000,        // Unix timestamp
 *   "daysRemaining": 15,
 *   "transactionHash": "0x...",
 *   "startedAt": 1729271200
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { isValidAddress, normalizeAddress } from '@/lib/address-utils'

export async function GET(request: NextRequest) {
  try {
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams
    const userAddress = searchParams.get('address')

    // 参数验证
    if (!userAddress) {
      console.warn('[Subscription Status API] 缺少必需参数: address')
      return NextResponse.json(
        {
          error: 'Missing required parameter: address',
        },
        { status: 400 }
      )
    }

    // 验证地址格式
    if (!isValidAddress(userAddress)) {
      console.warn('[Subscription Status API] 无效的钱包地址:', userAddress)
      return NextResponse.json(
        {
          error: 'Invalid wallet address format',
        },
        { status: 400 }
      )
    }

    const normalizedAddress = normalizeAddress(userAddress)
    console.log('[Subscription Status API] 查询订阅状态，用户地址:', normalizedAddress)

    // 连接数据库
    const db = await connectDB()

    // 查询订阅记录
    const subscription = await db.collection('subscriptions').findOne({
      userAddress: normalizedAddress,
    })

    if (!subscription) {
      console.log('[Subscription Status API] 未找到订阅记录')
      return NextResponse.json(
        {
          isActive: false,
          expiresAt: null,
          daysRemaining: 0,
          transactionHash: null,
          startedAt: null,
        },
        { status: 200 }
      )
    }

    // 检查订阅是否过期
    const now = Math.floor(Date.now() / 1000) // 转换为秒级 Unix 时间戳
    const isActive = subscription.status === 'active' && subscription.expiresAt > now
    const daysRemaining = isActive
      ? Math.ceil((subscription.expiresAt - now) / (24 * 3600))
      : 0

    console.log('[Subscription Status API] 订阅状态:', isActive ? '有效' : '已过期', '剩余天数:', daysRemaining)

    return NextResponse.json(
      {
        isActive,
        expiresAt: subscription.expiresAt,
        daysRemaining,
        transactionHash: subscription.transactionHash,
        startedAt: subscription.startedAt,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Subscription Status API] 处理请求失败:', error)
    return NextResponse.json(
      {
        error: 'Failed to query subscription status',
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
