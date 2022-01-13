const ethers = require("ethers")
const router_ABI = require("./router_ABI.json")
const pair_ABI = require("./pair_ABI.json")
const avaxVaultL1ABI = require("./AvaxVaultL1.json").abi
const avaxVaultABI = require("./AvaxVault.json").abi
const avaxStableVaultABI = require("./AvaxStableVault.json").abi
const deXAvaxStrategyABI = require("./DeXAvaxStrategy.json").abi
const deXStableStrategyABI = require("./DeXStableStrategy.json").abi
const stableAvaxStrategyABI = require("./StableAvaxStrategy.json").abi

const USDTAddr = "0xc7198437980c041c805A1EDcbA50c1Ce5db95118"
const USDCAddr = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664"
const DAIAddr = "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70"
const MIMAddr = "0x130966628846BFd36ff31a822705796e8cb8C18D"
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

const JOEUSDTAddr = "0x1643de2efB8e35374D796297a9f95f64C082a8ce"
const PNGUSDCAddr = "0xC33Ac18900b2f63DFb60B554B1F53Cd5b474d4cd"
const LYDDAIAddr = "0x4EE072c5946B4cdc00CBdeB4A4E54A03CF6d08d3"

const JOEUSDTVaultAddr = "0xaC8Ce7535d8E3D911A9aFD9d9260f0eC8722B053"
const PNGUSDCVaultAddr = "0xD57AEEa053b94d4f2DE266b92FA794D73aDb0789"
const LYDDAIVaultAddr = "0x469b5620675a9988c24cDd57B1E7136E162D6a53"

const USDTAVAXAddr = "0x5Fc70cF6A4A858Cf4124013047e408367EBa1ace"
const USDCAVAXAddr = "0xbd918Ed441767fe7924e99F6a0E0B568ac1970D9"
const DAIAVAXAddr = "0x87Dee1cC9FFd464B79e058ba20387c1984aed86a"
const MIMAVAXAddr = "0x239aAE4AaBB5D60941D7DFFAeaFE8e063C63Ab25"

const USDTAVAXVaultAddr = "0x82AFf9e3f08e34D61737b035c5890d57803B3958"
const USDCAVAXVaultAddr = "0x5378B730711D1f57F888e4828b130E591c4Ea97b"
const DAIAVAXVaultAddr = "0x308555fb3083A300A03dEfFfa311D2eAF2CD56C8"
const MIMAVAXVaultAddr = "0x8fFa3a48eC7D7Ad9b8740733deCFB9876d8849b3"

const deXAvaxVaultAddr = "0xE4809Ed214631017737A3d7FA3e78600Ee96Eb85"
const deXAvaxStrategyAddr = "0x9B403B87d856ae9B640FeE80AD338b6aF78732b4"
const deXStableVaultAddr = "0xcfDafB1E6310c1844EcC30C60A01D6E0D37368C5"
const deXStableStrategyAddr = "0x374701638b3Aeaa9f8578ab2062B0b604CE1C6C8"
const stableAvaxVaultAddr = "0xfbE9613a6bd9d28ceF286b01357789b2b02E46f5"
const stableAvaxStrategyAddr = "0x3845d7c09374Df1ae6Ce4728c99DD20D3d75F414"

let amountOutMinPerc = 995

