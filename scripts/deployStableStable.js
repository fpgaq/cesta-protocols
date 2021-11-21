const { ethers } = require("hardhat")

const USDTUSDCVaultAddr = "0xb5b5d953d14a6F3782528bE1dFE3574e20BFc72e"
const USDTDAIVaultAddr = "0xFB9c6A630e990e582d20D177C0F60D8dc7643412"
const USDCDAIVaultAddr = "0x3B77e68A882E05223fb5AeB249F41CEbB27B0D3f"

const treasuryAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
const communityAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
const adminAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"

const proxyAdminAddr = "0x29fBe3298569722Cfe26a122223Da1C0EC92829f"
const avaxStableVaultImplAddr = "0xDd07CC235FDc09420e7788BA7944c09af55afdaB"

const main = async () => {
    const [deployer] = await ethers.getSigners()

    // const deployerAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
    // await network.provider.request({method: "hardhat_impersonateAccount", params: [deployerAddr]})
    // const deployer = await ethers.getSigner(deployerAddr)

    // Deploy Stablecoin-Stablecoin strategy
    // const StableStableStrategyFac = await ethers.getContractFactory("StableStableStrategy", deployer)
    const StableStableStrategyFac = await ethers.getContractFactory("StableStableStrategyFuji", deployer)
    const stableStableStrategyImpl = await StableStableStrategyFac.deploy()
    await stableStableStrategyImpl.deployTransaction.wait()
    console.log("Cesta Avalanche Stablecoin-Stablecoin strategy (implementation) contract address:", stableStableStrategyImpl.address)

    // const stableStableStrategyArtifact = await artifacts.readArtifact("StableStableStrategy")
    const stableStableStrategyArtifact = await artifacts.readArtifact("StableStableStrategyFuji")
    const stableStableStrategyInterface = new ethers.utils.Interface(stableStableStrategyArtifact.abi)
    const dataStableStableStrategy = stableStableStrategyInterface.encodeFunctionData(
        "initialize",
        [USDTUSDCVaultAddr, USDTDAIVaultAddr, USDCDAIVaultAddr]
    )
    const StableStableStrategyProxy = await ethers.getContractFactory("AvaxProxy", deployer)
    const stableStableStrategyProxy = await StableStableStrategyProxy.deploy(
        stableStableStrategyImpl.address, proxyAdminAddr, dataStableStableStrategy,
    )
    await stableStableStrategyProxy.deployTransaction.wait()
    console.log("Cesta Avalanche Stablecoin-Stablecoin strategy (proxy) contract address:", stableStableStrategyProxy.address)
    const stableStableStrategy = await ethers.getContractAt("StableStableStrategy", stableStableStrategyProxy.address, deployer)

    // Deploy Stablecoin-Stablecoin vault
    // const avaxStableVaultArtifact = await artifacts.readArtifact("AvaxStableVault")
    const avaxStableVaultArtifact = await artifacts.readArtifact("AvaxStableVaultFuji")
    const avaxStableVaultInterface = new ethers.utils.Interface(avaxStableVaultArtifact.abi)
    const dataAvaxStableVault = avaxStableVaultInterface.encodeFunctionData(
        "initialize",
        [
            "Cesta L2 Avalanche Stable-Stable", "cestaA2S",
            treasuryAddr, communityAddr, adminAddr, stableStableStrategy.address
        ]
    )
    const AvaxStableVaultProxy = await ethers.getContractFactory("AvaxProxy", deployer)
    const avaxStableVaultProxy = await AvaxStableVaultProxy.deploy(
        avaxStableVaultImplAddr, proxyAdminAddr, dataAvaxStableVault,
    )
    await avaxStableVaultProxy.deployTransaction.wait()
    // const avaxStableVault = await ethers.getContractAt("AvaxStableVault", avaxStableVaultProxy.address, deployer)
    const avaxStableVault = await ethers.getContractAt("AvaxStableVaultFuji", avaxStableVaultProxy.address, deployer)
    console.log("Cesta Avalanche Stablecoin-Stablecoin vault (proxy) contract address:", avaxStableVault.address)

    // Set vault
    tx = await stableStableStrategy.setVault(avaxStableVault.address)
    await tx.wait()
    console.log("Set vault successfully")

    // Set whitelist
    const USDTUSDCVault = await ethers.getContractAt("AvaxVaultL1", USDTUSDCVaultAddr, deployer)
    tx = await USDTUSDCVault.setWhitelistAddress(stableStableStrategy.address, true)
    await tx.wait()
    const USDTDAIVault = await ethers.getContractAt("AvaxVaultL1", USDTDAIVaultAddr, deployer)
    tx = await USDTDAIVault.setWhitelistAddress(stableStableStrategy.address, true)
    await tx.wait()
    const USDCDAIVault = await ethers.getContractAt("AvaxVaultL1", USDCDAIVaultAddr, deployer)
    tx = await USDCDAIVault.setWhitelistAddress(stableStableStrategy.address, true)
    await tx.wait()
    console.log("Set whitelist successfully")
}
main()