const { ethers } = require("hardhat")

const main = async () => {
    const [deployer] = await ethers.getSigners()

    const proxyAdminFac = await ethers.getContractFactory("DAOProxyAdmin", deployer)
    const proxyAdmin = await proxyAdminFac.deploy()
    await proxyAdmin.deployTransaction.wait()
    
    console.log("DAO proxy admin contract address:", proxyAdmin.address)
}
main()