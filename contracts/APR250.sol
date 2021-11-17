// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "hardhat/console.sol";

interface IRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB);

    function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts);
}

interface IMasterChef {
    function deposit(uint pid, uint amount) external;
    function withdraw(uint pid, uint amount) external;
    function userInfo(uint pid, address account) external view returns (uint amount, uint rewardDebt);
    function poolInfo(uint pid) external view returns (address lpToken, uint allocPoint, uint lastRewardBlock, uint accRewardPerShare);
    function pendingTokens(uint pid, address account) external view returns (uint, address, string memory, uint);
    function pendingLyd(uint pid, address account) external view returns (uint);
}

interface IStakingReward {
    function stake(uint amount) external;
    function withdraw(uint amount) external;
    function getReward() external;
    function balanceOf(address account) external view returns (uint);
    function earned(address account) external view returns (uint);
    function stakingToken() external view returns (address);
}

interface IPair is IERC20Upgradeable {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

interface IChainlink {
    function latestAnswer() external view returns (int256);
}

contract APR250Strategy is Initializable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeERC20Upgradeable for IPair;

    IERC20Upgradeable constant WAVAX = IERC20Upgradeable(0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7);
    IERC20Upgradeable constant JOE = IERC20Upgradeable(0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd);
    IERC20Upgradeable constant PNG = IERC20Upgradeable(0x60781C2586D68229fde47564546784ab3fACA982);
    IERC20Upgradeable constant LYD = IERC20Upgradeable(0x4C9B4E1AC6F24CdE3660D5E4Ef1eBF77C710C084);

    IRouter constant joeRouter = IRouter(0x60aE616a2155Ee3d9A68541Ba4544862310933d4);
    IRouter constant pngRouter = IRouter(0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106);
    IRouter constant lydRouter = IRouter(0xA52aBE4676dbfd04Df42eF7755F01A3c41f28D27);

    IPair public joePair;
    IPair public pngPair;
    IPair public lydPair;

    IERC20Upgradeable public joeToken0;
    IERC20Upgradeable public joeToken1;
    IERC20Upgradeable public pngToken0;
    IERC20Upgradeable public pngToken1;
    IERC20Upgradeable public lydToken0;
    IERC20Upgradeable public lydToken1;

    IMasterChef public joeFarm;
    IStakingReward public pngFarm;
    IMasterChef public lydFarm;

    address public treasuryWallet;
    address public communityWallet;
    address public admin;

    address public vault;
    uint public yieldFeePerc;
    uint public profitFeePerc;
    uint public watermark; // In USD (18 decimals)

    event InvestJoePair(uint WAVAXAmt, uint joePairAmt);
    event InvestPngPair(uint WAVAXAmt, uint pngPairAmt);
    event InvestLydPair(uint WAVAXAmt, uint lydPairAmt);
    event Withdraw(uint amount, uint WAVAXAmt);
    event WithdrawJoePair(uint lpTokenAmt, uint WAVAXAmt);
    event WithdrawPngPair(uint lpTokenAmt, uint WAVAXAmt);
    event WithdrawLydPair(uint lpTokenAmt, uint WAVAXAmt);
    event CollectProfitAndUpdateWatermark(uint currentWatermark, uint lastWatermark, uint fee);
    event AdjustWatermark(uint currentWatermark, uint lastWatermark);
    event Reimburse(uint WAVAXAmt);

    modifier onlyVault {
        require(msg.sender == vault, "Only vault");
        _;
    }

