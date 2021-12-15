const { ethers, network, artifacts } = require("hardhat");
const IERC20_ABI = require("../abis/IERC20_ABI.json")
const router_ABI = require("../abis/router_ABI.json")
const pair_ABI = require("../abis/pair_ABI.json")
const middleware = require("../middleware/withdraw.js")

const USDTAddr = "0xc7198437980c041c805A1EDcbA50c1Ce5db95118"
const USDCAddr = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664"
const DAIAddr = "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70"
const WAVAXAddr = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"
const JOEAddr = "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd"
const PNGAddr = "0x60781C2586D68229fde47564546784ab3fACA982"
const LYDAddr = "0x4C9B4E1AC6F24CdE3660D5E4Ef1eBF77C710C084"
const USDTUSDCAddr = "0x2E02539203256c83c7a9F6fA6f8608A32A2b1Ca2"
const USDTDAIAddr = "0xa6908C7E3Be8F4Cd2eB704B5cB73583eBF56Ee62"
const USDCDAIAddr = "0x63ABE32d0Ee76C05a11838722A63e012008416E6"

const joeRouterAddr = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4"
const joeStakingContractAddr = "0xd6a4F121CA35509aF06A0Be99093d08462f53052"
const joeStakingContractV3Addr = "0x188bED1968b795d5c9022F6a0bb5931Ac4c18F00"

const USDTUSDCVaultAddr = "0x6fa8512d7950cAF167a534E45E39A12DA67F150C"
const USDTDAIVaultAddr = "0xA2ca6C09e9269fD88FCB19a2841c5F7F73a71916"
const USDCDAIVaultAddr = "0xcc71BE249986072AE6EbA7A67ed89FE7091d130B"

const pngRouterAddr = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106"
const pngStakingContractAddr = "0x7216d1e173c1f1Ed990239d5c77d74714a837Cd5"

const lydRouterAddr = "0xA52aBE4676dbfd04Df42eF7755F01A3c41f28D27"
const lydStakingContractAddr = "0xFb26525B14048B7BB1F3794F6129176195Db7766"

