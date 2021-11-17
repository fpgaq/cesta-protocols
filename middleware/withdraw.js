const ethers = require("ethers")
const IERC20_ABI = require("./IERC20_ABI.json")
const router_ABI = require("./router_ABI.json")
const pair_ABI = require("./pair_ABI.json")
const avaxVaultL1ABI = require("./AvaxVaultL1.json").abi
const avaxVaultABI = require("./AvaxVault.json").abi
const avaxStableVaultABI = require("./AvaxStableVault.json").abi
const deXAvaxStrategyABI = require("./DeXAvaxStrategy.json").abi
const deXStableStrategyABI = require("./DeXStableStrategy.json").abi
const stableAvaxStrategyABI = require("./StableAvaxStrategy.json").abi
const stableStableStrategyABI = require("./StableStableStrategy.json").abi

const USDTAddr = "0xc7198437980c041c805A1EDcbA50c1Ce5db95118"
const USDCAddr = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664"
const DAIAddr = "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70"
const WAVAXAddr = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"

const joeRouterAddr = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4"
const pngRouterAddr = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106"
const lydRouterAddr = "0xA52aBE4676dbfd04Df42eF7755F01A3c41f28D27"

const JOEAddr = "0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd"
const PNGAddr = "0x60781C2586D68229fde47564546784ab3fACA982"
const LYDAddr = "0x4C9B4E1AC6F24CdE3660D5E4Ef1eBF77C710C084"

const JOEAVAXAddr = "0x454E67025631C065d3cFAD6d71E6892f74487a15"
const PNGAVAXAddr = "0xd7538cABBf8605BdE1f4901B47B8D42c61DE0367"
const LYDAVAXAddr = "0xFba4EdaAd3248B03f1a3261ad06Ad846A8e50765"

const JOEAVAXVaultAddr = "0xFe67a4BAe72963BE1181B211180d8e617B5a8dee"
const PNGAVAXVaultAddr = "0x7eEcFB07b7677aa0e1798a4426b338dA23f9De34"
const LYDAVAXVaultAddr = "0xffEaB42879038920A31911f3E93295bF703082ed"

const JOEUSDCAddr = "0x67926d973cD8eE876aD210fAaf7DFfA99E414aCf"
const PNGUSDTAddr = "0x1fFB6ffC629f5D820DCf578409c2d26A2998a140"
const LYDDAIAddr = "0x4EE072c5946B4cdc00CBdeB4A4E54A03CF6d08d3"

const JOEUSDCVaultAddr = "0xC4029ad66AAe4DCF3F8A8C67F4000EAFE49E6d10"
const PNGUSDTVaultAddr = "0x3d78fDb997995f0bF7C5d881a758C45F1B706b80"
const LYDDAIVaultAddr = "0x469b5620675a9988c24cDd57B1E7136E162D6a53"

const USDTAVAXAddr = "0x67926d973cD8eE876aD210fAaf7DFfA99E414aCf"
const USDCAVAXAddr = "0x1fFB6ffC629f5D820DCf578409c2d26A2998a140"
const DAIAVAXAddr = "0x4EE072c5946B4cdc00CBdeB4A4E54A03CF6d08d3"

const USDTAVAXVaultAddr = "0xC4029ad66AAe4DCF3F8A8C67F4000EAFE49E6d10"
const USDCAVAXVaultAddr = "0x3d78fDb997995f0bF7C5d881a758C45F1B706b80"
const DAIAVAXVaultAddr = "0x469b5620675a9988c24cDd57B1E7136E162D6a53"

const deXAvaxVaultAddr = "0xa4DCbe792f51E13Fc0E6961BBEc436a881e73194"
const deXAvaxStrategyAddr = "0xDE5d4923e7Db1242a26693aA04Fa0C0FCf7D11f4"
const deXStableVaultAddr = ""
const deXStableStrategyAddr = ""
const stableAvaxVaultAddr = ""
const stableAvaxStrategyAddr = ""