    function initialize(
        IPair _joePair, IPair _pngPair, IPair _lydPair,
        IMasterChef _joeFarm, IStakingReward _pngFarm, IMasterChef _lydFarm
    ) external initializer {

        joePair = _joePair;
        pngPair = _pngPair;
        lydPair = _lydPair;

        joeFarm = _joeFarm;
        pngFarm = _pngFarm;
        lydFarm = _lydFarm;

        joeToken0 = IERC20Upgradeable(joePair.token0());
        joeToken1 = IERC20Upgradeable(joePair.token1());
        pngToken0 = IERC20Upgradeable(pngPair.token0());
        pngToken1 = IERC20Upgradeable(pngPair.token1());
        lydToken0 = IERC20Upgradeable(lydPair.token0());
        lydToken1 = IERC20Upgradeable(lydPair.token1());

        yieldFeePerc = 2000;
        profitFeePerc = 2000;

        WAVAX.safeApprove(address(joeRouter), type(uint).max);
        WAVAX.safeApprove(address(pngRouter), type(uint).max);
        WAVAX.safeApprove(address(lydRouter), type(uint).max);
        JOE.safeApprove(address(joeRouter), type(uint).max);
        PNG.safeApprove(address(pngRouter), type(uint).max);
        LYD.safeApprove(address(lydRouter), type(uint).max);

        joePair.safeApprove(address(joeRouter), type(uint).max);
        joePair.safeApprove(address(_joeFarm), type(uint).max);
        pngPair.safeApprove(address(pngRouter), type(uint).max);
        pngPair.safeApprove(address(_pngFarm), type(uint).max);
        lydPair.safeApprove(address(lydRouter), type(uint).max);
        lydPair.safeApprove(address(_lydFarm), type(uint).max);

        if (joeToken0.allowance(address(this), address(joeRouter)) == 0) joeToken0.safeApprove(address(joeRouter), type(uint).max);
        if (joeToken1.allowance(address(this), address(joeRouter)) == 0) joeToken1.safeApprove(address(joeRouter), type(uint).max);
        if (pngToken0.allowance(address(this), address(pngRouter)) == 0) pngToken0.safeApprove(address(pngRouter), type(uint).max);
        if (pngToken1.allowance(address(this), address(pngRouter)) == 0) pngToken1.safeApprove(address(pngRouter), type(uint).max);
        if (lydToken0.allowance(address(this), address(lydRouter)) == 0) lydToken0.safeApprove(address(lydRouter), type(uint).max);
        if (lydToken1.allowance(address(this), address(lydRouter)) == 0) lydToken1.safeApprove(address(lydRouter), type(uint).max);
    }

    function invest(uint WAVAXAmt, uint[] calldata amountsOutMin) external onlyVault {
        WAVAX.safeTransferFrom(vault, address(this), WAVAXAmt);

        investJoePair(WAVAXAmt * 2000 / 10000, amountsOutMin);
        investPngPair(WAVAXAmt * 4000 / 10000, amountsOutMin);
        investLydPair(WAVAXAmt * 4000 / 10000, amountsOutMin);
    }

    function investJoePair(uint WAVAXAmt, uint[] calldata amountOutMin) private {
        // Current Joe Pair: YAK-WAVAX
        uint halfWAVAXAmt = WAVAXAmt / 2;

        uint YAKAmt = swap(address(WAVAX), address(joeToken0), halfWAVAXAmt, amountOutMin[3]);
        
        (,,uint joePairAmt) = joeRouter.addLiquidity(
            address(joeToken0), address(joeToken1), YAKAmt, halfWAVAXAmt, 0, 0, address(this), block.timestamp
        );

        joeFarm.deposit(1, joePairAmt);

        emit InvestJoePair(WAVAXAmt, joePairAmt);
    }

    function investPngPair(uint WAVAXAmt, uint[] calldata amountOutMin) private {
        // Current Pangolin Pair: WAVAX-TIME
        uint halfWAVAXAmt = WAVAXAmt / 2;

        uint TIMEAmt = swap(address(WAVAX), address(pngToken1), halfWAVAXAmt, amountOutMin[5]);
        
        (,,uint pngPairAmt) = pngRouter.addLiquidity(
            address(pngToken0), address(pngToken1), halfWAVAXAmt, TIMEAmt, 0, 0, address(this), block.timestamp
        );

        pngFarm.stake(pngPairAmt);

        emit InvestPngPair(WAVAXAmt, pngPairAmt);
    }

    function investLydPair(uint WAVAXAmt, uint[] calldata amountOutMin) private {
        // Current Lydia Pair: WETH-LYD
        uint halfWAVAXAmt = WAVAXAmt / 2;

        uint WETHAmt = swap(address(WAVAX), address(lydToken0), halfWAVAXAmt, amountOutMin[7]);
        uint LYDAmt = swap(address(WAVAX), address(lydToken1), halfWAVAXAmt, amountOutMin[8]);
        
        (,,uint lydPairAmt) = lydRouter.addLiquidity(
            address(lydToken0), address(lydToken1), WETHAmt, LYDAmt, 0, 0, address(this), block.timestamp
        );

        lydFarm.deposit(19, lydPairAmt);

        emit InvestLydPair(WAVAXAmt, lydPairAmt);
    }

