const { ethers } = require("hardhat")

const proxyAdminAddr = "0xd02C2Ff6ef80f1d096Bc060454054B607d26763E"
const contractProxyAddr = "0x07b4d7f3b5599E9c345d13813e0C8bad1010D30b"
const contractName = "StableStableStrategy"

// const avaxVaultL1FactoryAddr = "0x04DDc3281f71DC70879E312BbF759d54f514f07f"

async function main() {
    const [deployer] = await ethers.getSigners()
    let tx

    // const deployerAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
    // await network.provider.request({method: "hardhat_impersonateAccount", params: [deployerAddr]})
    // const deployer = await ethers.getSigner(deployerAddr)
    // const [me] = await ethers.getSigners()
    // await me.sendTransaction({to: deployer.address, value: ethers.utils.parseEther("10")})

    // const contractFac = await ethers.getContractFactory(contractName)
    // const contractImpl = await contractFac.deploy()
    // await contractImpl.deployTransaction.wait()
    // console.log("New implementation contract:", contractImpl.address)
    // const contractImplAddr = "0x0D605b5fA2Eac22d5d72369deEE6A4D24eEe3e1D"

    // const proxyAdmin = new ethers.Contract(proxyAdminAddr, ["function upgrade(address, address) external"], deployer)
    // // tx = await proxyAdmin.upgrade(contractProxyAddr, contractImpl.address)
    // tx = await proxyAdmin.upgrade(contractProxyAddr, contractImplAddr)
    // await tx.wait()
    // console.log("Contract upgraded successfully")

    // const contract = await ethers.getContractAt(contractName, contractProxyAddr, deployer)
    const USDTUSDCVaultAddr = "0x4d9A85E9C329Be41c6eAb320a8A029EEAe483C62"
    const USDTDAIVaultAddr = "0x51791752Aa31d66c17AB525bf79e06c41929BbBc"
    const USDCDAIVaultAddr = "0x4ABD68371e0cf565596744Fc80a97dE41253deBd"
    // await contract.changeL1Vault(USDTUSDCVaultAddr, USDTDAIVaultAddr, USDCDAIVaultAddr)
    // console.log("Change L1 vaults successfully")

    // // Upgrade AvaxVaultL1
    // const avaxVaultL1Fac = await ethers.getContractFactory("AvaxVaultL1", deployer)
    // const avaxVaultL1Impl = await avaxVaultL1Fac.deploy()
    // await avaxVaultL1Impl.deployTransaction.wait()
    // console.log(avaxVaultL1Impl.address)
    // // const avaxVaultL1ImplAddr = "0x084F149E5B293eB0244fBEc1B4Ed76a56a498134"
    // const avaxVaultL1Factory = await ethers.getContractAt("AvaxVaultL1Factory", avaxVaultL1FactoryAddr, deployer)
    // tx = await avaxVaultL1Factory.updateLogic(avaxVaultL1Impl.address)
    // // tx = await avaxVaultL1Factory.updateLogic(avaxVaultL1ImplAddr)
    // await tx.wait()
    // console.log("Contract upgraded successfully")

    const strategyContractAddr = "0x07b4d7f3b5599E9c345d13813e0C8bad1010D30b"
    const USDTUSDCVault = await ethers.getContractAt("AvaxVaultL1", USDTUSDCVaultAddr, deployer)
    tx = await USDTUSDCVault.setWhitelistAddress(strategyContractAddr, true)
    await tx.wait()
    const USDCDAIVault = await ethers.getContractAt("AvaxVaultL1", USDCDAIVaultAddr, deployer)
    tx = await USDCDAIVault.setWhitelistAddress(strategyContractAddr, true)
    await tx.wait()
    const USDTDAIVault = await ethers.getContractAt("AvaxVaultL1", USDTDAIVaultAddr, deployer)
    tx = await USDTDAIVault.setWhitelistAddress(strategyContractAddr, true)
    await tx.wait()
    console.log("Set whitelist successfully")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
