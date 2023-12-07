const { expect } = require("chai");
const { mock } = require("node:test");

describe("CommissionLogic", function() {
  let CommissionStorage, commissionLogic, owner, addr1, addr2, addr3, mockToken;
  const ETH = "0x0000000000000000000000000000000000000000";
  const ZEROADDRESS = "0x0000000000000000000000000000000000000000";

  // 在每个测试用例之前都会运行此代码块，主要是为了部署合约和设置初始状态
  beforeEach(async function() {
    // 部署ERC20Mock合约，我们首先部署它以用作后续的ERC20代币交互测试
    const MockToken = await ethers.getContractFactory("ERC20Mock");
    mockToken = await MockToken.deploy(ethers.utils.parseEther("100"));

    // 部署CommissionStorage合约
    CommissionStorage = await ethers.getContractFactory("CommissionStorage");
    commissionStorage = await CommissionStorage.deploy();

    // 部署CommissionLogic合约
    CommissionLogic = await ethers.getContractFactory("CommissionLogic");
    commissionLogic = await CommissionLogic.deploy(commissionStorage.address);

    [owner, addr1, addr2, addr3] = await ethers.getSigners();
  });

  // 测试向合约直接转账会报错
  it("Should fail when transfer eth to commissionLogic", async function() {

    await expect(
      owner.sendTransaction({
        to: commissionLogic.address,
        value: ethers.utils.parseEther("1"),
        gasLimit: 210000
      })
    ).to.be.revertedWith("function selector was not recognized and there's no fallback nor receive function");

  });

  // 测试data是向空的情况下，佣金是eth，并且向一个第三方地址转账eth的情况是否能正常进行
  it("Should successful if commission is eth and transfter eth", async function() {
    const thirdAddr = "0x1f9090aae28b8a3dceadf281b0f12828e676c326";
    const depositAmount = ethers.utils.parseEther("0.6");
    const transferTokenAmount = ethers.utils.parseEther("0.7");

    const thirdAddrOrgBalance = await ethers.provider.getBalance(thirdAddr);
    const addr1OrgEthBalance = await ethers.provider.getBalance(addr1.address);

    const receiver = [{
      holder : addr2.address,
      token : ETH,
      value : ethers.utils.parseEther("0.1")
    },{
      holder : addr3.address,
      token : ETH,
      value : ethers.utils.parseEther("0.5")
    }];
    await commissionLogic.connect(addr1).execute("0x", thirdAddr, receiver, {
      value:depositAmount.add(transferTokenAmount)
    });

    const commissionLogicBalance = await ethers.provider.getBalance(commissionLogic.address);
    expect(commissionLogicBalance).to.equal(0);

    const commissionStorageBalance = await ethers.provider.getBalance(commissionStorage.address);
    expect(commissionStorageBalance).to.equal(depositAmount);

    const balance = await commissionStorage.balances(addr2.address, ETH);
    expect(balance).to.equal(ethers.utils.parseEther("0.1"));

    const balance3 = await commissionStorage.balances(addr3.address, ETH);
    expect(balance3).to.equal(ethers.utils.parseEther("0.5"));

    const addr1EthBalance = await ethers.provider.getBalance(addr1.address);
    expect(addr1EthBalance).to.be.lt(addr1OrgEthBalance.sub(depositAmount));

    const thirdAddrBalance = await ethers.provider.getBalance(thirdAddr);
    expect(thirdAddrBalance).to.equal(transferTokenAmount.add(thirdAddrOrgBalance));

  });

  // 测试data是空的情况下，佣金是eth, 接受佣金的人是多个的情况下, 余额不足应该执行失败
  it("Should fail execute with eth and multil receivers when Insufficient balance", async function() {
    const depositAmount = ethers.utils.parseEther("0.6");

    const receivers = [{
      holder : addr1.address,
      token : ETH,
      value : ethers.utils.parseEther("0.1")
    },{
      holder : addr2.address,
      token : ETH,
      value : ethers.utils.parseEther("0.51")
    }];
    await expect(
      commissionLogic.execute("0x", addr1.address, receivers, {
        value : depositAmount
      })
    ).to.be.revertedWith("CL : Insufficient eth balance of sender");

  });

  // 测试data是空的情况下，佣金是eth, 接受佣金的人是多个的情况下是否能正常执行
  it("Should successfully execute with eth and multil receivers", async function() {
    const depositAmount = ethers.utils.parseEther("0.6");

    const receivers = [{
      holder : addr1.address,
      token : ETH,
      value : ethers.utils.parseEther("0.1")
    },{
      holder : addr2.address,
      token : ETH,
      value : ethers.utils.parseEther("0.5")
    }];
    
    await commissionLogic.execute("0x", addr1.address, receivers, {
      value : depositAmount
    });

    const commissionLogicBalance = await ethers.provider.getBalance(commissionLogic.address);
    expect(commissionLogicBalance).to.equal(0);

    const commissionStorageBalance = await ethers.provider.getBalance(commissionStorage.address);
    expect(commissionStorageBalance).to.equal(depositAmount);

    const balance1 = await commissionStorage.balances(addr1.address, ETH);
    expect(balance1).to.equal(ethers.utils.parseEther("0.1"));
    const balance2 = await commissionStorage.balances(addr2.address, ETH);
    expect(balance2).to.equal(ethers.utils.parseEther("0.5"));

  });

  // 测试data是空的情况下，佣金是erc20 token, 接受佣金的人是多个的情况下, 授权余额不足是否能正常执行
  it("Should fail execute with ERC20 token and multil receivers when Insufficient balance", async function() {
    const depositAmount = ethers.utils.parseEther("0.6");
    await mockToken.transfer(addr1.address, depositAmount);
    await mockToken.connect(addr1).approve(commissionLogic.address, depositAmount);

    const receivers = [{
      holder : addr2.address,
      token : mockToken.address,
      value : ethers.utils.parseEther("0.1")
    },{
      holder : addr3.address,
      token : mockToken.address,
      value : ethers.utils.parseEther("0.6")
    }];
    
    await expect(
      commissionLogic.connect(addr1).execute("0x", addr1.address, receivers)
    ).to.be.revertedWith("CL : Insufficient token balance of sender");

  });

  // 测试data是空的情况下，佣金是erc20 token, 接受佣金的人是多个的情况下, 授权余额不足是否能正常执行
  it("Should fail execute with ERC20 token and multil receivers when Insufficient allowance", async function() {
    const depositAmount = ethers.utils.parseEther("0.6");
    await mockToken.approve(commissionLogic.address, depositAmount);

    const receivers = [{
      holder : addr1.address,
      token : mockToken.address,
      value : ethers.utils.parseEther("0.1")
    },{
      holder : addr2.address,
      token : mockToken.address,
      value : ethers.utils.parseEther("0.6")
    }];

    await expect(
      commissionLogic.execute("0x", addr1.address, receivers)
    ).to.be.revertedWith("CL : Insufficient token allowance balance of this");

  });

  // 测试data是空的情况下，佣金是erc20 token, 接受佣金的人是多个的情况下是否能正常执行
  it("Should successfully execute with ERC20 token and multil receivers", async function() {
    const depositAmount = ethers.utils.parseEther("0.6");
    await mockToken.approve(commissionLogic.address, depositAmount);

    const receivers = [{
      holder : addr1.address,
      token : mockToken.address,
      value : ethers.utils.parseEther("0.1")
    },{
      holder : addr2.address,
      token : mockToken.address,
      value : ethers.utils.parseEther("0.5")
    }];
    
    await commissionLogic.execute("0x", addr1.address, receivers);

    const commissionLogicBalance = await mockToken.balanceOf(commissionLogic.address);
    expect(commissionLogicBalance).to.equal(0);

    const commissionStorageBalance = await mockToken.balanceOf(commissionStorage.address);
    expect(commissionStorageBalance).to.equal(depositAmount);

    const balance1 = await commissionStorage.balances(addr1.address, mockToken.address);
    expect(balance1).to.equal(ethers.utils.parseEther("0.1"));
    const balance2 = await commissionStorage.balances(addr2.address, mockToken.address);
    expect(balance2).to.equal(ethers.utils.parseEther("0.5"));

  });

  // 测试data是向addr2转移erc20token的情况下，佣金是eth，是否能正常进行
  it("Should successful if commission is eth and transfter erc20 token to addr2", async function() {
    const depositAmount = ethers.utils.parseEther("0.6");
    const transferTokenAmount = ethers.utils.parseEther("0.7");

    const addr1OrgEthBalance = await ethers.provider.getBalance(addr1.address);

    await mockToken.approve(commissionLogic.address, transferTokenAmount);
    let data = mockToken.interface.encodeFunctionData("transferFrom(address,address,uint256)", [owner.address, addr2.address, transferTokenAmount]);

    const receiver = [{
      holder : addr2.address,
      token : ETH,
      value : ethers.utils.parseEther("0.1")
    },{
      holder : addr3.address,
      token : ETH,
      value : ethers.utils.parseEther("0.5")
    }];
    await commissionLogic.connect(addr1).execute(data, mockToken.address, receiver, {
      value:depositAmount
    });

    const commissionLogicBalance = await ethers.provider.getBalance(commissionLogic.address);
    expect(commissionLogicBalance).to.equal(0);

    const commissionStorageBalance = await ethers.provider.getBalance(commissionStorage.address);
    expect(commissionStorageBalance).to.equal(depositAmount);

    const balance = await commissionStorage.balances(addr2.address, ETH);
    expect(balance).to.equal(ethers.utils.parseEther("0.1"));

    const balance3 = await commissionStorage.balances(addr3.address, ETH);
    expect(balance3).to.equal(ethers.utils.parseEther("0.5"));

    const addr1EthBalance = await ethers.provider.getBalance(addr1.address);
    expect(addr1EthBalance).to.be.lt(addr1OrgEthBalance.sub(depositAmount));

    const addr2TokenBalance = await mockToken.balanceOf(addr2.address);
    expect(addr2TokenBalance).to.equal(transferTokenAmount);

  });

  // 测试data是空的情况下，佣金是erc20 token，但是转账给addr2地址eth，是否能正常进行
  it("Should successful if commission is ERC20 token and transfter eth", async function() {
    const depositAmount = ethers.utils.parseEther("0.6");
    const transferEthAmount = ethers.utils.parseEther("0.7");

    const addr2OrgEthBalance = await ethers.provider.getBalance(addr2.address);
    const addr1OrgEthBalance = await ethers.provider.getBalance(addr1.address);

    await mockToken.transfer(addr1.address, depositAmount);
    await mockToken.connect(addr1).approve(commissionLogic.address, depositAmount);
    const userBalance = await mockToken.balanceOf(addr1.address);
    expect(userBalance).to.equal(depositAmount);

    const receiver = [{
      holder : addr2.address,
      token : mockToken.address,
      value : depositAmount
    }];
    await commissionLogic.connect(addr1).execute("0x", addr2.address, receiver, {
      value:transferEthAmount
    });

    const commissionLogicBalance = await mockToken.balanceOf(commissionLogic.address);
    expect(commissionLogicBalance).to.equal(0);

    const commissionStorageBalance = await mockToken.balanceOf(commissionStorage.address);
    expect(commissionStorageBalance).to.equal(depositAmount);

    const balance = await commissionStorage.balances(addr2.address, mockToken.address);
    expect(balance).to.equal(depositAmount);

    const addr1EthBalance = await ethers.provider.getBalance(addr1.address);
    expect(addr1EthBalance).to.be.lt(addr1OrgEthBalance.sub(transferEthAmount));

    const addr2EthBalance = await ethers.provider.getBalance(addr2.address);
    expect(addr2EthBalance).to.equal(addr2OrgEthBalance.add(transferEthAmount));

  });

  // 测试输入的to是空地址的情况下，应该报错
  it("Should fail if to is address(0)", async function() {
    const depositAmount = ethers.utils.parseEther("0.6");
    const receiver = [{
      holder : addr2.address,
      token : mockToken.address,
      value : depositAmount
    }];

    await expect(
      commissionLogic.connect(addr1).execute("0x", ZEROADDRESS, receiver)
    ).to.be.revertedWith("CL : Unvalid to address");

  });

  // 测试data是空的情况下，佣金是erc20 token，授权给commissionLogic不足的情况下应该报错
  it("Should fail if Insufficient allowance ERC20 token", async function() {
    const depositAmount = ethers.utils.parseEther("0.6");
    const superDepositAmount = ethers.utils.parseEther("0.5");

    await mockToken.transfer(addr1.address, depositAmount);
    await mockToken.connect(addr1).approve(commissionLogic.address, superDepositAmount);
    const userBalance = await mockToken.balanceOf(addr1.address);
    expect(userBalance).to.equal(depositAmount);

    const receiver = [{
      holder : addr2.address,
      token : mockToken.address,
      value : depositAmount
    }];

    await expect(
      commissionLogic.connect(addr1).execute("0x", addr1.address, receiver)
    ).to.be.revertedWith("CL : Insufficient token allowance balance of this");

  });

  // 测试data是空的情况下，佣金是eth，余额不足的情况下应该报错
  it("Should fail if Insufficient eth", async function() {
    const depositAmount = ethers.utils.parseEther("0.7");
    const superDepositAmount = ethers.utils.parseEther("0.8");
    const receiver = [{
      holder : addr2.address,
      token : ETH,
      value : superDepositAmount
    }];
    await expect(
    commissionLogic.connect(addr1).execute("0x", addr1.address, receiver, {
      value: depositAmount
    })
    ).to.be.revertedWith("CL : Insufficient eth balance of sender");

  });

  // 测试data是空的情况下，佣金是erc20 token，余额不足的情况下应该报错
  it("Should fail if Insufficient ERC20 token", async function() {
    const depositAmount = ethers.utils.parseEther("0.6");
    const superDepositAmount = ethers.utils.parseEther("0.7");

    await mockToken.transfer(addr1.address, depositAmount);
    await mockToken.connect(addr1).approve(commissionLogic.address, depositAmount);
    const userBalance = await mockToken.balanceOf(addr1.address);
    expect(userBalance).to.equal(depositAmount);

    const receiver = [{
      holder : addr2.address,
      token : mockToken.address,
      value : superDepositAmount
    }];

    await expect(
      commissionLogic.connect(addr1).execute("0x", addr1.address, receiver)
    ).to.be.revertedWith("CL : Insufficient token balance of sender");

  });

  // 测试data是空的情况下，佣金是erc20 token是否能正常执行
  it("Should successfully execute with ERC20 token", async function() {
    const depositAmount = ethers.utils.parseEther("0.6");
    await mockToken.transfer(addr1.address, depositAmount);
    await mockToken.connect(addr1).approve(commissionLogic.address, depositAmount);
    const userBalance = await mockToken.balanceOf(addr1.address);
    expect(userBalance).to.equal(depositAmount);

    const receiver = [{
      holder : addr2.address,
      token : mockToken.address,
      value : depositAmount
    }];
    await commissionLogic.connect(addr1).execute("0x", addr1.address, receiver);

    const commissionLogicBalance = await mockToken.balanceOf(commissionLogic.address);
    expect(commissionLogicBalance).to.equal(0);

    const commissionStorageBalance = await mockToken.balanceOf(commissionStorage.address);
    expect(commissionStorageBalance).to.equal(depositAmount);

    const balance = await commissionStorage.balances(addr2.address, mockToken.address);
    expect(balance).to.equal(depositAmount);

  });

  // 测试data是空的情况下，佣金是eth 是否能正常执行
  it("Should successfully execute with eth", async function() {
    const depositAmount = ethers.utils.parseEther("0.7");
    const receiver = [{
      holder : addr2.address,
      token : ETH,
      value : depositAmount
    }];
    await commissionLogic.connect(addr1).execute("0x", addr1.address, receiver, {
      value: depositAmount
    });

    const commissionLogicBalance = await ethers.provider.getBalance(commissionLogic.address);
    expect(commissionLogicBalance).to.equal(0);

    const commissionStorageBalance = await ethers.provider.getBalance(commissionStorage.address);
    expect(commissionStorageBalance).to.equal(depositAmount);

    const balance = await commissionStorage.balances(addr2.address, ETH);
    expect(balance).to.equal(depositAmount);

  });

});
