/**
 * 完整测试流程脚本
 * 测试所有后端接口
 *
 * 使用方法:
 * node test/complete-test-flow.js
 */

const axios = require('axios')

// 配置
const BASE_URL = 'http://localhost:3000/api'
const TEST_ADDRESS_1 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const TEST_ADDRESS_2 = '0x70997970C51812e339D9B73B0245601222EEeBB5'

let testResults = {
  passed: 0,
  failed: 0,
  tests: [],
}

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(color, text) {
  console.log(`${colors[color]}${text}${colors.reset}`)
}

function logTest(name, passed, error = null) {
  const status = passed ? '✓' : '✗'
  const color = passed ? 'green' : 'red'
  const result = passed ? 'PASSED' : 'FAILED'

  log(color, `  ${status} ${name} ... ${result}`)

  if (error) {
    log('red', `     错误: ${error}`)
  }

  testResults.tests.push({ name, passed, error })
  if (passed) {
    testResults.passed++
  } else {
    testResults.failed++
  }
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================
// 测试 1: MongoDB 连接测试
// ============================================================
async function testMongoDBConnection() {
  log('cyan', '\n📊 测试 1: MongoDB 数据库连接')
  log('cyan', '━'.repeat(60))

  try {
    // 查询订阅状态作为连接测试
    const response = await axios.get(`${BASE_URL}/subscription/status`, {
      params: { address: TEST_ADDRESS_1 },
      timeout: 5000,
    })

    if (response.status === 200) {
      logTest('MongoDB 连接', true)
      log('green', `✓ 数据库连接正常`)
      return true
    }
  } catch (error) {
    logTest('MongoDB 连接', false, error.message)
    log('red', `✗ 数据库连接失败: ${error.message}`)
    return false
  }
}

// ============================================================
// 测试 2: 内容上传接口
// ============================================================
async function testContentUpload() {
  log('cyan', '\n📝 测试 2: 游戏攻略上传接口')
  log('cyan', '━'.repeat(60))

  try {
    const uploadData = {
      userAddress: TEST_ADDRESS_1,
      gameTitle: 'Elden Ring',
      title: '玛格丽特 Boss 完整攻略',
      content: `
## 玛格丽特，无名女王 (Margit, the Fell Omen) 攻略

### 基本信息
- 位置：艾尔登树前方，秘密峡谷
- 弱点：雷电伤害、出血伤害
- 推荐等级：30-40

### 第一阶段
1. 保持距离，观察攻击模式
2. 她的挥剑攻击有固定节奏，可以预判走位躲避
3. 在她收剑后进行反击（2-3次普通攻击）
4. 使用远程魔法或弓箭进行安全输出

### 击败奖励
- 经验值：3000
- 战利品：黄金种子
      `,
      tags: ['boss', 'strategy', 'main-boss'],
      description: '详细的玛格丽特Boss打法指南',
    }

    log('blue', '正在上传内容...')
    const response = await axios.post(`${BASE_URL}/content/upload`, uploadData, {
      timeout: 60000, // 可能需要等待链上交易
    })

    if (response.status === 201 && response.data.success) {
      logTest('内容上传', true)
      log('green', `✓ 上传成功`)
      log('green', `  • Content ID: ${response.data.contentId}`)
      log('green', `  • Reward TX Hash: ${response.data.rewardTxHash}`)
      log('green', `  • 消息: ${response.data.message}`)
      return response.data.contentId
    } else {
      logTest('内容上传', false, '响应状态异常')
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message
    logTest('内容上传', false, errorMsg)
    log('red', `✗ 上传失败: ${errorMsg}`)
  }
  return null
}

// ============================================================
// 测试 3: 查询内容列表
// ============================================================
async function testContentList() {
  log('cyan', '\n📋 测试 3: 查询内容列表')
  log('cyan', '━'.repeat(60))

  try {
    log('blue', '正在查询内容列表...')
    const response = await axios.get(`${BASE_URL}/content/list`, {
      params: {
        address: TEST_ADDRESS_1,
        limit: 10,
        skip: 0,
      },
      timeout: 10000,
    })

    if (response.status === 200 && response.data.success) {
      logTest('查询内容列表', true)
      log('green', `✓ 查询成功`)
      log('green', `  • 总内容数: ${response.data.total}`)
      log('green', `  • 本页数量: ${response.data.contents.length}`)

      if (response.data.contents.length > 0) {
        const latest = response.data.contents[0]
        log('green', `  • 最新内容: ${latest.title}`)
        log('green', `    - 游戏: ${latest.gameTitle}`)
        log('green', `    - 奖励: ${latest.rewardAmount} GAME`)
        log('green', `    - 奖励状态: ${latest.rewardStatus}`)
      }
    } else {
      logTest('查询内容列表', false, '响应状态异常')
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message
    logTest('查询内容列表', false, errorMsg)
    log('red', `✗ 查询失败: ${errorMsg}`)
  }
}

// ============================================================
// 测试 4: 创作者统计
// ============================================================
async function testCreatorStats() {
  log('cyan', '\n📊 测试 4: 创作者统计')
  log('cyan', '━'.repeat(60))

  try {
    log('blue', '正在查询创作者统计...')
    const response = await axios.get(`${BASE_URL}/content/stats`, {
      params: {
        address: TEST_ADDRESS_1,
      },
      timeout: 10000,
    })

    if (response.status === 200 && response.data.success) {
      logTest('创作者统计', true)
      log('green', `✓ 统计成功`)
      const stats = response.data.stats
      log('green', `  • 总内容数: ${stats.totalContent}`)
      log('green', `  • 已批准: ${stats.publishedContent}`)
      log('green', `  • 查询次数: ${stats.totalQueryCount}`)
      log('green', `  • 总奖励: ${stats.totalRewardEarned} GAME`)
      log('green', `  • 已分发: ${stats.distributedReward} GAME`)
      log('green', `  • 待分发: ${stats.pendingReward} GAME`)
    } else {
      logTest('创作者统计', false, '响应状态异常')
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message
    logTest('创作者统计', false, errorMsg)
    log('red', `✗ 统计失败: ${errorMsg}`)
  }
}

// ============================================================
// 测试 5: 订阅状态查询
// ============================================================
async function testSubscriptionStatus(address, label) {
  log('cyan', `\n🔍 测试 5.1: 查询${label}的订阅状态`)
  log('cyan', '━'.repeat(60))

  try {
    log('blue', `正在查询 ${label} 的订阅状态...`)
    const response = await axios.get(`${BASE_URL}/subscription/status`, {
      params: { address },
      timeout: 10000,
    })

    if (response.status === 200) {
      logTest(`查询订阅状态 (${label})`, true)

      const { isActive, expiresAt, daysRemaining } = response.data

      if (isActive) {
        log('green', `✓ ${label} 已订阅`)
        log('green', `  • 状态: 有效`)
        log('green', `  • 过期时间: ${new Date(expiresAt * 1000).toLocaleString()}`)
        log('green', `  • 剩余天数: ${daysRemaining} 天`)
      } else {
        log('yellow', `⚠️  ${label} 未订阅`)
        log('yellow', `  • 状态: 无效`)
        log('yellow', `  • 需要激活订阅`)
      }

      return isActive
    } else {
      logTest(`查询订阅状态 (${label})`, false, '响应状态异常')
      return false
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message
    logTest(`查询订阅状态 (${label})`, false, errorMsg)
    log('red', `✗ 查询失败: ${errorMsg}`)
    return false
  }
}

// ============================================================
// 测试 6: 激活订阅
// ============================================================
async function testActivateSubscription(address, transactionHash, label) {
  log('cyan', `\n✅ 测试 5.2: 激活${label}的订阅`)
  log('cyan', '━'.repeat(60))

  try {
    log('blue', `正在激活 ${label} 的订阅...`)
    log('blue', `使用交易哈希: ${transactionHash.substring(0, 20)}...`)

    const response = await axios.post(`${BASE_URL}/subscription/activate`, {
      userAddress: address,
      transactionHash,
      amount: '10',
    })

    if (response.status === 200 && response.data.success) {
      logTest(`激活订阅 (${label})`, true)
      log('green', `✓ 激活成功`)
      log('green', `  • 消息: ${response.data.message}`)
      log('green', `  • 过期时间戳: ${response.data.expiresAt}`)

      // 再次查询确认
      await delay(2000)
      const confirmed = await testSubscriptionStatus(address, `${label}(确认)`)
      return confirmed
    } else {
      logTest(`激活订阅 (${label})`, false, '响应状态异常')
      return false
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message
    logTest(`激活订阅 (${label})`, false, errorMsg)
    log('red', `✗ 激活失败: ${errorMsg}`)

    if (errorMsg.includes('Transaction not yet confirmed')) {
      log('yellow', '⚠️  交易未确认，请稍候后重试')
    } else if (errorMsg.includes('Invalid amount')) {
      log('yellow', '⚠️  金额错误，应为 10 VIRTUAL')
    }
    return false
  }
}

// ============================================================
// 测试 7: 游戏咨询查询
// ============================================================
async function testGameInference(address, label) {
  log('cyan', `\n🎮 测试 6: 游戏咨询查询 (${label})`)
  log('cyan', '━'.repeat(60))

  try {
    log('blue', `正在调用游戏咨询接口...`)
    const response = await axios.post(`${BASE_URL}/inference/chat`, {
      userAddress: address,
      question: 'Elden Ring 中如何打败玛格丽特？',
    })

    if (response.status === 200) {
      logTest(`游戏咨询查询 (${label})`, true)
      log('green', `✓ 查询成功`)
      log('green', `  • AI 回答长度: ${response.data.answer.length} 字符`)
      log('green', `  • 回答内容 (前100字):`)
      log('green', `    ${response.data.answer.substring(0, 100)}...`)
      log('green', `  • 订阅状态: 剩余 ${response.data.subscriptionStatus.daysRemaining} 天`)
    } else {
      logTest(`游戏咨询查询 (${label})`, false, '响应状态异常')
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error || error.message
    const errorCode = error.response?.data?.code
    logTest(`游戏咨询查询 (${label})`, false, errorMsg)
    log('red', `✗ 查询失败: ${errorMsg}`)

    if (errorCode === 'SUBSCRIPTION_INACTIVE') {
      log('yellow', '⚠️  订阅未激活，需要先激活订阅')
    } else if (errorCode === 'DIFY_AUTH_FAILED') {
      log('yellow', '⚠️  Dify AI 认证失败，请检查 API Key')
    }
  }
}

// ============================================================
// 主测试流程
// ============================================================
async function runCompleteTestFlow() {
  log('cyan', '\n' + '='.repeat(60))
  log('cyan', '  🚀 GAME.ai Backend 完整测试流程')
  log('cyan', '='.repeat(60))

  try {
    // 1. 测试数据库连接
    const dbConnected = await testMongoDBConnection()
    if (!dbConnected) {
      log('red', '\n❌ 数据库连接失败，无法继续测试')
      return
    }

    // 2. 测试内容上传
    await testContentUpload()

    // 3. 查询内容列表
    await testContentList()

    // 4. 创作者统计
    await testCreatorStats()

    // 5. 订阅相关测试
    const isSubscribed = await testSubscriptionStatus(TEST_ADDRESS_1, '用户1')

    // 6. 游戏咨询（需要先订阅）
    if (isSubscribed) {
      await testGameInference(TEST_ADDRESS_1, '用户1')
    } else {
      log('yellow', '\n⚠️  用户1未订阅，跳过游戏咨询测试')
      log('yellow', '提示: 如需测试游戏咨询，请手动执行以下步骤:')
      log('yellow', '  1. 在 Base Sepolia 上转账 10 VIRTUAL 到订阅合约')
      log('yellow', '  2. 获取交易哈希')
      log('yellow', '  3. 调用 激活订阅 API，参数为:')
      log('yellow', `     userAddress: ${TEST_ADDRESS_1}`)
      log('yellow', `     transactionHash: <交易哈希>`)
      log('yellow', `     amount: 10`)
    }

    // 生成测试报告
    log('cyan', '\n' + '='.repeat(60))
    log('cyan', '  📊 测试报告')
    log('cyan', '='.repeat(60))

    console.log(`\n✓ 通过: ${testResults.passed}`)
    console.log(`✗ 失败: ${testResults.failed}`)
    console.log(`总计: ${testResults.passed + testResults.failed}\n`)

    if (testResults.failed > 0) {
      log('red', '失败的测试:')
      testResults.tests
        .filter((t) => !t.passed)
        .forEach((t) => {
          console.log(`  ✗ ${t.name}: ${t.error}`)
        })
    }

    const passRate = ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(
      1
    )
    log(testResults.failed === 0 ? 'green' : 'yellow', `\n测试通过率: ${passRate}%\n`)
  } catch (error) {
    log('red', `\n❌ 测试流程错误: ${error.message}`)
    console.error(error)
  }
}

// 运行测试
runCompleteTestFlow()
