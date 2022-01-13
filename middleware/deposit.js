const ethers = require("ethers")
const axios = require("axios")
const router_ABI = require("./router_ABI.json")
const deXAvaxStrategyABI = require("./DeXAvaxStrategy.json").abi
const deXStableStrategyABI = require("./DeXStableStrategy.json").abi
const stableAvaxStrategyABI = require("./StableAvaxStrategy.json").abi

const USDTAddr = "0xc7198437980c041c805A1EDcbA50c1Ce5db95118"
const USDCAddr = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664"
const DAIAddr = "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70"
const MIMAddr = "0x130966628846BFd36ff31a822705796e8cb8C18D"
const WAVAXAddr = "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7"

const joeRouterAddr = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4"
const pngRouterAddr = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106"
const lydRouterAddr = "0xA52aBE4676dbfd04Df42eF7755F01A3c41f28D27"

const JOEAddr = "0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd"
const PNGAddr = "0x60781c2586d68229fde47564546784ab3faca982"
const LYDAddr = "0x4c9b4e1ac6f24cde3660d5e4ef1ebf77c710c084"

const deXAvaxStrategyAddr = "0x9B403B87d856ae9B640FeE80AD338b6aF78732b4"
const deXStableStrategyAddr = "0x374701638b3Aeaa9f8578ab2062B0b604CE1C6C8"
const stableAvaxStrategyAddr = "0x3845d7c09374Df1ae6Ce4728c99DD20D3d75F414"

const amountOutMinPerc = 995 // 0.5%
const networkFeePerc = 0

const getAmountsOutMinDeXAvax = async (amountDeposit, stablecoinAddr, _provider) => {
    const provider = new ethers.providers.Web3Provider(_provider) // Change Web3 provider to Ethers provider
    if (!ethers.BigNumber.isBigNumber(amountDeposit)) amountDeposit = new ethers.BigNumber.from(amountDeposit)

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

    // Inside vault
    amountDeposit = amountDeposit.sub(amountDeposit.mul(networkFeePerc).div(10000))
    const decimals = stablecoinAddr == DAIAddr || stablecoinAddr == MIMAddr ? 18 : 6
    const amountDepositInNum = parseFloat(ethers.utils.formatUnits(amountDeposit, decimals))
    const amountDepositInWAVAX = amountDepositInNum / WAVAXPriceInUSD
    const WAVAXAmt = (await joeRouter.getAmountsOut(amountDeposit, [stablecoinAddr, WAVAXAddr]))[1]
    if (amountDepositInWAVAX * 95 / 100 > parseFloat(ethers.utils.formatEther(WAVAXAmt))) {
        throw `Price impact occured (WAVAX): ${amountDepositInWAVAX * 95 / 100}, ${parseFloat(ethers.utils.formatEther(WAVAXAmt))}`
    }
    const WAVAXAmtMin = WAVAXAmt.mul(amountOutMinPerc).div(1000)

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
        JOEAmtMin = JOEAmt.mul(amountOutMinPerc).div(1000)
        // PNG
        const amountInvestPNGAVAX = PNGAVAXTargetPool.sub(pool1)
        const amountInvestPNGAVAXInUSD = parseFloat(ethers.utils.formatEther(amountInvestPNGAVAX.div(2))) * WAVAXPriceInUSD
        const PNGAmt = (await pngRouter.getAmountsOut(amountInvestPNGAVAX.div(2), [WAVAXAddr, PNGAddr]))[1]
        const PNGAmtInUSD = parseFloat(ethers.utils.formatEther(PNGAmt)) * PNGPriceInUSD
        if (amountInvestPNGAVAXInUSD * 95 / 100 > PNGAmtInUSD) {
            throw `Price impact occured (PNG): ${amountInvestPNGAVAXInUSD * 95 / 100}, ${PNGAmtInUSD}`
        }
        PNGAmtMin = PNGAmt.mul(amountOutMinPerc).div(1000)
        // LYD
        const amountInvestLYDAVAX = LYDAVAXTargetPool.sub(pool2)
        const amountInvestLYDAVAXInUSD = parseFloat(ethers.utils.formatEther(amountInvestLYDAVAX.div(2))) * WAVAXPriceInUSD
        const LYDAmt = (await lydRouter.getAmountsOut(amountInvestLYDAVAX.div(2), [WAVAXAddr, LYDAddr]))[1]
        const LYDAmtInUSD = parseFloat(ethers.utils.formatEther(LYDAmt)) * LYDPriceInUSD
        if (amountInvestLYDAVAXInUSD * 95 / 100 > LYDAmtInUSD) {
            throw `Price impact occured (LYD): ${amountInvestLYDAVAXInUSD * 95 / 100}, ${LYDAmtInUSD}`
        }
        LYDAmtMin = LYDAmt.mul(amountOutMinPerc).div(1000)
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
            JOEAmtMin = JOEAmt.mul(amountOutMinPerc).div(1000)
        } else if (farmIndex == 1) {
            const PNGAmt = (await pngRouter.getAmountsOut(WAVAXAmt.div(2), [WAVAXAddr, PNGAddr]))[1]
            const PNGAmtInUSD = parseFloat(ethers.utils.formatEther(PNGAmt)) * PNGPriceInUSD
            if (WAVAXAmtInUSD * 95 / 100 > PNGAmtInUSD) {
                throw `Price impact occured (PNG): ${WAVAXAmtInUSD * 95 / 100}, ${PNGAmtInUSD}`
            }
            PNGAmtMin = PNGAmt.mul(amountOutMinPerc).div(1000)
        } else {
            const LYDAmt = (await lydRouter.getAmountsOut(WAVAXAmt.div(2), [WAVAXAddr, LYDAddr]))[1]
            const LYDAmtInUSD = parseFloat(ethers.utils.formatEther(LYDAmt)) * LYDPriceInUSD
            if (WAVAXAmtInUSD * 95 / 100 > LYDAmtInUSD) {
                throw `Price impact occured (LYD): ${WAVAXAmtInUSD * 95 / 100}, ${LYDAmtInUSD}`
            }
            LYDAmtMin = LYDAmt.mul(amountOutMinPerc).div(1000)
        }
    }
    return [WAVAXAmtMin.toString(), JOEAmtMin.toString(), PNGAmtMin.toString(), LYDAmtMin.toString()]
}

