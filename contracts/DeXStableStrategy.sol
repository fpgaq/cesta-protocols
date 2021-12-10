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

    IERC20Upgradeable constant JOEUSDC = IERC20Upgradeable(0x67926d973cD8eE876aD210fAaf7DFfA99E414aCf); // Depreciated
    IERC20Upgradeable constant JOEUSDT = IERC20Upgradeable(0x1643de2efB8e35374D796297a9f95f64C082a8ce); // Replace JOEUSDC
    IERC20Upgradeable constant PNGUSDT = IERC20Upgradeable(0x1fFB6ffC629f5D820DCf578409c2d26A2998a140); // Depreciated
    IERC20Upgradeable constant PNGUSDC = IERC20Upgradeable(0xC33Ac18900b2f63DFb60B554B1F53Cd5b474d4cd); // Replace PNGUSDT
    IERC20Upgradeable constant LYDDAI = IERC20Upgradeable(0x4EE072c5946B4cdc00CBdeB4A4E54A03CF6d08d3);

    IRouter constant joeRouter = IRouter(0x60aE616a2155Ee3d9A68541Ba4544862310933d4);
    IRouter constant pngRouter = IRouter(0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106);
    IRouter constant lydRouter = IRouter(0xA52aBE4676dbfd04Df42eF7755F01A3c41f28D27);
    ICurve constant curve = ICurve(0x7f90122BF0700F9E7e1F688fe926940E8839F353); // av3pool

    IDaoL1Vault public JOEUSDCVault; // Depreciated
    IDaoL1Vault public PNGUSDTVault; // Depreciated
    IDaoL1Vault public LYDDAIVault;

    address public vault;

    // Newly variable added after upgrade
    IDaoL1Vault public JOEUSDTVault; // Replace JOEUSDC
    IDaoL1Vault public PNGUSDCVault; // Replace PNGUSDT
    uint public watermark; // In USD (18 decimals)
    uint public profitFeePerc;

    event TargetComposition (uint JOEUSDTTargetPool, uint PNGUSDCTargetPool, uint LYDDAITargetPool);
    event CurrentComposition (uint JOEUSDTCCurrentPool, uint PNGUSDCCurrentPool, uint LYDDAICurrentPool);
    event InvestJOEUSDT(uint USDAmt, uint JOEUSDTAmt);
    event InvestPNGUSDC(uint USDAmt, uint PNGUSDCAmt);
    event InvestLYDDAI(uint USDAmt, uint LYDDAIAmt);
    event Withdraw(uint amount, uint USDAmt);
    event WithdrawJOEUSDT(uint lpTokenAmt, uint USDAmt);
    event WithdrawPNGUSDC(uint lpTokenAmt, uint USDAmt);
    event WithdrawLYDDAI(uint lpTokenAmt, uint USDAmt);
    event CollectProfitAndUpdateWatermark(uint currentWatermark, uint lastWatermark, uint fee);
    event AdjustWatermark(uint currentWatermark, uint lastWatermark);
    event EmergencyWithdraw(uint USDAmt);

    modifier onlyVault {
        require(msg.sender == vault, "Only vault");
        _;
    }

    // function initialize(
    //     address _JOEUSDCVault, address _PNGUSDTVault, address _LYDDAIVault
    // ) external initializer {

    //     JOEUSDCVault = IDaoL1Vault(_JOEUSDCVault);
    //     PNGUSDTVault = IDaoL1Vault(_PNGUSDTVault);
    //     LYDDAIVault = IDaoL1Vault(_LYDDAIVault);

    //     USDC.safeApprove(address(joeRouter), type(uint).max);
    //     USDC.safeApprove(address(curve), type(uint).max);
    //     USDT.safeApprove(address(pngRouter), type(uint).max);
    //     USDT.safeApprove(address(curve), type(uint).max);
    //     DAI.safeApprove(address(lydRouter), type(uint).max);
    //     DAI.safeApprove(address(curve), type(uint).max);
    //     JOE.safeApprove(address(joeRouter), type(uint).max);
    //     PNG.safeApprove(address(pngRouter), type(uint).max);
    //     LYD.safeApprove(address(lydRouter), type(uint).max);

    //     JOEUSDC.safeApprove(address(JOEUSDCVault), type(uint).max);
    //     JOEUSDC.safeApprove(address(joeRouter), type(uint).max);
    //     PNGUSDT.safeApprove(address(PNGUSDTVault), type(uint).max);
    //     PNGUSDT.safeApprove(address(pngRouter), type(uint).max);
    //     LYDDAI.safeApprove(address(LYDDAIVault), type(uint).max);
    //     LYDDAI.safeApprove(address(lydRouter), type(uint).max);
    // }

    function invest(uint USDTAmt, uint[] calldata amountsOutMin) external onlyVault {
        USDT.safeTransferFrom(vault, address(this), USDTAmt);

        uint[] memory pools = getEachPool();
        uint pool = pools[0] + pools[1] + pools[2] + USDTAmt;
        uint JOEUSDTTargetPool = pool * 6000 / 10000;
        uint PNGUSDCTargetPool = pool * 3000 / 10000;
        uint LYDDAITargetPool = pool * 1000 / 10000;

        // For this pool we don't rebalancing invest it first
        // since liquidity in LYD-DAI still quite low
        investJOEUSDT(USDTAmt * 6000 / 10000, amountsOutMin[1]);
        investPNGUSDC(USDTAmt * 3000 / 10000, amountsOutMin[2]);
        investLYDDAI(USDTAmt * 1000 / 10000, amountsOutMin[3]);

        // // Rebalancing invest
        // if (
        //     JOEUSDTTargetPool > pools[0] &&
        //     PNGUSDCTargetPool > pools[1] &&
        //     LYDDAITargetPool > pools[2]
        // ) {
        //     investJOEUSDT(JOEUSDTTargetPool - pools[0], amountsOutMin[3]);
        //     investPNGUSDC(PNGUSDCTargetPool - pools[1], amountsOutMin[4]);
        //     investLYDDAI(LYDDAITargetPool - pools[2], amountsOutMin[5]);
        // } else {
        //     uint furthest;
        //     uint farmIndex;
        //     uint diff;

        //     if (JOEUSDTTargetPool > pools[0]) {
        //         diff = JOEUSDTTargetPool - pools[0];
        //         furthest = diff;
        //         farmIndex = 0;
        //     }
        //     if (PNGUSDCTargetPool > pools[1]) {
        //         diff = PNGUSDCTargetPool - pools[1];
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

        //     if (farmIndex == 0) investJOEUSDT(USDTAmt, amountsOutMin[1]);
        //     else if (farmIndex == 1) investPNGUSDC(USDTAmt, amountsOutMin[2]);
        //     else investLYDDAI(USDTAmt, amountsOutMin[3]);
        // }

        emit TargetComposition(JOEUSDTTargetPool, PNGUSDCTargetPool, LYDDAITargetPool);
        emit CurrentComposition(pools[0], pools[1], pools[2]);
    }

    function investJOEUSDT(uint USDTAmt, uint amountOutMin) private {
        uint halfUSDT = USDTAmt / 2;
        uint JOEAmt = joeRouter.swapExactTokensForTokens(
            halfUSDT, amountOutMin, getPath(address(USDT), address(JOE)), address(this), block.timestamp
        )[1];

        (,,uint JOEUSDTAmt) = joeRouter.addLiquidity(
            address(JOE), address(USDT), JOEAmt, halfUSDT, 0, 0, address(this), block.timestamp
        );

        JOEUSDTVault.deposit(JOEUSDTAmt);

        emit InvestJOEUSDT(USDTAmt, JOEUSDTAmt);
    }

    function investPNGUSDC(uint USDTAmt, uint amountOutMin) private {
        uint USDCAmt = curve.exchange_underlying(
            getCurveId(address(USDT)), getCurveId(address(USDC)), USDTAmt, USDTAmt * 99 / 100
        );

        uint halfUSDC = USDCAmt / 2;
        uint PNGAmt = pngRouter.swapExactTokensForTokens(
            halfUSDC, amountOutMin, getPath(address(USDC), address(PNG)), address(this), block.timestamp
        )[1];

        (,,uint PNGUSDCAmt) = pngRouter.addLiquidity(
            address(PNG), address(USDC), PNGAmt, halfUSDC, 0, 0, address(this), block.timestamp
        );

        PNGUSDCVault.deposit(PNGUSDCAmt);

        emit InvestPNGUSDC(USDTAmt, PNGUSDCAmt);
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
        withdrawJOEUSDT(sharePerc, amountsOutMin[1]);
        withdrawPNGUSDC(sharePerc, amountsOutMin[2]);
        withdrawLYDDAI(sharePerc, amountsOutMin[3]);
        USDTAmt = USDT.balanceOf(address(this)) - USDTAmtBefore;

        USDT.safeTransfer(vault, USDTAmt);

        emit Withdraw(amount, USDTAmt);
    }

    function withdrawJOEUSDT(uint sharePerc, uint amountOutMin) private {
        uint JOEUSDTAmt = JOEUSDTVault.withdraw(JOEUSDTVault.balanceOf(address(this)) * sharePerc / 1e18);

        (uint JOEAmt, uint USDTAmt) = joeRouter.removeLiquidity(
            address(JOE), address(USDT), JOEUSDTAmt, 0, 0, address(this), block.timestamp
        );

        USDTAmt += joeRouter.swapExactTokensForTokens(
            JOEAmt, amountOutMin, getPath(address(JOE), address(USDT)), address(this), block.timestamp
        )[1];

        emit WithdrawJOEUSDT(JOEUSDTAmt, USDTAmt);
    }

    function withdrawPNGUSDC(uint sharePerc, uint amountOutMin) private {
        uint PNGUSDCAmt = PNGUSDCVault.withdraw(PNGUSDCVault.balanceOf(address(this)) * sharePerc / 1e18);

        (uint PNGAmt, uint USDCAmt) = pngRouter.removeLiquidity(
            address(PNG), address(USDC), PNGUSDCAmt, 0, 0, address(this), block.timestamp
        );

        USDCAmt += pngRouter.swapExactTokensForTokens(
            PNGAmt, amountOutMin, getPath(address(PNG), address(USDC)), address(this), block.timestamp
        )[1];

        uint USDTAmt = curve.exchange_underlying(
            getCurveId(address(USDC)), getCurveId(address(USDT)), USDCAmt, USDCAmt * 99 / 100
        );

        emit WithdrawPNGUSDC(PNGUSDCAmt, USDTAmt);
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

    function emergencyWithdraw() external onlyVault {
        // 1e18 == 100% of share
        withdrawJOEUSDT(1e18, 0);
        withdrawPNGUSDC(1e18, 0);
        withdrawLYDDAI(1e18, 0);

        uint USDTAmt = USDT.balanceOf(address(this));
        USDT.safeTransfer(vault, USDTAmt);
        watermark = 0;

        emit EmergencyWithdraw(USDTAmt);
    }

    /// @notice Migrate funds JOEUSDC->JOEUSDT, PNGUSDT->PNGUSDC, to solve liquidity issue
    function migrateFunds(IDaoL1Vault _JOEUSDTVault, IDaoL1Vault _PNGUSDCVault) external {
        require(msg.sender == 0x3f68A3c1023d736D8Be867CA49Cb18c543373B99, "admin only");

        // Withdraw from JOEUSDCVault and swap USDC to USDT
        // uint JOEUSDCAmt = JOEUSDCVault.withdraw(JOEUSDCVault.balanceOf(address(this)));
        // (uint JOEAmt, uint USDCAmt) = joeRouter.removeLiquidity(
        //     address(JOE), address(USDC), JOEUSDCAmt, 0, 0, address(this), block.timestamp
        // );
        // uint USDTAmt = curve.exchange_underlying(
        //     getCurveId(address(USDC)), getCurveId(address(USDT)), USDCAmt, USDCAmt * 99 / 100
        // );
        // Add liquidity to JOEUSDT and deposit into JOEUSDTVault
        USDT.safeApprove(address(joeRouter), type(uint).max);
        // (,,uint JOEUSDTAmt) = joeRouter.addLiquidity(
        //     address(JOE), address(USDT), JOEAmt, USDTAmt, 0, 0, address(this), block.timestamp
        // );
        JOEUSDTVault = _JOEUSDTVault;
        JOEUSDT.safeApprove(address(_JOEUSDTVault), type(uint).max);
        JOEUSDT.safeApprove(address(joeRouter), type(uint).max);
        // JOEUSDTVault.deposit(JOEUSDTAmt);

        // Withdraw from PNGUSDTVault and swap USDT to USDC
        // uint PNGUSDTAmt = PNGUSDTVault.withdraw(PNGUSDTVault.balanceOf(address(this)));
        // (uint PNGAmt, uint _USDTAmt) = pngRouter.removeLiquidity(
        //     address(PNG), address(USDT), PNGUSDTAmt, 0, 0, address(this), block.timestamp
        // );
        // uint _USDCAmt = curve.exchange_underlying(
        //     getCurveId(address(USDT)), getCurveId(address(USDC)), _USDTAmt, _USDTAmt * 99 / 100
        // );
        // Add liquidity to PNGUSDC and deposit into PNGUSDCVault
        USDC.safeApprove(address(pngRouter), type(uint).max);
        // (,,uint PNGUSDCAmt) = pngRouter.addLiquidity(
        //     address(PNG), address(USDC), PNGAmt, _USDCAmt, 0, 0, address(this), block.timestamp
        // );
        PNGUSDCVault = _PNGUSDCVault;
        PNGUSDC.safeApprove(address(_PNGUSDCVault), type(uint).max);
        PNGUSDC.safeApprove(address(pngRouter), type(uint).max);
        // PNGUSDCVault.deposit(PNGUSDCAmt);
    }

    function collectProfitAndUpdateWatermark() external onlyVault returns (uint fee, uint allPoolInUSDAfterFee) {
        uint currentWatermark = getAllPoolInUSD();
        uint lastWatermark = watermark;
        if (currentWatermark > lastWatermark) {
            uint profit = currentWatermark - lastWatermark;
            fee = profit * profitFeePerc / 10000;
            watermark = currentWatermark;
        }
        allPoolInUSDAfterFee = currentWatermark - fee;

        emit CollectProfitAndUpdateWatermark(currentWatermark, lastWatermark, fee);
    }

    /// @param signs True for positive, false for negative
    function adjustWatermark(uint amount, bool signs) external onlyVault {
        uint lastWatermark = watermark;
        watermark = signs == true ? watermark + amount : watermark - amount;

        emit AdjustWatermark(watermark, lastWatermark);
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

    function getJOEUSDTPool() private view returns (uint) {
        uint JOEUSDTVaultPool = JOEUSDTVault.getAllPoolInUSD();
        if (JOEUSDTVaultPool == 0) return 0;
        return JOEUSDTVaultPool * JOEUSDTVault.balanceOf(address(this)) / JOEUSDTVault.totalSupply();
    }

    function getPNGUSDCPool() private view returns (uint) {
        uint PNGUSDCVaultPool = PNGUSDCVault.getAllPoolInUSD();
        if (PNGUSDCVaultPool == 0) return 0;
        return PNGUSDCVaultPool * PNGUSDCVault.balanceOf(address(this)) / PNGUSDCVault.totalSupply();
    }

    function getLYDDAIPool() private view returns (uint) {
        uint LYDDAIVaultPool = LYDDAIVault.getAllPoolInUSD();
        if (LYDDAIVaultPool == 0) return 0;
        return LYDDAIVaultPool * LYDDAIVault.balanceOf(address(this)) / LYDDAIVault.totalSupply();
    }

    function getEachPool() public view returns (uint[] memory pools) {
        pools = new uint[](3);
        pools[0] = getJOEUSDTPool();
        pools[1] = getPNGUSDCPool();
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