const getAmountsOutMinDeXAvax = async (shareToWithdraw, stablecoinAddr, _provider) => {
    const provider = new ethers.providers.Web3Provider(_provider) // Change Web3 provider to Ethers provider
    if (!ethers.BigNumber.isBigNumber(shareToWithdraw)) shareToWithdraw = new ethers.BigNumber.from(shareToWithdraw)

    const deXAvaxVault = new ethers.Contract(deXAvaxVaultAddr, avaxVaultABI, provider)
    const deXAvaxStrategy = new ethers.Contract(deXAvaxStrategyAddr, deXAvaxStrategyABI, provider)

    const JOEAVAXVault = new ethers.Contract(JOEAVAXVaultAddr, avaxVaultL1ABI, provider)
    const PNGAVAXVault = new ethers.Contract(PNGAVAXVaultAddr, avaxVaultL1ABI, provider)
    const LYDAVAXVault = new ethers.Contract(LYDAVAXVaultAddr, avaxVaultL1ABI, provider)

    const joeRouter = new ethers.Contract(joeRouterAddr, router_ABI, provider)
    const pngRouter = new ethers.Contract(pngRouterAddr, router_ABI, provider)
    const lydRouter = new ethers.Contract(lydRouterAddr, router_ABI, provider)

    // Vault
    const allPoolInUSD = await deXAvaxVault.getAllPoolInUSD()
    let withdrawAmt = (allPoolInUSD).mul(shareToWithdraw).div(await deXAvaxVault.totalSupply())

    // Strategy
    const oneEther = ethers.utils.parseEther("1")
    const sharePerc = withdrawAmt.mul(oneEther).div(allPoolInUSD)

    let totalWAVAXAmt = ethers.constants.Zero

    const JOEAVAXAmt = (await JOEAVAXVault.balanceOf(deXAvaxStrategy.address)).mul(sharePerc).div(oneEther)
    const JOEAVAXContract = new ethers.Contract(JOEAVAXAddr, pair_ABI, provider)
    const [JOEReserve, WAVAXReserveJOE] = await JOEAVAXContract.getReserves()
    const totalSupplyJOEAVAX = await JOEAVAXContract.totalSupply()
    const JOEAmt = JOEReserve.mul(JOEAVAXAmt).div(totalSupplyJOEAVAX)
    const WAVAXAmtJOE = WAVAXReserveJOE.mul(JOEAVAXAmt).div(totalSupplyJOEAVAX)
    const _WAVAXAmtJOE = (await joeRouter.getAmountsOut(JOEAmt, [JOEAddr, WAVAXAddr]))[1]
    const WAVAXAmtMinJOE = _WAVAXAmtJOE.mul(amountOutMinPerc).div(1000)
    totalWAVAXAmt = totalWAVAXAmt.add(WAVAXAmtJOE.add(_WAVAXAmtJOE))

    const PNGAVAXAmt = (await PNGAVAXVault.balanceOf(deXAvaxStrategy.address)).mul(sharePerc).div(oneEther)
    const PNGAVAXContract = new ethers.Contract(PNGAVAXAddr, pair_ABI, provider)
    const [PNGReserve, WAVAXReservePNG] = await PNGAVAXContract.getReserves()
    const totalSupplyPNGAVAX = await PNGAVAXContract.totalSupply()
    const PNGAmt = PNGReserve.mul(PNGAVAXAmt).div(totalSupplyPNGAVAX)
    const WAVAXAmtPNG = WAVAXReservePNG.mul(PNGAVAXAmt).div(totalSupplyPNGAVAX)
    const _WAVAXAmtPNG = (await pngRouter.getAmountsOut(PNGAmt, [PNGAddr, WAVAXAddr]))[1]
    const WAVAXAmtMinPNG = _WAVAXAmtPNG.mul(amountOutMinPerc).div(1000)
    totalWAVAXAmt = totalWAVAXAmt.add(WAVAXAmtPNG.add(_WAVAXAmtPNG))

    const LYDAVAXAmt = (await LYDAVAXVault.balanceOf(deXAvaxStrategy.address)).mul(sharePerc).div(oneEther)
    const LYDAVAXContract = new ethers.Contract(LYDAVAXAddr, pair_ABI, provider)
    const [LYDReserve, WAVAXReserveLYD] = await LYDAVAXContract.getReserves()
    const totalSupplyLYDAVAX = await LYDAVAXContract.totalSupply()
    const LYDAmt = LYDReserve.mul(LYDAVAXAmt).div(totalSupplyLYDAVAX)
    const WAVAXAmtLYD = WAVAXReserveLYD.mul(LYDAVAXAmt).div(totalSupplyLYDAVAX)
    const _WAVAXAmtLYD = (await lydRouter.getAmountsOut(LYDAmt, [LYDAddr, WAVAXAddr]))[1]
    const WAVAXAmtMinLYD = _WAVAXAmtLYD.mul(amountOutMinPerc).div(1000)
    totalWAVAXAmt = totalWAVAXAmt.add(WAVAXAmtLYD.add(_WAVAXAmtLYD))

    // Vault
    withdrawAmt = (await joeRouter.getAmountsOut(totalWAVAXAmt, [WAVAXAddr, stablecoinAddr]))[1]
    const withdrawAmtMin = withdrawAmt.mul(amountOutMinPerc).div(1000)
    return [withdrawAmtMin.toString(), WAVAXAmtMinJOE.toString(), WAVAXAmtMinPNG.toString(), WAVAXAmtMinLYD.toString()]
}

