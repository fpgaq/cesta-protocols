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
const USDTAVAXAddr = "0x5Fc70cF6A4A858Cf4124013047e408367EBa1ace"
const USDCAVAXAddr = "0xbd918Ed441767fe7924e99F6a0E0B568ac1970D9"
const DAIAVAXAddr = "0x87Dee1cC9FFd464B79e058ba20387c1984aed86a"

const joeRouterAddr = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4"
const joeStakingContractAddr = "0xd6a4F121CA35509aF06A0Be99093d08462f53052"
const joeStakingContractV3Addr = "0x188bED1968b795d5c9022F6a0bb5931Ac4c18F00"

const USDTAVAXVaultAddr = "0x82AFf9e3f08e34D61737b035c5890d57803B3958"
const USDCAVAXVaultAddr = "0x5378B730711D1f57F888e4828b130E591c4Ea97b"
const DAIAVAXVaultAddr = "0x308555fb3083A300A03dEfFfa311D2eAF2CD56C8"

const pngRouterAddr = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106"
const pngStakingContractAddr = "0x7216d1e173c1f1Ed990239d5c77d74714a837Cd5"

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
        const USDTAVAXVault = await ethers.getContractAt("AvaxVaultL1", USDTAVAXVaultAddr, deployer)
        const USDCAVAXVault = await ethers.getContractAt("AvaxVaultL1", USDCAVAXVaultAddr, deployer)
        const DAIAVAXVault = await ethers.getContractAt("AvaxVaultL1", DAIAVAXVaultAddr, deployer)

        // Proxy admin
        const proxyAdmin = await ethers.getContractAt("DAOProxyAdmin", "0xd02C2Ff6ef80f1d096Bc060454054B607d26763E", deployer)

        // Deploy Stable-AVAX strategy
        const stableAvaxStrategyFac = await ethers.getContractFactory("StableAvaxStrategy", deployer)
        const stableAvaxStrategyImpl = await stableAvaxStrategyFac.deploy()
        const stableAvaxStrategyArtifact = await artifacts.readArtifact("StableAvaxStrategy")
        const stableAvaxStrategyInterface = new ethers.utils.Interface(stableAvaxStrategyArtifact.abi)
        const dataDeXStableStrategy = stableAvaxStrategyInterface.encodeFunctionData(
            "initialize",
            [USDTAVAXVaultAddr, USDCAVAXVaultAddr, DAIAVAXVaultAddr]
        )
        const DeXStableStrategyProxy = await ethers.getContractFactory("AvaxProxy", deployer)
        const stableAvaxStrategyProxy = await DeXStableStrategyProxy.deploy(
            stableAvaxStrategyImpl.address, proxyAdmin.address, dataDeXStableStrategy,
        )
        const stableAvaxStrategy = await ethers.getContractAt("StableAvaxStrategy", stableAvaxStrategyProxy.address, deployer)
        // const stableAvaxStrategyProxyAddr = "0xDE5d4923e7Db1242a26693aA04Fa0C0FCf7D11f4"
        // const stableAvaxStrategy = await ethers.getContractAt("DeXStableStrategy", stableAvaxStrategyProxyAddr, deployer)

        // Deploy AvaxStableVault
        const AvaxStableVaultFac = await ethers.getContractFactory("AvaxStableVault", deployer)
        const avaxStableVaultImpl = await AvaxStableVaultFac.deploy()
        const avaxStableVaultArtifact = await artifacts.readArtifact("AvaxStableVault")
        const avaxStableVaultInterface = new ethers.utils.Interface(avaxStableVaultArtifact.abi)
        const dataAvaxStableVault = avaxStableVaultInterface.encodeFunctionData(
            "initialize",
            [
                "Cesta Avalanche Stable-AVAX", "cestaASA",
                treasury.address, community.address, admin.address, stableAvaxStrategy.address
            ]
        )
        const AvaxStableVaultProxy = await ethers.getContractFactory("AvaxProxy", deployer)
        const avaxStableVaultProxy = await AvaxStableVaultProxy.deploy(
            avaxStableVaultImpl.address, proxyAdmin.address, dataAvaxStableVault,
        )
        const avaxStableVault = await ethers.getContractAt("AvaxStableVault", avaxStableVaultProxy.address, deployer)
        // const avaxStableVaultProxyAddr = "0xa4DCbe792f51E13Fc0E6961BBEc436a881e73194"
        // const avaxStableVault = await ethers.getContractAt("AvaxStableVault", avaxStableVaultProxyAddr, deployer)

        // Upgrade AvaxVaultL1
        const avaxStableVaultL1Fac = await ethers.getContractFactory("AvaxVaultL1", deployer)
        const avaxStableVaultL1Impl = await avaxStableVaultL1Fac.deploy()
        const avaxStableVaultL1Factory = await ethers.getContractAt("AvaxVaultL1Factory", "0x04DDc3281f71DC70879E312BbF759d54f514f07f", deployer)
        await avaxStableVaultL1Factory.connect(admin).updateLogic(avaxStableVaultL1Impl.address)

        await stableAvaxStrategy.connect(admin).setVault(avaxStableVault.address)

        // Set whitelist
        await USDTAVAXVault.connect(admin).setWhitelistAddress(stableAvaxStrategy.address, true)
        await USDCAVAXVault.connect(admin).setWhitelistAddress(stableAvaxStrategy.address, true)
        await DAIAVAXVault.connect(admin).setWhitelistAddress(stableAvaxStrategy.address, true)

        // Set lower yield fee
        await USDTAVAXVault.connect(admin).setFee(1000, 1000)
        await USDCAVAXVault.connect(admin).setFee(1000, 1000)
        await DAIAVAXVault.connect(admin).setFee(1000, 1000)

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
        // // Vault
        // const tokenDeposit = USDTAddr
        // // const tokenDeposit = USDCAddr
        // // const tokenDeposit = DAIAddr
        // const amountDeposit = ethers.utils.parseUnits("10000", 6)
        // // const joeRouter = new ethers.Contract(joeRouterAddr, router_ABI, deployer)
        // const pngRouter = new ethers.Contract(pngRouterAddr, router_ABI, deployer)
        // const lydRouter = new ethers.Contract(lydRouterAddr, router_ABI, deployer)
        // const WAVAXAmt = (await joeRouter.getAmountsOut(amountDeposit, [tokenDeposit, WAVAXAddr]))[1]
        // const WAVAXAmtMin = WAVAXAmt.mul(995).div(1000)
        // // Strategy
        // const [pool0, pool1, pool2] = await stableAvaxStrategy.getEachPool()
        // const pool = pool0.add(pool1).add(pool2).add(WAVAXAmt)
        // const USDTAVAXTargetPool = pool.mul(4500).div(10000)
        // const USDCAVAXTargetPool = USDTAVAXTargetPool
        // const DAIAVAXTargetPool = pool.mul(1000).div(10000)
        // // Rebalancing
        // let JOEAmtMin, PNGAmtMin, LYDAmtMin
        // JOEAmtMin = PNGAmtMin = LYDAmtMin = 0
        // if (USDTAVAXTargetPool.gt(pool0) && USDCAVAXTargetPool.gt(pool1) && DAIAVAXTargetPool.gt(pool2)) {
        //     const amountInvestUSDTAVAX = USDTAVAXTargetPool.sub(pool0)
        //     const JOEAmt = (await joeRouter.getAmountsOut(amountInvestUSDTAVAX.div(2), [WAVAXAddr, JOEAddr]))[1]
        //     const JOEAmtMin = JOEAmt.mul(995).div(1000)
        //     const amountInvestUSDCAVAX = USDCAVAXTargetPool.sub(pool1)
        //     const PNGAmt = (await pngRouter.getAmountsOut(amountInvestUSDCAVAX.div(2), [WAVAXAddr, PNGAddr]))[1]
        //     const PNGAmtMin = PNGAmt.mul(995).div(1000)
        //     const amountInvestDAIAVAX = DAIAVAXTargetPool.sub(pool2)
        //     const LYDAmt = (await lydRouter.getAmountsOut(amountInvestDAIAVAX.div(2), [WAVAXAddr, LYDAddr]))[1]
        //     const LYDAmtMin = LYDAmt.mul(995).div(1000)
        // } else {
        //     let furthest, farmIndex, diff
        //     if (USDTAVAXTargetPool.gt(pool0)) {
        //         diff = USDTAVAXTargetPool.sub(pool0)
        //         furthest = diff
        //         farmIndex = 0
        //     }
        //     if (USDCAVAXTargetPool.gt(pool1)) {
        //         diff = USDCAVAXTargetPool.sub(pool1)
        //         if (diff.gt(furthest)) {
        //             furthest = diff
        //             farmIndex = 1
        //         }
        //     }
        //     if (DAIAVAXTargetPool.gt(pool2)) {
        //         diff = DAIAVAXTargetPool.sub(pool2)
        //         if (diff.gt(furthest)) {
        //             furthest = diff
        //             farmIndex = 2
        //         }
        //     }
        //     if (farmIndex == 0) {
        //         const JOEAmt = (await joeRouter.getAmountsOut(WAVAXAmt.div(2), [WAVAXAddr, JOEAddr]))[1]
        //         const JOEAmtMin = JOEAmt.mul(995).div(1000)
        //     } else if (farmIndex == 1) {
        //         const PNGAmt = (await pngRouter.getAmountsOut(WAVAXAmt.div(2), [WAVAXAddr, PNGAddr]))[1]
        //         const PNGAmtMin = PNGAmt.mul(995).div(1000)
        //     } else {
        //         const LYDAmt = (await lydRouter.getAmountsOut(WAVAXAmt.div(2), [WAVAXAddr, LYDAddr]))[1]
        //         const LYDAmtMin = LYDAmt.mul(995).div(1000)
        //     }
        // }
        // amountsOutMin = [WAVAXAmtMin, JOEAmtMin, PNGAmtMin, LYDAmtMin]

        amountsOutMin = [0, 0, 0, 0]
        await USDTContract.connect(client).approve(avaxStableVault.address, ethers.constants.MaxUint256)
        await USDCContract.connect(client).approve(avaxStableVault.address, ethers.constants.MaxUint256)
        await DAIContract.connect(client).approve(avaxStableVault.address, ethers.constants.MaxUint256)
        tx = await avaxStableVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), USDTAddr, amountsOutMin)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString()) // 2255219
        tx = await avaxStableVault.connect(client).deposit(ethers.utils.parseUnits("10000", 6), USDCAddr, amountsOutMin)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString()) // 2292253
        tx = await avaxStableVault.connect(client).deposit(ethers.utils.parseUnits("10000", 18), DAIAddr, amountsOutMin)
        // receipt = await tx.wait()
        // console.log(receipt.gasUsed.toString()) // 2223159
        // console.log(ethers.utils.formatEther(await avaxStableVault.balanceOf(client.address))) // 29867.872478311857532946

        // Second Deposit
        await USDTContract.connect(client2).approve(avaxStableVault.address, ethers.constants.MaxUint256)
        await USDCContract.connect(client3).approve(avaxStableVault.address, ethers.constants.MaxUint256)
        await avaxStableVault.connect(client2).deposit(ethers.utils.parseUnits("10000", 6), USDTAddr, amountsOutMin)
        await avaxStableVault.connect(client3).deposit(ethers.utils.parseUnits("10000", 6), USDCAddr, amountsOutMin)
        // console.log(ethers.utils.formatEther(await avaxStableVault.balanceOf(client2.address))) // 9946.761519139008157646
        // console.log(ethers.utils.formatEther(await avaxStableVault.balanceOf(client3.address))) // 9931.8734622781199488
        // console.log(ethers.utils.formatEther(await avaxStableVault.getAllPoolInUSD())) // 49746.507459728985639392
        // console.log(ethers.utils.formatEther(await avaxStableVault.getPricePerFullShare())) // 1.0

        // Check farm vault pool
        // console.log(ethers.utils.formatEther(await USDTAVAXVault.getAllPoolInUSD())) // 2458.882548146253609131
        // console.log(ethers.utils.formatEther(await USDTAVAXVault.getPricePerFullShare(true))) // 21948689.945624572584412181
        // console.log(ethers.utils.formatEther(await USDTAVAXVault.getPricePerFullShare(false))) // 1.0
        // console.log(ethers.utils.formatEther(await USDCAVAXVault.getAllPoolInUSD())) // 22381.633631343432581399
        // console.log(ethers.utils.formatEther(await USDCAVAXVault.getPricePerFullShare(true))) // 24233782.362891460775833788
        // console.log(ethers.utils.formatEther(await USDCAVAXVault.getPricePerFullShare(false))) // 1.0
        // console.log(ethers.utils.formatEther(await DAIAVAXVault.getAllPoolInUSD())) // 24917.367495789368311593
        // console.log(ethers.utils.formatEther(await DAIAVAXVault.getPricePerFullShare(true))) // 22.405419276524749648
        // console.log(ethers.utils.formatEther(await DAIAVAXVault.getPricePerFullShare(false))) // 1.0

        // Yield in farms
        await network.provider.request({method: "evm_increaseTime", params: [86400]})
        await network.provider.send("evm_mine")
        // console.log(ethers.utils.formatEther((await USDTAVAXVault.getPendingRewards())[0])) // 58.557814257413020984
        // console.log(ethers.utils.formatEther((await USDTAVAXVault.getPendingRewards())[1])) // 0.0
        // console.log(ethers.utils.formatEther((await USDCAVAXVault.getPendingRewards())[0])) // 10.595472801452346757
        // console.log(ethers.utils.formatEther((await DAIAVAXVault.getPendingRewards())[0])) // 5.760334627952680863
        await USDTAVAXVault.connect(admin).yield()
        await USDCAVAXVault.connect(admin).yield()
        await DAIAVAXVault.connect(admin).yield()
        // console.log(ethers.utils.formatEther(await USDTAVAXVault.getPricePerFullShare(false))) // 1.001487335859045282
        // console.log(ethers.utils.formatEther(await USDCAVAXVault.getPricePerFullShare(false))) // 1.000971702287307833
        // console.log(ethers.utils.formatEther(await DAIAVAXVault.getPricePerFullShare(false))) // 1.000673006458581316
        // console.log(ethers.utils.formatEther(await avaxStableVault.getPricePerFullShare())) // 1.000849017348870382

        // Check farm vault pool
        // console.log(ethers.utils.formatEther(await USDTAVAXVault.getAllPoolInUSD())) // 500 2462.588188769446473244
        // console.log(ethers.utils.formatEther(await USDCAVAXVault.getAllPoolInUSD())) // 4500 22403.394021788231783755
        // console.log(ethers.utils.formatEther(await DAIAVAXVault.getAllPoolInUSD())) // 5000 24934.145802219648855229

        // Test emergency withdraw
        // await avaxStableVault.connect(admin).emergencyWithdraw()
        // console.log(ethers.utils.formatEther(await USDTAVAXVault.getAllPoolInUSD())) // 
        // console.log(ethers.utils.formatEther(await USDCAVAXVault.getAllPoolInUSD())) // 
        // console.log(ethers.utils.formatEther(await DAIAVAXVault.getAllPoolInUSD())) // 

        // Withdraw
        console.log("-----withdraw-----")

        // // Vault
        // const shareWithdraw = (await avaxStableVault.balanceOf(client.address)).div(3)
        // // const shareWithdraw = await avaxStableVault.balanceOf(client2.address)
        // // const shareWithdraw = await avaxStableVault.balanceOf(client3.address)
        // const tokenWithdraw = USDTAddr
        // const allPoolInUSD = await avaxStableVault.getAllPoolInUSD()
        // let withdrawAmt = (allPoolInUSD).mul(shareWithdraw).div(await avaxStableVault.totalSupply())
        // // Strategy
        // // const joeRouter = new ethers.Contract(joeRouterAddr, router_ABI, deployer)
        // const pngRouter = new ethers.Contract(pngRouterAddr, router_ABI, deployer)
        // const lydRouter = new ethers.Contract(lydRouterAddr, router_ABI, deployer)
        // const oneEther = ethers.utils.parseEther("1")
        // const sharePerc = withdrawAmt.mul(oneEther).div(allPoolInUSD)

        // let totalWAVAXAmt = ethers.constants.Zero

        // const USDTAVAXAmt = (await USDTAVAXVault.balanceOf(stableAvaxStrategy.address)).mul(sharePerc).div(oneEther)
        // const USDTAVAXContract = new ethers.Contract(USDTAVAXAddr, pair_ABI, deployer)
        // const [JOEReserve, WAVAXReserveJOE] = await USDTAVAXContract.getReserves()
        // const totalSupplyUSDTAVAX = await USDTAVAXContract.totalSupply()
        // const JOEAmt = JOEReserve.mul(USDTAVAXAmt).div(totalSupplyUSDTAVAX)
        // const WAVAXAmtJOE = WAVAXReserveJOE.mul(USDTAVAXAmt).div(totalSupplyUSDTAVAX)
        // const _WAVAXAmtJOE = (await joeRouter.getAmountsOut(JOEAmt, [JOEAddr, WAVAXAddr]))[1]
        // const WAVAXAmtMinJOE = _WAVAXAmtJOE.mul(995).div(1000)
        // totalWAVAXAmt = totalWAVAXAmt.add(WAVAXAmtJOE.add(_WAVAXAmtJOE))

        // const USDCAVAXAmt = (await USDCAVAXVault.balanceOf(stableAvaxStrategy.address)).mul(sharePerc).div(oneEther)
        // const USDCAVAXContract = new ethers.Contract(USDCAVAXAddr, pair_ABI, deployer)
        // const [PNGReserve, WAVAXReservePNG] = await USDCAVAXContract.getReserves()
        // const totalSupplyUSDCAVAX = await USDCAVAXContract.totalSupply()
        // const PNGAmt = PNGReserve.mul(USDCAVAXAmt).div(totalSupplyUSDCAVAX)
        // const WAVAXAmtPNG = WAVAXReservePNG.mul(USDCAVAXAmt).div(totalSupplyUSDCAVAX)
        // const _WAVAXAmtPNG = (await pngRouter.getAmountsOut(PNGAmt, [PNGAddr, WAVAXAddr]))[1]
        // const WAVAXAmtMinPNG = _WAVAXAmtPNG.mul(995).div(1000)
        // totalWAVAXAmt = totalWAVAXAmt.add(WAVAXAmtPNG.add(_WAVAXAmtPNG))

        // const DAIAVAXAmt = (await DAIAVAXVault.balanceOf(stableAvaxStrategy.address)).mul(sharePerc).div(oneEther)
        // const DAIAVAXContract = new ethers.Contract(DAIAVAXAddr, pair_ABI, deployer)
        // const [LYDReserve, WAVAXReserveLYD] = await DAIAVAXContract.getReserves()
        // const totalSupplyDAIAVAX = await DAIAVAXContract.totalSupply()
        // const LYDAmt = LYDReserve.mul(DAIAVAXAmt).div(totalSupplyDAIAVAX)
        // const WAVAXAmtLYD = WAVAXReserveLYD.mul(DAIAVAXAmt).div(totalSupplyDAIAVAX)
        // const _WAVAXAmtLYD = (await lydRouter.getAmountsOut(LYDAmt, [LYDAddr, WAVAXAddr]))[1]
        // const WAVAXAmtMinLYD = _WAVAXAmtLYD.mul(995).div(1000)
        // totalWAVAXAmt = totalWAVAXAmt.add(WAVAXAmtLYD.add(_WAVAXAmtLYD))

        // // Vault
        // withdrawAmt = (await joeRouter.getAmountsOut(totalWAVAXAmt, [WAVAXAddr, tokenWithdraw]))[1]
        // const withdrawAmtMin = withdrawAmt.mul(995).div(1000)
        // amountsOutMin = [withdrawAmtMin, WAVAXAmtMinJOE, WAVAXAmtMinPNG, WAVAXAmtMinLYD]

        // amountsOutMin = await middleware.getAmountsOutMinDeXAvax((await avaxStableVault.balanceOf(client.address)).div(3), USDTAddr, deployer)
        await avaxStableVault.connect(client).withdraw((await avaxStableVault.balanceOf(client.address)).div(3), USDTAddr, amountsOutMin)
        // amountsOutMin = await middleware.getAmountsOutMinDeXAvax(await avaxStableVault.balanceOf(client2.address), USDTAddr, deployer)
        await avaxStableVault.connect(client2).withdraw(avaxStableVault.balanceOf(client2.address), USDTAddr, amountsOutMin)
        // amountsOutMin = await middleware.getAmountsOutMinDeXAvax(await avaxStableVault.balanceOf(client3.address), USDTAddr, deployer)
        await avaxStableVault.connect(client3).withdraw(avaxStableVault.balanceOf(client3.address), USDTAddr, amountsOutMin)
        console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(client.address), 6)) // 9864.694456
        console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(client2.address), 6)) // 9853.208453
        console.log(ethers.utils.formatUnits(await USDTContract.balanceOf(client3.address), 6)) // 9836.092514

        // amountsOutMin = await getAmountsOutMinDeXAvax(
        //     avaxStableVault.address, stableAvaxStrategy.address, (await avaxStableVault.balanceOf(client.address)).div(3), USDCAddr, deployer
        // )
        // await avaxStableVault.connect(client).withdraw((await avaxStableVault.balanceOf(client.address)).div(3), USDCAddr, amountsOutMin)
        // amountsOutMin = await getAmountsOutMinDeXAvax(avaxStableVault.address, stableAvaxStrategy.address, await avaxStableVault.balanceOf(client2.address), USDCAddr, deployer)
        // await avaxStableVault.connect(client2).withdraw(avaxStableVault.balanceOf(client2.address), USDCAddr, amountsOutMin)
        // amountsOutMin = await getAmountsOutMinDeXAvax(avaxStableVault.address, stableAvaxStrategy.address, await avaxStableVault.balanceOf(client3.address), USDCAddr, deployer)
        // await avaxStableVault.connect(client3).withdraw(avaxStableVault.balanceOf(client3.address), USDCAddr, amountsOutMin)
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(client.address), 6)) // 9844.080167
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(client2.address), 6)) // 9861.726068
        // console.log(ethers.utils.formatUnits(await USDCContract.balanceOf(client3.address), 6)) // 9856.199273

        // amountsOutMin = await getAmountsOutMinDeXAvax(
        //     avaxStableVault.address, stableAvaxStrategy.address, (await avaxStableVault.balanceOf(client.address)).div(3), DAIAddr, deployer
        // )
        // await avaxStableVault.connect(client).withdraw((await avaxStableVault.balanceOf(client.address)).div(3), DAIAddr, amountsOutMin)
        // amountsOutMin = await getAmountsOutMinDeXAvax(avaxStableVault.address, stableAvaxStrategy.address, await avaxStableVault.balanceOf(client2.address), DAIAddr, deployer)
        // await avaxStableVault.connect(client2).withdraw(avaxStableVault.balanceOf(client2.address), DAIAddr, amountsOutMin)
        // amountsOutMin = await getAmountsOutMinDeXAvax(avaxStableVault.address, stableAvaxStrategy.address, await avaxStableVault.balanceOf(client3.address), DAIAddr, deployer)
        // await avaxStableVault.connect(client3).withdraw(avaxStableVault.balanceOf(client3.address), DAIAddr, amountsOutMin)
        // console.log(ethers.utils.formatUnits(await DAIContract.balanceOf(client.address), 18)) // 9841.539386186864417744
        // console.log(ethers.utils.formatUnits(await DAIContract.balanceOf(client2.address), 18)) // 9854.417211070852915627
        // console.log(ethers.utils.formatUnits(await DAIContract.balanceOf(client3.address), 18)) // 9840.180822409327116238

        // console.log(ethers.utils.formatEther(await avaxStableVault.getAllPoolInUSD())) // 19943.142532395565327845
        // console.log(ethers.utils.formatEther(await avaxStableVault.getPricePerFullShare())) // 1.001568284460686097

        // console.log(ethers.utils.formatEther(await USDTAVAXVault.getAllPoolInUSD())) // 500 993.914228244685466929
        // console.log(ethers.utils.formatEther(await USDCAVAXVault.getAllPoolInUSD())) // 4500 8973.410115020637015085
        // console.log(ethers.utils.formatEther(await DAIAVAXVault.getAllPoolInUSD())) // 5000 9987.212268189323041768
    })
});