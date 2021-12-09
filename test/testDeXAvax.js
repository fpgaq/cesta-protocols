const { ethers, network, artifacts } = require("hardhat");
const Web3 = require("web3")
const IERC20_ABI = require("../abis/IERC20_ABI.json")
const router_ABI = require("../abis/router_ABI.json")
const pair_ABI = require("../abis/pair_ABI.json")
const midDeposit = require("../middleware/deposit.js")
const midWithdraw = require("../middleware/withdraw.js")

const USDTAddr = "0xc7198437980c041c805A1EDcbA50c1Ce5db95118"
const USDCAddr = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664"
const DAIAddr = "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70"
const WAVAXAddr = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"
const JOEAddr = "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd"
const PNGAddr = "0x60781C2586D68229fde47564546784ab3fACA982"
const LYDAddr = "0x4C9B4E1AC6F24CdE3660D5E4Ef1eBF77C710C084"
const JOEAVAXAddr = "0x454E67025631C065d3cFAD6d71E6892f74487a15"
const PNGAVAXAddr = "0xd7538cABBf8605BdE1f4901B47B8D42c61DE0367"
const LYDAVAXAddr = "0xFba4EdaAd3248B03f1a3261ad06Ad846A8e50765"

const joeRouterAddr = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4"
const joeStakingContractAddr = "0xd6a4F121CA35509aF06A0Be99093d08462f53052"
const joeStakingContractV3Addr = "0x188bED1968b795d5c9022F6a0bb5931Ac4c18F00"

const JOEAVAXVaultAddr = "0xFe67a4BAe72963BE1181B211180d8e617B5a8dee"
const PNGAVAXVaultAddr = "0x7eEcFB07b7677aa0e1798a4426b338dA23f9De34"
const LYDAVAXVaultAddr = "0xffEaB42879038920A31911f3E93295bF703082ed"

const pngRouterAddr = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106"
const pngStakingContractAddr = "0x574d3245e36Cf8C9dc86430EaDb0fDB2F385F829"

const lydRouterAddr = "0xA52aBE4676dbfd04Df42eF7755F01A3c41f28D27"
const lydStakingContractAddr = "0xFb26525B14048B7BB1F3794F6129176195Db7766"

