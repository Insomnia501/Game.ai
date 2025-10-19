/**
 * MongoDB 数据库连接测试脚本 - 简化版
 * 用于检查数据库连接状态和表结构
 *
 * 使用方法:
 * node test/test-db-connection.js
 */

const { MongoClient } = require('mongodb')
require('dotenv').config()

async function testDatabaseConnection() {
  console.log('\n' + '='.repeat(80))
  console.log('MongoDB 数据库连接测试')
  console.log('='.repeat(80) + '\n')

  const MONGODB_URI = process.env.MONGODB_URI
  const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME

  if (!MONGODB_URI) {
    console.error('❌ 错误: MONGODB_URI 未配置')
    process.exit(1)
  }

  console.log('📍 连接信息:')
  console.log(`   数据库名: ${MONGODB_DB_NAME}`)
  console.log(
    `   连接字符串: ${MONGODB_URI.replace(/:[^:]*@/, ':****@')} (密码已隐藏)`
  )
  console.log()

  let client = null
  try {
    // 1. 连接数据库
    console.log('⏳ 正在连接到数据库...')
    client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 60000,
    })

    await client.connect()
    console.log('✅ 数据库连接成功！\n')

    // 2. 获取数据库实例
    const db = client.db(MONGODB_DB_NAME)

    // 3. 列出所有集合
    console.log('📊 现有集合列表:')
    const collections = await db.listCollections().toArray()

    if (collections.length === 0) {
      console.log('   (数据库为空，暂无集合)')
    } else {
      collections.forEach((col, idx) => {
        console.log(`   ${idx + 1}. ${col.name}`)
      })
    }
    console.log()

    // 4. 获取每个集合的详细信息
    console.log('📈 集合详细信息:')
    console.log('━'.repeat(80))

    for (const collection of collections) {
      const collName = collection.name
      const coll = db.collection(collName)

      // 统计文档数
      const docCount = await coll.countDocuments()

      // 获取第一条文档作为样本
      const sampleDoc = await coll.findOne()

      console.log(`\n集合名称: ${collName}`)
      console.log(`文档数量: ${docCount}`)

      // 显示字段结构
      if (sampleDoc) {
        console.log('包含字段:')
        const fields = Object.keys(sampleDoc)
        fields.forEach((field) => {
          const value = sampleDoc[field]
          let typeInfo = ''

          if (value === null) {
            typeInfo = 'null'
          } else if (value instanceof require('mongodb').ObjectId) {
            typeInfo = `ObjectId (${value})`
          } else if (value instanceof Date) {
            typeInfo = `Date (${value.toISOString()})`
          } else if (Array.isArray(value)) {
            typeInfo = `Array[${value.length}]`
          } else if (typeof value === 'object') {
            typeInfo = `Object: ${JSON.stringify(value).substring(0, 40)}...`
          } else {
            typeInfo = `${typeof value}: ${String(value).substring(0, 40)}`
          }

          console.log(`  • ${field.padEnd(20)} : ${typeInfo}`)
        })
      }

      console.log()
    }

    console.log('━'.repeat(80))

    // 5. 显示推荐的表结构
    console.log('\n📋 推荐的数据库结构:')
    console.log('-'.repeat(80))

    console.log('\n1️⃣  subscriptions (订阅表)')
    console.log('   用途: 存储用户的订阅信息')
    console.log('   字段:')
    console.log('     • _id: ObjectId (主键)')
    console.log('     • userAddress: String (用户钱包地址，唯一索引)')
    console.log('     • status: String (active/inactive)')
    console.log('     • expiresAt: Number (过期时间戳，秒)')
    console.log('     • startedAt: Number (开始时间戳)')
    console.log('     • transactionHash: String (支付交易哈希)')
    console.log('     • renewedAt: Number (最后续期时间)')
    console.log('     • createdAt: Date')
    console.log('     • updatedAt: Date')

    console.log('\n2️⃣  gameContent (内容表) - 新增')
    console.log('   用途: 存储用户上传的游戏攻略')
    console.log('   字段:')
    console.log('     • _id: ObjectId (主键)')
    console.log('     • contentId: String (UUID，唯一索引)')
    console.log('     • userAddress: String (创作者地址，有索引)')
    console.log('     • gameTitle: String (游戏名称，有索引)')
    console.log('     • title: String (攻略标题)')
    console.log('     • content: String (攻略内容)')
    console.log('     • tags: Array (标签)')
    console.log('     • description: String (描述)')
    console.log('     • status: String (approved/pending/rejected)')
    console.log('     • queryCount: Number (被查询次数)')
    console.log('     • rewardAmount: String (奖励 GAME 数量)')
    console.log('     • rewardStatus: String (pending/distributed)')
    console.log('     • rewardTxHash: String (奖励转账哈希)')
    console.log('     • createdAt: Date (有索引)')
    console.log('     • updatedAt: Date')

    console.log('\n3️⃣  chat_logs (对话记录表)')
    console.log('   用途: 存储 AI 咨询的对话记录')
    console.log('   字段:')
    console.log('     • _id: ObjectId (主键)')
    console.log('     • userAddress: String (用户地址，有索引)')
    console.log('     • question: String (用户问题)')
    console.log('     • answer: String (AI 回答)')
    console.log('     • conversationId: String (对话ID)')
    console.log('     • messageId: String (消息ID)')
    console.log('     • taskId: String (任务ID)')
    console.log('     • timestamp: Date (有索引)')
    console.log('     • metadata: Object (元数据)')

    console.log('\n' + '━'.repeat(80))

    // 6. 初始化缺失的表
    console.log('\n⚙️  检查和初始化缺失的集合...\n')

    const requiredCollections = ['subscriptions', 'gameContent', 'chat_logs']

    for (const collName of requiredCollections) {
      const exists = collections.some((c) => c.name === collName)

      if (exists) {
        console.log(`   ✓ 集合已存在: ${collName}`)
      } else {
        console.log(`   ⚠️  集合不存在，创建中: ${collName}`)
        try {
          await db.createCollection(collName)
          console.log(`   ✓ 集合创建成功: ${collName}`)
        } catch (e) {
          console.log(`   ✗ 创建失败: ${e.message}`)
        }
      }
    }

    // 创建索引
    console.log('\n建立索引...')

    try {
      // subscriptions 索引
      const subsColl = db.collection('subscriptions')
      await subsColl.createIndex({ userAddress: 1 }, { unique: true })
      console.log('   ✓ subscriptions.userAddress (UNIQUE)')
      await subsColl.createIndex({ expiresAt: 1 })
      console.log('   ✓ subscriptions.expiresAt')
      await subsColl.createIndex({ status: 1 })
      console.log('   ✓ subscriptions.status')

      // gameContent 索引
      const contentColl = db.collection('gameContent')
      await contentColl.createIndex({ contentId: 1 }, { unique: true })
      console.log('   ✓ gameContent.contentId (UNIQUE)')
      await contentColl.createIndex({ userAddress: 1 })
      console.log('   ✓ gameContent.userAddress')
      await contentColl.createIndex({ gameTitle: 1 })
      console.log('   ✓ gameContent.gameTitle')
      await contentColl.createIndex({ createdAt: 1 })
      console.log('   ✓ gameContent.createdAt')

      // chat_logs 索引
      const chatColl = db.collection('chat_logs')
      await chatColl.createIndex({ userAddress: 1 })
      console.log('   ✓ chat_logs.userAddress')
      await chatColl.createIndex({ timestamp: 1 })
      console.log('   ✓ chat_logs.timestamp')
    } catch (e) {
      // 索引创建可能重复，不影响
      if (!e.message.includes('already exists')) {
        console.log(`   ⚠️  ${e.message}`)
      }
    }

    console.log('\n✅ 所有检查和初始化完成！\n')

    // 7. 最终状态总结
    console.log('📊 数据库连接状态汇总:')
    console.log('━'.repeat(80))
    console.log('✓ 数据库连接: 正常')
    console.log(`✓ 数据库名称: ${MONGODB_DB_NAME}`)
    console.log(`✓ 现有集合数: ${collections.length}`)
    console.log(
      `✓ 必需集合: ${requiredCollections.filter((c) => collections.some((col) => col.name === c)).length}/${requiredCollections.length}`
    )
    console.log('✓ 系统状态: 就绪')
    console.log('━'.repeat(80))

    console.log('\n🎉 数据库测试成功！系统已就绪。\n')
  } catch (error) {
    console.error('\n❌ 连接失败!')
    console.error('错误信息:', error.message)
    console.error()

    // 提供具体的错误诊断
    if (error.code === 'ECONNREFUSED' || error.message.includes('connect')) {
      console.error('🔍 诊断:')
      console.error('   → 无法连接到数据库服务')
      console.error('   请检查:')
      console.error('     1. 网络连接是否正常')
      console.error('     2. MongoDB 服务是否运行')
      console.error('     3. 连接字符串是否正确')
    } else if (error.message.includes('auth')) {
      console.error('🔍 诊断:')
      console.error('   → 数据库认证失败')
      console.error('   请检查:')
      console.error('     1. 用户名和密码是否正确')
      console.error('     2. 是否有访问权限')
    } else if (error.message.includes('timeout')) {
      console.error('🔍 诊断:')
      console.error('   → 连接超时')
      console.error('   请检查:')
      console.error('     1. 网络延迟是否过高')
      console.error('     2. 防火墙设置是否允许连接')
    } else {
      console.error('🔍 其他错误，请查看日志详情')
    }

    process.exit(1)
  } finally {
    if (client) {
      await client.close()
      console.log('📍 数据库连接已关闭\n')
    }
  }
}

// 运行测试
testDatabaseConnection().catch((err) => {
  console.error('测试执行错误:', err)
  process.exit(1)
})
