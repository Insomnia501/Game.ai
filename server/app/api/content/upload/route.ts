/**
 * 游戏攻略内容上传 API 路由
 *
 * 功能：
 * 1. 接收用户上传的游戏攻略/经验
 * 2. 存储到数据库
 * 3. 向上传用户转账 1 GAME 代币作为奖励
 *
 * 请求方式: POST /api/content/upload
 *
 * 请求体格式:
 * {
 *   "userAddress": "0x...",
 *   "gameTitle": "Elden Ring",
 *   "title": "Boss 攻略：玛格丽特，无名女王",
 *   "content": "完整的攻略文本...",
 *   "tags": ["boss", "strategy"],
 *   "description": "详细的Boss打法指南"
 * }
 *
 * 响应格式:
 * {
 *   "success": true,
 *   "contentId": "uuid",
 *   "rewardTxHash": "0x...",
 *   "message": "内容上传成功，已获得 1 GAME 代币奖励"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { isValidAddress, normalizeAddress } from '@/lib/address-utils'
import { createBlockchainClient, toWei } from '@/lib/blockchain'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, gameTitle, title, content, tags, description } = body

    // 参数验证
    if (!userAddress || !gameTitle || !title || !content) {
      console.warn('[Content Upload API] 缺少必需参数')
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters: userAddress, gameTitle, title, content',
        },
        { status: 400 }
      )
    }

    // 验证地址格式
    if (!isValidAddress(userAddress)) {
      console.warn('[Content Upload API] 无效的钱包地址:', userAddress)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid user address format',
        },
        { status: 400 }
      )
    }

    const normalizedAddress = normalizeAddress(userAddress)

    // 验证内容长度
    if (typeof content !== 'string' || content.trim().length === 0) {
      console.warn('[Content Upload API] 内容无效')
      return NextResponse.json(
        {
          success: false,
          error: 'Content must be a non-empty string',
        },
        { status: 400 }
      )
    }

    if (content.length > 50000) {
      console.warn('[Content Upload API] 内容过长')
      return NextResponse.json(
        {
          success: false,
          error: 'Content must be less than 50000 characters',
        },
        { status: 400 }
      )
    }

    // 验证标题长度
    if (typeof title !== 'string' || title.trim().length === 0 || title.length > 500) {
      console.warn('[Content Upload API] 标题无效')
      return NextResponse.json(
        {
          success: false,
          error: 'Title must be a non-empty string and less than 500 characters',
        },
        { status: 400 }
      )
    }

    console.log('[Content Upload API] 收到请求 | 用户:', normalizedAddress, '| 游戏:', gameTitle)

    // 生成内容ID
    const contentId = uuidv4()

    // 1. 存储内容到数据库
    console.log('[Content Upload API] 存储内容到数据库...')
    const db = await connectDB()

    const now = new Date()
    await db.collection('gameContent').insertOne({
      contentId,
      userAddress: normalizedAddress,
      gameTitle,
      title,
      content,
      tags: tags || [],
      description: description || '',
      status: 'approved', // 简化版本：直接批准，不需要审核
      queryCount: 0,
      rewardAmount: '1', // 固定 1 GAME
      rewardStatus: 'pending', // 待分发
      rewardTxHash: null,
      createdAt: now,
      updatedAt: now,
    })

    console.log('[Content Upload API] 内容已存储，ID:', contentId)

    // 2. 转账 1 GAME 代币给用户
    console.log('[Content Upload API] 准备转账 1 GAME 代币...')
    let rewardTxHash: string | null = null

    try {
      const gameTokenAddress = process.env.GAME_TOKEN_ADDRESS
      const rewardAmount = toWei('1') // 1 GAME，假设18位小数

      if (!gameTokenAddress) {
        console.warn('[Content Upload API] GAME_TOKEN_ADDRESS 环境变量未配置，跳过转账')
      } else {
        const blockchain = createBlockchainClient()
        const txResult = await blockchain.transferERC20(gameTokenAddress, normalizedAddress, rewardAmount)

        rewardTxHash = txResult.transactionHash
        console.log('[Content Upload API] 转账成功，TX Hash:', rewardTxHash)

        // 更新数据库中的转账状态
        await db.collection('gameContent').updateOne(
          { contentId },
          {
            $set: {
              rewardStatus: 'distributed',
              rewardTxHash,
              updatedAt: new Date(),
            },
          }
        )
        console.log('[Content Upload API] 数据库已更新，转账状态: distributed')
      }
    } catch (transferError) {
      console.error('[Content Upload API] 转账失败:', transferError)
      // 不中断请求，只记录转账失败（内容已存储）
      // 可以稍后手动处理转账
    }

    // 3. 返回响应
    return NextResponse.json(
      {
        success: true,
        contentId,
        rewardTxHash,
        message: rewardTxHash
          ? '内容上传成功，已获得 1 GAME 代币奖励'
          : '内容上传成功（代币奖励处理中）',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[Content Upload API] 处理请求失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload content',
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
