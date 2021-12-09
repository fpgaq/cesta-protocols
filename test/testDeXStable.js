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
const JOEUSDCAddr = "0x67926d973cD8eE876aD210fAaf7DFfA99E414aCf"
const PNGUSDTAddr = "0x1fFB6ffC629f5D820DCf578409c2d26A2998a140"
const LYDDAIAddr = "0x4EE072c5946B4cdc00CBdeB4A4E54A03CF6d08d3"

const joeRouterAddr = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4"
const joeStakingContractAddr = "0xd6a4F121CA35509aF06A0Be99093d08462f53052"
const joeStakingContractV3Addr = "0x188bED1968b795d5c9022F6a0bb5931Ac4c18F00"

const JOEUSDTVaultAddr = "0x95921D21029751bF8F65Bb53442b69412C71FFE0"
const PNGUSDCVaultAddr = "0xcd799015fbe5AF106E4D4aDe29D5AF9918bfd318"
const LYDDAIVaultAddr = "0x469b5620675a9988c24cDd57B1E7136E162D6a53"

const pngRouterAddr = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106"
const pngStakingContractAddr = "0x1f806f7C8dED893fd3caE279191ad7Aa3798E928" // V2 farm (MiniChef)

const lydRouterAddr = "0xA52aBE4676dbfd04Df42eF7755F01A3c41f28D27"
const lydStakingContractAddr = "0xFb26525B14048B7BB1F3794F6129176195Db7766"

