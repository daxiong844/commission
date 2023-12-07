const { expect } = require('chai')
const { mock } = require('node:test')

describe('BatchCommission', function () {
  let CommissionStorage, batchCommission, owner, addr1, addr2, addr3, mockToken
  const ETH = '0x0000000000000000000000000000000000000000'
  const ZEROADDRESS = '0x0000000000000000000000000000000000000000'

  // 在每个测试用例之前都会运行此代码块，主要是为了部署合约和设置初始状态
  beforeEach(async function () {
    // 部署ERC20Mock合约，我们首先部署它以用作后续的ERC20代币交互测试
    const MockToken = await ethers.getContractFactory('ERC20Mock')
    mockToken = await MockToken.deploy(ethers.utils.parseEther('100'))

    // 部署CommissionStorage合约
    CommissionStorage = await ethers.getContractFactory('CommissionStorage')
    commissionStorage = await CommissionStorage.deploy()

    // 部署BatchCommission合约
    BatchCommission = await ethers.getContractFactory('BatchCommission')
    batchCommission = await BatchCommission.deploy()
    // 初始化交易单合约所需的状态
    await batchCommission.initialize(commissionStorage.address)
    ;[owner, addr1, addr2, addr3] = await ethers.getSigners()
  })

  it('向合约直接转账会报错', async function () {
    await expect(
      owner.sendTransaction({
        to: batchCommission.address,
        value: ethers.utils.parseEther('1'),
        gasLimit: 210000
      })
    ).to.be.revertedWith("function selector was not recognized and there's no fallback nor receive function")
  })

  // 测试depositCommission方法
  describe('存入佣金', function () {
    it('佣金是eth,一个人,应该执行成功的情况', async function () {
      const key = '0x'
      const commissionInfos = [{ user: addr1.address, token: ETH, balance: ethers.utils.parseEther('1') }]

      // 使用 await 确保等待交易被确认
      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos, { value: ethers.utils.parseEther('1') })).to.emit(batchCommission, 'CommissionDeposited')

      // 检查commissionInfos是否正确存储在合约状态中
      const storedCommissionInfos = await batchCommission.userCommissionInfo(owner.address, key, 0)

      // console.log(storedCommissionInfos)

      expect(storedCommissionInfos[0]).to.equal(addr1.address)
      expect(storedCommissionInfos[1]).to.equal(ETH)
      expect(storedCommissionInfos[2]).to.equal(ethers.utils.parseEther('1'))

      // 确保余额已相应更改
      const userBalance = await ethers.provider.getBalance(batchCommission.address)
      expect(userBalance).to.equal(ethers.utils.parseEther('1'))
    })

    it('佣金是eth, 接受佣金的人是多个的情况下, 余额不足应该执行失败', async function () {
      const key = '0x'
      const commissionInfos = [
        { user: addr1.address, token: ETH, balance: ethers.utils.parseEther('1') },
        { user: addr2.address, token: ETH, balance: ethers.utils.parseEther('2') }
      ]

      // 确保addr1余额不足
      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos, { value: ethers.utils.parseEther('2') })).to.be.revertedWith('Insufficient Ether sent for commission')
    })

    it('佣金是eth, 接受佣金的人是多个的情况下也能正常执行', async function () {
      const key = '0x'
      const commissionInfos = [
        { user: addr1.address, token: ETH, balance: ethers.utils.parseEther('1') },
        { user: addr2.address, token: ETH, balance: ethers.utils.parseEther('2') }
      ]

      // 使用 await 确保等待交易被确认
      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos, { value: ethers.utils.parseEther('3') })).to.emit(batchCommission, 'CommissionDeposited')

      // 确保commissionInfos正确存储在合约状态中
      const storedCommissionInfos = await batchCommission.userCommissionInfo(owner.address, key, 0)
      // console.log(storedCommissionInfos)

      expect(storedCommissionInfos[0]).to.equal(addr1.address)
      expect(storedCommissionInfos[1]).to.equal(ETH)
      expect(storedCommissionInfos[2]).to.equal(ethers.utils.parseEther('1'))

      const storedCommissionInfos2 = await batchCommission.userCommissionInfo(owner.address, key, 1)
      expect(storedCommissionInfos2[0]).to.equal(addr2.address)
      expect(storedCommissionInfos2[1]).to.equal(ETH)
      expect(storedCommissionInfos2[2]).to.equal(ethers.utils.parseEther('2'))
    })

    it('佣金是某个代币,一个人,应该执行成功的情况', async function () {
      const key = '0x'
      const commissionInfos = [{ user: addr1.address, token: mockToken.address, balance: ethers.utils.parseEther('1') }]

      await mockToken.connect(owner).approve(batchCommission.address, ethers.utils.parseEther('1'))
      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos)).to.emit(batchCommission, 'CommissionDeposited')

      // 确保commissionInfos正确存储在合约状态中
      const storedCommissionInfos = await batchCommission.userCommissionInfo(owner.address, key, 0)
      // console.log(storedCommissionInfos)

      expect(storedCommissionInfos[0]).to.equal(addr1.address)
      expect(storedCommissionInfos[1]).to.equal(mockToken.address)
      expect(storedCommissionInfos[2]).to.equal(ethers.utils.parseEther('1'))
    })

    it('佣金是某个代币, 接受佣金的人是多个的情况下, 余额不足应该执行失败', async function () {
      const key = '0x'
      const commissionInfos = [
        { user: addr1.address, token: mockToken.address, balance: ethers.utils.parseEther('100') },
        { user: addr2.address, token: mockToken.address, balance: ethers.utils.parseEther('101') }
      ]

      await mockToken.connect(owner).approve(batchCommission.address, ethers.utils.parseEther('100'))

      // 确保addr1余额不足
      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos)).to.be.revertedWith('Insufficient token balance')
    })

    it('佣金是某个代币, 接受佣金的人是多个的情况下是否能正常执行', async function () {
      const key = '0x'
      const commissionInfos = [
        { user: addr1.address, token: mockToken.address, balance: ethers.utils.parseEther('50') },
        { user: addr2.address, token: mockToken.address, balance: ethers.utils.parseEther('50') }
      ]

      await mockToken.connect(owner).approve(batchCommission.address, ethers.utils.parseEther('100'))
      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos)).to.emit(batchCommission, 'CommissionDeposited')

      // 确保commissionInfos正确存储在合约状态中
      const storedCommissionInfos = await batchCommission.userCommissionInfo(owner.address, key, 0)
      expect(storedCommissionInfos[0]).to.equal(addr1.address)
      expect(storedCommissionInfos[1]).to.equal(mockToken.address)
      expect(storedCommissionInfos[2]).to.equal(ethers.utils.parseEther('50'))

      const storedCommissionInfos2 = await batchCommission.userCommissionInfo(owner.address, key, 1)
      expect(storedCommissionInfos2[0]).to.equal(addr2.address)
      expect(storedCommissionInfos2[1]).to.equal(mockToken.address)
      expect(storedCommissionInfos2[2]).to.equal(ethers.utils.parseEther('50'))
    })

    it('佣金是eth和某个代币, 是否能正常执行', async function () {
      const key = '0x'
      const ethCommissionInfo = { user: addr1.address, token: ETH, balance: ethers.utils.parseEther('1') }
      const tokenCommissionInfo = { user: addr1.address, token: mockToken.address, balance: ethers.utils.parseEther('1') }
      const commissionInfos = [ethCommissionInfo, tokenCommissionInfo]

      await mockToken.connect(owner).approve(batchCommission.address, ethers.utils.parseEther('1'))

      const initialBalance = await ethers.provider.getBalance(batchCommission.address)
      await batchCommission.connect(owner).depositCommission(key, commissionInfos, { value: ethers.utils.parseEther('1') })
      const finalBalance = await ethers.provider.getBalance(batchCommission.address)

      // 确保 addr1 收到以太币
      expect(finalBalance.sub(initialBalance)).to.equal(ethers.utils.parseEther('1'))

      // 确保commissionInfos正确存储在合约状态中
      const storedCommissionInfos = await batchCommission.userCommissionInfo(owner.address, key, 0)
      expect(storedCommissionInfos[0]).to.equal(addr1.address)
      expect(storedCommissionInfos[1]).to.equal(ETH)
      expect(storedCommissionInfos[2]).to.equal(ethers.utils.parseEther('1'))

      const storedCommissionInfos2 = await batchCommission.userCommissionInfo(owner.address, key, 1)
      expect(storedCommissionInfos2[0]).to.equal(addr1.address)
      expect(storedCommissionInfos2[1]).to.equal(mockToken.address)
      expect(storedCommissionInfos2[2]).to.equal(ethers.utils.parseEther('1'))
    })

    it('调用者传入的佣金数组不应为空', async function () {
      const key = '0x'
      const commissionInfos = []

      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos)).to.be.revertedWith('Commission array should not be empty')
    })

    it('调用者发送佣金的以太币必须足够', async function () {
      const key = '0x'
      const commissionInfos = [{ user: addr1.address, token: ETH, balance: ethers.utils.parseEther('1') }]

      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos)).to.be.revertedWith('Insufficient Ether sent for commission')
    })

    it('调用者所持有的某个ERC20代币的余额必须足够', async function () {
      const key = '0x'
      const commissionInfos = [{ user: addr1.address, token: mockToken.address, balance: ethers.utils.parseEther('101') }]

      await mockToken.connect(owner).approve(batchCommission.address, ethers.utils.parseEther('100'))

      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos)).to.be.revertedWith('Insufficient token balance')
    })

    it('允许调用者转移到该合约的代币数量必须足够', async function () {
      const key = '0x'
      const commissionInfos = [{ user: addr1.address, token: mockToken.address, balance: ethers.utils.parseEther('1') }]

      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos)).to.be.revertedWith('The number of tokens that the caller is allowed to transfer to this address is not enough.')
    })

    it('向addr2转移erc20token的情况下,佣金是eth,是否能正常进行', async function () {
      const key = '0x'
      const commissionInfos = [
        { user: addr1.address, token: mockToken.address, balance: ethers.utils.parseEther('2') },
        { user: addr2.address, token: ETH, balance: ethers.utils.parseEther('1') }
      ]

      // 授权ERC20代币的转让
      await mockToken.connect(owner).approve(batchCommission.address, ethers.utils.parseEther('2'))

      // 发送足够的 ETH 来支付佣金
      const ethAmount = ethers.utils.parseEther('1')
      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos, { value: ethAmount })).to.emit(batchCommission, 'CommissionDeposited')

      // 确保commissionInfos正确存储在合约状态中
      const storedCommissionInfos = await batchCommission.userCommissionInfo(owner.address, key, 0)
      // console.log(storedCommissionInfos)

      expect(storedCommissionInfos[0]).to.equal(addr1.address)
      expect(storedCommissionInfos[1]).to.equal(mockToken.address)
      expect(storedCommissionInfos[2]).to.equal(ethers.utils.parseEther('2'))

      const storedCommissionInfos2 = await batchCommission.userCommissionInfo(owner.address, key, 1)
      expect(storedCommissionInfos2[0]).to.equal(addr2.address)
      expect(storedCommissionInfos2[1]).to.equal(ETH)
      expect(storedCommissionInfos2[2]).to.equal(ethers.utils.parseEther('1'))
    })

    it('向addr2转移eth的情况下,但佣金是erc20token,是否能正常进行', async function () {
      const key = '0x'
      const commissionInfos = [
        { user: addr1.address, token: ETH, balance: ethers.utils.parseEther('2') },
        { user: addr2.address, token: mockToken.address, balance: ethers.utils.parseEther('1') }
      ]

      // 授权ERC20代币的转让
      await mockToken.connect(owner).approve(batchCommission.address, ethers.utils.parseEther('1'))

      // 发送足够的 ETH 来支付佣金
      const ethAmount = ethers.utils.parseEther('2')
      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos, { value: ethAmount })).to.emit(batchCommission, 'CommissionDeposited')

      // 确保commissionInfos正确存储在合约状态中
      const storedCommissionInfos = await batchCommission.userCommissionInfo(owner.address, key, 0)
      // console.log(storedCommissionInfos)

      expect(storedCommissionInfos[0]).to.equal(addr1.address)
      expect(storedCommissionInfos[1]).to.equal(ETH)
      expect(storedCommissionInfos[2]).to.equal(ethers.utils.parseEther('2'))

      const storedCommissionInfos2 = await batchCommission.userCommissionInfo(owner.address, key, 1)
      expect(storedCommissionInfos2[0]).to.equal(addr2.address)
      expect(storedCommissionInfos2[1]).to.equal(mockToken.address)
      expect(storedCommissionInfos2[2]).to.equal(ethers.utils.parseEther('1'))
    })

    it('传入相同的key,则应覆盖之前的commissionInfos,并返回用余额', async function () {
      const key = '0x'

      const commissionInfos1 = [{ user: addr1.address, token: mockToken.address, balance: ethers.utils.parseEther('1') }]

      const commissionInfos2 = [{ user: addr1.address, token: ETH, balance: ethers.utils.parseEther('1') }]

      // 第一次调用
      await mockToken.connect(owner).approve(batchCommission.address, ethers.utils.parseEther('1'))
      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos1)).to.emit(batchCommission, 'CommissionDeposited')

      // 获取 owner 地址在 mockToken 合约中的余额
      const balanceBeforeFirstDeposit = await mockToken.balanceOf(owner.address)

      // 确保commissionInfos正确存储在合约状态中
      const storedCommissionInfos1 = await batchCommission.userCommissionInfo(owner.address, key, 0)

      expect(storedCommissionInfos1[0]).to.equal(addr1.address)
      expect(storedCommissionInfos1[1]).to.equal(mockToken.address)
      expect(storedCommissionInfos1[2]).to.equal(ethers.utils.parseEther('1'))

      // 第二次调用，传入相同的key
      await batchCommission.connect(owner).depositCommission(key, commissionInfos2, { value: ethers.utils.parseEther('1') })

      // 确保commissionInfos1正确存储在合约状态中
      const storedCommissionInfos2 = await batchCommission.userCommissionInfo(owner.address, key, 0)
      expect(storedCommissionInfos2[0]).to.equal(addr1.address)
      expect(storedCommissionInfos2[1]).to.equal(ETH)
      expect(storedCommissionInfos2[2]).to.equal(ethers.utils.parseEther('1'))

      // 获取 owner 地址在 mockToken 合约中的余额
      const balanceAfterSecondDeposit = await mockToken.balanceOf(owner.address)

      // 检查余额是否符合预期
      expect(balanceAfterSecondDeposit).to.equal(balanceBeforeFirstDeposit.add(ethers.utils.parseEther('1')))
    })
  })

  // 测试distributeCommission方法
  describe('批量下发佣金', function () {
    it('佣金是eth,一个人,应该执行成功的情况', async function () {
      const key = '0x'
      const commissionInfos = [{ user: addr1.address, token: ETH, balance: ethers.utils.parseEther('1') }]

      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos, { value: ethers.utils.parseEther('1') })).to.emit(batchCommission, 'CommissionDeposited')

      // 下发佣金
      await expect(batchCommission.connect(owner).distributeCommission(owner.address, key)).to.emit(batchCommission, 'CommissionDistributed')

      const storedTokenBalances = await commissionStorage.getTokenBalances(addr1.address)
      // console.log(storedTokenBalances[0][0])
      expect(storedTokenBalances[0][0]).to.equal(ETH)
      expect(storedTokenBalances[0][1]).to.equal(ethers.utils.parseEther('1'))
    })

    it('佣金是eth, 接受佣金的人是多个的情况下也能正常执行', async function () {
      const key = '0x'
      const commissionInfos = [
        { user: addr1.address, token: ETH, balance: ethers.utils.parseEther('1') },
        { user: addr2.address, token: ETH, balance: ethers.utils.parseEther('2') }
      ]

      // 使用 await 确保等待交易被确认
      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos, { value: ethers.utils.parseEther('3') })).to.emit(batchCommission, 'CommissionDeposited')

      // 下发佣金
      await expect(batchCommission.connect(owner).distributeCommission(owner.address, key)).to.emit(batchCommission, 'CommissionDistributed')

      const storedTokenBalances = await commissionStorage.getTokenBalances(addr1.address)
      // console.log(storedTokenBalances[0][0])
      expect(storedTokenBalances[0][0]).to.equal(ETH)
      expect(storedTokenBalances[0][1]).to.equal(ethers.utils.parseEther('1'))
      const storedTokenBalances2 = await commissionStorage.getTokenBalances(addr2.address)
      // console.log(storedTokenBalances[0][0])
      expect(storedTokenBalances2[0][0]).to.equal(ETH)
      expect(storedTokenBalances2[0][1]).to.equal(ethers.utils.parseEther('2'))
    })

    it('佣金是某个代币,一个人,应该执行成功的情况', async function () {
      const key = '0x'
      const commissionInfos = [{ user: addr1.address, token: mockToken.address, balance: ethers.utils.parseEther('1') }]

      await mockToken.connect(owner).approve(batchCommission.address, ethers.utils.parseEther('1'))
      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos)).to.emit(batchCommission, 'CommissionDeposited')

      // 下发佣金
      await expect(batchCommission.connect(owner).distributeCommission(owner.address, key)).to.emit(batchCommission, 'CommissionDistributed')

      const storedTokenBalances = await commissionStorage.getTokenBalances(addr1.address)
      // console.log(storedTokenBalances[0][0])
      expect(storedTokenBalances[0][0]).to.equal(mockToken.address)
      expect(storedTokenBalances[0][1]).to.equal(ethers.utils.parseEther('1'))
    })

    it('佣金是某个代币, 接受佣金的人是多个的情况下是否能正常执行', async function () {
      const key = '0x'
      const commissionInfos = [
        { user: addr1.address, token: mockToken.address, balance: ethers.utils.parseEther('1') },
        { user: addr2.address, token: mockToken.address, balance: ethers.utils.parseEther('1') }
      ]

      await mockToken.connect(owner).approve(batchCommission.address, ethers.utils.parseEther('2'))
      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos)).to.emit(batchCommission, 'CommissionDeposited')

      // 下发佣金
      await expect(batchCommission.connect(owner).distributeCommission(owner.address, key)).to.emit(batchCommission, 'CommissionDistributed')

      const storedTokenBalances = await commissionStorage.getTokenBalances(addr1.address)
      // console.log(storedTokenBalances[0])
      expect(storedTokenBalances[0][0]).to.equal(mockToken.address)
      expect(storedTokenBalances[0][1]).to.equal(ethers.utils.parseEther('1'))
      const storedTokenBalances2 = await commissionStorage.getTokenBalances(addr2.address)
      // console.log(storedTokenBalances[0])
      expect(storedTokenBalances2[0][0]).to.equal(mockToken.address)
      expect(storedTokenBalances2[0][1]).to.equal(ethers.utils.parseEther('1'))
    })

    it('佣金是eth和某个代币, 是否能正常执行', async function () {
      const key = '0x'
      const ethCommissionInfo = { user: addr1.address, token: ETH, balance: ethers.utils.parseEther('1') }
      const tokenCommissionInfo = { user: addr1.address, token: mockToken.address, balance: ethers.utils.parseEther('2') }
      const commissionInfos = [ethCommissionInfo, tokenCommissionInfo]

      await mockToken.connect(owner).approve(batchCommission.address, ethers.utils.parseEther('2'))

      const initialBalance = await ethers.provider.getBalance(batchCommission.address)
      await batchCommission.connect(owner).depositCommission(key, commissionInfos, { value: ethers.utils.parseEther('1') })
      const finalBalance = await ethers.provider.getBalance(batchCommission.address)

      // 确保 addr1 收到以太币
      expect(finalBalance.sub(initialBalance)).to.equal(ethers.utils.parseEther('1'))

      // 下发佣金
      await expect(batchCommission.connect(owner).distributeCommission(owner.address, key)).to.emit(batchCommission, 'CommissionDistributed')

      const storedTokenBalances = await commissionStorage.getTokenBalances(addr1.address)
      // console.log(storedTokenBalances[0])
      expect(storedTokenBalances[0][0]).to.equal(ETH)
      expect(storedTokenBalances[0][1]).to.equal(ethers.utils.parseEther('1'))
      const storedTokenBalances2 = await commissionStorage.getTokenBalances(addr1.address)
      // console.log(storedTokenBalances[1])
      expect(storedTokenBalances2[1][0]).to.equal(mockToken.address)
      expect(storedTokenBalances2[1][1]).to.equal(ethers.utils.parseEther('2'))
    })

    it('佣金数组不能为空', async function () {
      const key = '0x'

      // 尝试用空数组分配佣金
      await expect(batchCommission.connect(owner).distributeCommission(addr1.address, key)).to.be.revertedWith('Commission array should not be empty')
    })

    it('当传入一个错误的key值时', async function () {
      const key = '0x'
      const errorKey = '0x1234'

      const commissionInfos = [{ user: addr1.address, token: ETH, balance: ethers.utils.parseEther('1') }]

      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos, { value: ethers.utils.parseEther('1') })).to.emit(batchCommission, 'CommissionDeposited')

      // 下发佣金
      await expect(batchCommission.connect(owner).distributeCommission(owner.address, errorKey)).to.be.revertedWith('Commission array should not be empty')
    })
  })

  // 测试distributeCommission方法
  describe('批量摧毁佣金', function () {
    it('佣金是eth,一个人,应该执行成功的情况', async function () {
      const key = '0x'
      const commissionInfos = [{ user: addr1.address, token: ETH, balance: ethers.utils.parseEther('1') }]

      // 使用 await 确保等待交易被确认
      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos, { value: ethers.utils.parseEther('1') })).to.emit(batchCommission, 'CommissionDeposited')

      // 摧毁佣金之前相应余额
      const userBalance1 = await ethers.provider.getBalance(batchCommission.address)
      expect(userBalance1).to.equal(ethers.utils.parseEther('1'))

      // 摧毁佣金
      await expect(batchCommission.connect(owner).destroyAndReturnCommission(key)).to.emit(batchCommission, 'CommissionReturned')

      // 摧毁佣金之后相应余额
      const userBalance2 = await ethers.provider.getBalance(batchCommission.address)
      expect(userBalance2).to.equal(ethers.utils.parseEther('0'))
    })

    it('佣金是eth, 接受佣金的人是多个的情况下也能正常执行', async function () {
      const key = '0x'
      const commissionInfos = [
        { user: addr1.address, token: ETH, balance: ethers.utils.parseEther('1') },
        { user: addr2.address, token: ETH, balance: ethers.utils.parseEther('2') }
      ]

      // 使用 await 确保等待交易被确认
      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos, { value: ethers.utils.parseEther('3') })).to.emit(batchCommission, 'CommissionDeposited')

      // 摧毁佣金之前相应余额
      const userBalance1 = await ethers.provider.getBalance(batchCommission.address)
      expect(userBalance1).to.equal(ethers.utils.parseEther('3'))

      // 摧毁佣金
      await expect(batchCommission.connect(owner).destroyAndReturnCommission(key)).to.emit(batchCommission, 'CommissionReturned')

      // 摧毁佣金之后相应余额
      const userBalance2 = await ethers.provider.getBalance(batchCommission.address)
      expect(userBalance2).to.equal(ethers.utils.parseEther('0'))
    })

    it('佣金是某个代币,一个人,应该执行成功的情况', async function () {
      const key = '0x'
      const commissionInfos = [{ user: owner.address, token: mockToken.address, balance: ethers.utils.parseEther('1') }]

      await mockToken.connect(owner).approve(batchCommission.address, ethers.utils.parseEther('1'))
      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos)).to.emit(batchCommission, 'CommissionDeposited')

      // 摧毁佣金之前相应余额
      const initialTokenBalance = await mockToken.balanceOf(owner.address)

      // 摧毁佣金
      await expect(batchCommission.connect(owner).destroyAndReturnCommission(key)).to.emit(batchCommission, 'CommissionReturned')

      // 摧毁佣金之后相应余额
      const finalTokenBalance = await mockToken.balanceOf(owner.address)
      const expectedTokenBalance = initialTokenBalance.add(ethers.utils.parseEther('1'))
      expect(finalTokenBalance).to.equal(expectedTokenBalance)
    })

    it('佣金是某个代币, 接受佣金的人是多个的情况下是否能正常执行', async function () {
      const key = '0x'
      const commissionInfos = [
        { user: owner.address, token: mockToken.address, balance: ethers.utils.parseEther('1') },
        { user: owner.address, token: mockToken.address, balance: ethers.utils.parseEther('1') }
      ]

      await mockToken.connect(owner).approve(batchCommission.address, ethers.utils.parseEther('2'))
      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos)).to.emit(batchCommission, 'CommissionDeposited')

      // 摧毁佣金之前相应余额
      const initialTokenBalance = await mockToken.balanceOf(owner.address)

      // 摧毁佣金
      await expect(batchCommission.connect(owner).destroyAndReturnCommission(key)).to.emit(batchCommission, 'CommissionReturned')

      // 摧毁佣金之后相应余额
      const finalTokenBalance = await mockToken.balanceOf(owner.address)
      const expectedTokenBalance = initialTokenBalance.add(ethers.utils.parseEther('2'))
      expect(finalTokenBalance).to.equal(expectedTokenBalance)
    })

    it('佣金是eth和某个代币, 是否能正常执行', async function () {
      const key = '0x'
      const ethCommissionInfo = { user: addr1.address, token: ETH, balance: ethers.utils.parseEther('1') }
      const tokenCommissionInfo = { user: owner.address, token: mockToken.address, balance: ethers.utils.parseEther('2') }
      const commissionInfos = [ethCommissionInfo, tokenCommissionInfo]

      await mockToken.connect(owner).approve(batchCommission.address, ethers.utils.parseEther('2'))

      const initialBalance = await ethers.provider.getBalance(batchCommission.address)
      await batchCommission.connect(owner).depositCommission(key, commissionInfos, { value: ethers.utils.parseEther('1') })
      const finalBalance = await ethers.provider.getBalance(batchCommission.address)

      // 确保 addr1 收到以太币
      expect(finalBalance.sub(initialBalance)).to.equal(ethers.utils.parseEther('1'))

      // 摧毁佣金之前erc20相应余额
      const initialTokenBalance = await mockToken.balanceOf(owner.address)
      // 摧毁佣金之前ETH相应余额
      const userBalance1 = await ethers.provider.getBalance(batchCommission.address)
      expect(userBalance1).to.equal(ethers.utils.parseEther('1'))

      // 摧毁佣金
      await expect(batchCommission.connect(owner).destroyAndReturnCommission(key)).to.emit(batchCommission, 'CommissionReturned')

      // 摧毁佣金之后erc20相应余额
      const finalTokenBalance = await mockToken.balanceOf(owner.address)
      const expectedTokenBalance = initialTokenBalance.add(ethers.utils.parseEther('2'))
      expect(finalTokenBalance).to.equal(expectedTokenBalance)
      // 摧毁佣金之后相应余额
      const userBalance2 = await ethers.provider.getBalance(batchCommission.address)
      expect(userBalance2).to.equal(ethers.utils.parseEther('0'))
    })

    it('当传入一个错误的key值时', async function () {
      const key = '0x'
      const errorKey = '0x1234'

      const commissionInfos = [{ user: addr1.address, token: ETH, balance: ethers.utils.parseEther('1') }]

      // 使用 await 确保等待交易被确认
      await expect(batchCommission.connect(owner).depositCommission(key, commissionInfos, { value: ethers.utils.parseEther('1') })).to.emit(batchCommission, 'CommissionDeposited')

      // 摧毁佣金之前相应余额
      const userBalance1 = await ethers.provider.getBalance(batchCommission.address)
      expect(userBalance1).to.equal(ethers.utils.parseEther('1'))

      // 摧毁佣金
      await expect(batchCommission.connect(owner).destroyAndReturnCommission(errorKey)).to.emit(batchCommission, 'CommissionReturned')
    })
  })
})