const getAmountsOutMinDeXAvax = async (shareToWithdraw, stablecoinAddr, provider) => {
    // provider = new ethers.providers.Web3Provider(provider) // uncomment this to change Web3 provider to Ethers provider
    if (!ethers.BigNumber.isBigNumber(shareToWithdraw)) shareToWithdraw = new ethers.BigNumber.from(shareToWithdraw)

    const dexAvaxVault = new ethers.Contract(deXAvaxVaultAddr, avaxVaultABI, provider)
    const dexAvaxStrategy = new ethers.Contract(deXAvaxStrategyAddr, deXAvaxStrategyABI, provider)

    const amtWithdrawInUSD = (
        (await dexAvaxVault.getAllPoolInUSD())
            .sub(await dexAvaxVault.totalPendingDepositAmt()))
            .mul(shareToWithdraw)
            .div(await dexAvaxVault.totalSupply()
    )

    const USDTContract = new ethers.Contract(USDTAddr, IERC20_ABI, provider)
    const USDCContract = new ethers.Contract(USDCAddr, IERC20_ABI, provider)
    const DAIContract = new ethers.Contract(DAIAddr, IERC20_ABI, provider)
    const USDTAmtInVault = (await USDTContract.balanceOf(dexAvaxVault.address)).mul(ethers.utils.parseUnits("1", 12))
    const USDCAmtInVault = (await USDCContract.balanceOf(dexAvaxVault.address)).mul(ethers.utils.parseUnits("1", 12))
    const DAIAmtInVault = await DAIContract.balanceOf(dexAvaxVault.address)
    const totalAmtInVault = USDTAmtInVault.add(USDCAmtInVault).add(DAIAmtInVault).sub(await dexAvaxVault.fees())

    let amountsOutMin
    if (amtWithdrawInUSD.gt(totalAmtInVault)) {
        const oneEther = ethers.utils.parseEther("1")

        let stablecoinAmtInVault
        if (stablecoinAddr == USDTAddr) stablecoinAmtInVault = USDTAmtInVault
        else if (stablecoinAddr == USDCAddr) stablecoinAmtInVault = USDCAmtInVault
        else stablecoinAmtInVault = DAIAmtInVault
        const amtToWithdrawFromStrategy = amtWithdrawInUSD.sub(stablecoinAmtInVault)
        const strategyAllPoolInUSD = await dexAvaxStrategy.getAllPoolInUSD()
        const sharePerc = amtToWithdrawFromStrategy.mul(oneEther).div(strategyAllPoolInUSD)

        const WAVAXContract = new ethers.Contract(WAVAXAddr, IERC20_ABI, provider)
        const WAVAXAmtBefore = await WAVAXContract.balanceOf(deXAvaxStrategyAddr)
        let totalWithdrawWAVAX = WAVAXAmtBefore
        let WAVAXAmt, _WAVAXAmt

        const JOEAVAXVault = new ethers.Contract(JOEAVAXVaultAddr, avaxVaultL1ABI, provider)
        const JOEAVAXVaultAmt = (await JOEAVAXVault.balanceOf(deXAvaxStrategyAddr)).mul(sharePerc).div(oneEther)
        const JOEAVAXAmt = (await JOEAVAXVault.getAllPool()).mul(JOEAVAXVaultAmt).div(await JOEAVAXVault.totalSupply())
        const JOEAVAX = new ethers.Contract(JOEAVAXAddr, pair_ABI, provider)
        const [JOEReserve, WAVAXReserveJOE] = await JOEAVAX.getReserves()
        const JOEAmt = JOEReserve.mul(JOEAVAXAmt).div(await JOEAVAX.totalSupply())
        WAVAXAmt = WAVAXReserveJOE.mul(JOEAVAXAmt).div(await JOEAVAX.totalSupply())
        totalWithdrawWAVAX = totalWithdrawWAVAX.add(WAVAXAmt)
        const joeRouter = new ethers.Contract(joeRouterAddr, router_ABI, provider)
        _WAVAXAmt = (await joeRouter.getAmountsOut(JOEAmt, [JOEAddr, WAVAXAddr]))[1]
        const _WAVAXAmtMinJoe = _WAVAXAmt.mul(995).div(1000)
        totalWithdrawWAVAX = totalWithdrawWAVAX.add(_WAVAXAmt)

        const PNGAVAXVault = new ethers.Contract(PNGAVAXVaultAddr, avaxVaultL1ABI, provider)
        const PNGAVAXVaultAmt = (await PNGAVAXVault.balanceOf(deXAvaxStrategyAddr)).mul(sharePerc).div(oneEther)
        const PNGAVAXAmt = (await PNGAVAXVault.getAllPool()).mul(PNGAVAXVaultAmt).div(await PNGAVAXVault.totalSupply())
        const PNGAVAX = new ethers.Contract(PNGAVAXAddr, pair_ABI, provider)
        const [PNGReserve, WAVAXReservePNG] = await PNGAVAX.getReserves()
        const PNGAmt = PNGReserve.mul(PNGAVAXAmt).div(await PNGAVAX.totalSupply())
        WAVAXAmt = WAVAXReservePNG.mul(PNGAVAXAmt).div(await PNGAVAX.totalSupply())
        totalWithdrawWAVAX = totalWithdrawWAVAX.add(WAVAXAmt)
        const pngRouter = new ethers.Contract(pngRouterAddr, router_ABI, provider)
        _WAVAXAmt = (await pngRouter.getAmountsOut(PNGAmt, [PNGAddr, WAVAXAddr]))[1]
        const _WAVAXAmtMinPng = _WAVAXAmt.mul(995).div(1000)
        totalWithdrawWAVAX = totalWithdrawWAVAX.add(_WAVAXAmt)

        const LYDAVAXVault = new ethers.Contract(LYDAVAXVaultAddr, avaxVaultL1ABI, provider)
        const LYDAVAXVaultAmt = (await LYDAVAXVault.balanceOf(deXAvaxStrategyAddr)).mul(sharePerc).div(oneEther)
        const LYDAVAXAmt = (await LYDAVAXVault.getAllPool()).mul(LYDAVAXVaultAmt).div(await LYDAVAXVault.totalSupply())
        const LYDAVAX = new ethers.Contract(LYDAVAXAddr, pair_ABI, provider)
        const [LYDReserve, WAVAXReserveLYD] = await LYDAVAX.getReserves()
        const LYDAmt = LYDReserve.mul(LYDAVAXAmt).div(await LYDAVAX.totalSupply())
        WAVAXAmt = WAVAXReserveLYD.mul(LYDAVAXAmt).div(await LYDAVAX.totalSupply())
        totalWithdrawWAVAX = totalWithdrawWAVAX.add(WAVAXAmt)
        const lydRouter = new ethers.Contract(lydRouterAddr, router_ABI, provider)
        _WAVAXAmt = (await lydRouter.getAmountsOut(LYDAmt, [LYDAddr, WAVAXAddr]))[1]
        const _WAVAXAmtMinLyd = _WAVAXAmt.mul(995).div(1000)
        totalWithdrawWAVAX = totalWithdrawWAVAX.add(_WAVAXAmt)

        totalWithdrawWAVAX = totalWithdrawWAVAX.sub(WAVAXAmtBefore)

        const withdrawAmtInStablecoin = (await joeRouter.getAmountsOut(totalWithdrawWAVAX, [WAVAXAddr, stablecoinAddr]))[1]
        const withdrawAmtInStablecoinMin = withdrawAmtInStablecoin.mul(995).div(1000)

        // console.log(_WAVAXAmtMinJoe.toString())
        // console.log(_WAVAXAmtMinPng.toString())
        // console.log(_WAVAXAmtMinLyd.toString())
        // console.log(withdrawAmtInStablecoinMin.toString())
        
        amountsOutMin = [
            withdrawAmtInStablecoinMin,
            _WAVAXAmtMinJoe,
            _WAVAXAmtMinPng,
            _WAVAXAmtMinLyd
        ]
    } else {
        amountsOutMin = []
    }

    return amountsOutMin
}