describe("Cesta Avalanche", function () {
    it("Should work on Stablecoin-Stablecoin strategy", async function () {
        let tx, receipt, amountsOutMin
        // const [deployer, client, client2, client3, treasury, community, admin, multisig] = await ethers.getSigners()
        const [deployer, client, client2, client3, treasury, community] = await ethers.getSigners()

        // Impersonate admin
        const adminAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
        await network.provider.request({method: "hardhat_impersonateAccount", params: [adminAddr]})
        const admin = await ethers.getSigner(adminAddr)
        await deployer.sendTransaction({to: adminAddr, value: ethers.utils.parseEther("10")})

        // Avax L1 vaults
        const USDTUSDCVault = await ethers.getContractAt("AvaxVaultL1", USDTUSDCVaultAddr, deployer)
        const USDTDAIVault = await ethers.getContractAt("AvaxVaultL1", USDTDAIVaultAddr, deployer)
        const USDCDAIVault = await ethers.getContractAt("AvaxVaultL1", USDCDAIVaultAddr, deployer)

        // Upgrade AvaxVaultL1
        // const avaxStableVaultL1Fac = await ethers.getContractFactory("AvaxVaultL1", deployer)
        // const avaxStableVaultL1Impl = await avaxStableVaultL1Fac.deploy()
        // const avaxStableVaultL1Factory = await ethers.getContractAt("AvaxVaultL1Factory", "0x04DDc3281f71DC70879E312BbF759d54f514f07f", deployer)
        // await avaxStableVaultL1Factory.connect(admin).updateLogic(avaxStableVaultL1Impl.address)

        // Proxy admin
        const proxyAdmin = await ethers.getContractAt("DAOProxyAdmin", "0xd02C2Ff6ef80f1d096Bc060454054B607d26763E", deployer)

        // Deploy Stable-AVAX strategy
        // const stableStableStrategyFac = await ethers.getContractFactory("StableStableStrategy", deployer)
        // const stableStableStrategyImpl = await stableStableStrategyFac.deploy()
        // const stableStableStrategyArtifact = await artifacts.readArtifact("StableStableStrategy")
        // const stableStableStrategyInterface = new ethers.utils.Interface(stableStableStrategyArtifact.abi)
        // const dataDeXStableStrategy = stableStableStrategyInterface.encodeFunctionData(
        //     "initialize",
        //     [USDTUSDCVaultAddr, USDTDAIVaultAddr, USDCDAIVaultAddr]
        // )
        // const DeXStableStrategyProxy = await ethers.getContractFactory("AvaxProxy", deployer)
        // const stableStableStrategyProxy = await DeXStableStrategyProxy.deploy(
        //     stableStableStrategyImpl.address, proxyAdmin.address, dataDeXStableStrategy,
        // )
        // const stableStableStrategy = await ethers.getContractAt("StableStableStrategy", stableStableStrategyProxy.address, deployer)
        const stableStableStrategyProxyAddr = "0x07b4d7f3b5599E9c345d13813e0C8bad1010D30b"
        const stableStableStrategy = await ethers.getContractAt("StableStableStrategy", stableStableStrategyProxyAddr, deployer)

        // Upgrade stableStableStrategy
        // const stableStableStrategyFac = await ethers.getContractFactory("StableStableStrategy", deployer)
        // const stableStableStrategyImpl = await stableStableStrategyFac.deploy()
        // await proxyAdmin.connect(admin).upgrade(stableStableStrategyProxyAddr, stableStableStrategyImpl.address)

        // Deploy AvaxStableVault
        // const AvaxStableVaultFac = await ethers.getContractFactory("AvaxStableVault", deployer)
        // const avaxStableVaultImpl = await AvaxStableVaultFac.deploy()
        // const avaxStableVaultArtifact = await artifacts.readArtifact("AvaxStableVault")
        // const avaxStableVaultInterface = new ethers.utils.Interface(avaxStableVaultArtifact.abi)
        // const dataAvaxStableVault = avaxStableVaultInterface.encodeFunctionData(
        //     "initialize",
        //     [
        //         "Cesta Avalanche Stable-AVAX", "cestaASA",
        //         treasury.address, community.address, admin.address, stableStableStrategy.address
        //     ]
        // )
        // const AvaxStableVaultProxy = await ethers.getContractFactory("AvaxProxy", deployer)
        // const avaxStableVaultProxy = await AvaxStableVaultProxy.deploy(
        //     avaxStableVaultImpl.address, proxyAdmin.address, dataAvaxStableVault,
        // )
        // const avaxStableVault = await ethers.getContractAt("AvaxStableVault", avaxStableVaultProxy.address, deployer)
        const avaxStableVaultProxyAddr = "0xB103F669E87f67376FB9458A67226f2774a0B4FD"
        const avaxStableVault = await ethers.getContractAt("AvaxStableVault", avaxStableVaultProxyAddr, deployer)

        // Upgrade AvaxStableVault
        // const avaxStableVaultFac = await ethers.getContractFactory("AvaxStableVault", deployer)
        // const avaxStableVaultImpl = await avaxStableVaultFac.deploy()
        // await proxyAdmin.connect(admin).upgrade(avaxStableVaultProxyAddr, avaxStableVaultImpl.address)

        // await avaxStableVault.connect(admin).setFees(100, 2000)

        // await stableStableStrategy.connect(admin).setVault(avaxStableVault.address)

        // Set whitelist
        // await USDTUSDCVault.connect(admin).setWhitelistAddress(stableStableStrategy.address, true)
        // await USDTDAIVault.connect(admin).setWhitelistAddress(stableStableStrategy.address, true)
        // await USDCDAIVault.connect(admin).setWhitelistAddress(stableStableStrategy.address, true)

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
        amountsOutMin = [0]
        await USDTContract.connect(client).approve(avaxStableVault.address, ethers.constants.MaxUint256)
        await USDCContract.connect(client).approve(avaxStableVault.address, ethers.constants.MaxUint256)
        await DAIContract.connect(client).approve(avaxStableVault.address, ethers.constants.MaxUint256)
        tx = await avaxStableVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), USDTAddr, amountsOutMin)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString()) // 2518970
        tx = await avaxStableVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), USDCAddr, amountsOutMin)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString()) // 2535211
        tx = await avaxStableVault.connect(client).deposit(ethers.utils.parseUnits("10000", 18), DAIAddr, amountsOutMin)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString()) // 2509917
        // console.log(ethers.utils.formatEther(await avaxStableVault.balanceOf(client.address))) // 29887.978795503847571795

        // Second Deposit
        await USDTContract.connect(client2).approve(avaxStableVault.address, ethers.constants.MaxUint256)
        await USDCContract.connect(client3).approve(avaxStableVault.address, ethers.constants.MaxUint256)
        await avaxStableVault.connect(client2).deposit(ethers.utils.parseUnits("10000", 6), USDTAddr, amountsOutMin)
        await avaxStableVault.connect(client3).deposit(ethers.utils.parseUnits("10000", 6), USDCAddr, amountsOutMin)
        // console.log(ethers.utils.formatEther(await avaxStableVault.balanceOf(client2.address))) // 9969.969949060075042083
        // console.log(ethers.utils.formatEther(await avaxStableVault.balanceOf(client3.address))) // 9959.26467595224017666
        // console.log(ethers.utils.formatEther(await avaxStableVault.getAllPoolInUSD())) // 49875.535248445914501579
        // console.log(ethers.utils.formatEther(await avaxStableVault.getPricePerFullShare())) // 1.0

        // Check farm vault pool
        // console.log(ethers.utils.formatEther(await USDTUSDCVault.getAllPoolInUSD())) // 16624.791248173429954949
        // console.log(ethers.utils.formatEther(await USDTUSDCVault.getPricePerFullShare(true))) // 2018648380424.240079351452413963
        // console.log(ethers.utils.formatEther(await USDTUSDCVault.getPricePerFullShare(false))) // 1.0
        // console.log(ethers.utils.formatEther(await USDTDAIVault.getAllPoolInUSD())) // 16630.617084995572079693
        // console.log(ethers.utils.formatEther(await USDTDAIVault.getPricePerFullShare(true))) // 2034490.873975254982855398
        // console.log(ethers.utils.formatEther(await USDTDAIVault.getPricePerFullShare(false))) // 1.0
        // console.log(ethers.utils.formatEther(await USDCDAIVault.getAllPoolInUSD())) // 16629.725957719455973789
        // console.log(ethers.utils.formatEther(await USDCDAIVault.getPricePerFullShare(true))) // 2013017.958745536731201316
        // console.log(ethers.utils.formatEther(await USDCDAIVault.getPricePerFullShare(false))) // 1.0

        // Yield in farms
        await network.provider.request({method: "evm_increaseTime", params: [86400]})
        await network.provider.send("evm_mine")
        // console.log(ethers.utils.formatEther((await USDTUSDCVault.getPendingRewards())[0])) // 2.144901709276487363
        // console.log(ethers.utils.formatEther((await USDTUSDCVault.getPendingRewards())[1])) // 0.0
        // console.log(ethers.utils.formatEther((await USDTDAIVault.getPendingRewards())[0])) // 2.719544083533077744
        // console.log(ethers.utils.formatEther((await USDCDAIVault.getPendingRewards())[0])) // 2.383853873375385494
        await USDTUSDCVault.connect(admin).yield()
        // await USDTDAIVault.connect(admin).yield() // No reward from Trader Joe at the moment
        await USDCDAIVault.connect(admin).yield()
        // console.log(ethers.utils.formatEther(await USDTUSDCVault.getPricePerFullShare(false))) // 1.000374999517005749
        // console.log(ethers.utils.formatEther(await USDTDAIVault.getPricePerFullShare(false))) // 1.000474838584791507
        // console.log(ethers.utils.formatEther(await USDCDAIVault.getPricePerFullShare(false))) // 1.000416567310997146
        // console.log(ethers.utils.formatEther(await avaxStableVault.getPricePerFullShare())) // 1.000422484586947156

        // Release fees
        // await avaxStableVault.connect(admin).releaseFees()
        // const lpTokenAmt = await avaxStableVault.balanceOf(adminAddr)
        // const ppfs = await avaxStableVault.getPricePerFullShare()
        // console.log(ethers.utils.formatEther(lpTokenAmt.mul(ppfs).div(ethers.utils.parseEther("1"))))

        // Check farm vault pool
        // console.log(ethers.utils.formatEther(await USDTUSDCVault.getAllPoolInUSD())) // 3333 16631.028410661977632621
        // console.log(ethers.utils.formatEther(await USDTDAIVault.getAllPoolInUSD())) // 3333 16638.521115522342267305
        // console.log(ethers.utils.formatEther(await USDCDAIVault.getAllPoolInUSD())) // 3333 16636.659855827386512095

        // Test emergency withdraw
        // await avaxStableVault.connect(admin).emergencyWithdraw()
        // console.log(ethers.utils.formatEther(await USDTUSDCVault.getAllPoolInUSD())) // 
        // console.log(ethers.utils.formatEther(await USDTDAIVault.getAllPoolInUSD())) // 
        // console.log(ethers.utils.formatEther(await USDCDAIVault.getAllPoolInUSD())) // 

        // Withdraw
        console.log("-----withdraw-----")
        amountsOutMin = [0]
        await avaxStableVault.connect(client).withdraw((await avaxStableVault.balanceOf(client.address)).div(3), USDTAddr, amountsOutMin)
        await avaxStableVault.connect(client2).withdraw(avaxStableVault.balanceOf(client2.address), USDTAddr, amountsOutMin)
        await avaxStableVault.connect(client3).withdraw(avaxStableVault.balanceOf(client3.address), USDTAddr, amountsOutMin)
        console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(client.address), 6)) // 9979.85764
        console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(client2.address), 6)) // 9985.353307
        console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(client3.address), 6)) // 9978.012196

        // amountsOutMin = await getAmountsOutMinDeXAvax(
        //     avaxStableVault.address, stableStableStrategy.address, (await avaxStableVault.balanceOf(client.address)).div(3), USDCAddr, deployer
        // )
        // await avaxStableVault.connect(client).withdraw((await avaxStableVault.balanceOf(client.address)).div(3), USDCAddr, amountsOutMin)
        // amountsOutMin = await getAmountsOutMinDeXAvax(avaxStableVault.address, stableStableStrategy.address, await avaxStableVault.balanceOf(client2.address), USDCAddr, deployer)
        // await avaxStableVault.connect(client2).withdraw(avaxStableVault.balanceOf(client2.address), USDCAddr, amountsOutMin)
        // amountsOutMin = await getAmountsOutMinDeXAvax(avaxStableVault.address, stableStableStrategy.address, await avaxStableVault.balanceOf(client3.address), USDCAddr, deployer)
        // await avaxStableVault.connect(client3).withdraw(avaxStableVault.balanceOf(client3.address), USDCAddr, amountsOutMin)
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(client.address), 6)) // 9844.080167
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(client2.address), 6)) // 9861.726068
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(client3.address), 6)) // 9856.199273

        // amountsOutMin = await getAmountsOutMinDeXAvax(
        //     avaxStableVault.address, stableStableStrategy.address, (await avaxStableVault.balanceOf(client.address)).div(3), DAIAddr, deployer
        // )
        // await avaxStableVault.connect(client).withdraw((await avaxStableVault.balanceOf(client.address)).div(3), DAIAddr, amountsOutMin)
        // amountsOutMin = await getAmountsOutMinDeXAvax(avaxStableVault.address, stableStableStrategy.address, await avaxStableVault.balanceOf(client2.address), DAIAddr, deployer)
        // await avaxStableVault.connect(client2).withdraw(avaxStableVault.balanceOf(client2.address), DAIAddr, amountsOutMin)
        // amountsOutMin = await getAmountsOutMinDeXAvax(avaxStableVault.address, stableStableStrategy.address, await avaxStableVault.balanceOf(client3.address), DAIAddr, deployer)
        // await avaxStableVault.connect(client3).withdraw(avaxStableVault.balanceOf(client3.address), DAIAddr, amountsOutMin)
        // console.log(ethers.utils.formatUnits(await DAIContract.balanceOf(client.address), 18)) // 9841.539386186864417744
        // console.log(ethers.utils.formatUnits(await DAIContract.balanceOf(client2.address), 18)) // 9854.417211070852915627
        // console.log(ethers.utils.formatUnits(await DAIContract.balanceOf(client3.address), 18)) // 9840.180822409327116238

        // console.log(ethers.utils.formatEther(await avaxStableVault.getAllPoolInUSD())) // 19957.680697026299951604
        // console.log(ethers.utils.formatEther(await avaxStableVault.getPricePerFullShare())) // 1.000422472587731047

        // console.log(ethers.utils.formatEther(await USDTUSDCVault.getAllPoolInUSD())) // 3333 6654.009498987561366346
        // console.log(ethers.utils.formatEther(await USDTDAIVault.getAllPoolInUSD())) // 3333 6657.008929820570684498
        // console.log(ethers.utils.formatEther(await USDCDAIVault.getAllPoolInUSD())) // 3333 6656.265366110511036291
    })
});