    /// @param amount Amount to withdraw in USD
    function withdraw(uint amount, uint[] calldata amountsOutMin) external onlyVault returns (uint WAVAXAmt) {
        uint sharePerc = amount * 1e18 / getAllPoolInUSD();

        uint WAVAXAmtBefore = WAVAX.balanceOf(address(this));
        withdrawJoePair(sharePerc, amountsOutMin);
        withdrawPngPair(sharePerc, amountsOutMin);
        withdrawLydPair(sharePerc, amountsOutMin);
        WAVAXAmt = WAVAX.balanceOf(address(this)) - WAVAXAmtBefore;

        WAVAX.safeTransfer(vault, WAVAXAmt);

        emit Withdraw(amount, WAVAXAmt);
    }

    function withdrawJoePair(uint sharePerc, uint[] calldata amountOutMin) private {
        // Current Joe Pair: YAK-WAVAX
        (uint joePairAmt,) = joeFarm.userInfo(1, address(this));
        joeFarm.withdraw(1, joePairAmt * sharePerc / 1e18);

        (uint joeToken0Amt, uint joeToken1Amt) = joeRouter.removeLiquidity(
            address(joeToken0), address(joeToken1), joePairAmt, 0, 0, address(this), block.timestamp
        );

        uint WAVAXAmt = joeToken1Amt;
        WAVAXAmt += swap(address(joeToken0), address(WAVAX), joeToken0Amt, amountOutMin[1]);

        emit WithdrawJoePair(joePairAmt, WAVAXAmt);
    }

    function withdrawPngPair(uint sharePerc, uint[] calldata amountOutMin) private {
        // Current Pangolin Pair: WAVAX-TIME
        uint pngPairAmt = pngFarm.balanceOf(address(this));
        pngFarm.withdraw(pngPairAmt * sharePerc / 1e18);

        (uint pngToken0Amt, uint pngToken1Amt) = pngRouter.removeLiquidity(
            address(pngToken0), address(pngToken1), pngPairAmt, 0, 0, address(this), block.timestamp
        );

        uint WAVAXAmt = pngToken0Amt;
        WAVAXAmt += swap(address(pngToken1), address(WAVAX), pngToken1Amt, amountOutMin[3]);

        emit WithdrawPngPair(pngPairAmt, WAVAXAmt);
    }

    function withdrawLydPair(uint sharePerc, uint[] calldata amountOutMin) private {
        // Current Lydia Pair: WETH-LYD
        (uint lydPairAmt,) = lydFarm.userInfo(19, address(this));
        lydFarm.withdraw(19, lydPairAmt * sharePerc / 1e18);

        (uint lydToken0Amt, uint lydToken1Amt) = lydRouter.removeLiquidity(
            address(lydToken0), address(lydToken1), lydPairAmt, 0, 0, address(this), block.timestamp
        );

        uint WAVAXAmt = swap(address(lydToken0), address(WAVAX), lydToken0Amt, amountOutMin[5]);
        WAVAXAmt += swap(address(lydToken1), address(WAVAX), lydToken1Amt, amountOutMin[6]);

        emit WithdrawLydPair(lydPairAmt, WAVAXAmt);
    }

    function collectProfitAndUpdateWatermark() public onlyVault returns (uint fee) {
        uint currentWatermark = getAllPoolInUSD();
        uint lastWatermark = watermark;
        if (currentWatermark > lastWatermark) {
            uint profit = currentWatermark - lastWatermark;
            fee = profit * profitFeePerc / 10000;
            watermark = currentWatermark;
        }

        emit CollectProfitAndUpdateWatermark(currentWatermark, lastWatermark, fee);
    }

    /// @param signs True for positive, false for negative
    function adjustWatermark(uint amount, bool signs) external onlyVault {
        uint lastWatermark = watermark;
        watermark = signs == true ? watermark + amount : watermark - amount;

        emit AdjustWatermark(watermark, lastWatermark);
    }

    /// @param amount Amount to reimburse to vault contract in AVAX
    function reimburse(uint farmIndex, uint amount, uint[] calldata amountOutMin) external onlyVault returns (uint WAVAXAmt) {
        if (farmIndex == 0) withdrawJoePair(amount * 1e18 / getJoePairPoolInAVAX(), amountOutMin);
        else if (farmIndex == 1) withdrawPngPair(amount * 1e18 / getPngPairPoolInAVAX(), amountOutMin);
        else if (farmIndex == 2) withdrawLydPair(amount * 1e18 / getLydPairPoolInAVAX(), amountOutMin);

        WAVAXAmt = WAVAX.balanceOf(address(this));
        WAVAX.safeTransfer(vault, WAVAXAmt);

        emit Reimburse(WAVAXAmt);
    }

