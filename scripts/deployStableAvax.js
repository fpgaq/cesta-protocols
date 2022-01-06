const { ethers } = require("hardhat")

const USDTAVAXVaultAddr = "0x82AFf9e3f08e34D61737b035c5890d57803B3958"
const USDCAVAXVaultAddr = "0x5378B730711D1f57F888e4828b130E591c4Ea97b"
const DAIAVAXVaultAddr = "0x308555fb3083A300A03dEfFfa311D2eAF2CD56C8"

const treasuryAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
const communityAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
const adminAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"

const proxyAdminAddr = "0xd02C2Ff6ef80f1d096Bc060454054B607d26763E"
const avaxStableVaultImplAddr = "0x2DE3d757C16e3C0170f352D2BFB88b4278712870"

const main = async () => {
    const [deployer] = await ethers.getSigners()

    // const deployerAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
    // await network.provider.request({method: "hardhat_impersonateAccount", params: [deployerAddr]})
    // const deployer = await ethers.getSigner(deployerAddr)

    // Deploy Stablecoin-AVAX strategy
    const StableAvaxStrategyFac = await ethers.getContractFactory("StableAvaxStrategy", deployer)
    // const StableAvaxStrategyFac = await ethers.getContractFactory("StableAvaxStrategyFuji", deployer)
    const stableAvaxStrategyImpl = await StableAvaxStrategyFac.deploy()
    await stableAvaxStrategyImpl.deployTransaction.wait()
    console.log("Cesta Avalanche Stablecoin-AVAX strategy (implementation) contract address:", stableAvaxStrategyImpl.address)

    const stableAvaxStrategyArtifact = await artifacts.readArtifact("StableAvaxStrategy")
    // const stableAvaxStrategyArtifact = await artifacts.readArtifact("StableAvaxStrategyFuji")
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
    console.log("Cesta Avalanche Stablecoin-AVAX strategy (proxy) contract address:", stableAvaxStrategyProxy.address)
    const stableAvaxStrategy = await ethers.getContractAt("StableAvaxStrategy", stableAvaxStrategyProxy.address, deployer)

    // Deploy Stablecoin-AVAX vault
    const avaxStableVaultArtifact = await artifacts.readArtifact("AvaxStableVault")
    // const avaxStableVaultArtifact = await artifacts.readArtifact("AvaxStableVaultFuji")
    const avaxStableVaultInterface = new ethers.utils.Interface(avaxStableVaultArtifact.abi)
    const dataAvaxStableVault = avaxStableVaultInterface.encodeFunctionData(
        "initialize",
        [
            "Cesta L2 Avalanche Stable-AVAX", "cestaASA",
            treasuryAddr, communityAddr, adminAddr, stableAvaxStrategy.address
        ]
    )
    const AvaxStableVaultProxy = await ethers.getContractFactory("AvaxProxy", deployer)
    const avaxStableVaultProxy = await AvaxStableVaultProxy.deploy(
        avaxStableVaultImplAddr, proxyAdminAddr, dataAvaxStableVault,
    )
    await avaxStableVaultProxy.deployTransaction.wait()
    const avaxStableVault = await ethers.getContractAt("AvaxStableVault", avaxStableVaultProxy.address, deployer)
    // const avaxStableVault = await ethers.getContractAt("AvaxStableVaultFuji", avaxStableVaultProxy.address, deployer)
    console.log("Cesta Avalanche Stablecoin-AVAX vault (proxy) contract address:", avaxStableVault.address)

    // Set vault
    tx = await stableAvaxStrategy.setVault(avaxStableVault.address)
    await tx.wait()
    console.log("Set vault successfully")

    // Set whitelist
    const USDTAVAXVault = await ethers.getContractAt("AvaxVaultL1", USDTAVAXVaultAddr, deployer)
    tx = await USDTAVAXVault.setWhitelistAddress(stableAvaxStrategy.address, true)
    await tx.wait()
    const USDCAVAXVault = await ethers.getContractAt("AvaxVaultL1", USDCAVAXVaultAddr, deployer)
    tx = await USDCAVAXVault.setWhitelistAddress(stableAvaxStrategy.address, true)
    await tx.wait()
    const DAIAVAXVault = await ethers.getContractAt("AvaxVaultL1", DAIAVAXVaultAddr, deployer)
    tx = await DAIAVAXVault.setWhitelistAddress(stableAvaxStrategy.address, true)
    await tx.wait()
    console.log("Set whitelist successfully")
}
main()