const getAmountsOutMinDeXStable = async (shareToWithdraw, stablecoinAddr, _provider) => {
    const provider = new ethers.providers.Web3Provider(_provider) // Change Web3 provider to Ethers provider
    if (!ethers.BigNumber.isBigNumber(shareToWithdraw)) shareToWithdraw = new ethers.BigNumber.from(shareToWithdraw)

    const deXStableVault = new ethers.Contract(deXStableVaultAddr, avaxStableVaultABI, provider)
    const deXStableStrategy = new ethers.Contract(deXStableStrategyAddr, deXStableStrategyABI, provider)

    const JOEUSDTVault = new ethers.Contract(JOEUSDTVaultAddr, avaxVaultL1ABI, provider)
    const PNGUSDCVault = new ethers.Contract(PNGUSDCVaultAddr, avaxVaultL1ABI, provider)
    const LYDDAIVault = new ethers.Contract(LYDDAIVaultAddr, avaxVaultL1ABI, provider)

    const joeRouter = new ethers.Contract(joeRouterAddr, router_ABI, provider)
    const pngRouter = new ethers.Contract(pngRouterAddr, router_ABI, provider)
    const lydRouter = new ethers.Contract(lydRouterAddr, router_ABI, provider)

    // Vault
    const allPoolInUSD = await deXStableVault.getAllPoolInUSD()
    let withdrawAmt = (allPoolInUSD).mul(shareToWithdraw).div(await deXStableVault.totalSupply())
    // Strategy
    const oneEther = ethers.utils.parseEther("1")
    const sharePerc = withdrawAmt.mul(oneEther).div(allPoolInUSD)
    // JOE
    const JOEUSDTAmt = (await JOEUSDTVault.balanceOf(deXStableStrategy.address)).mul(sharePerc).div(oneEther)
    const JOEUSDTContract = new ethers.Contract(JOEUSDTAddr, pair_ABI, provider)
    const [JOEReserve,] = await JOEUSDTContract.getReserves()
    const totalSupplyJOEUSDT = await JOEUSDTContract.totalSupply()
    const JOEAmt = JOEReserve.mul(JOEUSDTAmt).div(totalSupplyJOEUSDT)
    const USDCAmt = (await joeRouter.getAmountsOut(JOEAmt, [JOEAddr, USDCAddr]))[1]
    const USDCAmtMin = USDCAmt.mul(amountOutMinPerc).div(1000)
    // PNG
    const PNGUSDCAmt = (await PNGUSDCVault.balanceOf(deXStableStrategy.address)).mul(sharePerc).div(oneEther)
    const PNGUSDCContract = new ethers.Contract(PNGUSDCAddr, pair_ABI, provider)
    const [PNGReserve,] = await PNGUSDCContract.getReserves()
    const totalSupplyPNGUSDC = await PNGUSDCContract.totalSupply()
    const PNGAmt = PNGReserve.mul(PNGUSDCAmt).div(totalSupplyPNGUSDC)
    const USDTAmt = (await pngRouter.getAmountsOut(PNGAmt, [PNGAddr, USDTAddr]))[1]
    const USDTAmtMin = USDTAmt.mul(amountOutMinPerc).div(1000)
    // LYD
    const LYDDAIAmt = (await LYDDAIVault.balanceOf(deXStableStrategy.address)).mul(sharePerc).div(oneEther)
    const LYDDAIContract = new ethers.Contract(LYDDAIAddr, pair_ABI, provider)
    const [LYDReserve,] = await LYDDAIContract.getReserves()
    const totalSupplyLYDDAI = await LYDDAIContract.totalSupply()
    const LYDAmt = LYDReserve.mul(LYDDAIAmt).div(totalSupplyLYDDAI)
    const DAIAmt = (await lydRouter.getAmountsOut(LYDAmt, [LYDAddr, DAIAddr]))[1]
    const DAIAmtMin = DAIAmt.mul(amountOutMinPerc).div(1000)

    return ["0", USDCAmtMin.toString(), USDTAmtMin.toString(), DAIAmtMin.toString()]
}

