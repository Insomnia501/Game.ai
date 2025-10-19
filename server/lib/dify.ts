/**
 * Dify API 集成模块
 * 用于调用 Dify 聊天对话 API
 *
 * Dify API 文档: https://docs.dify.ai/
 * 基础 URL: https://api.dify.ai/v1
 */

import axios, { AxiosInstance } from 'axios'

/**
 * Dify 消息响应类型
 */
interface DifyMessageResponse {
  event: string
  task_id: string
  id: string
  message_id: string
  conversation_id: string
  mode: string
  answer: string
  metadata?: {
    usage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    }
    retriever_resources?: any[]
  }
  created_at: number
}

/**
 * Dify 客户端配置
 */
interface DifyConfig {
  apiKey: string
  baseUrl?: string
  timeout?: number
}

/**
 * Dify 客户端类
 */
export class DifyClient {
  private client: AxiosInstance
  private apiKey: string

  constructor(config: DifyConfig) {
    this.apiKey = config.apiKey
    const baseURL = config.baseUrl || 'https://api.dify.ai/v1'
    const timeout = config.timeout || 30000

    this.client = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })
  }

  /**
   * 发送聊天消息到 Dify
   * 支持两种模式：
   * - blocking: 阻塞模式，等待执行完毕后返回结果（推荐用于 API）
   * - streaming: 流式模式，基于 SSE 实现流式返回
   *
   * @param message 用户输入/提问内容
   * @param userId 用户标识（必需）
   * @param conversationId 会话 ID（可选，用于多轮对话）
   * @param inputs 应用定义的变量值（可选）
   * @returns Dify 响应数据
   */
  async sendMessage(
    message: string,
    userId: string,
    conversationId?: string,
    inputs?: Record<string, any>
  ): Promise<DifyMessageResponse> {
    try {
      console.log('[Dify] 发送消息...')
      console.log('[Dify] 用户ID:', userId)
      console.log('[Dify] 消息内容:', message)

      const requestData = {
        query: message,
        user: userId,
        response_mode: 'blocking', // 使用阻塞模式，直接返回完整结果
        inputs: inputs || {},
      } as any

      // 如果提供了 conversation_id，表示继续已有的对话
      if (conversationId) {
        requestData.conversation_id = conversationId
        console.log('[Dify] 使用已有对话ID:', conversationId)
      } else {
        console.log('[Dify] 创建新对话')
      }

      console.log('[Dify] 请求数据:', JSON.stringify(requestData))

      const response = await this.client.post<DifyMessageResponse>(
        '/chat-messages',
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      )

      console.log('[Dify] 响应状态:', response.status)
      console.log('[Dify] 获取到AI回复:', response.data.answer.substring(0, 100) + '...')

      return response.data
    } catch (error) {
      console.error('[Dify] API 调用失败:', error)
      throw error
    }
  }

  /**
   * 获取会话历史消息
   *
   * @param conversationId 会话 ID
   * @param userId 用户标识
   * @param limit 返回的消息条数，默认 20
   * @param firstId 当前页第一条聊天记录的 ID（用于分页）
   * @returns 消息列表和分页信息
   */
  async getMessages(
    conversationId: string,
    userId: string,
    limit: number = 20,
    firstId?: string
  ) {
    try {
      console.log('[Dify] 获取会话消息...')
      console.log('[Dify] 对话ID:', conversationId)

      const params: any = {
        conversation_id: conversationId,
        user: userId,
        limit,
      }

      if (firstId) {
        params.first_id = firstId
      }

      const response = await this.client.get('/messages', {
        params,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      })

      console.log('[Dify] 获取到消息数量:', response.data.data?.length)

      return response.data
    } catch (error) {
      console.error('[Dify] 获取消息失败:', error)
      throw error
    }
  }

  /**
   * 获取用户的会话列表
   *
   * @param userId 用户标识
   * @param limit 返回的会话条数，默认 20
   * @param lastId 当前页最后一条记录的 ID（用于分页）
   * @returns 会话列表和分页信息
   */
  async getConversations(
    userId: string,
    limit: number = 20,
    lastId?: string
  ) {
    try {
      console.log('[Dify] 获取会话列表...')
      console.log('[Dify] 用户ID:', userId)

      const params: any = {
        user: userId,
        limit,
      }

      if (lastId) {
        params.last_id = lastId
      }

      const response = await this.client.get('/conversations', {
        params,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      })

      console.log('[Dify] 获取到会话数量:', response.data.data?.length)

      return response.data
    } catch (error) {
      console.error('[Dify] 获取会话列表失败:', error)
      throw error
    }
  }

  /**
   * 删除会话
   *
   * @param conversationId 会话 ID
   * @param userId 用户标识
   */
  async deleteConversation(conversationId: string, userId: string) {
    try {
      console.log('[Dify] 删除会话...')
      console.log('[Dify] 对话ID:', conversationId)

      const response = await this.client.delete(
        `/conversations/${conversationId}`,
        {
          data: { user: userId },
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      )

      console.log('[Dify] 会话已删除')
      return response.data
    } catch (error) {
      console.error('[Dify] 删除会话失败:', error)
      throw error
    }
  }

  /**
   * 重命名会话
   *
   * @param conversationId 会话 ID
   * @param name 新的会话名称（可选）
   * @param userId 用户标识
   * @param autoGenerate 是否自动生成标题，默认 false
   */
  async renameConversation(
    conversationId: string,
    userId: string,
    name?: string,
    autoGenerate: boolean = false
  ) {
    try {
      console.log('[Dify] 重命名会话...')
      console.log('[Dify] 对话ID:', conversationId)

      const response = await this.client.post(
        `/conversations/${conversationId}/name`,
        {
          user: userId,
          name,
          auto_generate: autoGenerate,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      )

      console.log('[Dify] 会话已重命名')
      return response.data
    } catch (error) {
      console.error('[Dify] 重命名会话失败:', error)
      throw error
    }
  }

  /**
   * 获取应用基本信息
   */
  async getAppInfo() {
    try {
      console.log('[Dify] 获取应用信息...')

      const response = await this.client.get('/info', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      })

      console.log('[Dify] 应用信息获取成功:', response.data.name)
      return response.data
    } catch (error) {
      console.error('[Dify] 获取应用信息失败:', error)
      throw error
    }
  }

  /**
   * 获取应用参数配置
   * 包括开场白、建议问题、文件上传配置等
   */
  async getParameters() {
    try {
      console.log('[Dify] 获取应用参数...')

      const response = await this.client.get('/parameters', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      })

      console.log('[Dify] 应用参数获取成功')
      return response.data
    } catch (error) {
      console.error('[Dify] 获取应用参数失败:', error)
      throw error
    }
  }
}

/**
 * 创建 Dify 客户端实例
 *
 * @param apiKey Dify API Key
 * @returns DifyClient 实例
 */
export function createDifyClient(apiKey: string): DifyClient {
  return new DifyClient({
    apiKey,
    baseUrl: process.env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1',
  })
}