const getAmountsOutMinDeXStable = async (shareToWithdraw, stablecoinAddr, provider) => {
    // provider = new ethers.providers.Web3Provider(provider) // uncomment this to change Web3 provider to Ethers provider
    if (!ethers.BigNumber.isBigNumber(shareToWithdraw)) shareToWithdraw = new ethers.BigNumber.from(shareToWithdraw)

    const deXStableVault = new ethers.Contract(deXStableVaultAddr, avaxVaultABI, provider)
    const dexStableStrategy = new ethers.Contract(deXStableStrategyAddr, deXStableStrategyABI, provider)

    const amtWithdrawInUSD = (
        (await deXStableVault.getAllPoolInUSD())
            .sub(await deXStableVault.totalPendingDepositAmt()))
            .mul(shareToWithdraw)
            .div(await deXStableVault.totalSupply()
    )

    const USDTContract = new ethers.Contract(USDTAddr, IERC20_ABI, provider)
    const USDCContract = new ethers.Contract(USDCAddr, IERC20_ABI, provider)
    const DAIContract = new ethers.Contract(DAIAddr, IERC20_ABI, provider)
    const USDTAmtInVault = (await USDTContract.balanceOf(deXStableVault.address)).mul(ethers.utils.parseUnits("1", 12))
    const USDCAmtInVault = (await USDCContract.balanceOf(deXStableVault.address)).mul(ethers.utils.parseUnits("1", 12))
    const DAIAmtInVault = await DAIContract.balanceOf(deXStableVault.address)
    const totalAmtInVault = USDTAmtInVault.add(USDCAmtInVault).add(DAIAmtInVault).sub(await deXStableVault.fees())

    let amountsOutMin
    if (amtWithdrawInUSD.gt(totalAmtInVault)) {
        const oneEther = ethers.utils.parseEther("1")

        let stablecoinAmtInVault
        if (stablecoinAddr == USDTAddr) stablecoinAmtInVault = USDTAmtInVault
        else if (stablecoinAddr == USDCAddr) stablecoinAmtInVault = USDCAmtInVault
        else stablecoinAmtInVault = DAIAmtInVault
        const amtToWithdrawFromStrategy = amtWithdrawInUSD.sub(stablecoinAmtInVault)
        const strategyAllPoolInUSD = await dexStableStrategy.getAllPoolInUSD()
        const sharePerc = amtToWithdrawFromStrategy.mul(oneEther).div(strategyAllPoolInUSD)

        const JOEUSDCVault = new ethers.Contract(JOEUSDCVaultAddr, avaxVaultL1ABI, provider)
        const JOEUSDCVaultAmt = (await JOEUSDCVault.balanceOf(deXStableStrategyAddr)).mul(sharePerc).div(oneEther)
        const JOEUSDCAmt = (await JOEUSDCVault.getAllPool()).mul(JOEUSDCVaultAmt).div(await JOEUSDCVault.totalSupply())
        const JOEUSDC = new ethers.Contract(JOEUSDCAddr, pair_ABI, provider)
        const [JOEReserve, USDCReserve] = await JOEUSDC.getReserves()
        const JOEAmt = JOEReserve.mul(JOEUSDCAmt).div(await JOEUSDC.totalSupply())
        const USDCAmt = USDCReserve.mul(JOEUSDCAmt).div(await JOEUSDC.totalSupply())
        const joeRouter = new ethers.Contract(joeRouterAddr, router_ABI, provider)
        const _USDCAmt = (await joeRouter.getAmountsOut(JOEAmt, [JOEAddr, USDCAddr]))[1]
        const _USDCAmtMin = _USDCAmt.mul(995).div(1000)

        const PNGUSDTVault = new ethers.Contract(PNGUSDTVaultAddr, avaxVaultL1ABI, provider)
        const PNGUSDTVaultAmt = (await PNGUSDTVault.balanceOf(deXStableStrategyAddr)).mul(sharePerc).div(oneEther)
        const PNGUSDTAmt = (await PNGUSDTVault.getAllPool()).mul(PNGUSDTVaultAmt).div(await PNGUSDTVault.totalSupply())
        const PNGUSDT = new ethers.Contract(PNGUSDTAddr, pair_ABI, provider)
        const [PNGReserve, USDTReserve] = await PNGUSDT.getReserves()
        const PNGAmt = PNGReserve.mul(PNGUSDTAmt).div(await PNGUSDT.totalSupply())
        const USDTAmt = USDTReserve.mul(PNGUSDTAmt).div(await PNGUSDT.totalSupply())
        const pngRouter = new ethers.Contract(pngRouterAddr, router_ABI, provider)
        const _USDTAmt = (await pngRouter.getAmountsOut(PNGAmt, [PNGAddr, USDTAddr]))[1]
        const _USDTAmtMin = _USDTAmt.mul(995).div(1000)

        const LYDDAIVault = new ethers.Contract(LYDDAIVaultAddr, avaxVaultL1ABI, provider)
        const LYDDAIVaultAmt = (await LYDDAIVault.balanceOf(deXStableStrategyAddr)).mul(sharePerc).div(oneEther)
        const LYDDAIAmt = (await LYDDAIVault.getAllPool()).mul(LYDDAIVaultAmt).div(await LYDDAIVault.totalSupply())
        const LYDDAI = new ethers.Contract(LYDDAIAddr, pair_ABI, provider)
        const [LYDReserve, DAIReserve] = await LYDDAI.getReserves()
        const LYDAmt = LYDReserve.mul(LYDDAIAmt).div(await LYDDAI.totalSupply())
        const DAIAmt = DAIReserve.mul(LYDDAIAmt).div(await LYDDAI.totalSupply())
        const lydRouter = new ethers.Contract(lydRouterAddr, router_ABI, provider)
        const _DAIAmt = (await lydRouter.getAmountsOut(LYDAmt, [LYDAddr, DAIAddr]))[1]
        const _DAIAmtMin = _DAIAmt.mul(995).div(1000)

        // console.log(_USDCAmtMin.toString())
        // console.log(_USDTAmtMin.toString())
        // console.log(_DAIAmtMin.toString())
        
        amountsOutMin = [
            0,
            _USDCAmtMin,
            _USDTAmtMin,
            _DAIAmtMin
        ]
    } else {
        amountsOutMin = []
    }

    return amountsOutMin
}

