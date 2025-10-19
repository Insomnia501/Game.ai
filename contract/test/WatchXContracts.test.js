const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("GAME.ai Agent Contracts", function () {
  // 部署合约的 fixture
  async function deployContractsFixture() {
    const [owner, user1, user2, user3] = await ethers.getSigners();

    // 部署 Mock $VIRTUAL 代币（用于测试）
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const virtualToken = await MockERC20.deploy("Virtual Token", "VIRTUAL", ethers.utils.parseEther("1000000"));

    // 部署 Mock $WATCH 代币（用于测试）
    const watchToken = await MockERC20.deploy("WatchX Token", "WATCH", ethers.utils.parseEther("1000000000"));

    // 部署分红池合约
    const GameDividendPool = await ethers.getContractFactory("GameDividendPool");
    const dividendPool = await GameDividendPool.deploy(
      watchToken.address,
      virtualToken.address
    );

    // 部署 AI 推理支付合约
    const GameInferencePayment = await ethers.getContractFactory("GameInferencePayment");
    const inferencePayment = await GameInferencePayment.deploy(
      virtualToken.address,
      dividendPool.address,
      owner.address
    );

    // 给用户分配代币
    await virtualToken.transfer(user1.address, ethers.utils.parseEther("100"));
    await virtualToken.transfer(user2.address, ethers.utils.parseEther("100"));
    await virtualToken.transfer(user3.address, ethers.utils.parseEther("100"));

    await watchToken.transfer(user1.address, ethers.utils.parseEther("100000"));
    await watchToken.transfer(user2.address, ethers.utils.parseEther("200000"));
    await watchToken.transfer(user3.address, ethers.utils.parseEther("300000"));

    return {
      virtualToken,
      watchToken,
      dividendPool,
      inferencePayment,
      owner,
      user1,
      user2,
      user3,
    };
  }

  describe("GameInferencePayment", function () {
    describe("部署", function () {
      it("应该正确设置初始参数", async function () {
        const { inferencePayment, virtualToken, dividendPool, owner } =
          await loadFixture(deployContractsFixture);

        expect(await inferencePayment.virtualToken()).to.equal(await virtualToken.address);
        expect(await inferencePayment.dividendPool()).to.equal(await dividendPool.address);
        expect(await inferencePayment.owner()).to.equal(owner.address);
        expect(await inferencePayment.serviceFee()).to.equal(ethers.utils.parseEther("0.1"));
      });
    });

    describe("支付 AI 咨询", function () {
      it("应该允许用户支付并生成 sessionId", async function () {
        const { inferencePayment, virtualToken, user1 } = await loadFixture(deployContractsFixture);

        const serviceFee = await inferencePayment.serviceFee();

        // 用户授权合约使用代币
        virtualToken.connect(user1).approve(await inferencePayment.address, serviceFee);

        // 支付咨询
        const tx = await inferencePayment.connect(user1).payForInference();
        const receipt = await tx.wait();

        // 查找 InferencePaid 事件
        const event = receipt.logs.find(
          (log) => log.fragment && log.fragment.name === "InferencePaid"
        );

        expect(event).to.not.be.undefined;
        expect(event.args.user).to.equal(user1.address);
        expect(event.args.cost).to.equal(serviceFee);
      });

      it("应该正确分配收益（30% 创作者，70% 分红池）", async function () {
        const { inferencePayment, virtualToken, dividendPool, owner, user1 } =
          await loadFixture(deployContractsFixture);

        const serviceFee = await inferencePayment.serviceFee();
        const creatorShare = (serviceFee * 30n) / 100n;
        const dividendShare = (serviceFee * 70n) / 100n;

        const ownerBalanceBefore = await virtualToken.balanceOf(owner.address);
        const poolBalanceBefore = await virtualToken.balanceOf(await dividendPool.address);

        // 用户授权并支付
        virtualToken.connect(user1).approve(await inferencePayment.address, serviceFee);
        await inferencePayment.connect(user1).payForInference();

        const ownerBalanceAfter = await virtualToken.balanceOf(owner.address);
        const poolBalanceAfter = await virtualToken.balanceOf(await dividendPool.address);

        expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(creatorShare);
        expect(poolBalanceAfter - poolBalanceBefore).to.equal(dividendShare);
      });

      it("应该更新统计数据", async function () {
        const { inferencePayment, virtualToken, user1, user2 } =
          await loadFixture(deployContractsFixture);

        const serviceFee = await inferencePayment.serviceFee();

        // User1 咨询 2 次
        virtualToken.connect(user1).approve(await inferencePayment.address, serviceFee * 2n);
        await inferencePayment.connect(user1).payForInference();
        await inferencePayment.connect(user1).payForInference();

        // User2 咨询 1 次
        virtualToken.connect(user2).approve(await inferencePayment.address, serviceFee);
        await inferencePayment.connect(user2).payForInference();

        expect(await inferencePayment.totalConsultations()).to.equal(3);
        expect(await inferencePayment.totalRevenue()).to.equal(serviceFee * 3n);
        expect(await inferencePayment.userConsultations(user1.address)).to.equal(2);
        expect(await inferencePayment.userConsultations(user2.address)).to.equal(1);
      });
    });

    describe("管理功能", function () {
      it("应该允许创作者更新服务费用", async function () {
        const { inferencePayment, owner } = await loadFixture(deployContractsFixture);

        const newFee = ethers.utils.parseEther("0.2");
        await inferencePayment.connect(owner).updateServiceFee(newFee);

        expect(await inferencePayment.serviceFee()).to.equal(newFee);
      });

      it("应该拒绝非创作者更新服务费用", async function () {
        const { inferencePayment, user1 } = await loadFixture(deployContractsFixture);

        const newFee = ethers.utils.parseEther("0.2");
        await expect(
          inferencePayment.connect(user1).updateServiceFee(newFee)
        ).to.be.revertedWithCustomError(inferencePayment, "OwnableUnauthorizedAccount");
      });

      it("应该允许创作者更新分红池地址", async function () {
        const { inferencePayment, owner, user1 } = await loadFixture(deployContractsFixture);

        await inferencePayment.connect(owner).updateDividendPool(user1.address);

        expect(await inferencePayment.dividendPool()).to.equal(user1.address);
      });
    });
  });

  describe("GameDividendPool", function () {
    describe("部署", function () {
      it("应该正确设置初始参数", async function () {
        const { dividendPool, watchToken, virtualToken } = await loadFixture(deployContractsFixture);

        expect(await dividendPool.watchToken()).to.equal(await watchToken.address);
        expect(await dividendPool.virtualToken()).to.equal(await virtualToken.address);
        expect(await dividendPool.totalDividendPool()).to.equal(0);
      });
    });

    describe("存入分红", function () {
      it("应该允许存入分红", async function () {
        const { dividendPool, virtualToken, owner } = await loadFixture(deployContractsFixture);

        const amount = ethers.utils.parseEther("10");
        virtualToken.approve(await dividendPool.address, amount);
        await dividendPool.depositDividend(amount);

        expect(await dividendPool.totalDividendPool()).to.equal(amount);
      });

      it("应该正确更新 totalDividendPerShare", async function () {
        const { dividendPool, virtualToken, watchToken, owner } =
          await loadFixture(deployContractsFixture);

        const amount = ethers.utils.parseEther("100");
        const totalSupply = await watchToken.totalSupply();
        const expectedPerShare = (amount * ethers.utils.parseEther("1")) / totalSupply;

        virtualToken.approve(await dividendPool.address, amount);
        await dividendPool.depositDividend(amount);

        expect(await dividendPool.totalDividendPerShare()).to.equal(expectedPerShare);
      });
    });

    describe("提取分红", function () {
      it("应该允许持有者提取分红", async function () {
        const { dividendPool, virtualToken, watchToken, inferencePayment, user1 } =
          await loadFixture(deployContractsFixture);

        // 用户支付 AI 咨询，产生分红
        const serviceFee = await inferencePayment.serviceFee();
        virtualToken.connect(user1).approve(await inferencePayment.address, serviceFee);
        await inferencePayment.connect(user1).payForInference();

        // 检查用户可提取分红
        const pendingBefore = await dividendPool.getPendingDividend(user1.address);
        expect(pendingBefore).to.be.gt(0);

        // 提取分红
        const balanceBefore = await virtualToken.balanceOf(user1.address);
        await dividendPool.connect(user1).claimDividend();
        const balanceAfter = await virtualToken.balanceOf(user1.address);

        expect(balanceAfter - balanceBefore).to.equal(pendingBefore);

        // 提取后待提取分红应该为 0
        const pendingAfter = await dividendPool.getPendingDividend(user1.address);
        expect(pendingAfter).to.equal(0);
      });

      it("应该正确计算多个持有者的分红", async function () {
        const { dividendPool, virtualToken, watchToken, inferencePayment, user1, user2, user3 } =
          await loadFixture(deployContractsFixture);

        // 用户持仓情况
        const user1Balance = await watchToken.balanceOf(user1.address);
        const user2Balance = await watchToken.balanceOf(user2.address);
        const user3Balance = await watchToken.balanceOf(user3.address);
        const totalSupply = await watchToken.totalSupply();

        // 产生分红
        const serviceFee = await inferencePayment.serviceFee();
        virtualToken.connect(user1).approve(await inferencePayment.address, serviceFee);
        await inferencePayment.connect(user1).payForInference();

        const totalDividend = (serviceFee * 70n) / 100n;

        // 计算预期分红
        const expectedUser1 = (totalDividend * user1Balance) / totalSupply;
        const expectedUser2 = (totalDividend * user2Balance) / totalSupply;
        const expectedUser3 = (totalDividend * user3Balance) / totalSupply;

        // 验证实际分红
        const actualUser1 = await dividendPool.getPendingDividend(user1.address);
        const actualUser2 = await dividendPool.getPendingDividend(user2.address);
        const actualUser3 = await dividendPool.getPendingDividend(user3.address);

        // 允许一些精度损失（由于整数除法）
        expect(actualUser1).to.be.closeTo(expectedUser1, ethers.utils.parseEther("0.0001"));
        expect(actualUser2).to.be.closeTo(expectedUser2, ethers.utils.parseEther("0.0001"));
        expect(actualUser3).to.be.closeTo(expectedUser3, ethers.utils.parseEther("0.0001"));
      });

      it("应该允许多次提取分红", async function () {
        const { dividendPool, virtualToken, inferencePayment, user1, user2 } =
          await loadFixture(deployContractsFixture);

        const serviceFee = await inferencePayment.serviceFee();

        // 第一次产生分红
        virtualToken.connect(user1).approve(await inferencePayment.address, serviceFee);
        await inferencePayment.connect(user1).payForInference();

        const pending1 = await dividendPool.getPendingDividend(user2.address);
        await dividendPool.connect(user2).claimDividend();

        // 第二次产生分红
        virtualToken.connect(user1).approve(await inferencePayment.address, serviceFee);
        await inferencePayment.connect(user1).payForInference();

        const pending2 = await dividendPool.getPendingDividend(user2.address);
        await dividendPool.connect(user2).claimDividend();

        // 两次分红应该相等（因为持仓未变）
        expect(pending2).to.be.closeTo(pending1, ethers.utils.parseEther("0.0001"));

        // 累计提取分红
        const totalClaimed = await dividendPool.userTotalClaimed(user2.address);
        expect(totalClaimed).to.be.closeTo(pending1 + pending2, ethers.utils.parseEther("0.0001"));
      });
    });

    describe("查询功能", function () {
      it("应该正确返回用户分红信息", async function () {
        const { dividendPool, virtualToken, inferencePayment, watchToken, user1 } =
          await loadFixture(deployContractsFixture);

        // 产生分红
        const serviceFee = await inferencePayment.serviceFee();
        virtualToken.connect(user1).approve(await inferencePayment.address, serviceFee);
        await inferencePayment.connect(user1).payForInference();

        const info = await dividendPool.getUserDividendInfo(user1.address);
        expect(info.pending).to.be.gt(0);
        expect(info.claimed).to.equal(0);
        expect(info.watchBalance).to.equal(await watchToken.balanceOf(user1.address));

        // 提取后再查询
        await dividendPool.connect(user1).claimDividend();
        const infoAfter = await dividendPool.getUserDividendInfo(user1.address);
        expect(infoAfter.pending).to.equal(0);
        expect(infoAfter.claimed).to.equal(info.pending);
      });

      it("应该正确返回分红池统计数据", async function () {
        const { dividendPool, virtualToken, inferencePayment, user1, user2 } =
          await loadFixture(deployContractsFixture);

        const serviceFee = await inferencePayment.serviceFee();

        // 产生两次分红
        virtualToken.connect(user1).approve(await inferencePayment.address, serviceFee * 2n);
        await inferencePayment.connect(user1).payForInference();
        await inferencePayment.connect(user1).payForInference();

        const stats = await dividendPool.getPoolStats();
        const expectedTotal = (serviceFee * 70n * 2n) / 100n;

        expect(stats._totalDividendPool).to.equal(expectedTotal);
        expect(stats._totalClaimed).to.equal(0);
        expect(stats._totalPending).to.equal(expectedTotal);

        // 用户提取后再查询
        await dividendPool.connect(user2).claimDividend();
        const statsAfter = await dividendPool.getPoolStats();
        expect(statsAfter._totalClaimed).to.be.gt(0);
      });
    });
  });

  describe("集成测试", function () {
    it("完整流程：支付咨询 → 产生分红 → 提取分红", async function () {
      const { inferencePayment, dividendPool, virtualToken, watchToken, user1, user2 } =
        await loadFixture(deployContractsFixture);

      const serviceFee = await inferencePayment.serviceFee();
      const user2WatchBalance = await watchToken.balanceOf(user2.address);
      const totalSupply = await watchToken.totalSupply();

      // User1 支付 AI 咨询
      virtualToken.connect(user1).approve(await inferencePayment.address, serviceFee);
      await inferencePayment.connect(user1).payForInference();

      // 计算 User2 应得分红
      const totalDividend = (serviceFee * 70n) / 100n;
      const expectedDividend = (totalDividend * user2WatchBalance) / totalSupply;

      // User2 提取分红
      const balanceBefore = await virtualToken.balanceOf(user2.address);
      await dividendPool.connect(user2).claimDividend();
      const balanceAfter = await virtualToken.balanceOf(user2.address);

      expect(balanceAfter - balanceBefore).to.be.closeTo(expectedDividend, ethers.utils.parseEther("0.0001"));
    });

    it("多用户多次咨询的分红计算", async function () {
      const { inferencePayment, dividendPool, virtualToken, user1, user2, user3 } =
        await loadFixture(deployContractsFixture);

      const serviceFee = await inferencePayment.serviceFee();

      // User1 咨询 3 次
      virtualToken.connect(user1).approve(await inferencePayment.address, serviceFee * 3n);
      for (let i = 0; i < 3; i++) {
        await inferencePayment.connect(user1).payForInference();
      }

      // User2 咨询 2 次
      virtualToken.connect(user2).approve(await inferencePayment.address, serviceFee * 2n);
      for (let i = 0; i < 2; i++) {
        await inferencePayment.connect(user2).payForInference();
      }

      // 总咨询次数应该是 5
      expect(await inferencePayment.totalConsultations()).to.equal(5);

      // 总分红应该是 5 * 0.1 * 70% = 0.35 $VIRTUAL
      const expectedTotalDividend = (serviceFee * 5n * 70n) / 100n;
      const stats = await dividendPool.getPoolStats();
      expect(stats._totalDividendPool).to.equal(expectedTotalDividend);

      // 所有用户提取分红
      await dividendPool.connect(user1).claimDividend();
      await dividendPool.connect(user2).claimDividend();
      await dividendPool.connect(user3).claimDividend();

      // 所有待提取分红应该接近 0（允许精度误差）
      const statsAfter = await dividendPool.getPoolStats();
      expect(statsAfter._totalPending).to.be.closeTo(0, ethers.utils.parseEther("0.001"));
    });
  });
});