const getAmountsOutMinStableAvax = async (shareToWithdraw, stablecoinAddr, _provider) => {
    const provider = new ethers.providers.Web3Provider(_provider) // Change Web3 provider to Ethers provider
    if (!ethers.BigNumber.isBigNumber(shareToWithdraw)) shareToWithdraw = new ethers.BigNumber.from(shareToWithdraw)

    const stableAvaxVault = new ethers.Contract(stableAvaxVaultAddr, avaxStableVaultABI, provider)
    const stableAvaxStrategy = new ethers.Contract(stableAvaxStrategyAddr, stableAvaxStrategyABI, provider)

    const USDTAVAXVault = new ethers.Contract(USDTAVAXVaultAddr, avaxVaultL1ABI, provider)
    const USDCAVAXVault = new ethers.Contract(USDCAVAXVaultAddr, avaxVaultL1ABI, provider)
    const MIMAVAXVault = new ethers.Contract(MIMAVAXVaultAddr, avaxVaultL1ABI, provider)

    const joeRouter = new ethers.Contract(joeRouterAddr, router_ABI, provider)
    const pngRouter = new ethers.Contract(pngRouterAddr, router_ABI, provider)
    const lydRouter = new ethers.Contract(lydRouterAddr, router_ABI, provider)

    // Vault
    const allPoolInUSD = await stableAvaxVault.getAllPoolInUSD()
    let withdrawAmt = (allPoolInUSD).mul(shareToWithdraw).div(await stableAvaxVault.totalSupply())
    // Strategy
    const oneEther = ethers.utils.parseEther("1")
    const sharePerc = withdrawAmt.mul(oneEther).div(allPoolInUSD)
    // LYD
    const USDTAVAXAmt = (await USDTAVAXVault.balanceOf(stableAvaxStrategy.address)).mul(sharePerc).div(oneEther)
    const USDTAVAXContract = new ethers.Contract(USDTAVAXAddr, pair_ABI, provider)
    const [WAVAXReserveLYD,] = await USDTAVAXContract.getReserves()
    const totalSupplyUSDTAVAX = await USDTAVAXContract.totalSupply()
    const WAVAXAmtLYD = WAVAXReserveLYD.mul(USDTAVAXAmt).div(totalSupplyUSDTAVAX)
    const USDTAmt = (await lydRouter.getAmountsOut(WAVAXAmtLYD, [WAVAXAddr, USDTAddr]))[1]
    const USDTAmtMin = USDTAmt.mul(amountOutMinPerc).div(1000)
    // PNG
    const USDCAVAXAmt = (await USDCAVAXVault.balanceOf(stableAvaxStrategy.address)).mul(sharePerc).div(oneEther)
    const USDCAVAXContract = new ethers.Contract(USDCAVAXAddr, pair_ABI, provider)
    const [, WAVAXReservePNG] = await USDCAVAXContract.getReserves()
    const totalSupplyUSDCAVAX = await USDCAVAXContract.totalSupply()
    const WAVAXAmtPNG = WAVAXReservePNG.mul(USDCAVAXAmt).div(totalSupplyUSDCAVAX)
    const USDCAmt = (await pngRouter.getAmountsOut(WAVAXAmtPNG, [WAVAXAddr, USDCAddr]))[1]
    const USDCAmtMin = USDCAmt.mul(amountOutMinPerc).div(1000)
    // PNG
    const MIMAVAXAmt = (await MIMAVAXVault.balanceOf(stableAvaxStrategy.address)).mul(sharePerc).div(oneEther)
    const MIMAVAXContract = new ethers.Contract(MIMAVAXAddr, pair_ABI, provider)
    const [WAVAXReserveJOE,] = await MIMAVAXContract.getReserves()
    const totalSupplyMIMAVAX = await MIMAVAXContract.totalSupply()
    const WAVAXAmtJOE = WAVAXReserveJOE.mul(MIMAVAXAmt).div(totalSupplyMIMAVAX)
    const MIMAmt = (await pngRouter.getAmountsOut(WAVAXAmtJOE, [WAVAXAddr, MIMAddr]))[1]
    const MIMAmtMin = MIMAmt.mul(amountOutMinPerc).div(1000)

    return ["0", USDTAmtMin.toString(), USDCAmtMin.toString(), MIMAmtMin.toString()]
}

module.exports = {
    getAmountsOutMinDeXAvax,
    getAmountsOutMinDeXStable,
    getAmountsOutMinStableAvax
}