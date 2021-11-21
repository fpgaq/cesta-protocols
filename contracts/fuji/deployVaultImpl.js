const { ethers } = require("hardhat")

const main = async () => {
    const [deployer] = await ethers.getSigners()

    const AvaxVaultFac = await ethers.getContractFactory("AvaxVault", deployer)
    // const AvaxVaultFac = await ethers.getContractFactory("AvaxVaultKovan", deployer)
    const avaxVaultImpl = await AvaxVaultFac.deploy()
    await avaxVaultImpl.deployTransaction.wait()
    console.log("DAO Avalanche vault (implementation) contract address:", avaxVaultImpl.address)

    const AvaxStableVaultFac = await ethers.getContractFactory("AvaxStableVault", deployer)
    // const AvaxStableVaultFac = await ethers.getContractFactory("AvaxStableVaultKovan", deployer)
    const avaxStableVaultImpl = await AvaxStableVaultFac.deploy()
    await avaxStableVaultImpl.deployTransaction.wait()
    console.log("DAO Avalanche stable vault (implementation) contract address:", avaxStableVaultImpl.address)
}
main()