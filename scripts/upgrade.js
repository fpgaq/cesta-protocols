const { ethers } = require("hardhat")

const proxyAdminAddr = "0x29fBe3298569722Cfe26a122223Da1C0EC92829f"
const contractProxyAddr = "0xe1964BDd447ee6f0Ee2bC734f1043ebA35444CFC"
const contractName = "AvaxVaultFuji"

// const avaxVaultL1FactoryAddr = "0x849DBe4417E03534cB15F48c996219FC07B69008"

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
    const contractImplAddr = "0x9C92FB7fF819F83B1ec349267f005749a725f853"

    const proxyAdmin = new ethers.Contract(proxyAdminAddr, ["function upgrade(address, address) external"], deployer)
    // tx = await proxyAdmin.upgrade(contractProxyAddr, contractImpl.address)
    tx = await proxyAdmin.upgrade(contractProxyAddr, contractImplAddr)
    await tx.wait()
    console.log("Contract upgraded successfully")

    // Upgrade AvaxVaultL1
    // const avaxVaultL1Fac = await ethers.getContractFactory("AvaxVaultL1", deployer)
    // const avaxVaultL1Impl = await avaxVaultL1Fac.deploy()
    // await avaxVaultL1Impl.deployTransaction.wait()
    // console.log(avaxVaultL1Impl.address)
    // const avaxVaultL1ImplAddr = "0x084F149E5B293eB0244fBEc1B4Ed76a56a498134"
    // const avaxVaultL1Factory = await ethers.getContractAt("AvaxVaultL1Factory", avaxVaultL1FactoryAddr, deployer)
    // tx = await avaxVaultL1Factory.updateLogic(avaxVaultL1Impl.address)
    // tx = await avaxVaultL1Factory.updateLogic(avaxVaultL1ImplAddr)
    // await tx.wait()
    // console.log("Contract upgraded successfully")

    // Set lower yield fee
    // const JOEAVAXVaultAddr = "0xFe67a4BAe72963BE1181B211180d8e617B5a8dee"
    // const JOEAVAXVault = await ethers.getContractAt("AvaxVaultL1", JOEAVAXVaultAddr, deployer)
    // tx = await JOEAVAXVault.setFee(1000, 1000)
    // await tx.wait()
    // const PNGAVAXVaultAddr = "0x7eEcFB07b7677aa0e1798a4426b338dA23f9De34"
    // const PNGAVAXVault = await ethers.getContractAt("AvaxVaultL1", PNGAVAXVaultAddr, deployer)
    // tx = await PNGAVAXVault.setFee(1000, 1000)
    // await tx.wait()
    // const LYDAVAXVaultAddr = "0xffEaB42879038920A31911f3E93295bF703082ed"
    // const LYDAVAXVault = await ethers.getContractAt("AvaxVaultL1", LYDAVAXVaultAddr, deployer)
    // tx = await LYDAVAXVault.setFee(1000, 1000)
    // await tx.wait()

    // console.log((await JOEAVAXVault.yieldFeePerc()).toString())
    // console.log((await JOEAVAXVault.depositFeePerc()).toString())
    // console.log((await PNGAVAXVault.yieldFeePerc()).toString())
    // console.log((await PNGAVAXVault.depositFeePerc()).toString())
    // console.log((await LYDAVAXVault.yieldFeePerc()).toString())
    // console.log((await LYDAVAXVault.depositFeePerc()).toString())
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