describe("Cesta Avalanche", function () {
    it("Should work on DeXToken-AVAX strategy", async function () {
        let tx, receipt, amountsOutMin
        // const [deployer, client, client2, client3, treasury, community, admin, multisig] = await ethers.getSigners()
        const [deployer, client, client2, client3, treasury, community] = await ethers.getSigners()

        // Impersonate admin
        const adminAddr = "0x3f68A3c1023d736D8Be867CA49Cb18c543373B99"
        await network.provider.request({method: "hardhat_impersonateAccount", params: [adminAddr]})
        const admin = await ethers.getSigner(adminAddr)
        await deployer.sendTransaction({to: adminAddr, value: ethers.utils.parseEther("10")})

        // Avax L1 vaults
        const JOEUSDTVault = await ethers.getContractAt("AvaxVaultL1", JOEUSDTVaultAddr, deployer)
        const PNGUSDCVault = await ethers.getContractAt("AvaxVaultL1", PNGUSDCVaultAddr, deployer)
        const LYDDAIVault = await ethers.getContractAt("AvaxVaultL1", LYDDAIVaultAddr, deployer)

        // Upgrade AvaxVaultL1
        // const avaxVaultL1Fac = await ethers.getContractFactory("AvaxVaultL1", deployer)
        // const avaxVaultL1Impl = await avaxVaultL1Fac.deploy()
        const avaxVaultL1Factory = await ethers.getContractAt("AvaxVaultL1Factory", "0x04DDc3281f71DC70879E312BbF759d54f514f07f", deployer)
        // await avaxVaultL1Factory.connect(admin).updateLogic(avaxVaultL1Impl.address)

        const avaxVaultL1Artifact = await artifacts.readArtifact("AvaxVaultL1")
        const avaxVaultL1Interface = new ethers.utils.Interface(avaxVaultL1Artifact.abi)

        // Deploy JOE-USDT
        // const dataJOEUSDT = avaxVaultL1Interface.encodeFunctionData(
        //     "initialize",
        //     [
        //         "DAO L1 Joe JOE-USDT", "daoJoeUSDT",
        //         joeRouterAddr, joeStakingContractAddr, JOEAddr, 30, false,
        //         treasury.address, community.address, admin.address
        //     ]
        // )
        // await avaxVaultL1Factory.connect(admin).createVault(dataJOEUSDT)
        // const JOEUSDTVaultAddr = await avaxVaultL1Factory.getVault((await avaxVaultL1Factory.getVaultLength()).sub(1))
        // const JOEUSDTVault = await ethers.getContractAt("AvaxVaultL1", JOEUSDTVaultAddr, deployer)

        // Deploy PNG-USDC
        // const dataPNGUSDC = avaxVaultL1Interface.encodeFunctionData(
        //     "initialize",
        //     [
        //         "DAO L1 Pangolin PNG-USDC", "daoPngUSDC",
        //         pngRouterAddr, pngStakingContractAddr, PNGAddr, 1, true,
        //         treasury.address, community.address, admin.address
        //     ]
        // )
        // await avaxVaultL1Factory.connect(admin).createVault(dataPNGUSDC)
        // const PNGUSDCVaultAddr = await avaxVaultL1Factory.getVault((await avaxVaultL1Factory.getVaultLength()).sub(1))
        // const PNGUSDCVault = await ethers.getContractAt("AvaxVaultL1", PNGUSDCVaultAddr, deployer)

        // Proxy admin
        const proxyAdmin = await ethers.getContractAt("DAOProxyAdmin", "0xd02C2Ff6ef80f1d096Bc060454054B607d26763E", deployer)

        // Deploy DeX-Stable strategy
        // const DeXStableStrategyFac = await ethers.getContractFactory("DeXStableStrategy", deployer)
        // const deXStableStrategyImpl = await DeXStableStrategyFac.deploy()
        // const deXStableStrategyArtifact = await artifacts.readArtifact("DeXStableStrategy")
        // const deXStableStrategyInterface = new ethers.utils.Interface(deXStableStrategyArtifact.abi)
        // const dataDeXStableStrategy = deXStableStrategyInterface.encodeFunctionData(
        //     "initialize",
        //     [JOEUSDCVaultAddr, PNGUSDTVaultAddr, LYDDAIVaultAddr]
        // )
        // const DeXStableStrategyProxy = await ethers.getContractFactory("AvaxProxy", deployer)
        // const deXStableStrategyProxy = await DeXStableStrategyProxy.deploy(
        //     deXStableStrategyImpl.address, proxyAdmin.address, dataDeXStableStrategy,
        // )
        // const deXStableStrategy = await ethers.getContractAt("DeXStableStrategy", deXStableStrategyProxy.address, deployer)
        const deXStableStrategyProxyAddr = "0x63243f079C2054D6c011d4b5D11F3955D9d5F3F4"
        const deXStableStrategy = await ethers.getContractAt("DeXStableStrategy", deXStableStrategyProxyAddr, deployer)

        // Upgrade DeXStableStrategy
        const deXStableStrategyFac = await ethers.getContractFactory("DeXStableStrategy", deployer)
        const deXStableStrategyImpl = await deXStableStrategyFac.deploy()
        await proxyAdmin.connect(admin).upgrade(deXStableStrategyProxyAddr, deXStableStrategyImpl.address)

        await deXStableStrategy.connect(admin).migrateFunds(JOEUSDTVaultAddr, PNGUSDCVaultAddr)

        // Deploy AvaxStableVault
        const AvaxStableVaultFac = await ethers.getContractFactory("AvaxStableVault", deployer)
        // const avaxStableVaultImpl = await AvaxStableVaultFac.deploy()
        // const avaxStableVaultArtifact = await artifacts.readArtifact("AvaxStableVault")
        // const avaxStableVaultInterface = new ethers.utils.Interface(avaxStableVaultArtifact.abi)
        // const dataAvaxStableVault = avaxStableVaultInterface.encodeFunctionData(
        //     "initialize",
        //     [
        //         "Cesta Avalanche DeX-Stable", "cestaAXS",
        //         treasury.address, community.address, admin.address, deXStableStrategy.address
        //     ]
        // )
        // const AvaxStableVaultProxy = await ethers.getContractFactory("AvaxProxy", deployer)
        // const avaxStableVaultProxy = await AvaxStableVaultProxy.deploy(
        //     avaxStableVaultImpl.address, proxyAdmin.address, dataAvaxStableVault,
        // )
        // const avaxStableVault = await ethers.getContractAt("AvaxStableVault", avaxStableVaultProxy.address, deployer)
        const avaxStableVaultProxyAddr = "0x54f3eEFE81465EE52E4b67e6466D63501a2F5007"
        const avaxStableVault = await ethers.getContractAt("AvaxStableVault", avaxStableVaultProxyAddr, deployer)

        // Upgrade AvaxStableVault
        // const avaxStableVaultFac = await ethers.getContractFactory("AvaxStableVault", deployer)
        // const avaxStableVaultImpl = await avaxStableVaultFac.deploy()
        // await proxyAdmin.connect(admin).upgrade(avaxStableVaultProxyAddr, avaxStableVaultImpl.address)

        // await avaxStableVault.connect(admin).setFees(100)

        // Set vault
        // await deXStableStrategy.connect(admin).setVault(avaxStableVault.address)

        // Set whitelist
        // await JOEUSDCVault.connect(admin).setWhitelistAddress(deXStableStrategy.address, true)
        // await PNGUSDTVault.connect(admin).setWhitelistAddress(deXStableStrategy.address, true)
        // await LYDDAIVault.connect(admin).setWhitelistAddress(deXStableStrategy.address, true)
        await JOEUSDTVault.connect(admin).setWhitelistAddress(deXStableStrategy.address, true)
        await PNGUSDCVault.connect(admin).setWhitelistAddress(deXStableStrategy.address, true)

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

        // // Deposit
        amountsOutMin = [0, 0, 0, 0]
        await USDTContract.connect(client).approve(avaxStableVault.address, ethers.constants.MaxUint256)
        await USDCContract.connect(client).approve(avaxStableVault.address, ethers.constants.MaxUint256)
        await DAIContract.connect(client).approve(avaxStableVault.address, ethers.constants.MaxUint256)
        tx = await avaxStableVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), USDTAddr, amountsOutMin)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString()) // 2502144
        tx = await avaxStableVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), USDCAddr, amountsOutMin)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString()) // 2505344
        tx = await avaxStableVault.connect(client).deposit(ethers.utils.parseUnits("10000", 18), DAIAddr, amountsOutMin)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString()) // 2450184
        // console.log(ethers.utils.formatEther(await avaxStableVault.balanceOf(client.address))) // 29820.518732148733072401

        // Second Deposit
        await USDTContract.connect(client2).approve(avaxStableVault.address, ethers.constants.MaxUint256)
        await USDCContract.connect(client3).approve(avaxStableVault.address, ethers.constants.MaxUint256)
        await avaxStableVault.connect(client2).deposit(ethers.utils.parseUnits("10000", 6), USDTAddr, amountsOutMin)
        await avaxStableVault.connect(client3).deposit(ethers.utils.parseUnits("10000", 6), USDCAddr, amountsOutMin)
        // console.log(ethers.utils.formatEther(await avaxStableVault.balanceOf(client2.address))) // 9924.184352227647585308
        // console.log(ethers.utils.formatEther(await avaxStableVault.balanceOf(client3.address))) // 9906.071919125399551665
        // console.log(ethers.utils.formatEther(await avaxStableVault.getAllPoolInUSD())) // 49650.775003500951137172
        // console.log(ethers.utils.formatEther(await avaxStableVault.getPricePerFullShare())) // 1.0
        // console.log((await deXStableStrategy.getCurrentCompositionPerc()).toString()); // 8004,998,996

        // Check farm vault pool
        // console.log(ethers.utils.formatEther(await JOEUSDCVault.getAllPoolInUSD())) // 8000 39752.225867494760896907
        // console.log(ethers.utils.formatEther(await JOEUSDCVault.getPricePerFullShare(true))) // 4075184.452965665435487227
        // console.log(ethers.utils.formatEther(await JOEUSDCVault.getPricePerFullShare(false))) // 1.0
        // console.log(ethers.utils.formatEther(await PNGUSDTVault.getAllPoolInUSD())) // 1000 4960.183560253874498972
        // console.log(ethers.utils.formatEther(await PNGUSDTVault.getPricePerFullShare(true))) // 3327184.652471042451148706
        // console.log(ethers.utils.formatEther(await PNGUSDTVault.getPricePerFullShare(false))) // 1.0
        // console.log(ethers.utils.formatEther(await LYDDAIVault.getAllPoolInUSD())) // 1000 4948.671914436551423522
        // console.log(ethers.utils.formatEther(await LYDDAIVault.getPricePerFullShare(true))) // 0.541760478719547978
        // console.log(ethers.utils.formatEther(await LYDDAIVault.getPricePerFullShare(false))) // 1.0

        // Yield in farms
        await network.provider.request({method: "evm_increaseTime", params: [86400]})
        await network.provider.send("evm_mine")
        // console.log(ethers.utils.formatEther((await JOEUSDCVault.getPendingRewards())[0])) // 32.655724431912399847
        // console.log(ethers.utils.formatEther((await JOEUSDCVault.getPendingRewards())[1])) // 0.0
        // console.log(ethers.utils.formatEther((await PNGUSDTVault.getPendingRewards())[0])) // 2.05922915199966986
        // console.log(ethers.utils.formatEther((await LYDDAIVault.getPendingRewards())[0])) // 439.382561435826829091
        await JOEUSDTVault.connect(admin).yield()
        await PNGUSDCVault.connect(admin).yield()
        await LYDDAIVault.connect(admin).yield()
        // console.log(ethers.utils.formatEther(await JOEUSDCVault.getPricePerFullShare(false))) // 1.002381910421775881
        // console.log(ethers.utils.formatEther(await PNGUSDTVault.getPricePerFullShare(false))) // 1.00084271734892523
        // console.log(ethers.utils.formatEther(await LYDDAIVault.getPricePerFullShare(false))) // 1.005468164579934691
        // console.log(ethers.utils.formatEther(await avaxStableVault.getPricePerFullShare())) // 1.002533579239154478

        // Check farm vault pool
        // console.log(ethers.utils.formatEther(await JOEUSDCVault.getAllPoolInUSD())) // 8000 39846.894233851368402422
        // console.log(ethers.utils.formatEther(await PNGUSDTVault.getAllPoolInUSD())) // 1000 4964.363629755047484621
        // console.log(ethers.utils.formatEther(await LYDDAIVault.getAllPoolInUSD())) // 1000 4975.643365260254372669

        // Test emergency withdraw
        // await avaxStableVault.connect(admin).emergencyWithdraw()
        // console.log(ethers.utils.formatEther(await JOEUSDCVault.getAllPoolInUSD())) // 
        // console.log(ethers.utils.formatEther(await PNGUSDTVault.getAllPoolInUSD())) // 
        // console.log(ethers.utils.formatEther(await LYDDAIVault.getAllPoolInUSD())) // 

        // Withdraw
        console.log("-----withdraw-----")
        amountsOutMin = [0, 0, 0, 0]
        // amountsOutMin = await middleware.getAmountsOutMinDeXAvax((await avaxStableVault.balanceOf(client.address)).div(3), USDTAddr, deployer)
        await avaxStableVault.connect(client).withdraw((await avaxStableVault.balanceOf(client.address)).div(3), USDTAddr, amountsOutMin)
        // amountsOutMin = await middleware.getAmountsOutMinDeXAvax(await avaxStableVault.balanceOf(client2.address), USDTAddr, deployer)
        await avaxStableVault.connect(client2).withdraw(avaxStableVault.balanceOf(client2.address), USDTAddr, amountsOutMin)
        // amountsOutMin = await middleware.getAmountsOutMinDeXAvax(await avaxStableVault.balanceOf(client3.address), USDTAddr, deployer)
        await avaxStableVault.connect(client3).withdraw(avaxStableVault.balanceOf(client3.address), USDTAddr, amountsOutMin)
        console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(client.address), 6)) // 9904.774893
        console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(client2.address), 6)) // 9878.201368
        console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(client3.address), 6)) // 9849.56857

        // amountsOutMin = await getAmountsOutMinDeXAvax(
        //     avaxStableVault.address, deXStableStrategy.address, (await avaxStableVault.balanceOf(client.address)).div(3), USDCAddr, deployer
        // )
        // await avaxStableVault.connect(client).withdraw((await avaxStableVault.balanceOf(client.address)).div(3), USDCAddr, amountsOutMin)
        // amountsOutMin = await getAmountsOutMinDeXAvax(avaxStableVault.address, deXStableStrategy.address, await avaxStableVault.balanceOf(client2.address), USDCAddr, deployer)
        // await avaxStableVault.connect(client2).withdraw(avaxStableVault.balanceOf(client2.address), USDCAddr, amountsOutMin)
        // amountsOutMin = await getAmountsOutMinDeXAvax(avaxStableVault.address, deXStableStrategy.address, await avaxStableVault.balanceOf(client3.address), USDCAddr, deployer)
        // await avaxStableVault.connect(client3).withdraw(avaxStableVault.balanceOf(client3.address), USDCAddr, amountsOutMin)
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(client.address), 6)) // 9844.080167
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(client2.address), 6)) // 9861.726068
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(client3.address), 6)) // 9856.199273

        // amountsOutMin = await getAmountsOutMinDeXAvax(
        //     avaxStableVault.address, deXStableStrategy.address, (await avaxStableVault.balanceOf(client.address)).div(3), DAIAddr, deployer
        // )
        // await avaxStableVault.connect(client).withdraw((await avaxStableVault.balanceOf(client.address)).div(3), DAIAddr, amountsOutMin)
        // amountsOutMin = await getAmountsOutMinDeXAvax(avaxStableVault.address, deXStableStrategy.address, await avaxStableVault.balanceOf(client2.address), DAIAddr, deployer)
        // await avaxStableVault.connect(client2).withdraw(avaxStableVault.balanceOf(client2.address), DAIAddr, amountsOutMin)
        // amountsOutMin = await getAmountsOutMinDeXAvax(avaxStableVault.address, deXStableStrategy.address, await avaxStableVault.balanceOf(client3.address), DAIAddr, deployer)
        // await avaxStableVault.connect(client3).withdraw(avaxStableVault.balanceOf(client3.address), DAIAddr, amountsOutMin)
        // console.log(ethers.utils.formatUnits(await DAIContract.balanceOf(client.address), 18)) // 9841.539386186864417744
        // console.log(ethers.utils.formatUnits(await DAIContract.balanceOf(client2.address), 18)) // 9854.417211070852915627
        // console.log(ethers.utils.formatUnits(await DAIContract.balanceOf(client3.address), 18)) // 9840.180822409327116238

        // console.log(ethers.utils.formatEther(await avaxStableVault.getAllPoolInUSD())) // 19930.369099549349329984
        // console.log(ethers.utils.formatEther(await avaxStableVault.getPricePerFullShare())) // 1.002516217703994158
        // console.log((await deXStableStrategy.getCurrentCompositionPerc()).toString()); // 8003,997,999

        // console.log(ethers.utils.formatEther(await JOEUSDCVault.getAllPoolInUSD())) // 4500 15959.745960191038351395
        // console.log(ethers.utils.formatEther(await PNGUSDTVault.getAllPoolInUSD())) // 4500 1988.38004791065865293
        // console.log(ethers.utils.formatEther(await LYDDAIVault.getAllPoolInUSD())) // 1000 1992.574969314382117894
    })
});