// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GameDividendPool
 * @notice $GAME 持有者分红池合约
 * @dev 采用累积快照机制，用户主动 Claim 分红
 */

contract GameDividendPool is ReentrancyGuard {
    // ============ 状态变量 ============

    IERC20 public immutable gameToken;        // $GAME 代币合约
    IERC20 public immutable virtualToken;      // $VIRTUAL 代币合约

    uint256 public totalDividendPool;          // 累积的总分红池
    uint256 public totalDividendPerShare;      // 每个代币累积的分红（精度放大 1e18）
    uint256 public totalClaimed;               // 累计已提取分红

    // 用户状态
    mapping(address => uint256) public lastClaimedPerShare; // 用户上次提取时的 perShare
    mapping(address => uint256) public userTotalClaimed;    // 用户累计提取的 $VIRTUAL 金额

    // ============ 事件 ============

    event DividendDeposited(uint256 amount, uint256 newTotalPerShare, uint256 timestamp);
    event DividendClaimed(address indexed user, uint256 amount, uint256 timestamp);

    // ============ 构造函数 ============

    constructor(address _gameToken, address _virtualToken) {
        require(_gameToken != address(0), "Invalid GAME token address");
        require(_virtualToken != address(0), "Invalid VIRTUAL token address");

        gameToken = IERC20(_gameToken);
        virtualToken = IERC20(_virtualToken);
    }

    // ============ 核心功能 ============

    /**
     * @notice 存入新的分红（由 GameInferencePayment 合约调用）
     * @param amount 分红金额（$VIRTUAL）
     */
    function depositDividend(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");

        // 转账 $VIRTUAL 到合约
        virtualToken.transferFrom(msg.sender, address(this), amount);

        // 获取当前 $GAME 总供应量
        uint256 totalSupply = gameToken.totalSupply();
        require(totalSupply > 0, "No token holders");

        // 更新全局每股分红（精度放大 1e18）
        uint256 dividendPerShare = (amount * 1e18) / totalSupply;
        totalDividendPerShare += dividendPerShare;
        totalDividendPool += amount;

        emit DividendDeposited(amount, totalDividendPerShare, block.timestamp);
    }

    /**
     * @notice 用户主动提取分红
     * @return claimable 提取的分红金额
     */
    function claimDividend() external nonReentrant returns (uint256 claimable) {
        claimable = _calculatePendingDividend(msg.sender);
        require(claimable > 0, "No dividends to claim");

        // 更新用户状态
        lastClaimedPerShare[msg.sender] = totalDividendPerShare;
        userTotalClaimed[msg.sender] += claimable;
        totalClaimed += claimable;

        // 转账 $VIRTUAL 给用户
        virtualToken.transfer(msg.sender, claimable);

        emit DividendClaimed(msg.sender, claimable, block.timestamp);

        return claimable;
    }

    // ============ 查询功能 ============

    /**
     * @notice 查询用户可提取的分红
     * @param user 用户地址
     * @return 可提取的分红金额（$VIRTUAL）
     */
    function getPendingDividend(address user) external view returns (uint256) {
        return _calculatePendingDividend(user);
    }

    /**
     * @notice 内部函数：计算用户待提取分红
     * @param user 用户地址
     * @return 待提取分红金额
     */
    function _calculatePendingDividend(address user) internal view returns (uint256) {
        uint256 userBalance = gameToken.balanceOf(user);
        if (userBalance == 0) {
            return 0;
        }

        // 计算新增的每股分红
        uint256 newDividendPerShare = totalDividendPerShare - lastClaimedPerShare[user];

        // 计算用户应得分红
        return (userBalance * newDividendPerShare) / 1e18;
    }

    /**
     * @notice 获取用户的分红统计
     * @param user 用户地址
     * @return pending 待提取分红
     * @return claimed 累计已提取分红
     * @return gameBalance 当前 $GAME 持有量
     */
    function getUserDividendInfo(address user) external view returns (
        uint256 pending,
        uint256 claimed,
        uint256 gameBalance
    ) {
        pending = _calculatePendingDividend(user);
        claimed = userTotalClaimed[user];
        gameBalance = gameToken.balanceOf(user);
    }

    /**
     * @notice 获取分红池统计数据
     * @return _totalDividendPool 累积总分红池
     * @return _totalClaimed 累计已提取
     * @return _totalPending 累计待提取
     * @return _totalDividendPerShare 当前每股累积分红
     */
    function getPoolStats() external view returns (
        uint256 _totalDividendPool,
        uint256 _totalClaimed,
        uint256 _totalPending,
        uint256 _totalDividendPerShare
    ) {
        uint256 totalPending = totalDividendPool - totalClaimed;

        return (
            totalDividendPool,
            totalClaimed,
            totalPending,
            totalDividendPerShare
        );
    }

    /**
     * @notice 批量查询用户分红（用于前端展示）
     * @param users 用户地址数组
     * @return pendings 每个用户的待提取分红
     */
    function batchGetPendingDividends(address[] calldata users)
        external
        view
        returns (uint256[] memory pendings)
    {
        pendings = new uint256[](users.length);
        for (uint256 i = 0; i < users.length; i++) {
            pendings[i] = _calculatePendingDividend(users[i]);
        }
    }
}
