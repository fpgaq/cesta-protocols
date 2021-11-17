const { ethers } = require("hardhat")

const JOEUSDCVaultAddr = "0xC4029ad66AAe4DCF3F8A8C67F4000EAFE49E6d10"
const PNGUSDTVaultAddr = "0x12bD78eF81bd767B9014aD4Ec61a6F209DDB659F"
const LYDDAIVaultAddr = "0x469b5620675a9988c24cDd57B1E7136E162D6a53"

const treasuryAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
const communityAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
const adminAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"

const proxyAdminAddr = "0xd02C2Ff6ef80f1d096Bc060454054B607d26763E"
const avaxStableVaultImplAddr = "0x10F69c2e8e15229492A987aDe4fB203D05845eAb"

const main = async () => {
    const [deployer] = await ethers.getSigners()

    // const deployerAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
    // await network.provider.request({method: "hardhat_impersonateAccount", params: [deployerAddr]})
    // const deployer = await ethers.getSigner(deployerAddr)

    // Deploy DeXToken-Stablecon strategy
    // const DeXStableStrategyFac = await ethers.getContractFactory("DeXStableStrategy", deployer)
    // // const DeXStableStrategyFac = await ethers.getContractFactory("DeXStableStrategyKovan", deployer)
    // const deXStableStrategyImpl = await DeXStableStrategyFac.deploy()
    // await deXStableStrategyImpl.deployTransaction.wait()
    // console.log("DAO Avalanche DeXToken-Stablecoin strategy (implementation) contract address:", deXStableStrategyImpl.address)
    const deXStableStrategyImplAddr = "0x005A85EA9A8b758FAf3e91e6D6BdfAB3E81BCf63"

    const deXStableStrategyArtifact = await artifacts.readArtifact("DeXStableStrategy")
    // const deXStableStrategyArtifact = await artifacts.readArtifact("DeXStableStrategyKovan")
    const deXStableStrategyInterface = new ethers.utils.Interface(deXStableStrategyArtifact.abi)
    const dataDeXStableStrategy = deXStableStrategyInterface.encodeFunctionData(
        "initialize",
        [JOEUSDCVaultAddr, PNGUSDTVaultAddr, LYDDAIVaultAddr]
    )
    const DeXStableStrategyProxy = await ethers.getContractFactory("AvaxProxy", deployer)
    const deXStableStrategyProxy = await DeXStableStrategyProxy.deploy(
        // deXStableStrategyImpl.address, proxyAdminAddr, dataDeXStableStrategy,
        deXStableStrategyImplAddr, proxyAdminAddr, dataDeXStableStrategy,
    )
    await deXStableStrategyProxy.deployTransaction.wait()
    console.log("DAO Avalanche DeXToken-Stablecoin strategy (proxy) contract address:", deXStableStrategyProxy.address)
    const deXStableStrategy = await ethers.getContractAt("DeXStableStrategy", deXStableStrategyProxy.address, deployer)

    // Deploy DeXToken-Stablecoin vault
    const avaxStableVaultArtifact = await artifacts.readArtifact("AvaxStableVault")
    // const avaxStableVaultArtifact = await artifacts.readArtifact("AvaxStableVaultKovan")
    const avaxStableVaultInterface = new ethers.utils.Interface(avaxStableVaultArtifact.abi)
    const dataAvaxStableVault = avaxStableVaultInterface.encodeFunctionData(
        "initialize",
        [
            "DAO L2 Avalanche DeX-Stable", "daoAXS",
            treasuryAddr, communityAddr, adminAddr, deXStableStrategy.address
        ]
    )
    const AvaxStableVaultProxy = await ethers.getContractFactory("AvaxProxy", deployer)
    const avaxStableVaultProxy = await AvaxStableVaultProxy.deploy(
        avaxStableVaultImplAddr, proxyAdminAddr, dataAvaxStableVault,
    )
    await avaxStableVaultProxy.deployTransaction.wait()
    const avaxStableVault = await ethers.getContractAt("AvaxStableVault", avaxStableVaultProxy.address, deployer)
    // const avaxStableVault = await ethers.getContractAt("AvaxStableVaultKovan", avaxStableVaultProxy.address, deployer)
    console.log("DAO Avalanche DeXToken-Stablecoin vault (proxy) contract address:", avaxStableVault.address)

    tx = await deXStableStrategy.setVault(avaxStableVault.address)
    await tx.wait()
    console.log("Set vault successfully")

    // Set whitelist
    const JOEUSDCVault = await ethers.getContractAt("AvaxVaultL1", JOEUSDCVaultAddr, deployer)
    // const JOEUSDCVault = await ethers.getContractAt("AvaxVaultL1Kovan", JOEUSDCVaultAddr, deployer)
    tx = await JOEUSDCVault.setWhitelistAddress(deXStableStrategy.address, true)
    await tx.wait()
    const PNGUSDTVault = await ethers.getContractAt("AvaxVaultL1", PNGUSDTVaultAddr, deployer)
    // const PNGUSDTVault = await ethers.getContractAt("AvaxVaultL1Kovan", PNGUSDTVaultAddr, deployer)
    tx = await PNGUSDTVault.setWhitelistAddress(deXStableStrategy.address, true)
    await tx.wait()
    const LYDDAIVault = await ethers.getContractAt("AvaxVaultL1", LYDDAIVaultAddr, deployer)
    // const LYDDAIVault = await ethers.getContractAt("AvaxVaultL1Kovan", LYDDAIVaultAddr, deployer)
    tx = await LYDDAIVault.setWhitelistAddress(deXStableStrategy.address, true)
    await tx.wait()
    console.log("Set whitelist successfully")
}
main()
