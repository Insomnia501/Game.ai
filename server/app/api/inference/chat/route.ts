/**
 * AI 健康咨询 API 路由
 *
 * 功能：
 * 1. 检查用户订阅状态
 * 2. 调用 Dify API 获取 AI 回答
 * 3. 返回回答结果
 *
 * 请求方式: POST /api/inference/chat
 *
 * 请求体格式:
 * {
 *   "userAddress": "0x...",
 *   "question": "我每天睡6小时够吗？",
 *   "conversationId": "uuid" // 可选，用于多轮对话
 * }
 *
 * 响应格式:
 * {
 *   "answer": "根据健康研究...",
 *   "conversationId": "uuid",
 *   "subscriptionStatus": {
 *     "isActive": true,
 *     "daysRemaining": 15
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import { createDifyClient } from '@/lib/dify'
import { isValidAddress, normalizeAddress } from '@/lib/address-utils'

/**
 * 验证用户订阅状态
 * 检查数据库中的订阅记录是否有效
 */
async function checkSubscription(userAddress: string) {
  try {
    const db = await connectDB()

    const subscription = await db
      .collection('subscriptions')
      .findOne({
        userAddress,
        status: 'active',
      })

    if (!subscription) {
      return {
        isActive: false,
        error: 'No active subscription found',
      }
    }

    const now = Math.floor(Date.now() / 1000) // 转换为秒级 Unix 时间戳
    const isExpired = subscription.expiresAt < now

    if (isExpired) {
      return {
        isActive: false,
        error: 'Subscription has expired',
      }
    }

    const daysRemaining = Math.ceil((subscription.expiresAt - now) / (24 * 3600))

    return {
      isActive: true,
      expiresAt: subscription.expiresAt,
      daysRemaining,
      transactionHash: subscription.transactionHash,
      startedAt: subscription.startedAt,
    }
  } catch (error) {
    console.error('[Chat API] 订阅状态检查失败:', error)
    return {
      isActive: false,
      error: 'Failed to check subscription status',
    }
  }
}

/**
 * 处理 POST 请求
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, question, conversationId } = body

    // 参数验证
    if (!userAddress || !question) {
      console.warn('[Chat API] 缺少必需参数: userAddress 或 question')
      return corsJson(
        {
          error: 'Missing required parameters: userAddress and question',
        },
        { status: 400 }
      )
    }

    // 验证地址格式
    if (!isValidAddress(userAddress)) {
      console.warn('[Chat API] 无效的钱包地址:', userAddress)
      return corsJson(
        {
          error: 'Invalid wallet address format',
        },
        { status: 400 }
      )
    }

    const normalizedAddress = normalizeAddress(userAddress)

    // 验证问题长度
    if (typeof question !== 'string' || question.trim().length === 0) {
      console.warn('[Chat API] 问题内容无效')
      return corsJson(
        {
          error: 'Question must be a non-empty string',
        },
        { status: 400 }
      )
    }

    if (question.length > 2000) {
      console.warn('[Chat API] 问题内容过长')
      return corsJson(
        {
          error: 'Question must be less than 2000 characters',
        },
        { status: 400 }
      )
    }

    console.log('[Chat API] 收到请求 | 用户:', normalizedAddress, '| 问题长度:', question.length)
    if (conversationId) {
      console.log('[Chat API] 对话ID:', conversationId)
    }

    // 1. 检查订阅状态
    console.log('[Chat API] 检查订阅状态...')
    const subscriptionStatus = await checkSubscription(normalizedAddress)

    if (!subscriptionStatus.isActive) {
      console.warn('[Chat API] 订阅验证失败:', subscriptionStatus.error)
      return corsJson(
        {
          error: subscriptionStatus.error,
          code: 'SUBSCRIPTION_INACTIVE',
        },
        { status: 403 }
      )
    }

    console.log('[Chat API] 订阅有效 | 剩余天数:', subscriptionStatus.daysRemaining)

    // 2. 初始化 Dify 客户端
    const apiKey = process.env.DIFY_API_KEY
    if (!apiKey) {
      console.error('[Chat API] DIFY_API_KEY 环境变量未配置')
      return corsJson(
        {
          error: 'AI service is not properly configured',
          code: 'CONFIG_ERROR',
        },
        { status: 500 }
      )
    }

    const difyClient = createDifyClient(apiKey)

    // 3. 调用 Dify API
    console.log('[Chat API] 调用 Dify API...')
    let difyResponse
    try {
      difyResponse = await difyClient.sendMessage(
        question,
        normalizedAddress,
        conversationId
      )
    } catch (difyError: any) {
      console.error('[Chat API] Dify API 调用失败:', difyError.message)

      // 处理特定的 Dify 错误
      if (difyError.response?.status === 401) {
        return corsJson(
          {
            error: 'AI service authentication failed',
            code: 'DIFY_AUTH_FAILED',
          },
          { status: 401 }
        )
      }

      if (difyError.response?.status === 429) {
        return corsJson(
          {
            error: 'AI service rate limit exceeded, please try again later',
            code: 'DIFY_RATE_LIMITED',
          },
          { status: 429 }
        )
      }

      throw difyError
    }

    console.log('[Chat API] Dify 响应成功')

    // 4. 保存对话记录到 MongoDB（可选但推荐）
    try {
      const db = await connectDB()
      await db.collection('chat_logs').insertOne({
        userAddress: normalizedAddress,
        question,
        answer: difyResponse.answer,
        conversationId: difyResponse.conversation_id,
        messageId: difyResponse.message_id,
        taskId: difyResponse.task_id,
        timestamp: new Date(),
        metadata: difyResponse.metadata,
      })
      console.log('[Chat API] 对话记录已保存到 MongoDB')
    } catch (logError) {
      console.warn('[Chat API] 对话记录保存失败 (非致命错误):', logError)
      // 不中断请求，只记录警告
    }

    // 5. 返回响应
    return corsJson(
      {
        answer: difyResponse.answer,
        conversationId: difyResponse.conversation_id,
        messageId: difyResponse.message_id,
        taskId: difyResponse.task_id,
        subscriptionStatus: {
          isActive: subscriptionStatus.isActive,
          daysRemaining: subscriptionStatus.daysRemaining,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Chat API] 处理请求失败:', error)

    // 处理网络/超时错误
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        return corsJson(
          {
            error: 'Failed to connect to AI service',
            code: 'SERVICE_UNAVAILABLE',
          },
          { status: 503 }
        )
      }

      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        return corsJson(
          {
            error: 'Request to AI service timed out, please try again',
            code: 'REQUEST_TIMEOUT',
          },
          { status: 504 }
        )
      }
    }

    return corsJson(
      {
        error: 'Failed to process chat request',
        code: 'INTERNAL_ERROR',
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
  return corsJson(null, { status: 200 })
}

function corsJson(body: any, init?: ResponseInit) {
  const response = body === null
    ? new NextResponse(null, init)
    : NextResponse.json(body, init)
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}
