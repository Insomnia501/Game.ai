/**
 * 内容上传功能测试脚本
 * 用于测试新的内容上传API
 *
 * 使用方法:
 * node test/test-content-upload.js
 */

const axios = require('axios')

// 测试配置
const BASE_URL = 'http://localhost:3000/api'

// 测试用户地址（需要替换为实际的测试地址）
const TEST_USER_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

// 测试数据
const testContent = {
  userAddress: TEST_USER_ADDRESS,
  gameTitle: 'Elden Ring',
  title: '玛格丽特，无名女王 Boss 完整攻略',
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

    ### 第二阶段
    - 进入第二阶段后，她会召唤神圣武器
    - 优先集中火力打破武器的防御
    - 然后继续按照第一阶段的策略进行

    ### 推荐装备
    - 武器：任何升级到+3的武器都可以
    - 护甲：轻中度护甲，保持足够闪避
    - 魔法：雷电魔法或出血刀片

    ### 击败奖励
    - 经验值：3000
    - 战利品：黄金种子
  `,
  tags: ['boss', '攻略', '主线'],
  description: '详细的玛格丽特Boss打法指南，包含所有阶段的策略和装备推荐',
}

/**
 * 测试内容上传
 */
async function testContentUpload() {
  try {
    console.log('\n=== 测试内容上传 ===')
    console.log('请求数据:', JSON.stringify(testContent, null, 2))

    const response = await axios.post(`${BASE_URL}/content/upload`, testContent)

    console.log('\n✓ 上传成功')
    console.log('响应数据:', JSON.stringify(response.data, null, 2))

    return response.data.contentId
  } catch (error) {
    console.error('\n✗ 上传失败')
    if (error.response) {
      console.error('状态码:', error.response.status)
      console.error('错误信息:', JSON.stringify(error.response.data, null, 2))
    } else {
      console.error('错误:', error.message)
    }
    process.exit(1)
  }
}

/**
 * 测试获取内容列表
 */
async function testContentList() {
  try {
    console.log('\n=== 测试获取内容列表 ===')
    console.log('查询地址:', TEST_USER_ADDRESS)

    const response = await axios.get(`${BASE_URL}/content/list`, {
      params: {
        address: TEST_USER_ADDRESS,
        limit: 10,
        skip: 0,
      },
    })

    console.log('\n✓ 查询成功')
    console.log('响应数据:', JSON.stringify(response.data, null, 2))
  } catch (error) {
    console.error('\n✗ 查询失败')
    if (error.response) {
      console.error('状态码:', error.response.status)
      console.error('错误信息:', JSON.stringify(error.response.data, null, 2))
    } else {
      console.error('错误:', error.message)
    }
    process.exit(1)
  }
}

/**
 * 测试获取创作者统计
 */
async function testContentStats() {
  try {
    console.log('\n=== 测试获取创作者统计 ===')
    console.log('查询地址:', TEST_USER_ADDRESS)

    const response = await axios.get(`${BASE_URL}/content/stats`, {
      params: {
        address: TEST_USER_ADDRESS,
      },
    })

    console.log('\n✓ 查询成功')
    console.log('响应数据:', JSON.stringify(response.data, null, 2))
  } catch (error) {
    console.error('\n✗ 查询失败')
    if (error.response) {
      console.error('状态码:', error.response.status)
      console.error('错误信息:', JSON.stringify(error.response.data, null, 2))
    } else {
      console.error('错误:', error.message)
    }
    process.exit(1)
  }
}

/**
 * 主测试流程
 */
async function runTests() {
  console.log('==========================================')
  console.log('  GAME.ai 内容上传功能测试')
  console.log('==========================================')

  // 1. 上传内容
  const contentId = await testContentUpload()

  // 2. 查询内容列表
  await testContentList()

  // 3. 查询创作者统计
  await testContentStats()

  console.log('\n==========================================')
  console.log('  所有测试完成！')
  console.log('==========================================\n')
}

// 运行测试
runTests()
