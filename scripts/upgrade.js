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
    // // const contractImplAddr = "0x254Ba654D6aEBC334693D5e72776c6cCd548FcB1"

    // const proxyAdmin = new ethers.Contract(proxyAdminAddr, ["function upgrade(address, address) external"], deployer)
    // tx = await proxyAdmin.upgrade(contractProxyAddr, contractImpl.address)
    // // tx = await proxyAdmin.upgrade(contractProxyAddr, contractImplAddr)
    // await tx.wait()
    // console.log("Contract upgraded successfully")

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

    const JOEUSDTVault = await ethers.getContractAt("AvaxVaultL1", "0x95921D21029751bF8F65Bb53442b69412C71FFE0", deployer)
    tx = await JOEUSDTVault.setWhitelistAddress("0x63243f079C2054D6c011d4b5D11F3955D9d5F3F4", true)
    await tx.wait()
    const PNGUSDCVault = await ethers.getContractAt("AvaxVaultL1", "0xcd799015fbe5AF106E4D4aDe29D5AF9918bfd318", deployer)
    tx = await PNGUSDCVault.setWhitelistAddress("0x63243f079C2054D6c011d4b5D11F3955D9d5F3F4", true)
    await tx.wait()
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
