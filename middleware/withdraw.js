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

const deXAvaxVaultAddr = "0xE4809Ed214631017737A3d7FA3e78600Ee96Eb85"
const deXAvaxStrategyAddr = "0x9B403B87d856ae9B640FeE80AD338b6aF78732b4"
const deXStableVaultAddr = ""
const deXStableStrategyAddr = ""
const stableAvaxVaultAddr = ""
const stableAvaxStrategyAddr = ""

let amountOutMinPerc = 995

const getAmountsOutMinDeXAvax = async (shareToWithdraw, stablecoinAddr, provider) => {
    provider = new ethers.providers.Web3Provider(provider) // Change Web3 provider to Ethers provider
    if (!ethers.BigNumber.isBigNumber(shareToWithdraw)) shareToWithdraw = new ethers.BigNumber.from(shareToWithdraw)

    // amountOutMinPerc = 990

    const deXAvaxVault = new ethers.Contract(deXAvaxVaultAddr, avaxVaultABI, provider)
    const deXAvaxStrategy = new ethers.Contract(deXAvaxStrategyAddr, deXAvaxStrategyABI, provider)

    const JOEAVAXVault = await ethers.getContractAt("AvaxVaultL1", JOEAVAXVaultAddr, deployer)
    const PNGAVAXVault = await ethers.getContractAt("AvaxVaultL1", PNGAVAXVaultAddr, deployer)
    const LYDAVAXVault = await ethers.getContractAt("AvaxVaultL1", LYDAVAXVaultAddr, deployer)

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
    const JOEAVAXContract = new ethers.Contract(JOEAVAXAddr, pair_ABI, deployer)
    const [JOEReserve, WAVAXReserveJOE] = await JOEAVAXContract.getReserves()
    const totalSupplyJOEAVAX = await JOEAVAXContract.totalSupply()
    const JOEAmt = JOEReserve.mul(JOEAVAXAmt).div(totalSupplyJOEAVAX)
    const WAVAXAmtJOE = WAVAXReserveJOE.mul(JOEAVAXAmt).div(totalSupplyJOEAVAX)
    const _WAVAXAmtJOE = (await joeRouter.getAmountsOut(JOEAmt, [JOEAddr, WAVAXAddr]))[1]
    const WAVAXAmtMinJOE = _WAVAXAmtJOE.mul(amountOutMinPerc).div(1000)
    totalWAVAXAmt = totalWAVAXAmt.add(WAVAXAmtJOE.add(_WAVAXAmtJOE))

    const PNGAVAXAmt = (await PNGAVAXVault.balanceOf(deXAvaxStrategy.address)).mul(sharePerc).div(oneEther)
    const PNGAVAXContract = new ethers.Contract(PNGAVAXAddr, pair_ABI, deployer)
    const [PNGReserve, WAVAXReservePNG] = await PNGAVAXContract.getReserves()
    const totalSupplyPNGAVAX = await PNGAVAXContract.totalSupply()
    const PNGAmt = PNGReserve.mul(PNGAVAXAmt).div(totalSupplyPNGAVAX)
    const WAVAXAmtPNG = WAVAXReservePNG.mul(PNGAVAXAmt).div(totalSupplyPNGAVAX)
    const _WAVAXAmtPNG = (await pngRouter.getAmountsOut(PNGAmt, [PNGAddr, WAVAXAddr]))[1]
    const WAVAXAmtMinPNG = _WAVAXAmtPNG.mul(amountOutMinPerc).div(1000)
    totalWAVAXAmt = totalWAVAXAmt.add(WAVAXAmtPNG.add(_WAVAXAmtPNG))

    const LYDAVAXAmt = (await LYDAVAXVault.balanceOf(deXAvaxStrategy.address)).mul(sharePerc).div(oneEther)
    const LYDAVAXContract = new ethers.Contract(LYDAVAXAddr, pair_ABI, deployer)
    const [LYDReserve, WAVAXReserveLYD] = await LYDAVAXContract.getReserves()
    const totalSupplyLYDAVAX = await LYDAVAXContract.totalSupply()
    const LYDAmt = LYDReserve.mul(LYDAVAXAmt).div(totalSupplyLYDAVAX)
    const WAVAXAmtLYD = WAVAXReserveLYD.mul(LYDAVAXAmt).div(totalSupplyLYDAVAX)
    const _WAVAXAmtLYD = (await lydRouter.getAmountsOut(LYDAmt, [LYDAddr, WAVAXAddr]))[1]
    const WAVAXAmtMinLYD = _WAVAXAmtLYD.mul(amountOutMinPerc).div(1000)
    totalWAVAXAmt = totalWAVAXAmt.add(WAVAXAmtLYD.add(_WAVAXAmtLYD))

    // Vault
    withdrawAmt = (await joeRouter.getAmountsOut(totalWAVAXAmt, [WAVAXAddr, tokenWithdraw]))[1]
    const withdrawAmtMin = withdrawAmt.mul(amountOutMinPerc).div(1000)
    return [withdrawAmtMin, WAVAXAmtMinJOE, WAVAXAmtMinPNG, WAVAXAmtMinLYD]
}

