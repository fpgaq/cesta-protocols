const { ethers } = require("hardhat")

const proxyAdminAddr = "0x29fBe3298569722Cfe26a122223Da1C0EC92829f"
const contractProxyAddr = "0x89D6Fd8ba3EAF76687cF7B3d10F914cc445eaeC1"
const contractName = "AvaxStableVaultKovan"

const avaxVaultL1FactoryAddr = "0x04DDc3281f71DC70879E312BbF759d54f514f07f"

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
    // const contractImplAddr = "0x9D7575d4288B5632a1cF5B6dFa4B37aa8Db3b1aF"

    // const proxyAdmin = new ethers.Contract(proxyAdminAddr, [
    //     "function upgrade(address, address) external"
    // ], deployer)
    // // const tx = await proxyAdmin.upgrade(contractProxyAddr, contractImpl.address)
    // const tx = await proxyAdmin.upgrade(contractProxyAddr, contractImplAddr)
    // await tx.wait()
    // console.log("Contract upgraded successfully")

    // Upgrade AvaxVaultL1
    // const avaxVaultL1Fac = await ethers.getContractFactory("AvaxVaultL1", deployer)
    // const avaxVaultL1Impl = await avaxVaultL1Fac.deploy()
    // console.log(avaxVaultL1Impl.address)
    // const avaxVaultL1ImplAddr = "0x5C947855aF7Ae03a33B96ae24aB2976dbb27098c"
    // const avaxVaultL1Factory = await ethers.getContractAt("AvaxVaultL1Factory", avaxVaultL1FactoryAddr, deployer)
    // tx = await avaxVaultL1Factory.updateLogic(avaxVaultL1ImplAddr)
    // await tx.wait()
    // console.log("Contract upgraded successfully")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
