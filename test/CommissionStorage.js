const { expect } = require("chai");

describe("CommissionStorage", function() {
  let CommissionStorage, owner, addr1, addr2, mockToken;

  // 在每个测试用例之前都会运行此代码块，主要是为了部署合约和设置初始状态
  beforeEach(async function() {
    // 部署ERC20Mock合约，我们首先部署它以用作后续的ERC20代币交互测试
    const MockToken = await ethers.getContractFactory("ERC20Mock");
    mockToken = await MockToken.deploy(ethers.utils.parseEther("100"));

    // 部署CommissionStorage合约
    CommissionStorage = await ethers.getContractFactory("CommissionStorage");
    commissionStorage = await CommissionStorage.deploy();
    [owner, addr1, addr2] = await ethers.getSigners();
  });

  // 测试向合约直接转账会报错
  it("Should fail when transfer eth to commissionLogic", async function() {

    await expect(
      owner.sendTransaction({
        to: commissionStorage.address,
        value: ethers.utils.parseEther("1"),
        gasLimit: 210000
      })
    ).to.be.revertedWith("function selector was not recognized and there's no fallback nor receive function");

  });

  // 测试提现eth 佣金余额不足的情况
  it("Should not allow withdraw eth when Insufficient", async function() {
    const depositAmount = ethers.utils.parseEther("10");
    const superDepositAmount = ethers.utils.parseEther("11");

    await commissionStorage.connect(addr1).updateBalance(addr2.address, commissionStorage.ETH(), depositAmount, {
      value : depositAmount
    });

    const balance = await commissionStorage.balances(addr2.address, commissionStorage.ETH());
    expect(balance).to.equal(depositAmount);

    await expect(
      commissionStorage.connect(addr2).withdrawEth(superDepositAmount)
    ).to.be.revertedWith("CS : Insufficient balance of sender");
  });

  // 测试提现erc20 token 佣金余额不足的情况
  it("Should not allow withdraw erc20 token when Insufficient", async function() {
    const depositAmount = ethers.utils.parseEther("10");
    const superDepositAmount = ethers.utils.parseEther("11");
    await mockToken.transfer(addr1.address, depositAmount);
    await mockToken.connect(addr1).approve(commissionStorage.address, depositAmount);
    await commissionStorage.connect(addr1).updateBalance(addr2.address, mockToken.address, depositAmount);

    const balance = await commissionStorage.balances(addr2.address, mockToken.address);
    expect(balance).to.equal(depositAmount);

    await expect(
      commissionStorage.connect(addr2).withdrawToken(mockToken.address, superDepositAmount)
    ).to.be.revertedWith("CS : Insufficient balance of sender");
  });

  // 测试提现erc20 token输入的token不存在的情况
  it("Should not allow withdraw erc20 token when token is not exist", async function() {
    const depositAmount = ethers.utils.parseEther("1");
    await expect(
      commissionStorage.connect(owner).withdrawToken(addr2.address, depositAmount)
    ).to.be.revertedWith("CS : No token");
  });

  // 测试提现erc20 token输入的余额等于0的情况
  it("Should not allow withdraw erc20 token when amount = 0", async function() {
    const depositAmount = ethers.utils.parseEther("0");
    await expect(
      commissionStorage.connect(owner).withdrawToken(mockToken.address, depositAmount)
    ).to.be.revertedWith("CS : Unvalid amount");
  });

  // 测试提现eth输入的余额等于0的情况
  it("Should not allow withdraw eth when amount = 0", async function() {
    const depositAmount = ethers.utils.parseEther("0");
    await expect(
      commissionStorage.connect(owner).withdrawEth(depositAmount)
    ).to.be.revertedWith("CS : Unvalid amount");
  });

  // 测试输入的余额等于0的情况
  it("Should not allow when _balance = 0", async function() {
    const depositAmount = ethers.utils.parseEther("0");
    await expect(
      commissionStorage.connect(owner).updateBalance(owner.address, commissionStorage.ETH(), depositAmount)
    ).to.be.revertedWith("CS : Unvalid balance");
  });

  // 测试eth存款金额与发送金额的不匹配情况
  it("Should not allow insufficient ETH deposit", async function() {
    const depositAmount = ethers.utils.parseEther("1");
    await expect(
      commissionStorage.connect(owner).updateBalance(owner.address, commissionStorage.ETH(), depositAmount, {
        value: ethers.utils.parseEther("0.5")
      })
    ).to.be.revertedWith("CS : Insufficient eth balance of sender");
  });

  // 测试erc20 token存款金额与发送金额的不匹配情况
  it("Should not allow insufficient ERC20 token deposit", async function() {
    const depositAmount = ethers.utils.parseEther("1000");
    await expect(
      commissionStorage.connect(owner).updateBalance(owner.address, mockToken.address, depositAmount)
    ).to.be.revertedWith("CS : Insufficient token balance of sender");
  });

  // 测试存储ETH功能是否正常
  it("Should allow owner to deposit ETH", async function() {
    const depositAmount = ethers.utils.parseEther("1");
    await commissionStorage.connect(owner).updateBalance(addr1.address, commissionStorage.ETH(), depositAmount, {
      value: depositAmount
    });

    const balance = await commissionStorage.balances(addr1.address, commissionStorage.ETH());
    expect(balance).to.equal(depositAmount);
  });

  // 测试存储ERC20代币功能是否正常
  it("Should allow owner to deposit ERC20 tokens", async function() {
    const depositAmount = ethers.utils.parseEther("10");
    await mockToken.transfer(addr1.address, depositAmount);
    await mockToken.connect(addr1).approve(commissionStorage.address, depositAmount);
    await commissionStorage.connect(addr1).updateBalance(addr2.address, mockToken.address, depositAmount);

    const balance = await commissionStorage.balances(addr2.address, mockToken.address);
    expect(balance).to.equal(depositAmount);
  });

  // 测试提现ETH功能是否正常
  it("Should allow withdrawal of ETH", async function() {
    const depositAmount = ethers.utils.parseEther("1");
    await commissionStorage.connect(owner).updateBalance(addr1.address, commissionStorage.ETH(), depositAmount, {
      value: depositAmount
    });

    await commissionStorage.connect(addr1).withdrawEth(ethers.utils.parseEther("0.6"));
    const balanceAfter = await commissionStorage.balances(addr1.address, commissionStorage.ETH());
    expect(balanceAfter).to.equal(ethers.utils.parseEther("0.4"));
  });

  // 测试提现Erc20token功能是否正常
  it("Should allow withdrawal of ERC20", async function() {
    const depositAmount = ethers.utils.parseEther("1");
    await mockToken.transfer(addr1.address, depositAmount);
    await mockToken.connect(addr1).approve(commissionStorage.address, depositAmount);
    await commissionStorage.connect(addr1).updateBalance(addr2.address, mockToken.address, depositAmount);

    await commissionStorage.connect(addr2).withdrawToken(mockToken.address, ethers.utils.parseEther("0.6"));
    const balanceAfter = await commissionStorage.balances(addr2.address, mockToken.address);
    expect(balanceAfter).to.equal(ethers.utils.parseEther("0.4"));

    const balanceUser = await mockToken.balanceOf(addr2.address);
    expect(balanceUser).to.equal(ethers.utils.parseEther("0.6"));
  });

});
