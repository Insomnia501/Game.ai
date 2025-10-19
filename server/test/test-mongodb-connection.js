/**
 * MongoDB 连接测试脚本
 * 用于验证 MongoDB Atlas 连接并测试数据写入
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testMongoDBConnection() {
  // 获取连接字符串
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('❌ 错误: 环境变量 MONGODB_URI 未定义');
    console.error('请确保 .env 文件中有 MONGODB_URI 配置');
    process.exit(1);
  }

  console.log('📡 正在连接到 MongoDB...');
  console.log('连接字符串：', mongoUri.substring(0, 50) + '...');

  const client = new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });

  try {
    // 连接到 MongoDB
    await client.connect();
    console.log('✅ MongoDB 连接成功！');

    // 获取管理员数据库
    const adminDb = client.db('admin');

    // 列出所有数据库
    console.log('\n📚 获取可用数据库列表...');
    const databases = await adminDb.admin().listDatabases();
    console.log('✅ 可用数据库:');
    databases.databases.forEach(db => {
      console.log(`   - ${db.name}`);
    });

    // 连接到 vitals 数据库
    const db = client.db('Vitals');
    console.log('\n📦 已连接到 "Vitals" 数据库');

    // 测试数据写入
    console.log('\n✍️  正在写入测试数据...');
    const testCollection = db.collection('test_connection');

    const testDoc = {
      timestamp: new Date(),
      message: '这是一条测试消息',
      status: 'connected',
      type: 'connection_test',
    };

    const result = await testCollection.insertOne(testDoc);
    console.log('✅ 数据写入成功!');
    console.log('   文档 ID:', result.insertedId);

    // 验证数据写入
    console.log('\n🔍 正在读取写入的数据...');
    const doc = await testCollection.findOne({ _id: result.insertedId });
    console.log('✅ 数据读取成功!');
    console.log('   读取的数据:', doc);

    // 获取集合统计
    console.log('\n📊 集合信息:');
    const stats = await db.collection('test_connection').countDocuments();
    console.log('   文档数量:', stats);

    // 创建 subscriptions 集合（如果不存在）
    console.log('\n🛠️  初始化 subscriptions 集合...');
    try {
      await db.createCollection('subscriptions');
      console.log('✅ subscriptions 集合已创建');
    } catch (error) {
      if (error.code === 48) {
        console.log('ℹ️  subscriptions 集合已存在');
      } else {
        throw error;
      }
    }

    // 创建索引
    console.log('\n🔑 创建索引...');
    await db.collection('subscriptions').createIndex(
      { userAddress: 1 },
      { unique: true }
    );
    console.log('✅ userAddress 唯一索引已创建');

    await db.collection('subscriptions').createIndex({ expiresAt: 1 });
    console.log('✅ expiresAt 索引已创建');

    await db.collection('subscriptions').createIndex({ status: 1 });
    console.log('✅ status 索引已创建');

    // 插入一条测试的订阅记录
    console.log('\n📝 插入测试订阅记录...');
    const testSubscription = {
      userAddress: '0x1234567890123456789012345678901234567890',
      status: 'active',
      expiresAt: Math.floor(Date.now() / 1000) + 30 * 24 * 3600, // 30 天后过期
      startedAt: Math.floor(Date.now() / 1000),
      transactionHash: '0x' + 'a'.repeat(64),
      renewedAt: Math.floor(Date.now() / 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const subResult = await db.collection('subscriptions').insertOne(testSubscription);
    console.log('✅ 订阅记录已插入');
    console.log('   订阅 ID:', subResult.insertedId);

    // 查询订阅记录
    console.log('\n🔍 查询订阅记录...');
    const subscription = await db.collection('subscriptions').findOne({
      userAddress: '0x1234567890123456789012345678901234567890',
    });
    console.log('✅ 订阅记录查询成功!');
    console.log('   订阅状态:', subscription.status);
    console.log('   到期时间:', new Date(subscription.expiresAt * 1000));

    console.log('\n' + '='.repeat(60));
    console.log('✨ MongoDB 连接和数据写入测试全部成功！');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error('错误详情:', error);

    if (error.name === 'MongoServerError') {
      console.error('\n💡 建议:');
      console.error('1. 检查 IP 白名单 - 在 MongoDB Atlas 中添加您的 IP');
      console.error('2. 检查连接字符串 - 确保用户名和密码正确');
      console.error('3. 检查网络 - 确保能访问外部网络');
    }

    process.exit(1);
  } finally {
    // 关闭连接
    await client.close();
    console.log('\n✅ 数据库连接已关闭');
  }
}

// 运行测试
testMongoDBConnection().catch(console.error);