const getAmountsOutMinStableAvax = async (shareToWithdraw, stablecoinAddr, provider) => {
    // provider = new ethers.providers.Web3Provider(provider) // uncomment this to change Web3 provider to Ethers provider
    if (!ethers.BigNumber.isBigNumber(shareToWithdraw)) shareToWithdraw = new ethers.BigNumber.from(shareToWithdraw)

    const stableAvaxVault = new ethers.Contract(stableAvaxVaultAddr, avaxVaultABI, provider)
    const stableAvaxStrategy = new ethers.Contract(stableAvaxStrategyAddr, stableAvaxStrategyABI, provider)

    const amtWithdrawInUSD = (
        (await stableAvaxVault.getAllPoolInUSD())
            .sub(await stableAvaxVault.totalPendingDepositAmt()))
            .mul(shareToWithdraw)
            .div(await stableAvaxVault.totalSupply()
    )

    const USDTContract = new ethers.Contract(USDTAddr, IERC20_ABI, provider)
    const USDCContract = new ethers.Contract(USDCAddr, IERC20_ABI, provider)
    const DAIContract = new ethers.Contract(DAIAddr, IERC20_ABI, provider)
    const USDTAmtInVault = (await USDTContract.balanceOf(stableAvaxVault.address)).mul(ethers.utils.parseUnits("1", 12))
    const USDCAmtInVault = (await USDCContract.balanceOf(stableAvaxVault.address)).mul(ethers.utils.parseUnits("1", 12))
    const DAIAmtInVault = await DAIContract.balanceOf(stableAvaxVault.address)
    const totalAmtInVault = USDTAmtInVault.add(USDCAmtInVault).add(DAIAmtInVault).sub(await stableAvaxVault.fees())

    let amountsOutMin
    if (amtWithdrawInUSD.gt(totalAmtInVault)) {
        const oneEther = ethers.utils.parseEther("1")

        let stablecoinAmtInVault
        if (stablecoinAddr == USDTAddr) stablecoinAmtInVault = USDTAmtInVault
        else if (stablecoinAddr == USDCAddr) stablecoinAmtInVault = USDCAmtInVault
        else stablecoinAmtInVault = DAIAmtInVault
        const amtToWithdrawFromStrategy = amtWithdrawInUSD.sub(stablecoinAmtInVault)
        const strategyAllPoolInUSD = await stableAvaxStrategy.getAllPoolInUSD()
        const sharePerc = amtToWithdrawFromStrategy.mul(oneEther).div(strategyAllPoolInUSD)

        const USDTAVAXVault = new ethers.Contract(USDTAVAXVaultAddr, avaxVaultL1ABI, provider)
        const USDTAVAXVaultAmt = (await USDTAVAXVault.balanceOf(stableAvaxStrategyAddr)).mul(sharePerc).div(oneEther)
        const USDTAVAXAmt = (await USDTAVAXVault.getAllPool()).mul(USDTAVAXVaultAmt).div(await USDTAVAXVault.totalSupply())
        const USDTAVAX = new ethers.Contract(USDTAVAXAddr, pair_ABI, provider)
        const [WAVAXReserveLyd, USDTReserve] = await USDTAVAX.getReserves()
        const WAVAXAmtLyd = WAVAXReserveLyd.mul(USDTAVAXAmt).div(await USDTAVAX.totalSupply())
        const USDTAmt = USDTReserve.mul(USDTAVAXAmt).div(await USDTAVAX.totalSupply())
        const lydRouter = new ethers.Contract(lydRouterAddr, router_ABI, provider)
        const _USDTAmt = (await lydRouter.getAmountsOut(WAVAXAmtLyd, [WAVAXAddr, USDTAddr]))[1]
        const _USDTAmtMin = _USDTAmt.mul(995).div(1000)

        const USDCAVAXVault = new ethers.Contract(USDCAVAXVaultAddr, avaxVaultL1ABI, provider)
        const USDCAVAXVaultAmt = (await USDCAVAXVault.balanceOf(stableAvaxStrategyAddr)).mul(sharePerc).div(oneEther)
        const USDCAVAXAmt = (await USDCAVAXVault.getAllPool()).mul(USDCAVAXVaultAmt).div(await USDCAVAXVault.totalSupply())
        const USDCAVAX = new ethers.Contract(USDCAVAXAddr, pair_ABI, provider)
        const [USDCReserve, WAVAXReservePng] = await USDCAVAX.getReserves()
        const USDCAmt = USDCReserve.mul(USDCAVAXAmt).div(await USDCAVAX.totalSupply())
        const WAVAXAmtPng = WAVAXReservePng.mul(USDCAVAXAmt).div(await USDCAVAX.totalSupply())
        const pngRouter = new ethers.Contract(pngRouterAddr, router_ABI, provider)
        const _USDCAmt = (await pngRouter.getAmountsOut(WAVAXAmtPng, [WAVAXAddr, USDCAddr]))[1]
        const _USDCAmtMin = _USDCAmt.mul(995).div(1000)

        const DAIAVAXVault = new ethers.Contract(DAIAVAXVaultAddr, avaxVaultL1ABI, provider)
        const DAIAVAXVaultAmt = (await DAIAVAXVault.balanceOf(stableAvaxStrategyAddr)).mul(sharePerc).div(oneEther)
        const DAIAVAXAmt = (await DAIAVAXVault.getAllPool()).mul(DAIAVAXVaultAmt).div(await DAIAVAXVault.totalSupply())
        const DAIAVAX = new ethers.Contract(DAIAVAXAddr, pair_ABI, provider)
        const [WAVAXReserveJoe, DAIReserve] = await DAIAVAX.getReserves()
        const WAVAXAmtJoe = WAVAXReserveJoe.mul(DAIAVAXAmt).div(await DAIAVAX.totalSupply())
        const DAIAmt = DAIReserve.mul(DAIAVAXAmt).div(await DAIAVAX.totalSupply())
        const joeRouter = new ethers.Contract(joeRouterAddr, router_ABI, provider)
        const _DAIAmt = (await joeRouter.getAmountsOut(WAVAXAmtJoe, [WAVAXAddr, DAIAddr]))[1]
        const _DAIAmtMin = _DAIAmt.mul(995).div(1000)

        // console.log(_USDCAmtMin.toString())
        // console.log(_USDTAmtMin.toString())
        // console.log(_DAIAmtMin.toString())
        
        amountsOutMin = [
            0,
            _USDTAmtMin,
            _USDCAmtMin,
            _DAIAmtMin
        ]
    } else {
        amountsOutMin = []
    }

    return amountsOutMin
}

module.exports = {
    getAmountsOutMinDeXAvax,
    getAmountsOutMinDeXStable,
    getAmountsOutMinStableAvax
}