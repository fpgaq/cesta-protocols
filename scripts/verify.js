const { run } = require('hardhat')
const { mainnet } = require("../addresses")

const contractAddr = "0x03C18d4c14AbD2D7B50F1AeaC3e0BDc8Eb610228"
const contractName = "AvaxVault"

const AXSETHVaultAddr = "0x6A4EfC6Ab4792Fc8DCd5A488791CBDD45675d239" // Kovan
const SLPETHVaultAddr = "0x777d14f93166FA67e9cd6b869bd0F87F45FdC497" // Kovan
const ILVETHVaultAddr = "0x4Ba84ba0e07a30Bdde5E73aB8f94959b7ce1f7EF" // Kovan
const GHSTETHVaultAddr = "0x8C2bf8B337A7dc91660DD7783f9A4EFCEcC7bf65" // Kovan
const daoProxyAdminAddr = "0x0A25131608AbAeCA03AE160efAAFb008dd34a4ab" // Kovan
const mvfStrategyImplAddr = "0x9A5cC5AD35076B06a73bc8D98282761b14A998e0" // Kovan

const treasuryAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
const communityAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
const adminAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
const deXAvaxStrategyAddr = "0x9B403B87d856ae9B640FeE80AD338b6aF78732b4"

async function main() {
    // const mvfStrategyArtifact = await artifacts.readArtifact("MVFStrategy")
    const avaxVaultArtifact = await artifacts.readArtifact("AvaxVaultFuji")
    const avaxVaultInterface = new ethers.utils.Interface(avaxVaultArtifact.abi)
    const dataAvaxVault = avaxVaultInterface.encodeFunctionData(
        "initialize",
        ["Cesta Avalanche DeX-AVAX", "cestaAXA", treasuryAddr, communityAddr, adminAddr, deXAvaxStrategyAddr]
    )
    console.log(dataAvaxVault)

    // await run('verify:verify', {
    //     address: contractAddr,
    //     // constructorArguments: [
    //     //     mvfStrategyImplAddr,
    //     //     daoProxyAdminAddr,
    //     //     dataAvaxVault
    //     //   ],
    //     contract: `contracts/${contractName}.sol:${contractName}`
    // })
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })