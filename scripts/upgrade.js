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

    // Deploy implementation contract
    // const contractFac = await ethers.getContractFactory(contractName, deployer)
    // const contractImpl = await contractFac.deploy()
    // await contractImpl.deployTransaction.wait()
    // console.log("New implementation contract:", contractImpl.address)
    const contractImplAddr = "0x3438F3F8A6B319c947a14f072182Ec3C970C91C0"

    // Upgrade proxy contract
    const proxyAdmin = new ethers.Contract(proxyAdminAddr, ["function upgrade(address, address) external"], deployer)
    // tx = await proxyAdmin.upgrade(contractProxyAddr, contractImpl.address)
    tx = await proxyAdmin.upgrade(contractProxyAddr, contractImplAddr)
    await tx.wait()
    console.log("Contract upgraded successfully")

    const contractProxy = await ethers.getContractAt(contractName, contractProxyAddr, deployer)
    tx = await contractProxy.approveCurve2()
    await tx.wait()
    console.log("Approve Curve2 successfully")
    

    // Set whitelist
    // const MIMAVAXVaultAddr = "0x8fFa3a48eC7D7Ad9b8740733deCFB9876d8849b3"
    // const MIMAVAXVault = await ethers.getContractAt("AvaxVaultL1", MIMAVAXVaultAddr, deployer)
    // tx = await MIMAVAXVault.setWhitelistAddress(contractProxyAddr, true)
    // await tx.wait()
    // console.log("Set whitelist successfully")

    // Switch L1 vault
    // const contractProxy = await ethers.getContractAt(contractName, contractProxyAddr, deployer)
    // tx = await contractProxy.switchVaultL1(MIMAVAXVaultAddr)
    // await tx.wait()
    // console.log("Switch L1 vault successfully")

    // Upgrade AvaxVaultL1
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
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
