const ethers = require("ethers")
const axios = require("axios")
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
const WAVAXAddr = "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7"

const joeRouterAddr = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4"
const pngRouterAddr = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106"
const lydRouterAddr = "0xA52aBE4676dbfd04Df42eF7755F01A3c41f28D27"

const JOEAddr = "0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd"
const PNGAddr = "0x60781c2586d68229fde47564546784ab3faca982"
const LYDAddr = "0x4c9b4e1ac6f24cde3660d5e4ef1ebf77c710c084"

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

const minimumOutputInPercentage = 995

const getAmountsOutMinDeXAvax = async (amountDeposit, stablecoinAddr, _provider) => {
    const provider = new ethers.providers.Web3Provider(_provider) // Change Web3 provider to Ethers provider
    if (!ethers.BigNumber.isBigNumber(amountDeposit)) amountDeposit = new ethers.BigNumber.from(amountDeposit)

    const deXAvaxVault = new ethers.Contract(deXAvaxVaultAddr, avaxVaultABI, provider)
    const deXAvaxStrategy = new ethers.Contract(deXAvaxStrategyAddr, deXAvaxStrategyABI, provider)

    const joeRouter = new ethers.Contract(joeRouterAddr, router_ABI, provider)
    const pngRouter = new ethers.Contract(pngRouterAddr, router_ABI, provider)
    const lydRouter = new ethers.Contract(lydRouterAddr, router_ABI, provider)

    // Fetch price from Coingecko
    const res = await axios.get(`https://api.coingecko.com/api/v3/simple/token_price/avalanche?contract_addresses=${WAVAXAddr}%2C${JOEAddr}%2C${PNGAddr}%2C${LYDAddr}&vs_currencies=usd`)
    const WAVAXPriceInUSD = res.data[WAVAXAddr].usd
    const JOEPriceInUSD = res.data[JOEAddr].usd
    const PNGPriceInUSD = res.data[PNGAddr].usd
    const LYDPriceInUSD = res.data[LYDAddr].usd

    let amountDepositInNum
    // Inside vault
    const decimals = stablecoinAddr == DAIAddr ? 18 : 6
    amountDepositInNum = parseFloat(ethers.utils.formatUnits(amountDeposit, decimals))
    const amountDepositInWAVAX = amountDepositInNum / WAVAXPriceInUSD
    const WAVAXAmt = (await joeRouter.getAmountsOut(amountDeposit, [stablecoinAddr, WAVAXAddr]))[1]
    if (amountDepositInWAVAX * 95 / 100 > parseFloat(ethers.utils.formatEther(WAVAXAmt))) {
        throw `Price impact occured (WAVAX): ${amountDepositInWAVAX * 95 / 100}, ${parseFloat(ethers.utils.formatEther(WAVAXAmt))}`
    }
    const WAVAXAmtMin = WAVAXAmt.mul(minimumOutputInPercentage).div(1000)

    // Inside strategy
    const [pool0, pool1, pool2] = await deXAvaxStrategy.getEachPool()
    const pool = pool0.add(pool1).add(pool2).add(WAVAXAmt)
    const JOEAVAXTargetPool = pool.mul(4500).div(10000)
    const PNGAVAXTargetPool = JOEAVAXTargetPool
    const LYDAVAXTargetPool = pool.mul(1000).div(10000)
    // Rebalancing
    let JOEAmtMin, PNGAmtMin, LYDAmtMin
    JOEAmtMin = PNGAmtMin = LYDAmtMin = 0
    if (JOEAVAXTargetPool.gt(pool0) && PNGAVAXTargetPool.gt(pool1) && LYDAVAXTargetPool.gt(pool2)) {
        // JOE
        const amountInvestJOEAVAX = JOEAVAXTargetPool.sub(pool0)
        const amountInvestJOEAVAXInUSD = parseFloat(ethers.utils.formatEther(amountInvestJOEAVAX.div(2))) * WAVAXPriceInUSD
        const JOEAmt = (await joeRouter.getAmountsOut(amountInvestJOEAVAX.div(2), [WAVAXAddr, JOEAddr]))[1]
        const JOEAmtInUSD = parseFloat(ethers.utils.formatEther(JOEAmt)) * JOEPriceInUSD
        if (amountInvestJOEAVAXInUSD * 95 / 100 > JOEAmtInUSD) {
            throw `Price impact occured (JOE): ${amountInvestJOEAVAXInUSD * 95 / 100}, ${JOEAmtInUSD}`
        }
        JOEAmtMin = JOEAmt.mul(minimumOutputInPercentage).div(1000)
        // PNG
        const amountInvestPNGAVAX = PNGAVAXTargetPool.sub(pool1)
        const amountInvestPNGAVAXInUSD = parseFloat(ethers.utils.formatEther(amountInvestPNGAVAX.div(2))) * WAVAXPriceInUSD
        const PNGAmt = (await pngRouter.getAmountsOut(amountInvestPNGAVAX.div(2), [WAVAXAddr, PNGAddr]))[1]
        const PNGAmtInUSD = parseFloat(ethers.utils.formatEther(PNGAmt)) * PNGPriceInUSD
        if (amountInvestPNGAVAXInUSD * 95 / 100 > PNGAmtInUSD) {
            throw `Price impact occured (PNG): ${amountInvestPNGAVAXInUSD * 95 / 100}, ${PNGAmtInUSD}`
        }
        PNGAmtMin = PNGAmt.mul(minimumOutputInPercentage).div(1000)
        // LYD
        const amountInvestLYDAVAX = LYDAVAXTargetPool.sub(pool2)
        const amountInvestLYDAVAXInUSD = parseFloat(ethers.utils.formatEther(amountInvestLYDAVAX.div(2))) * WAVAXPriceInUSD
        const LYDAmt = (await lydRouter.getAmountsOut(amountInvestLYDAVAX.div(2), [WAVAXAddr, LYDAddr]))[1]
        const LYDAmtInUSD = parseFloat(ethers.utils.formatEther(LYDAmt)) * LYDPriceInUSD
        if (amountInvestLYDAVAXInUSD * 10 / 100 > LYDAmtInUSD) {
            throw `Price impact occured (LYD): ${amountInvestLYDAVAXInUSD * 10 / 100}, ${LYDAmtInUSD}`
        }
        LYDAmtMin = LYDAmt.mul(minimumOutputInPercentage).div(1000)
    } else {
        let furthest, farmIndex, diff
        if (JOEAVAXTargetPool.gt(pool0)) {
            diff = JOEAVAXTargetPool.sub(pool0)
            furthest = diff
            farmIndex = 0
        }
        if (PNGAVAXTargetPool.gt(pool1)) {
            diff = PNGAVAXTargetPool.sub(pool1)
            if (diff.gt(furthest)) {
                furthest = diff
                farmIndex = 1
            }
        }
        if (LYDAVAXTargetPool.gt(pool2)) {
            diff = LYDAVAXTargetPool.sub(pool2)
            if (diff.gt(furthest)) {
                furthest = diff
                farmIndex = 2
            }
        }
        const WAVAXAmtInUSD = parseFloat(ethers.utils.formatEther(WAVAXAmt.div(2))) * WAVAXPriceInUSD
        if (farmIndex == 0) {
            const JOEAmt = (await joeRouter.getAmountsOut(WAVAXAmt.div(2), [WAVAXAddr, JOEAddr]))[1]
            const JOEAmtInUSD = parseFloat(ethers.utils.formatEther(JOEAmt)) * JOEPriceInUSD
            if (WAVAXAmtInUSD * 95 / 100 > JOEAmtInUSD) {
                throw `Price impact occured (JOE): ${WAVAXAmtInUSD * 95 / 100}, ${JOEAmtInUSD}`
            }
            JOEAmtMin = JOEAmt.mul(minimumOutputInPercentage).div(1000)
        } else if (farmIndex == 1) {
            const PNGAmt = (await pngRouter.getAmountsOut(WAVAXAmt.div(2), [WAVAXAddr, PNGAddr]))[1]
            const PNGAmtInUSD = parseFloat(ethers.utils.formatEther(PNGAmt)) * PNGPriceInUSD
            if (WAVAXAmtInUSD * 95 / 100 > PNGAmtInUSD) {
                throw `Price impact occured (PNG): ${WAVAXAmtInUSD * 95 / 100}, ${PNGAmtInUSD}`
            }
            PNGAmtMin = PNGAmt.mul(minimumOutputInPercentage).div(1000)
        } else {
            const LYDAmt = (await lydRouter.getAmountsOut(WAVAXAmt.div(2), [WAVAXAddr, LYDAddr]))[1]
            const LYDAmtInUSD = parseFloat(ethers.utils.formatEther(LYDAmt)) * LYDPriceInUSD
            if (WAVAXAmtInUSD * 95 / 100 > LYDAmtInUSD) {
                throw `Price impact occured (LYD): ${WAVAXAmtInUSD * 95 / 100}, ${LYDAmtInUSD}`
            }
            LYDAmtMin = LYDAmt.mul(minimumOutputInPercentage).div(1000)
        }
    }
    return [WAVAXAmtMin, JOEAmtMin, PNGAmtMin, LYDAmtMin]
}

module.exports = {
    getAmountsOutMinDeXAvax,
}