const getAmountsOutMinDeXStable = async (amountDeposit, stablecoinAddr, _provider) => {
    const provider = new ethers.providers.Web3Provider(_provider) // Change Web3 provider to Ethers provider
    if (!ethers.BigNumber.isBigNumber(amountDeposit)) amountDeposit = new ethers.BigNumber.from(amountDeposit)

    const deXStableStrategy = new ethers.Contract(deXStableStrategyAddr, deXStableStrategyABI, provider)

    const joeRouter = new ethers.Contract(joeRouterAddr, router_ABI, provider)
    const pngRouter = new ethers.Contract(pngRouterAddr, router_ABI, provider)
    const lydRouter = new ethers.Contract(lydRouterAddr, router_ABI, provider)

    // Fetch price from Coingecko
    const res = await axios.get(`https://api.coingecko.com/api/v3/simple/token_price/avalanche?contract_addresses=${JOEAddr}%2C${PNGAddr}%2C${LYDAddr}&vs_currencies=usd`)
    const JOEPriceInUSD = res.data[JOEAddr].usd
    const PNGPriceInUSD = res.data[PNGAddr].usd
    const LYDPriceInUSD = res.data[LYDAddr].usd

    // Vault (Assume all Stablecoins have same value)
    amountDeposit = amountDeposit.sub(amountDeposit.mul(networkFeePerc).div(10000))
    // Strategy
    if (stablecoinAddr == DAIAddr || stablecoinAddr == MIMAddr) amountDeposit = amountDeposit.div(ethers.utils.parseUnits("1", 12))
    // const [pool0, pool1, pool2] = await deXStableStrategy.getEachPool()
    // const pool = pool0.add(pool1).add(pool2).add(amountDeposit)
    // const JOEUSDTTargetPool = pool.mul(6000).div(10000)
    // const PNGUSDCTargetPool = pool.mul(3000).div(10000)
    // const LYDDAITargetPool = pool.mul(1000).div(10000)
    const amountInvestJOEUSDT = amountDeposit.mul(6000).div(10000)
    const amountInvestPNGUSDC = amountDeposit.mul(3000).div(10000)
    const amountInvestLYDDAI = amountDeposit.mul(1000).div(10000)
    // Rebalancing - No rebalancing for this strategy for now
    // JOE
    // const amountInvestJOEUSDT = JOEUSDTTargetPool.sub(pool0)
    const idealJOEAmt = parseFloat(ethers.utils.formatUnits(amountInvestJOEUSDT.div(2), 6)) / JOEPriceInUSD
    const JOEAmt = (await joeRouter.getAmountsOut(amountInvestJOEUSDT.div(2), [USDTAddr, JOEAddr]))[1]
    if (idealJOEAmt * 95 / 100 > JOEAmt) {
        throw `Price impact occured (JOE): ${idealJOEAmt * 95 / 100}, ${JOEAmt}`
    }
    const JOEAmtMin = JOEAmt.mul(amountOutMinPerc).div(1000)
    // PNG
    // const amountInvestPNGUSDC = PNGUSDCTargetPool.sub(pool1)
    const idealPNGAmt = parseFloat(ethers.utils.formatUnits(amountInvestPNGUSDC.div(2), 6)) / PNGPriceInUSD
    const PNGAmt = (await pngRouter.getAmountsOut(amountInvestPNGUSDC.div(2), [USDCAddr, PNGAddr]))[1]
    if (idealPNGAmt * 95 / 100 > PNGAmt) {
        throw `Price impact occured (PNG): ${idealPNGAmt * 95 / 100}, ${PNGAmt}`
    }
    const PNGAmtMin = PNGAmt.mul(amountOutMinPerc).div(1000)
    // LYD
    // const amountInvestLYDDAI = LYDDAITargetPool.sub(pool2)
    const idealLYDAmt = parseFloat(ethers.utils.formatUnits(amountInvestLYDDAI.div(2), 6)) / LYDPriceInUSD
    const LYDAmt = (await lydRouter.getAmountsOut(amountInvestLYDDAI.mul(ethers.utils.parseUnits("1", 12)).div(2), [DAIAddr, LYDAddr]))[1]
    if (idealLYDAmt * 95 / 100 > LYDAmt) {
        throw `Price impact occured (LYD): ${idealLYDAmt * 95 / 100}, ${LYDAmt}`
    }
    const LYDAmtMin = LYDAmt.mul(amountOutMinPerc).div(1000)
    
    return ["0", JOEAmtMin.toString(), PNGAmtMin.toString(), LYDAmtMin.toString()]
}