    function swap(address from, address to, uint amount, uint amountOutMin) private returns (uint amountOut) {
        IRouter _router;
        if (from == address(PNG) ||to == address(PNG)) _router = pngRouter;
        else if (from == address(LYD) ||to == address(LYD)) _router = lydRouter;
        else _router = joeRouter;
        
        return _router.swapExactTokensForTokens(
            amount, amountOutMin, getPath(from, to), address(this), block.timestamp
        )[1];
    }

    function setVault(address _vault) external {
        require(vault == address(0), "Vault set");
        vault = _vault;
    }

    function setYieldAndProfitFeePerc(uint _yieldFeePerc, uint _profitFeePerc) external onlyVault {
        yieldFeePerc = _yieldFeePerc;
        profitFeePerc = _profitFeePerc;
    }

    function getPath(address tokenA, address tokenB) private pure returns (address[] memory path) {
        path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
    }

    function getJoePairPoolInAVAX() private view returns (uint WAVAXAmt) {
        // Current Joe Pair: YAK-WAVAX
        (uint joePairAmt,) = joeFarm.userInfo(1, address(this));
        if (joePairAmt == 0) return 0;

        (uint reserveToken0, uint reserveToken1,) = joePair.getReserves();
        uint YAKAmt = reserveToken0 * joePairAmt / joePair.totalSupply();
        WAVAXAmt = reserveToken1 * joePairAmt / joePair.totalSupply();

        uint WAVAXPerYAK = (joeRouter.getAmountsOut(1e15, getPath(address(joeToken0), address(WAVAX))))[1];
        WAVAXAmt += YAKAmt * WAVAXPerYAK / 1e15;
    }

    function getPngPairPoolInAVAX() private view returns (uint WAVAXAmt) {
        // Current Pangolin Pair: WAVAX-TIME
        uint pngPairAmt = pngFarm.balanceOf(address(this));
        if (pngPairAmt == 0) return 0;

        (uint reserveToken0, uint reserveToken1,) = pngPair.getReserves();
        WAVAXAmt = reserveToken0 * pngPairAmt / pngPair.totalSupply();
        uint TIMEAmt = reserveToken1 * pngPairAmt / pngPair.totalSupply();

        uint WAVAXPerTIME = (pngRouter.getAmountsOut(1e15, getPath(address(pngToken1), address(WAVAX))))[1];
        WAVAXAmt += TIMEAmt * WAVAXPerTIME / 1e15;
    }

    function getLydPairPoolInAVAX() private view returns (uint WAVAXAmt) {
        // Current Lydia Pair: WETH-LYD
        (uint lydPairAmt,) = lydFarm.userInfo(19, address(this));
        if (lydPairAmt == 0) return 0;

        (uint reserveToken0, uint reserveToken1,) = lydPair.getReserves();
        uint WETHAmt = reserveToken0 * lydPairAmt / lydPair.totalSupply();
        uint LYDAmt = reserveToken1 * lydPairAmt / lydPair.totalSupply();

        uint WAVAXPerWETH = (lydRouter.getAmountsOut(1e15, getPath(address(lydToken0), address(WAVAX))))[1];
        WAVAXAmt += WETHAmt * WAVAXPerWETH / 1e15;
        uint WAVAXPerLYD = (lydRouter.getAmountsOut(1e18, getPath(address(lydToken0), address(WAVAX))))[1];
        WAVAXAmt += LYDAmt * WAVAXPerLYD / 1e18;
    }

    function getEachPoolInAVAX() private view returns (uint[] memory pools) {
        pools = new uint[](3);
        pools[0] = getJoePairPoolInAVAX();
        pools[1] = getPngPairPoolInAVAX();
        pools[2] = getLydPairPoolInAVAX();
    }

    /// @notice This function return only farms TVL in AVAX
    function getAllPoolInAVAX() public view returns (uint) {
        uint[] memory pools = getEachPoolInAVAX();
        return pools[0] + pools[1] + pools[2];
    }

    function getAllPoolInUSD() public view returns (uint) {
        uint AVAXPriceInUSD = uint(IChainlink(0x0A77230d17318075983913bC2145DB16C7366156).latestAnswer()); // 8 decimals
        require(AVAXPriceInUSD > 0, "ChainLink error");

        return getAllPoolInAVAX() * AVAXPriceInUSD / 1e8;
    }
}