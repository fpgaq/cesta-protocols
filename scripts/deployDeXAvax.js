const { ethers, tasks } = require("hardhat")

const JOEAVAXVaultAddr = "0xFe67a4BAe72963BE1181B211180d8e617B5a8dee"
const PNGAVAXVaultAddr = "0x7eEcFB07b7677aa0e1798a4426b338dA23f9De34"
const LYDAVAXVaultAddr = "0xffEaB42879038920A31911f3E93295bF703082ed"

const treasuryAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
const communityAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
const adminAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"

const proxyAdminAddr = "0xd02C2Ff6ef80f1d096Bc060454054B607d26763E"
const avaxVaultImplAddr = "0x20B07973085c4fB12b5B17A6E30193847f498BA4"

const main = async () => {
    const [deployer] = await ethers.getSigners()

    // const deployerAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
    // await network.provider.request({method: "hardhat_impersonateAccount", params: [deployerAddr]})
    // const deployer = await ethers.getSigner(deployerAddr)

    // Deploy DeX-Avax strategy
    const DeXAvaxStrategyFac = await ethers.getContractFactory("DeXAvaxStrategy", deployer)
    // const DeXAvaxStrategyFac = await ethers.getContractFactory("DeXAvaxStrategyFuji", deployer)
    const deXAvaxStrategyImpl = await DeXAvaxStrategyFac.deploy()
    await deXAvaxStrategyImpl.deployTransaction.wait()
    console.log("Cesta Avalanche DeXToken-AVAX strategy (implementation) contract address:", deXAvaxStrategyImpl.address)

    const deXAvaxStrategyArtifact = await artifacts.readArtifact("DeXAvaxStrategy")
    // const deXAvaxStrategyArtifact = await artifacts.readArtifact("DeXAvaxStrategyFuji")
    const deXAvaxStrategyInterface = new ethers.utils.Interface(deXAvaxStrategyArtifact.abi)
    const dataDeXAvaxStrategy = deXAvaxStrategyInterface.encodeFunctionData(
        "initialize",
        [JOEAVAXVaultAddr, PNGAVAXVaultAddr, LYDAVAXVaultAddr]
    )
    const DeXAvaxStrategyProxy = await ethers.getContractFactory("AvaxProxy", deployer)
    const deXAvaxStrategyProxy = await DeXAvaxStrategyProxy.deploy(
        deXAvaxStrategyImpl.address, proxyAdminAddr, dataDeXAvaxStrategy,
    )
    await deXAvaxStrategyProxy.deployTransaction.wait()
    console.log("Cesta Avalanche DeXToken-AVAX strategy (proxy) contract address:", deXAvaxStrategyProxy.address)
    const deXAvaxStrategy = await ethers.getContractAt("DeXAvaxStrategy", deXAvaxStrategyProxy.address, deployer)

    // Deploy DeX-Avax vault
    const avaxVaultArtifact = await artifacts.readArtifact("AvaxVault")
    // const avaxVaultArtifact = await artifacts.readArtifact("AvaxVaultFuji")
    const avaxVaultInterface = new ethers.utils.Interface(avaxVaultArtifact.abi)
    const dataAvaxVault = avaxVaultInterface.encodeFunctionData(
        "initialize",
        [
            "Cesta L2 Avalanche DeX-AVAX", "cestaAXA",
            treasuryAddr, communityAddr, adminAddr, deXAvaxStrategy.address
        ]
    )
    const AvaxVaultProxy = await ethers.getContractFactory("AvaxProxy", deployer)
    const avaxVaultProxy = await AvaxVaultProxy.deploy(
        avaxVaultImplAddr, proxyAdminAddr, dataAvaxVault,
    )
    await avaxVaultProxy.deployTransaction.wait()
    const avaxVault = await ethers.getContractAt("AvaxVault", avaxVaultProxy.address, deployer)
    // const avaxVault = await ethers.getContractAt("AvaxVaultFuji", avaxVaultProxy.address, deployer)
    console.log("Cesta Avalanche DeXToken-AVAX vault (proxy) contract address:", avaxVault.address)

    tx = await deXAvaxStrategy.setVault(avaxVault.address)
    await tx.wait()
    console.log("Set vault successfully")

    // Set whitelist
    const JOEAVAXVault = await ethers.getContractAt("AvaxVaultL1", JOEAVAXVaultAddr, deployer)
    tx = await JOEAVAXVault.setWhitelistAddress(deXAvaxStrategy.address, true)
    await tx.wait()
    const PNGAVAXVault = await ethers.getContractAt("AvaxVaultL1", PNGAVAXVaultAddr, deployer)
    tx = await PNGAVAXVault.setWhitelistAddress(deXAvaxStrategy.address, true)
    await tx.wait()
    const LYDAVAXVault = await ethers.getContractAt("AvaxVaultL1", LYDAVAXVaultAddr, deployer)
    tx = await LYDAVAXVault.setWhitelistAddress(deXAvaxStrategy.address, true)
    await tx.wait()
    console.log("Set whitelist successfully")
}
main()