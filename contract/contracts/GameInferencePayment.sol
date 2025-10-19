// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GameInferencePayment
 * @notice AI 游戏咨询包月订阅支付合约
 * @dev 用户支付 $VIRTUAL 进行包月订阅，收益实时分配给创作者和分红池
 * @dev 后端负责通过验证交易hash来判断用户是否开通包月
 */

interface IDividendPool {
    function depositDividend(uint256 amount) external;
}

contract GameInferencePayment is Ownable, ReentrancyGuard {
    // ============ 状态变量 ============

    IERC20 public immutable virtualToken;      // $VIRTUAL 代币合约
    address public dividendPool;                // 分红池合约地址

    uint256 public monthlySubscriptionFee = 10 ether;  // 每月包月费用（10 $VIRTUAL）
    uint256 public constant CREATOR_SHARE = 30; // 创作者分成比例（30%）
    uint256 public constant DIVIDEND_SHARE = 70; // 分红池分成比例（70%）

    // 统计数据
    uint256 public totalSubscriptions;          // 总包月订阅次数
    uint256 public totalRevenue;                // 总收入
    uint256 public totalCreatorEarned;          // 创作者累计收益
    uint256 public totalDividendDistributed;    // 累计分红池分配

    // ============ 事件 ============

    /**
     * @notice 包月订阅支付事件
     * @param user 用户地址
     * @param amount 支付金额
     * @param timestamp 支付时间戳
     */
    event SubscriptionPaid(
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );

    /**
     * @notice 收益分配事件
     * @param creatorShare 创作者分成
     * @param dividendShare 分红池分成
     * @param timestamp 分配时间戳
     */
    event RevenueDistributed(
        uint256 creatorShare,
        uint256 dividendShare,
        uint256 timestamp
    );

    event SubscriptionFeeUpdated(uint256 oldFee, uint256 newFee);
    event DividendPoolUpdated(address oldPool, address newPool);

    // ============ 构造函数 ============

    constructor(
        address _virtualToken,
        address _dividendPool,
        address _creator
    ) Ownable(_creator) {
        require(_virtualToken != address(0), "Invalid VIRTUAL token address");
        require(_dividendPool != address(0), "Invalid dividend pool address");

        virtualToken = IERC20(_virtualToken);
        dividendPool = _dividendPool;
    }

    // ============ 核心功能 ============

    /**
     * @notice 用户进行包月订阅支付
     * @dev 用户支付每月订阅费，后端通过验证交易hash判断是否已开通包月
     * @dev 合约只负责接收支付和分配收益，订阅状态管理由后端处理
     */
    function subscribeMonthly() external nonReentrant {
        // 转账 $VIRTUAL 到合约
        virtualToken.transferFrom(msg.sender, address(this), monthlySubscriptionFee);

        // 分配收益
        _distributeRevenue(monthlySubscriptionFee);

        // 更新统计数据
        totalSubscriptions++;
        totalRevenue += monthlySubscriptionFee;

        emit SubscriptionPaid(msg.sender, monthlySubscriptionFee, block.timestamp);
    }

    /**
     * @notice 分配收益给创作者和分红池
     * @param amount 总收入金额
     */
    function _distributeRevenue(uint256 amount) internal {
        // 计算分配金额
        uint256 creatorShare = (amount * CREATOR_SHARE) / 100;
        uint256 dividendShare = (amount * DIVIDEND_SHARE) / 100;

        // 转账给创作者（Dify 成本从这里支出）
        virtualToken.transfer(owner(), creatorShare);
        totalCreatorEarned += creatorShare;

        // 转账给分红池
        virtualToken.approve(dividendPool, dividendShare);
        IDividendPool(dividendPool).depositDividend(dividendShare);
        totalDividendDistributed += dividendShare;

        emit RevenueDistributed(creatorShare, dividendShare, block.timestamp);
    }

    // ============ 查询功能 ============

    /**
     * @notice 获取当前包月订阅费用
     * @return 当前每月订阅的费用（$VIRTUAL）
     */
    function getMonthlySubscriptionFee() external view returns (uint256) {
        return monthlySubscriptionFee;
    }

    /**
     * @notice 获取统计数据
     * @return _totalSubscriptions 总包月订阅次数
     * @return _totalRevenue 总收入
     * @return _totalCreatorEarned 创作者累计收益
     * @return _totalDividendDistributed 累计分红池分配
     */
    function getStats() external view returns (
        uint256 _totalSubscriptions,
        uint256 _totalRevenue,
        uint256 _totalCreatorEarned,
        uint256 _totalDividendDistributed
    ) {
        return (
            totalSubscriptions,
            totalRevenue,
            totalCreatorEarned,
            totalDividendDistributed
        );
    }

    // ============ 管理功能 ============

    /**
     * @notice 更新包月订阅费用（仅创作者）
     * @param newFee 新的包月订阅费用
     */
    function updateSubscriptionFee(uint256 newFee) external onlyOwner {
        require(newFee > 0, "Fee must be greater than 0");
        require(newFee <= 100 ether, "Fee too high"); // 最高 100 $VIRTUAL

        uint256 oldFee = monthlySubscriptionFee;
        monthlySubscriptionFee = newFee;

        emit SubscriptionFeeUpdated(oldFee, newFee);
    }

    /**
     * @notice 更新分红池地址（仅创作者）
     * @param newDividendPool 新的分红池地址
     */
    function updateDividendPool(address newDividendPool) external onlyOwner {
        require(newDividendPool != address(0), "Invalid address");

        address oldPool = dividendPool;
        dividendPool = newDividendPool;

        emit DividendPoolUpdated(oldPool, newDividendPool);
    }

    /**
     * @notice 紧急提取（仅用于异常情况，需要多签治理）
     * @param token 代币地址
     * @param amount 提取金额
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token address");
        IERC20(token).transfer(owner(), amount);
    }
}
