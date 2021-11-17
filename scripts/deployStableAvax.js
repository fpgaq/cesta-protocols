const { ethers } = require("hardhat")

const USDTAVAXVaultAddr = "0x82AFf9e3f08e34D61737b035c5890d57803B3958"
const USDCAVAXVaultAddr = "0x5378B730711D1f57F888e4828b130E591c4Ea97b"
const DAIAVAXVaultAddr = "0x308555fb3083A300A03dEfFfa311D2eAF2CD56C8"

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

    // Deploy Stablecoin-AVAX strategy
    const StableAvaxStrategyFac = await ethers.getContractFactory("StableAvaxStrategy", deployer)
    // const StableAvaxStrategyFac = await ethers.getContractFactory("StableAvaxStrategyKovan", deployer)
    const stableAvaxStrategyImpl = await StableAvaxStrategyFac.deploy()
    await stableAvaxStrategyImpl.deployTransaction.wait()
    console.log("DAO Avalanche Stablecoin-AVAX strategy (implementation) contract address:", stableAvaxStrategyImpl.address)

    const stableAvaxStrategyArtifact = await artifacts.readArtifact("StableAvaxStrategy")
    // const stableAvaxStrategyArtifact = await artifacts.readArtifact("StableAvaxStrategyKovan")
    const stableAvaxStrategyInterface = new ethers.utils.Interface(stableAvaxStrategyArtifact.abi)
    const dataStableAvaxStrategy = stableAvaxStrategyInterface.encodeFunctionData(
        "initialize",
        [USDTAVAXVaultAddr, USDCAVAXVaultAddr, DAIAVAXVaultAddr]
    )
    const StableAvaxStrategyProxy = await ethers.getContractFactory("AvaxProxy", deployer)
    const stableAvaxStrategyProxy = await StableAvaxStrategyProxy.deploy(
        stableAvaxStrategyImpl.address, proxyAdminAddr, dataStableAvaxStrategy,
    )
    await stableAvaxStrategyProxy.deployTransaction.wait()
    console.log("DAO Avalanche Stablecoin-AVAX strategy (proxy) contract address:", stableAvaxStrategyProxy.address)
    const stableAvaxStrategy = await ethers.getContractAt("StableAvaxStrategy", stableAvaxStrategyProxy.address, deployer)

    // Deploy Stablecoin-AVAX vault
    const avaxStableVaultArtifact = await artifacts.readArtifact("AvaxStableVault")
    // const avaxStableVaultArtifact = await artifacts.readArtifact("AvaxStableVaultKovan")
    const avaxStableVaultInterface = new ethers.utils.Interface(avaxStableVaultArtifact.abi)
    const dataAvaxStableVault = avaxStableVaultInterface.encodeFunctionData(
        "initialize",
        [
            "DAO L2 Avalanche Stable-AVAX", "daoASA",
            treasuryAddr, communityAddr, adminAddr, stableAvaxStrategy.address
        ]
    )
    const AvaxStableVaultProxy = await ethers.getContractFactory("AvaxProxy", deployer)
    const avaxStableVaultProxy = await AvaxStableVaultProxy.deploy(
        avaxStableVaultImplAddr, proxyAdminAddr, dataAvaxStableVault,
    )
    await avaxStableVaultProxy.deployTransaction.wait()
    const avaxStableVault = await ethers.getContractAt("AvaxStableVault", avaxStableVaultProxy.address, deployer)
    // const avaxStableVault = await ethers.getContractAt("AvaxStableVaultKovan", avaxStableVaultProxy.address, deployer)
    console.log("DAO Avalanche Stablecoin-AVAX vault (proxy) contract address:", avaxStableVault.address)

    tx = await stableAvaxStrategy.setVault(avaxStableVault.address)
    await tx.wait()
    console.log("Set vault successfully")

    // Set whitelist
    const USDTAVAXVault = await ethers.getContractAt("AvaxVaultL1", USDTAVAXVaultAddr, deployer)
    // const USDTAVAXVault = await ethers.getContractAt("AvaxVaultL1Kovan", USDTAVAXVaultAddr, deployer)
    tx = await USDTAVAXVault.setWhitelistAddress(stableAvaxStrategy.address, true)
    await tx.wait()
    const USDCAVAXVault = await ethers.getContractAt("AvaxVaultL1", USDCAVAXVaultAddr, deployer)
    // const USDCAVAXVault = await ethers.getContractAt("AvaxVaultL1Kovan", USDCAVAXVaultAddr, deployer)
    tx = await USDCAVAXVault.setWhitelistAddress(stableAvaxStrategy.address, true)
    await tx.wait()
    const DAIAVAXVault = await ethers.getContractAt("AvaxVaultL1", DAIAVAXVaultAddr, deployer)
    // const DAIAVAXVault = await ethers.getContractAt("AvaxVaultL1Kovan", DAIAVAXVaultAddr, deployer)
    tx = await DAIAVAXVault.setWhitelistAddress(stableAvaxStrategy.address, true)
    await tx.wait()
    console.log("Set whitelist successfully")
}
main()