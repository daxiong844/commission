// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require('hardhat')
const { ethers, upgrades } = require('hardhat')

async function main() {
  // 部署 CommissionStorage 合约
  const CommissionStorage = await hre.ethers.getContractFactory('CommissionStorage')
  const commissionStorage = await hre.upgrades.deployProxy(CommissionStorage)

  await commissionStorage.deployed()
  console.log('commissionStorage deployed to:', commissionStorage.address)

  // 部署 BatchCommission 合约，传入 CommissionStorage 地址
  const BatchCommission = await hre.ethers.getContractFactory('BatchCommission')
  const batchCommission = await hre.upgrades.deployProxy(BatchCommission, [commissionStorage.address])

  await batchCommission.deployed()
  console.log('batchCommission deployed to:', batchCommission.address)

  // // 升级成V2
  const BatchCommissionV2 = await hre.ethers.getContractFactory('BatchCommissionV2')
  const batchCommissionV2 = await hre.upgrades.upgradeProxy(batchCommission.address, BatchCommissionV2)

  await batchCommissionV2.deployed()
  console.log('batchCommissionV2 deployed to:', batchCommissionV2.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
