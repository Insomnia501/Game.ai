/**
 * MongoDB 连接管理模块
 * 使用单例模式缓存连接，避免每次重复连接
 */

import { MongoClient, Db } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017'
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'game-ai'

/**
 * 缓存的连接实例
 */
let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

/**
 * 连接到 MongoDB
 * 使用单例模式确保只创建一个连接
 */
export async function connectDB(): Promise<Db> {
  // 如果已有连接，直接返回
  if (cachedClient && cachedDb) {
    console.log('[MongoDB] 使用缓存连接')
    return cachedDb
  }

  try {
    console.log('[MongoDB] 正在连接...')

    const client = new MongoClient(MONGODB_URI!, {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 60000,
    })

    await client.connect()
    console.log('[MongoDB] 连接成功')

    // 获取数据库实例
    const db = client.db(MONGODB_DB_NAME)

    // 缓存连接和数据库实例
    cachedClient = client
    cachedDb = db

    return db
  } catch (error) {
    console.error('[MongoDB] 连接失败:', error)
    throw error
  }
}

/**
 * 关闭 MongoDB 连接
 */
export async function closeDB(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close()
    cachedClient = null
    cachedDb = null
    console.log('[MongoDB] 连接已关闭')
  }
}

/**
 * 获取当前数据库实例
 */
export function getDB(): Db {
  if (!cachedDb) {
    throw new Error('Database not connected. Call connectDB() first.')
  }
  return cachedDb
}

/**
 * 创建必要的集合和索引
 */
export async function initializeDatabase(): Promise<void> {
  try {
    const db = await connectDB()

    console.log('[MongoDB] 初始化数据库...')

    // 创建 subscriptions 集合
    try {
      await db.createCollection('subscriptions')
      console.log('[MongoDB] subscriptions 集合已创建')
    } catch (error: any) {
      if (error.code === 48) {
        // 集合已存在
        console.log('[MongoDB] subscriptions 集合已存在')
      } else {
        throw error
      }
    }

    // 创建 subscriptions 索引
    await db.collection('subscriptions').createIndex(
      { userAddress: 1 },
      { unique: true }
    )
    console.log('[MongoDB] subscriptions.userAddress 唯一索引已创建')

    await db.collection('subscriptions').createIndex({ expiresAt: 1 })
    console.log('[MongoDB] subscriptions.expiresAt 索引已创建')

    await db.collection('subscriptions').createIndex({ status: 1 })
    console.log('[MongoDB] subscriptions.status 索引已创建')

    // 创建 chat_logs 集合（可选）
    try {
      await db.createCollection('chat_logs')
      console.log('[MongoDB] chat_logs 集合已创建')
    } catch (error: any) {
      if (error.code === 48) {
        console.log('[MongoDB] chat_logs 集合已存在')
      } else {
        throw error
      }
    }

    // 创建 chat_logs 索引
    await db.collection('chat_logs').createIndex({ userAddress: 1 })
    console.log('[MongoDB] chat_logs.userAddress 索引已创建')

    await db.collection('chat_logs').createIndex({ timestamp: 1 })
    console.log('[MongoDB] chat_logs.timestamp 索引已创建')

    // 创建 gameContent 集合
    try {
      await db.createCollection('gameContent')
      console.log('[MongoDB] gameContent 集合已创建')
    } catch (error: any) {
      if (error.code === 48) {
        console.log('[MongoDB] gameContent 集合已存在')
      } else {
        throw error
      }
    }

    // 创建 gameContent 索引
    await db.collection('gameContent').createIndex({ contentId: 1 }, { unique: true })
    console.log('[MongoDB] gameContent.contentId 唯一索引已创建')

    await db.collection('gameContent').createIndex({ userAddress: 1 })
    console.log('[MongoDB] gameContent.userAddress 索引已创建')

    await db.collection('gameContent').createIndex({ gameTitle: 1 })
    console.log('[MongoDB] gameContent.gameTitle 索引已创建')

    await db.collection('gameContent').createIndex({ createdAt: 1 })
    console.log('[MongoDB] gameContent.createdAt 索引已创建')

    // 创建 dividendWithdrawals 集合
    try {
      await db.createCollection('dividendWithdrawals')
      console.log('[MongoDB] dividendWithdrawals 集合已创建')
    } catch (error: any) {
      if (error.code === 48) {
        console.log('[MongoDB] dividendWithdrawals 集合已存在')
      } else {
        throw error
      }
    }

    // 创建 dividendWithdrawals 索引
    await db.collection('dividendWithdrawals').createIndex({ withdrawalId: 1 }, { unique: true })
    console.log('[MongoDB] dividendWithdrawals.withdrawalId 唯一索引已创建')

    await db.collection('dividendWithdrawals').createIndex({ userAddress: 1 })
    console.log('[MongoDB] dividendWithdrawals.userAddress 索引已创建')

    await db.collection('dividendWithdrawals').createIndex({ transactionHash: 1 })
    console.log('[MongoDB] dividendWithdrawals.transactionHash 索引已创建')

    await db.collection('dividendWithdrawals').createIndex({ createdAt: 1 })
    console.log('[MongoDB] dividendWithdrawals.createdAt 索引已创建')

    await db.collection('dividendWithdrawals').createIndex({ status: 1 })
    console.log('[MongoDB] dividendWithdrawals.status 索引已创建')

    console.log('[MongoDB] 数据库初始化完成')
  } catch (error) {
    console.error('[MongoDB] 初始化失败:', error)
    throw error
  }
}

/**
 * 清理过期的订阅
 * 定期调用此函数删除已过期的订阅记录
 */
export async function cleanupExpiredSubscriptions(): Promise<number> {
  try {
    const db = await connectDB()
    const now = Math.floor(Date.now() / 1000)

    const result = await db.collection('subscriptions').deleteMany({
      expiresAt: { $lt: now },
      status: 'inactive',
    })

    console.log(`[MongoDB] 已清理 ${result.deletedCount} 条过期订阅记录`)
    return result.deletedCount
  } catch (error) {
    console.error('[MongoDB] 清理过期订阅失败:', error)
    throw error
  }
}
