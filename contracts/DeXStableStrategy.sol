// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

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
}

interface ICurve {
    function exchange_underlying(int128 i, int128 j, uint dx, uint min_dy) external returns (uint);
}

interface IDaoL1Vault is IERC20Upgradeable {
    function deposit(uint amount) external;
    function withdraw(uint share) external returns (uint);
    function getAllPoolInUSD() external view returns (uint);
}

contract DeXStableStrategy is Initializable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable constant JOE = IERC20Upgradeable(0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd);
    IERC20Upgradeable constant PNG = IERC20Upgradeable(0x60781C2586D68229fde47564546784ab3fACA982);
    IERC20Upgradeable constant LYD = IERC20Upgradeable(0x4C9B4E1AC6F24CdE3660D5E4Ef1eBF77C710C084);
    IERC20Upgradeable constant USDT = IERC20Upgradeable(0xc7198437980c041c805A1EDcbA50c1Ce5db95118);
    IERC20Upgradeable constant USDC = IERC20Upgradeable(0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664);
    IERC20Upgradeable constant DAI = IERC20Upgradeable(0xd586E7F844cEa2F87f50152665BCbc2C279D8d70);

    IERC20Upgradeable constant JOEUSDC = IERC20Upgradeable(0x67926d973cD8eE876aD210fAaf7DFfA99E414aCf);
    IERC20Upgradeable constant PNGUSDT = IERC20Upgradeable(0x1fFB6ffC629f5D820DCf578409c2d26A2998a140);
    IERC20Upgradeable constant LYDDAI = IERC20Upgradeable(0x4EE072c5946B4cdc00CBdeB4A4E54A03CF6d08d3);

    IRouter constant joeRouter = IRouter(0x60aE616a2155Ee3d9A68541Ba4544862310933d4);
    IRouter constant pngRouter = IRouter(0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106);
    IRouter constant lydRouter = IRouter(0xA52aBE4676dbfd04Df42eF7755F01A3c41f28D27);
    ICurve constant curve = ICurve(0x7f90122BF0700F9E7e1F688fe926940E8839F353); // av3pool

    IDaoL1Vault public JOEUSDCVault;
    IDaoL1Vault public PNGUSDTVault;
    IDaoL1Vault public LYDDAIVault;

    address public vault;
    uint public watermark; // In USD (18 decimals)
    uint public profitFeePerc;

    event TargetComposition (uint JOEUSDCTargetPool, uint PNGUSDTTargetPool, uint LYDDAITargetPool);
    event CurrentComposition (uint JOEUSDCCCurrentPool, uint PNGUSDTCurrentPool, uint LYDDAICurrentPool);
    event InvestJOEUSDC(uint USDAmt, uint JOEUSDCAmt);
    event InvestPNGUSDT(uint USDAmt, uint PNGUSDTAmt);
    event InvestLYDDAI(uint USDAmt, uint LYDDAIAmt);
    event Withdraw(uint amount, uint USDAmt);
    event WithdrawJOEUSDC(uint lpTokenAmt, uint USDAmt);
    event WithdrawPNGUSDT(uint lpTokenAmt, uint USDAmt);
    event WithdrawLYDDAI(uint lpTokenAmt, uint USDAmt);
    event CollectProfitAndUpdateWatermark(uint currentWatermark, uint lastWatermark, uint fee);
    event AdjustWatermark(uint currentWatermark, uint lastWatermark);
    event Reimburse(uint USDAmt);
    event EmergencyWithdraw(uint USDAmt);

    modifier onlyVault {
        require(msg.sender == vault, "Only vault");
        _;
    }

    function initialize(
        address _JOEUSDCVault, address _PNGUSDTVault, address _LYDDAIVault
    ) external initializer {

        JOEUSDCVault = IDaoL1Vault(_JOEUSDCVault);
        PNGUSDTVault = IDaoL1Vault(_PNGUSDTVault);
        LYDDAIVault = IDaoL1Vault(_LYDDAIVault);

        profitFeePerc = 2000;

        USDC.safeApprove(address(joeRouter), type(uint).max);
        USDC.safeApprove(address(curve), type(uint).max);
        USDT.safeApprove(address(pngRouter), type(uint).max);
        USDT.safeApprove(address(curve), type(uint).max);
        DAI.safeApprove(address(lydRouter), type(uint).max);
        DAI.safeApprove(address(curve), type(uint).max);
        JOE.safeApprove(address(joeRouter), type(uint).max);
        PNG.safeApprove(address(pngRouter), type(uint).max);
        LYD.safeApprove(address(lydRouter), type(uint).max);

        JOEUSDC.safeApprove(address(JOEUSDCVault), type(uint).max);
        JOEUSDC.safeApprove(address(joeRouter), type(uint).max);
        PNGUSDT.safeApprove(address(PNGUSDTVault), type(uint).max);
        PNGUSDT.safeApprove(address(pngRouter), type(uint).max);
        LYDDAI.safeApprove(address(LYDDAIVault), type(uint).max);
        LYDDAI.safeApprove(address(lydRouter), type(uint).max);
    }

    function invest(uint USDTAmt, uint[] calldata amountsOutMin) external onlyVault {
        USDT.safeTransferFrom(vault, address(this), USDTAmt);

        uint[] memory pools = getEachPool();
        uint pool = pools[0] + pools[1] + pools[2] + USDTAmt;
        uint JOEUSDCTargetPool = pool * 8000 / 10000;
        uint PNGUSDTTargetPool = pool * 1000 / 10000;
        uint LYDDAITargetPool = pool * 1000 / 10000;

        // For this pool we don't rebalancing invest it first
        // since liquidity in PNG-USDT and LYD-DAI still quite low
        investJOEUSDC(USDTAmt * 8000 / 10000, amountsOutMin[3]);
        investPNGUSDT(USDTAmt * 1000 / 10000, amountsOutMin[4]);
        investLYDDAI(USDTAmt * 1000 / 10000, amountsOutMin[5]);

        // // Rebalancing invest
        // if (
        //     JOEUSDCTargetPool > pools[0] &&
        //     PNGUSDTTargetPool > pools[1] &&
        //     LYDDAITargetPool > pools[2]
        // ) {
        //     investJOEUSDC(JOEUSDCTargetPool - pools[0], amountsOutMin[3]);
        //     investPNGUSDT(PNGUSDTTargetPool - pools[1], amountsOutMin[4]);
        //     investLYDDAI(LYDDAITargetPool - pools[2], amountsOutMin[5]);
        // } else {
        //     uint furthest;
        //     uint farmIndex;
        //     uint diff;

        //     if (JOEUSDCTargetPool > pools[0]) {
        //         diff = JOEUSDCTargetPool - pools[0];
        //         furthest = diff;
        //         farmIndex = 0;
        //     }
        //     if (PNGUSDTTargetPool > pools[1]) {
        //         diff = PNGUSDTTargetPool - pools[1];
        //         if (diff > furthest) {
        //             furthest = diff;
        //             farmIndex = 1;
        //         }
        //     }
        //     if (LYDDAITargetPool > pools[2]) {
        //         diff = LYDDAITargetPool - pools[2];
        //         if (diff > furthest) {
        //             furthest = diff;
        //             farmIndex = 2;
        //         }
        //     }

        //     if (farmIndex == 0) investJOEUSDC(USDTAmt, amountsOutMin[3]);
        //     else if (farmIndex == 1) investPNGUSDT(USDTAmt, amountsOutMin[4]);
        //     else investLYDDAI(USDTAmt, amountsOutMin[5]);
        // }

        emit TargetComposition(JOEUSDCTargetPool, PNGUSDTTargetPool, LYDDAITargetPool);
        emit CurrentComposition(pools[0], pools[1], pools[2]);
    }

    function investJOEUSDC(uint USDTAmt, uint amountOutMin) private {
        uint USDCAmt = curve.exchange_underlying(
            getCurveId(address(USDT)), getCurveId(address(USDC)), USDTAmt, USDTAmt * 99 / 100
        );

        uint halfUSDC = USDCAmt / 2;
        uint JOEAmt = joeRouter.swapExactTokensForTokens(
            halfUSDC, amountOutMin, getPath(address(USDC), address(JOE)), address(this), block.timestamp
        )[1];

        (,,uint JOEUSDCAmt) = joeRouter.addLiquidity(
            address(JOE), address(USDC), JOEAmt, halfUSDC, 0, 0, address(this), block.timestamp
        );

        JOEUSDCVault.deposit(JOEUSDCAmt);

        emit InvestJOEUSDC(USDTAmt, JOEUSDCAmt);
    }

    function investPNGUSDT(uint USDTAmt, uint amountOutMin) private {
        uint halfUSDT = USDTAmt / 2;
        uint PNGAmt = pngRouter.swapExactTokensForTokens(
            halfUSDT, amountOutMin, getPath(address(USDT), address(PNG)), address(this), block.timestamp
        )[1];

        (,,uint PNGUSDTAmt) = pngRouter.addLiquidity(
            address(PNG), address(USDT), PNGAmt, halfUSDT, 0, 0, address(this), block.timestamp
        );

        PNGUSDTVault.deposit(PNGUSDTAmt);

        emit InvestPNGUSDT(USDTAmt, PNGUSDTAmt);
    }

    function investLYDDAI(uint USDTAmt, uint amountOutMin) private {
        uint DAIAmt = curve.exchange_underlying(
            getCurveId(address(USDT)), getCurveId(address(DAI)), USDTAmt, USDTAmt * 1e12 * 99 / 100
        );

        uint halfDAI = DAIAmt / 2;
        uint LYDAmt = lydRouter.swapExactTokensForTokens(
            halfDAI, amountOutMin, getPath(address(DAI), address(LYD)), address(this), block.timestamp
        )[1];

        (,,uint LYDDAIAmt) = lydRouter.addLiquidity(
            address(LYD), address(DAI), LYDAmt, halfDAI, 0, 0, address(this), block.timestamp
        );
        
        LYDDAIVault.deposit(LYDDAIAmt);

        emit InvestLYDDAI(USDTAmt, LYDDAIAmt);
    }

    /// @param amount Amount to withdraw in USD
    function withdraw(uint amount, uint[] calldata amountsOutMin) external onlyVault returns (uint USDTAmt) {
        uint sharePerc = amount * 1e18 / getAllPoolInUSD();

        uint USDTAmtBefore = USDT.balanceOf(address(this));
        withdrawJOEUSDC(sharePerc, amountsOutMin[1]);
        withdrawPNGUSDT(sharePerc, amountsOutMin[2]);
        withdrawLYDDAI(sharePerc, amountsOutMin[3]);
        USDTAmt = USDT.balanceOf(address(this)) - USDTAmtBefore;

        USDT.safeTransfer(vault, USDTAmt);

        emit Withdraw(amount, USDTAmt);
    }

    function withdrawJOEUSDC(uint sharePerc, uint amountOutMin) private {
        uint JOEUSDCAmt = JOEUSDCVault.withdraw(JOEUSDCVault.balanceOf(address(this)) * sharePerc / 1e18);

        (uint JOEAmt, uint USDCAmt) = joeRouter.removeLiquidity(
            address(JOE), address(USDC), JOEUSDCAmt, 0, 0, address(this), block.timestamp
        );

        USDCAmt += joeRouter.swapExactTokensForTokens(
            JOEAmt, amountOutMin, getPath(address(JOE), address(USDC)), address(this), block.timestamp
        )[1];
        
        uint USDTAmt = curve.exchange_underlying(
            getCurveId(address(USDC)), getCurveId(address(USDT)), USDCAmt, USDCAmt * 99 / 100
        );

        emit WithdrawJOEUSDC(JOEUSDCAmt, USDTAmt);
    }

    function withdrawPNGUSDT(uint sharePerc, uint amountOutMin) private {
        uint PNGUSDTAmt = PNGUSDTVault.withdraw(PNGUSDTVault.balanceOf(address(this)) * sharePerc / 1e18);

        (uint PNGAmt, uint USDTAmt) = pngRouter.removeLiquidity(
            address(PNG), address(USDT), PNGUSDTAmt, 0, 0, address(this), block.timestamp
        );

        USDTAmt += pngRouter.swapExactTokensForTokens(
            PNGAmt, amountOutMin, getPath(address(PNG), address(USDT)), address(this), block.timestamp
        )[1];

        emit WithdrawPNGUSDT(PNGUSDTAmt, USDTAmt);
    }

    function withdrawLYDDAI(uint sharePerc, uint amountOutMin) private {
        uint LYDDAIAmt = LYDDAIVault.withdraw(LYDDAIVault.balanceOf(address(this)) * sharePerc / 1e18);

        (uint LYDAmt, uint DAIAmt) = lydRouter.removeLiquidity(
            address(LYD), address(DAI), LYDDAIAmt, 0, 0, address(this), block.timestamp
        );

        DAIAmt += lydRouter.swapExactTokensForTokens(
            LYDAmt, amountOutMin, getPath(address(LYD), address(DAI)), address(this), block.timestamp
        )[1];

        uint USDTAmt = curve.exchange_underlying(
            getCurveId(address(DAI)), getCurveId(address(USDT)), DAIAmt, (DAIAmt / 1e12) * 99 / 100
        );

        emit WithdrawLYDDAI(LYDDAIAmt, USDTAmt);
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

    /// @param amount Amount to reimburse to vault contract in USDT
    function reimburse(uint farmIndex, uint amount, uint amountOutMin) external onlyVault returns (uint USDTAmt) {
        if (farmIndex == 0) withdrawJOEUSDC(amount * 1e18 / getJOEUSDCPool(), amountOutMin);
        else if (farmIndex == 1) withdrawPNGUSDT(amount * 1e18 / getPNGUSDTPool(), amountOutMin);
        else if (farmIndex == 2) withdrawLYDDAI(amount * 1e18 / getLYDDAIPool(), amountOutMin);

        USDTAmt = USDT.balanceOf(address(this));
        USDT.safeTransfer(vault, USDTAmt);

        emit Reimburse(USDTAmt);
    }

    function emergencyWithdraw() external onlyVault {
        // 1e18 == 100% of share
        withdrawJOEUSDC(1e18, 0);
        withdrawPNGUSDT(1e18, 0);
        withdrawLYDDAI(1e18, 0);

        uint USDTAmt = USDT.balanceOf(address(this));
        USDT.safeTransfer(vault, USDTAmt);
        watermark = 0;

        emit EmergencyWithdraw(USDTAmt);
    }

    function setVault(address _vault) external {
        require(vault == address(0), "Vault set");
        vault = _vault;
    }

    function setProfitFeePerc(uint _profitFeePerc) external onlyVault {
        profitFeePerc = _profitFeePerc;
    }

    function getPath(address tokenA, address tokenB) private pure returns (address[] memory path) {
        path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
    }

    function getCurveId(address token) private pure returns (int128) {
        if (token == address(USDT)) return 2;
        else if (token == address(USDC)) return 1;
        else return 0; // DAI
    }

    function getJOEUSDCPool() private view returns (uint) {
        uint JOEUSDCVaultPool = JOEUSDCVault.getAllPoolInUSD();
        if (JOEUSDCVaultPool == 0) return 0;
        return JOEUSDCVaultPool * JOEUSDCVault.balanceOf(address(this)) / JOEUSDCVault.totalSupply();
    }

    function getPNGUSDTPool() private view returns (uint) {
        uint PNGUSDTVaultPool = PNGUSDTVault.getAllPoolInUSD();
        if (PNGUSDTVaultPool == 0) return 0;
        return PNGUSDTVaultPool * PNGUSDTVault.balanceOf(address(this)) / PNGUSDTVault.totalSupply();
    }

    function getLYDDAIPool() private view returns (uint) {
        uint LYDDAIVaultPool = LYDDAIVault.getAllPoolInUSD();
        if (LYDDAIVaultPool == 0) return 0;
        return LYDDAIVaultPool * LYDDAIVault.balanceOf(address(this)) / LYDDAIVault.totalSupply();
    }

    function getEachPool() private view returns (uint[] memory pools) {
        pools = new uint[](3);
        pools[0] = getJOEUSDCPool();
        pools[1] = getPNGUSDTPool();
        pools[2] = getLYDDAIPool();
    }

    function getAllPoolInUSD() public view returns (uint) {
        uint[] memory pools = getEachPool();
        return pools[0] + pools[1] + pools[2];
    }

    function getCurrentCompositionPerc() external view returns (uint[] memory percentages) {
        uint[] memory pools = getEachPool();
        uint allPool = pools[0] + pools[1] + pools[2];
        percentages = new uint[](3);
        percentages[0] = pools[0] * 10000 / allPool;
        percentages[1] = pools[1] * 10000 / allPool;
        percentages[2] = pools[2] * 10000 / allPool;
    }
}