describe("Cesta Avalanche", function () {
    it("Should work on DeXToken-AVAX strategy", async function () {
        let tx, receipt, amountsOutMin
        const provider = new Web3.providers.HttpProvider("https://api.avax.network/ext/bc/C/rpc")
        // const [deployer, client, client2, client3, treasury, community, admin, multisig] = await ethers.getSigners()
        const [deployer, client, client2, client3, treasury, community] = await ethers.getSigners()

        // Impersonate admin
        const adminAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
        await network.provider.request({method: "hardhat_impersonateAccount", params: [adminAddr]})
        const admin = await ethers.getSigner(adminAddr)
        await deployer.sendTransaction({to: adminAddr, value: ethers.utils.parseEther("10")})

        // Avax L1 vaults
        const JOEAVAXVault = await ethers.getContractAt("AvaxVaultL1", JOEAVAXVaultAddr, deployer)
        const PNGAVAXVault = await ethers.getContractAt("AvaxVaultL1", PNGAVAXVaultAddr, deployer)
        const LYDAVAXVault = await ethers.getContractAt("AvaxVaultL1", LYDAVAXVaultAddr, deployer)

        // Upgrade AvaxVaultL1
        // const avaxVaultL1Fac = await ethers.getContractFactory("AvaxVaultL1", deployer)
        // const avaxVaultL1Impl = await avaxVaultL1Fac.deploy()
        // const avaxVaultL1Factory = await ethers.getContractAt("AvaxVaultL1Factory", "0x04DDc3281f71DC70879E312BbF759d54f514f07f", deployer)
        // await avaxVaultL1Factory.connect(admin).updateLogic(avaxVaultL1Impl.address)

        // await PNGAVAXVault.connect(admin).migratePangolinFarm(0)

        // Proxy admin
        const proxyAdmin = await ethers.getContractAt("DAOProxyAdmin", "0xd02C2Ff6ef80f1d096Bc060454054B607d26763E", deployer)

        // Deploy DeX-Avax strategy
        // const DeXAvaxStrategyFac = await ethers.getContractFactory("DeXAvaxStrategy", deployer)
        // const deXAvaxStrategyImpl = await DeXAvaxStrategyFac.deploy()
        // const deXAvaxStrategyArtifact = await artifacts.readArtifact("DeXAvaxStrategy")
        // const deXAvaxStrategyInterface = new ethers.utils.Interface(deXAvaxStrategyArtifact.abi)
        // const dataDeXAvaxStrategy = deXAvaxStrategyInterface.encodeFunctionData(
        //     "initialize",
        //     [JOEAVAXVaultAddr, PNGAVAXVaultAddr, LYDAVAXVaultAddr]
        // )
        // const DeXAvaxStrategyProxy = await ethers.getContractFactory("AvaxProxy", deployer)
        // const deXAvaxStrategyProxy = await DeXAvaxStrategyProxy.deploy(
        //     deXAvaxStrategyImpl.address, proxyAdmin.address, dataDeXAvaxStrategy,
        // )
        // const deXAvaxStrategy = await ethers.getContractAt("DeXAvaxStrategy", deXAvaxStrategyProxy.address, deployer)
        const deXAvaxStrategyProxyAddr = "0x9B403B87d856ae9B640FeE80AD338b6aF78732b4"
        const deXAvaxStrategy = await ethers.getContractAt("DeXAvaxStrategy", deXAvaxStrategyProxyAddr, deployer)

        // Deploy AvaxVault
        // const AvaxVaultFac = await ethers.getContractFactory("AvaxVault", deployer)
        // const avaxVaultImpl = await AvaxVaultFac.deploy()
        // const avaxVaultArtifact = await artifacts.readArtifact("AvaxVault")
        // const avaxVaultInterface = new ethers.utils.Interface(avaxVaultArtifact.abi)
        // const dataAvaxVault = avaxVaultInterface.encodeFunctionData(
        //     "initialize",
        //     [
        //         "Cesta Avalanche DeX-AVAX", "cestaAXA",
        //         treasury.address, community.address, admin.address, deXAvaxStrategy.address
        //     ]
        // )
        // const AvaxVaultProxy = await ethers.getContractFactory("AvaxProxy", deployer)
        // const avaxVaultProxy = await AvaxVaultProxy.deploy(
        //     avaxVaultImpl.address, proxyAdmin.address, dataAvaxVault,
        // )
        // const avaxVault = await ethers.getContractAt("AvaxVault", avaxVaultProxy.address, deployer)
        const avaxVaultProxyAddr = "0xE4809Ed214631017737A3d7FA3e78600Ee96Eb85"
        const avaxVault = await ethers.getContractAt("AvaxVault", avaxVaultProxyAddr, deployer)

        // Upgrade AvaxVault
        // const avaxVaultFac = await ethers.getContractFactory("AvaxVault", deployer)
        // const avaxVaultImpl = await avaxVaultFac.deploy()
        // await proxyAdmin.connect(admin).upgrade(avaxVaultProxyAddr, avaxVaultImpl.address)

        // await avaxVault.connect(admin).setFees(100)

        // Set vault
        // await deXAvaxStrategy.connect(admin).setVault(avaxVault.address)

        // Set whitelist
        // await JOEAVAXVault.connect(admin).setWhitelistAddress(deXAvaxStrategy.address, true)
        // await PNGAVAXVault.connect(admin).setWhitelistAddress(deXAvaxStrategy.address, true)
        // await LYDAVAXVault.connect(admin).setWhitelistAddress(deXAvaxStrategy.address, true)

        // Swap & transfer Stablecoins to client
        const joeRouter = new ethers.Contract(joeRouterAddr, router_ABI, deployer)    
        await joeRouter.swapAVAXForExactTokens(
            ethers.utils.parseUnits("20000", 6), [WAVAXAddr, USDTAddr], deployer.address, Math.ceil(Date.now() / 1000),
            {value: ethers.utils.parseEther("400")}
        )   
        await joeRouter.swapAVAXForExactTokens(
            ethers.utils.parseUnits("20000", 6), [WAVAXAddr, USDCAddr], deployer.address, Math.ceil(Date.now() / 1000),
            {value: ethers.utils.parseEther("400")}
        )   
        await joeRouter.swapAVAXForExactTokens(
            ethers.utils.parseUnits("10000", 18), [WAVAXAddr, DAIAddr], deployer.address, Math.ceil(Date.now() / 1000),
            {value: ethers.utils.parseEther("200")}
        )
        const USDTContract = new ethers.Contract(USDTAddr, IERC20_ABI, deployer)
        const USDCContract = new ethers.Contract(USDCAddr, IERC20_ABI, deployer)
        const DAIContract = new ethers.Contract(DAIAddr, IERC20_ABI, deployer)
        await USDTContract.transfer(client.address, ethers.utils.parseUnits("10000", 6))
        await USDTContract.transfer(client2.address, ethers.utils.parseUnits("10000", 6))
        await USDCContract.transfer(client.address, ethers.utils.parseUnits("10000", 6))
        await USDCContract.transfer(client3.address, ethers.utils.parseUnits("10000", 6))
        await DAIContract.transfer(client.address, ethers.utils.parseUnits("10000", 18))

        // Deposit
        amountsOutMin = [0, 0, 0, 0]
        await USDTContract.connect(client).approve(avaxVault.address, ethers.constants.MaxUint256)
        await USDCContract.connect(client).approve(avaxVault.address, ethers.constants.MaxUint256)
        await DAIContract.connect(client).approve(avaxVault.address, ethers.constants.MaxUint256)
        // amountsOutMin = await midDeposit.getAmountsOutMinDeXAvax(ethers.utils.parseUnits("10000", 6), USDTAddr, provider)
        tx = await avaxVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), USDTAddr, amountsOutMin)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString()) // 1654441
        // amountsOutMin = await midDeposit.getAmountsOutMinDeXAvax(ethers.utils.parseUnits("10000", 6), USDCAddr, provider)
        tx = await avaxVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), USDCAddr, amountsOutMin)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString()) // 1493978
        // amountsOutMin = await midDeposit.getAmountsOutMinDeXAvax(ethers.utils.parseUnits("10000", 18), DAIAddr, provider)
        tx = await avaxVault.connect(client).deposit(ethers.utils.parseUnits("10000", 18), DAIAddr, amountsOutMin)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString()) // 1442825
        // console.log(ethers.utils.formatEther(await avaxVault.balanceOf(client.address))) // 29826.6144742985537149

        // Second Deposit
        await USDTContract.connect(client2).approve(avaxVault.address, ethers.constants.MaxUint256)
        await USDCContract.connect(client3).approve(avaxVault.address, ethers.constants.MaxUint256)
        // amountsOutMin = await midDeposit.getAmountsOutMinDeXAvax(ethers.utils.parseUnits("10000", 6), USDTAddr, provider)
        await avaxVault.connect(client2).deposit(ethers.utils.parseUnits("10000", 6), USDTAddr, amountsOutMin)
        // amountsOutMin = await midDeposit.getAmountsOutMinDeXAvax(ethers.utils.parseUnits("10000", 6), USDCAddr, provider)
        await avaxVault.connect(client3).deposit(ethers.utils.parseUnits("10000", 6), USDCAddr, amountsOutMin)
        // console.log(ethers.utils.formatEther(await avaxVault.balanceOf(client2.address))) // 9942.978162144970684726
        // console.log(ethers.utils.formatEther(await avaxVault.balanceOf(client3.address))) // 9936.633979589888458834
        // console.log(ethers.utils.formatEther(await avaxVault.getAllPoolInUSD())) // 49706.22661603341285846
        // console.log(ethers.utils.formatEther(await avaxVault.getPricePerFullShare())) // 1.0
        // console.log((await deXAvaxStrategy.getCurrentCompositionPerc()).toString()); // 4499,4499,1000

        // Check farm vault pool
        // console.log(ethers.utils.formatEther(await JOEAVAXVault.getAllPoolInUSD())) // 4500 22371.298884733381556011
        // console.log(ethers.utils.formatEther(await JOEAVAXVault.getPricePerFullShare(true))) // 42.774740318007390766
        // console.log(ethers.utils.formatEther(await JOEAVAXVault.getPricePerFullShare(false))) // 1.0
        // console.log(ethers.utils.formatEther(await PNGAVAXVault.getAllPoolInUSD())) // 4500 22372.285719734165674792
        // console.log(ethers.utils.formatEther(await PNGAVAXVault.getPricePerFullShare(true))) // 35.575807828738378039
        // console.log(ethers.utils.formatEther(await PNGAVAXVault.getPricePerFullShare(false))) // 1.0
        // console.log(ethers.utils.formatEther(await LYDAVAXVault.getAllPoolInUSD())) // 1000 4975.307049973297539124
        // console.log(ethers.utils.formatEther(await LYDAVAXVault.getPricePerFullShare(true))) // 6.784296285289700564
        // console.log(ethers.utils.formatEther(await LYDAVAXVault.getPricePerFullShare(false))) // 1.0

        // Yield in farms
        await network.provider.request({method: "evm_increaseTime", params: [86400]})
        await network.provider.send("evm_mine")
        // console.log(ethers.utils.formatEther((await JOEAVAXVault.getPendingRewards())[0])) // 10.227583844030631206
        // console.log(ethers.utils.formatEther((await JOEAVAXVault.getPendingRewards())[1])) // 0.136899344325533245
        // console.log(ethers.utils.formatEther((await PNGAVAXVault.getPendingRewards())[0])) // 10.947432740803510785
        // console.log(ethers.utils.formatEther((await LYDAVAXVault.getPendingRewards())[0])) // 217.40476327089899811
        await JOEAVAXVault.connect(admin).yield()
        await PNGAVAXVault.connect(admin).yield()
        await LYDAVAXVault.connect(admin).yield()
        // console.log(ethers.utils.formatEther(await JOEAVAXVault.getPricePerFullShare(false))) // 1.001183405710973749
        // console.log(ethers.utils.formatEther(await PNGAVAXVault.getPricePerFullShare(false))) // 1.000893243155570047
        // console.log(ethers.utils.formatEther(await LYDAVAXVault.getPricePerFullShare(false))) // 1.002439065455446828
        // console.log(ethers.utils.formatEther(await avaxVault.getPricePerFullShare())) // 1.001177204377987399

        // Check farm vault pool
        // console.log(ethers.utils.formatEther(await JOEAVAXVault.getAllPoolInUSD())) // 4500 22397.765529831633037659
        // console.log(ethers.utils.formatEther(await PNGAVAXVault.getAllPoolInUSD())) // 4500 22392.262154729633250779
        // console.log(ethers.utils.formatEther(await LYDAVAXVault.getAllPoolInUSD())) // 1000 4987.392541540119777121

        // Test emergency withdraw
        // await avaxVault.connect(admin).emergencyWithdraw()
        // console.log(ethers.utils.formatEther(await JOEAVAXVault.getAllPoolInUSD())) // 0.0
        // console.log(ethers.utils.formatEther(await PNGAVAXVault.getAllPoolInUSD())) // 0.0
        // console.log(ethers.utils.formatEther(await LYDAVAXVault.getAllPoolInUSD())) // 0.0

        // Withdraw
        console.log("-----withdraw-----")

        amountsOutMin = [0, 0, 0, 0]
        // amountsOutMin = await midWithdraw.getAmountsOutMinDeXAvax((await avaxVault.balanceOf(client.address)).div(3), USDTAddr, provider)
        await avaxVault.connect(client).withdraw((await avaxVault.balanceOf(client.address)).div(3), USDTAddr, amountsOutMin)
        // amountsOutMin = await midWithdraw.getAmountsOutMinDeXAvax(await avaxVault.balanceOf(client2.address), USDTAddr, provider)
        await avaxVault.connect(client2).withdraw(avaxVault.balanceOf(client2.address), USDTAddr, amountsOutMin)
        // amountsOutMin = await midWithdraw.getAmountsOutMinDeXAvax(await avaxVault.balanceOf(client3.address), USDTAddr, provider)
        await avaxVault.connect(client3).withdraw(avaxVault.balanceOf(client3.address), USDTAddr, amountsOutMin)
        console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(client.address), 6)) // 9800.31519
        console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(client2.address), 6)) // 9811.112628
        console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(client3.address), 6)) // 9772.533221

        // amountsOutMin = await getAmountsOutMinDeXAvax(
        //     avaxVault.address, deXAvaxStrategy.address, (await avaxVault.balanceOf(client.address)).div(3), USDCAddr, deployer
        // )
        // await avaxVault.connect(client).withdraw((await avaxVault.balanceOf(client.address)).div(3), USDCAddr, amountsOutMin)
        // amountsOutMin = await getAmountsOutMinDeXAvax(avaxVault.address, deXAvaxStrategy.address, await avaxVault.balanceOf(client2.address), USDCAddr, deployer)
        // await avaxVault.connect(client2).withdraw(avaxVault.balanceOf(client2.address), USDCAddr, amountsOutMin)
        // amountsOutMin = await getAmountsOutMinDeXAvax(avaxVault.address, deXAvaxStrategy.address, await avaxVault.balanceOf(client3.address), USDCAddr, deployer)
        // await avaxVault.connect(client3).withdraw(avaxVault.balanceOf(client3.address), USDCAddr, amountsOutMin)
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(client.address), 6)) // 9844.080167
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(client2.address), 6)) // 9861.726068
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(client3.address), 6)) // 9856.199273

        // amountsOutMin = await getAmountsOutMinDeXAvax(
        //     avaxVault.address, deXAvaxStrategy.address, (await avaxVault.balanceOf(client.address)).div(3), DAIAddr, deployer
        // )
        // await avaxVault.connect(client).withdraw((await avaxVault.balanceOf(client.address)).div(3), DAIAddr, amountsOutMin)
        // amountsOutMin = await getAmountsOutMinDeXAvax(avaxVault.address, deXAvaxStrategy.address, await avaxVault.balanceOf(client2.address), DAIAddr, deployer)
        // await avaxVault.connect(client2).withdraw(avaxVault.balanceOf(client2.address), DAIAddr, amountsOutMin)
        // amountsOutMin = await getAmountsOutMinDeXAvax(avaxVault.address, deXAvaxStrategy.address, await avaxVault.balanceOf(client3.address), DAIAddr, deployer)
        // await avaxVault.connect(client3).withdraw(avaxVault.balanceOf(client3.address), DAIAddr, amountsOutMin)
        // console.log(ethers.utils.formatUnits(await DAIContract.balanceOf(client.address), 18)) // 9841.539386186864417744
        // console.log(ethers.utils.formatUnits(await DAIContract.balanceOf(client2.address), 18)) // 9854.417211070852915627
        // console.log(ethers.utils.formatUnits(await DAIContract.balanceOf(client3.address), 18)) // 9840.180822409327116238

        // console.log(ethers.utils.formatEther(await avaxVault.getAllPoolInUSD())) // 19902.30769872915341647
        // console.log(ethers.utils.formatEther(await avaxVault.getPricePerFullShare())) // 1.000900104630323042
        // console.log((await deXAvaxStrategy.getCurrentCompositionPerc()).toString()); // 4500,4498,1000

        // console.log(ethers.utils.formatEther(await JOEAVAXVault.getAllPoolInUSD())) // 4500 8962.229328606329006888
        // console.log(ethers.utils.formatEther(await PNGAVAXVault.getAllPoolInUSD())) // 4500 8960.112649035450283002
        // console.log(ethers.utils.formatEther(await LYDAVAXVault.getAllPoolInUSD())) // 1000 1992.642054562487550888
    })
});