const getAmountsOutMinDeXStable = async (shareToWithdraw, stablecoinAddr, provider) => {
    provider = new ethers.providers.Web3Provider(provider) // Change Web3 provider to Ethers provider
    if (!ethers.BigNumber.isBigNumber(shareToWithdraw)) shareToWithdraw = new ethers.BigNumber.from(shareToWithdraw)

    // amountOutMinPerc = 990

    const deXStableVault = new ethers.Contract(deXStableVaultAddr, avaxStableVaultABI, provider)
    const deXStableStrategy = new ethers.Contract(deXStableStrategyAddr, deXStableStrategyABI, provider)

    const JOEUSDCVault = await ethers.getContractAt("AvaxVaultL1", JOEUSDCVaultAddr, deployer)
    const PNGUSDTVault = await ethers.getContractAt("AvaxVaultL1", PNGUSDTVaultAddr, deployer)
    const LYDDAIVault = await ethers.getContractAt("AvaxVaultL1", LYDDAIVaultAddr, deployer)

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
    const JOEUSDCAmt = (await JOEUSDCVault.balanceOf(deXStableStrategy.address)).mul(sharePerc).div(oneEther)
    const JOEUSDCContract = new ethers.Contract(JOEUSDCAddr, pair_ABI, deployer)
    const [JOEReserve,] = await JOEUSDCContract.getReserves()
    const totalSupplyJOEUSDC = await JOEUSDCContract.totalSupply()
    const JOEAmt = JOEReserve.mul(JOEUSDCAmt).div(totalSupplyJOEUSDC)
    const USDCAmt = (await joeRouter.getAmountsOut(JOEAmt, [JOEAddr, USDCAddr]))[1]
    const USDCAmtMin = USDCAmt.mul(amountOutMinPerc).div(1000)
    // PNG
    const PNGUSDTAmt = (await PNGUSDTVault.balanceOf(deXStableStrategy.address)).mul(sharePerc).div(oneEther)
    const PNGUSDTContract = new ethers.Contract(PNGUSDTAddr, pair_ABI, deployer)
    const [PNGReserve,] = await PNGUSDTContract.getReserves()
    const totalSupplyPNGUSDT = await PNGUSDTContract.totalSupply()
    const PNGAmt = PNGReserve.mul(PNGUSDTAmt).div(totalSupplyPNGUSDT)
    const USDTAmt = (await pngRouter.getAmountsOut(PNGAmt, [PNGAddr, USDTAddr]))[1]
    const USDTAmtMin = USDTAmt.mul(amountOutMinPerc).div(1000)
    // LYD
    const LYDDAIAmt = (await LYDDAIVault.balanceOf(deXStableStrategy.address)).mul(sharePerc).div(oneEther)
    const LYDDAIContract = new ethers.Contract(LYDDAIAddr, pair_ABI, deployer)
    const [LYDReserve,] = await LYDDAIContract.getReserves()
    const totalSupplyLYDDAI = await LYDDAIContract.totalSupply()
    const LYDAmt = LYDReserve.mul(LYDDAIAmt).div(totalSupplyLYDDAI)
    const DAIAmt = (await lydRouter.getAmountsOut(LYDAmt, [LYDAddr, DAIAddr]))[1]
    const DAIAmtMin = DAIAmt.mul(amountOutMinPerc).div(1000)

    return [0, USDCAmtMin, USDTAmtMin, DAIAmtMin]
}

module.exports = {
    getAmountsOutMinDeXAvax,
    getAmountsOutMinDeXStable,
}