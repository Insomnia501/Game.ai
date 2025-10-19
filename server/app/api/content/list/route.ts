/**
 * 获取用户已上传内容列表 API 路由
 *
 * 功能：
 * 1. 查询指定用户上传的所有内容
 * 2. 支持分页
 * 3. 返回内容摘要信息
 *
 * 请求方式: GET /api/content/list?address=0x...&limit=10&skip=0
 *
 * 响应格式:
 * {
 *   "success": true,
 *   "total": 5,
 *   "contents": [
 *     {
 *       "contentId": "uuid",
 *       "gameTitle": "Elden Ring",
 *       "title": "Boss 攻略",
 *       "description": "详细的攻略",
 *       "status": "approved",
 *       "queryCount": 10,
 *       "rewardAmount": "1",
 *       "rewardStatus": "distributed",
 *       "createdAt": "2025-10-19T..."
 *     }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { isValidAddress, normalizeAddress } from '@/lib/address-utils'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userAddress = searchParams.get('address')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const skip = Math.max(parseInt(searchParams.get('skip') || '0'), 0)

    // 参数验证
    if (!userAddress) {
      console.warn('[Content List API] 缺少必需参数: address')
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
      console.warn('[Content List API] 无效的钱包地址:', userAddress)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid wallet address format',
        },
        { status: 400 }
      )
    }

    const normalizedAddress = normalizeAddress(userAddress)
    console.log('[Content List API] 查询用户内容，地址:', normalizedAddress, '分页:', { limit, skip })

    // 连接数据库
    const db = await connectDB()

    // 获取总数
    const total = await db.collection('gameContent').countDocuments({
      userAddress: normalizedAddress,
    })

    // 查询内容列表
    const contents = await db
      .collection('gameContent')
      .find({
        userAddress: normalizedAddress,
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .toArray()

    console.log('[Content List API] 找到', contents.length, '条内容，总共', total, '条')

    return NextResponse.json(
      {
        success: true,
        total,
        contents: contents.map((doc: any) => ({
          contentId: doc.contentId,
          gameTitle: doc.gameTitle,
          title: doc.title,
          description: doc.description,
          status: doc.status,
          queryCount: doc.queryCount,
          rewardAmount: doc.rewardAmount,
          rewardStatus: doc.rewardStatus,
          createdAt: doc.createdAt,
        })),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Content List API] 处理请求失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to query content list',
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
