const { ethers } = require("hardhat")

const proxyAdminAddr = "0xd02C2Ff6ef80f1d096Bc060454054B607d26763E"
const contractProxyAddr = "0xB103F669E87f67376FB9458A67226f2774a0B4FD"
const contractName = "AvaxStableVault"

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
    const contractImplAddr = "0x16a6AfEdFb08689Af316a747B6d0ac1cB37142eF"

    const proxyAdmin = new ethers.Contract(proxyAdminAddr, ["function upgrade(address, address) external"], deployer)
    // tx = await proxyAdmin.upgrade(contractProxyAddr, contractImpl.address)
    tx = await proxyAdmin.upgrade(contractProxyAddr, contractImplAddr)
    await tx.wait()
    console.log("Contract upgraded successfully")

    const contract = await ethers.getContractAt(contractName, contractProxyAddr, deployer)
    tx = await contract.setFees(100)
    await tx.wait()
    console.log("Set fees successfully")

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

    // const PNGAVAXVault = await ethers.getContractAt("AvaxVaultL1", "0x7eEcFB07b7677aa0e1798a4426b338dA23f9De34", deployer)
    // tx = await PNGAVAXVault.migratePangolinFarm(0)
    // await tx.wait()
    // const USDCAVAXVault = await ethers.getContractAt("AvaxVaultL1", "0x5378B730711D1f57F888e4828b130E591c4Ea97b", deployer)
    // tx = await USDCAVAXVault.migratePangolinFarm(9)
    // await tx.wait()
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