const getAmountsOutMinStableAvax = async (amountDeposit, stablecoinAddr, _provider) => {
    const provider = new ethers.providers.Web3Provider(_provider) // Change Web3 provider to Ethers provider
    if (!ethers.BigNumber.isBigNumber(amountDeposit)) amountDeposit = new ethers.BigNumber.from(amountDeposit)

    const stableAvaxStrategy = new ethers.Contract(stableAvaxStrategyAddr, stableAvaxStrategyABI, provider)

    const joeRouter = new ethers.Contract(joeRouterAddr, router_ABI, provider)
    const pngRouter = new ethers.Contract(pngRouterAddr, router_ABI, provider)
    const lydRouter = new ethers.Contract(lydRouterAddr, router_ABI, provider)

    // Fetch price from Coingecko
    const res = await axios.get(`https://api.coingecko.com/api/v3/simple/token_price/avalanche?contract_addresses=${WAVAXAddr}&vs_currencies=usd`)
    const WAVAXPriceInUSD = res.data[WAVAXAddr].usd

    // Vault (Assume all Stablecoins have same value)
    amountDeposit = amountDeposit.sub(amountDeposit.mul(networkFeePerc).div(10000))
    // Strategy
    if (stablecoinAddr == DAIAddr || stablecoinAddr == MIMAddr) amountDeposit = amountDeposit.div(ethers.utils.parseUnits("1", 12))
    const amountInvestUSDTAVAX = amountDeposit.mul(500).div(10000)
    const amountInvestUSDCAVAX = amountDeposit.mul(8000).div(10000)
    const amountInvestMIMAVAX = amountDeposit.mul(1500).div(10000)
    // Rebalancing - No rebalancing needed for this strategy
    // LYD
    const idealWAVAXAmtLYD = parseFloat(ethers.utils.formatUnits(amountInvestUSDTAVAX.div(2), 6)) / WAVAXPriceInUSD
    const WAVAXAmtLYD = (await lydRouter.getAmountsOut(amountInvestUSDTAVAX.div(2), [USDTAddr, WAVAXAddr]))[1]
    if (idealWAVAXAmtLYD * 95 / 100 > WAVAXAmtLYD) {
        throw `Price impact occured (JOE): ${idealWAVAXAmtLYD * 95 / 100}, ${WAVAXAmtLYD}`
    }
    const WAVAXAmtLYDMin = WAVAXAmtLYD.mul(amountOutMinPerc).div(1000)
    // PNG
    const idealWAVAXAmtPNG = parseFloat(ethers.utils.formatUnits(amountInvestUSDCAVAX.div(2), 6)) / WAVAXPriceInUSD
    const WAVAXAmtPNG = (await pngRouter.getAmountsOut(amountInvestUSDCAVAX.div(2), [USDCAddr, WAVAXAddr]))[1]
    if (idealWAVAXAmtPNG * 95 / 100 > WAVAXAmtPNG) {
        throw `Price impact occured (JOE): ${idealWAVAXAmtPNG * 95 / 100}, ${WAVAXAmtPNG}`
    }
    const WAVAXAmtPNGMin = WAVAXAmtPNG.mul(amountOutMinPerc).div(1000)
    // JOE -> replace with PNG MIM-AVAX pair
    const idealWAVAXAmtJOE = parseFloat(ethers.utils.formatUnits(amountInvestMIMAVAX.div(2), 6)) / WAVAXPriceInUSD
    const WAVAXAmtJOE = (await pngRouter.getAmountsOut(amountInvestMIMAVAX.mul(ethers.utils.parseUnits("1", 12)).div(2), [MIMAddr, WAVAXAddr]))[1]
    if (idealWAVAXAmtJOE * 95 / 100 > WAVAXAmtJOE) {
        throw `Price impact occured (JOE): ${idealWAVAXAmtJOE * 95 / 100}, ${WAVAXAmtJOE}`
    }
    const WAVAXAmtJOEMin = WAVAXAmtJOE.mul(amountOutMinPerc).div(1000)
    
    return ["0", WAVAXAmtLYDMin.toString(), WAVAXAmtPNGMin.toString(), WAVAXAmtJOEMin.toString()]
}

module.exports = {
    getAmountsOutMinDeXAvax,
    getAmountsOutMinDeXStable,
    getAmountsOutMinStableAvax
}