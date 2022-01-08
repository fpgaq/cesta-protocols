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
    function exchange(int128 i, int128 j, uint dx, uint min_dy) external returns (uint);
    function exchange_underlying(int128 i, int128 j, uint dx, uint min_dy) external returns (uint);
}

interface IDaoL1Vault is IERC20Upgradeable {
    function deposit(uint amount) external;
    function withdraw(uint share) external returns (uint);
    function getAllPoolInAVAX() external view returns (uint);
    function getAllPoolInUSD() external view returns (uint);
}

contract StableAvaxStrategy is Initializable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable constant USDT = IERC20Upgradeable(0xc7198437980c041c805A1EDcbA50c1Ce5db95118);
    IERC20Upgradeable constant USDC = IERC20Upgradeable(0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664);
    IERC20Upgradeable constant DAI = IERC20Upgradeable(0xd586E7F844cEa2F87f50152665BCbc2C279D8d70);
    IERC20Upgradeable constant MIM = IERC20Upgradeable(0x130966628846BFd36ff31a822705796e8cb8C18D);
    IERC20Upgradeable constant WAVAX = IERC20Upgradeable(0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7);

    IERC20Upgradeable constant USDTAVAX = IERC20Upgradeable(0x5Fc70cF6A4A858Cf4124013047e408367EBa1ace);
    IERC20Upgradeable constant USDCAVAX = IERC20Upgradeable(0xbd918Ed441767fe7924e99F6a0E0B568ac1970D9);
    IERC20Upgradeable constant DAIAVAX = IERC20Upgradeable(0x87Dee1cC9FFd464B79e058ba20387c1984aed86a); // Depreciated
    IERC20Upgradeable constant MIMAVAX = IERC20Upgradeable(0x239aAE4AaBB5D60941D7DFFAeaFE8e063C63Ab25); // Replace DAIAVAX

    IRouter constant joeRouter = IRouter(0x60aE616a2155Ee3d9A68541Ba4544862310933d4);
    IRouter constant pngRouter = IRouter(0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106);
    IRouter constant lydRouter = IRouter(0xA52aBE4676dbfd04Df42eF7755F01A3c41f28D27);
    ICurve constant curve = ICurve(0xAEA2E71b631fA93683BCF256A8689dFa0e094fcD); // 3poolV2

    IDaoL1Vault public USDTAVAXVault;
    IDaoL1Vault public USDCAVAXVault;
    IDaoL1Vault public DAIAVAXVault; // Depreciated

    address public vault;
    uint public watermark; // In USD (18 decimals)
    uint public profitFeePerc;

    // Newly added variable after upgrade
    IDaoL1Vault public MIMAVAXVault; // Replace DAIAVAXVault

    event InvestUSDTAVAX(uint USDAmt, uint USDTAVAXAmt);
    event InvestUSDCAVAX(uint USDAmt, uint USDCAVAXAmt);
    event InvestMIMAVAX(uint USDAmt, uint MIMAVAXAmt);
    event Withdraw(uint amount, uint USDAmt);
    event WithdrawUSDTAVAX(uint lpTokenAmt, uint USDAmt);
    event WithdrawUSDCAVAX(uint lpTokenAmt, uint USDAmt);
    event WithdrawMIMAVAX(uint lpTokenAmt, uint USDAmt);
    event CollectProfitAndUpdateWatermark(uint currentWatermark, uint lastWatermark, uint fee);
    event AdjustWatermark(uint currentWatermark, uint lastWatermark);
    event EmergencyWithdraw(uint USDAmt);

    modifier onlyVault {
        require(msg.sender == vault, "Only vault");
        _;
    }

    // function initialize(
    //     address _USDTAVAXVault, address _USDCAVAXVault, address _DAIAVAXVault
    // ) external initializer {

    //     USDTAVAXVault = IDaoL1Vault(_USDTAVAXVault);
    //     USDCAVAXVault = IDaoL1Vault(_USDCAVAXVault);
    //     DAIAVAXVault = IDaoL1Vault(_DAIAVAXVault);

    //     USDT.safeApprove(address(lydRouter), type(uint).max);
    //     USDT.safeApprove(address(curve), type(uint).max);
    //     USDC.safeApprove(address(pngRouter), type(uint).max);
    //     USDC.safeApprove(address(curve), type(uint).max);
    //     DAI.safeApprove(address(joeRouter), type(uint).max);
    //     DAI.safeApprove(address(curve), type(uint).max);
    //     WAVAX.safeApprove(address(lydRouter), type(uint).max);
    //     WAVAX.safeApprove(address(pngRouter), type(uint).max);
    //     WAVAX.safeApprove(address(joeRouter), type(uint).max);

    //     USDTAVAX.safeApprove(address(USDTAVAXVault), type(uint).max);
    //     USDTAVAX.safeApprove(address(lydRouter), type(uint).max);
    //     USDCAVAX.safeApprove(address(USDCAVAXVault), type(uint).max);
    //     USDCAVAX.safeApprove(address(pngRouter), type(uint).max);
    //     DAIAVAX.safeApprove(address(DAIAVAXVault), type(uint).max);
    //     DAIAVAX.safeApprove(address(joeRouter), type(uint).max);
    // }

    function invest(uint USDTAmt, uint[] calldata amountsOutMin) external onlyVault {
        USDT.safeTransferFrom(vault, address(this), USDTAmt);

        // Stablecoins-AVAX farm don't need rebalance invest
        investUSDTAVAX(USDTAmt * 500 / 10000, amountsOutMin[1]);
        investUSDCAVAX(USDTAmt * 8000 / 10000, amountsOutMin[2]);
        investMIMAVAX(USDTAmt * 1500 / 10000, amountsOutMin[3]);
    }

    function investUSDTAVAX(uint USDTAmt, uint amountOutMin) private {
        uint halfUSDT = USDTAmt / 2;

        uint WAVAXAmt = lydRouter.swapExactTokensForTokens(
            halfUSDT, amountOutMin, getPath(address(USDT), address(WAVAX)), address(this), block.timestamp
        )[1];

        (,,uint USDTAVAXAmt) = lydRouter.addLiquidity(
            address(USDT), address(WAVAX), halfUSDT, WAVAXAmt, 0, 0, address(this), block.timestamp
        );

        USDTAVAXVault.deposit(USDTAVAXAmt);

        emit InvestUSDTAVAX(USDTAmt, USDTAVAXAmt);
    }

    function investUSDCAVAX(uint USDTAmt, uint amountOutMin) private {
        uint USDCAmt = curve.exchange(
            getCurveId(address(USDT)), getCurveId(address(USDC)), USDTAmt, USDTAmt * 99 / 100
        );
        uint halfUSDC = USDCAmt / 2;

        uint WAVAXAmt = pngRouter.swapExactTokensForTokens(
            halfUSDC, amountOutMin, getPath(address(USDC), address(WAVAX)), address(this), block.timestamp
        )[1];

        (,,uint USDCAVAXAmt) = pngRouter.addLiquidity(
            address(USDC), address(WAVAX), halfUSDC, WAVAXAmt, 0, 0, address(this), block.timestamp
        );

        USDCAVAXVault.deposit(USDCAVAXAmt);

        emit InvestUSDCAVAX(USDTAmt, USDCAVAXAmt);
    }

    function investMIMAVAX(uint USDTAmt, uint amountOutMin) private {
        uint MIMAmt = curve.exchange(
            getCurveId(address(USDT)), getCurveId(address(MIM)), USDTAmt, (USDTAmt * 1e12) * 99 / 100
        );
        uint halfMIM = MIMAmt / 2;

        uint WAVAXAmt = pngRouter.swapExactTokensForTokens(
            halfMIM, amountOutMin, getPath(address(MIM), address(WAVAX)), address(this), block.timestamp
        )[1];

        (,,uint MIMAVAXAmt) = pngRouter.addLiquidity(
            address(MIM), address(WAVAX), halfMIM, WAVAXAmt, 0, 0, address(this), block.timestamp
        );

        MIMAVAXVault.deposit(MIMAVAXAmt);

        emit InvestMIMAVAX(USDTAmt, MIMAVAXAmt);
    }

    /// @param amount Amount to withdraw in USD
    function withdraw(uint amount, uint[] calldata amountsOutMin) external onlyVault returns (uint USDTAmt) {
        uint sharePerc = amount * 1e18 / getAllPoolInUSD();

        uint USDTAmtBefore = USDT.balanceOf(address(this));
        withdrawUSDTAVAX(sharePerc, amountsOutMin[1]);
        withdrawUSDCAVAX(sharePerc, amountsOutMin[2]);
        withdrawMIMAVAX(sharePerc, amountsOutMin[3]);
        USDTAmt = USDT.balanceOf(address(this)) - USDTAmtBefore;
        
        USDT.safeTransfer(vault, USDTAmt);

        emit Withdraw(amount, USDTAmt);
    }

    function withdrawUSDTAVAX(uint sharePerc, uint amountOutMin) private {
        uint USDTAVAXAmt = USDTAVAXVault.withdraw(USDTAVAXVault.balanceOf(address(this)) * sharePerc / 1e18);

        (uint WAVAXAmt, uint USDTAmt) = lydRouter.removeLiquidity(
            address(WAVAX), address(USDT), USDTAVAXAmt, 0, 0, address(this), block.timestamp
        );

        USDTAmt += lydRouter.swapExactTokensForTokens(
            WAVAXAmt, amountOutMin, getPath(address(WAVAX), address(USDT)), address(this), block.timestamp
        )[1];

        emit WithdrawUSDTAVAX(USDTAVAXAmt, USDTAmt);
    }

    function withdrawUSDCAVAX(uint sharePerc, uint amountOutMin) private {
        uint USDCAVAXAmt = USDCAVAXVault.withdraw(USDCAVAXVault.balanceOf(address(this)) * sharePerc / 1e18);

        (uint USDCAmt, uint WAVAXAmt) = pngRouter.removeLiquidity(
            address(USDC), address(WAVAX), USDCAVAXAmt, 0, 0, address(this), block.timestamp
        );

        USDCAmt += pngRouter.swapExactTokensForTokens(
            WAVAXAmt, amountOutMin, getPath(address(WAVAX), address(USDC)), address(this), block.timestamp
        )[1];

        uint USDTAmt = curve.exchange(
            getCurveId(address(USDC)), getCurveId(address(USDT)), USDCAmt, USDCAmt * 99 / 100
        );

        emit WithdrawUSDCAVAX(USDCAVAXAmt, USDTAmt);
    }

    function withdrawMIMAVAX(uint sharePerc, uint amountOutMin) private {
        uint MIMAVAXAmt = MIMAVAXVault.withdraw(MIMAVAXVault.balanceOf(address(this)) * sharePerc / 1e18);

        (uint MIMAmt, uint WAVAXAmt) = pngRouter.removeLiquidity(
            address(MIM), address(WAVAX), MIMAVAXAmt, 0, 0, address(this), block.timestamp
        );

        MIMAmt += pngRouter.swapExactTokensForTokens(
            WAVAXAmt, amountOutMin, getPath(address(WAVAX), address(MIM)), address(this), block.timestamp
        )[1];

        uint USDTAmt = curve.exchange(
            getCurveId(address(MIM)), getCurveId(address(USDT)), MIMAmt, (MIMAmt / 1e12) * 99 / 100
        );

        emit WithdrawMIMAVAX(MIMAVAXAmt, USDTAmt);
    }

    function emergencyWithdraw() external onlyVault {
        // 1e18 == 100% of share
        withdrawUSDTAVAX(1e18, 0);
        withdrawUSDCAVAX(1e18, 0);
        withdrawMIMAVAX(1e18, 0);

        uint USDTAmt = USDT.balanceOf(address(this));
        USDT.safeTransfer(vault, USDTAmt);
        watermark = 0;

        emit EmergencyWithdraw(USDTAmt);
    }

    function collectProfitAndUpdateWatermark() external onlyVault returns (uint fee, uint allPoolInUSD) {
        uint currentWatermark = getAllPoolInUSD();
        uint lastWatermark = watermark;
        if (currentWatermark > lastWatermark) {
            uint profit = currentWatermark - lastWatermark;
            fee = profit * profitFeePerc / 10000;
            watermark = currentWatermark;
        }
        allPoolInUSD = currentWatermark;

        emit CollectProfitAndUpdateWatermark(currentWatermark, lastWatermark, fee);
    }

    /// @param signs True for positive, false for negative
    function adjustWatermark(uint amount, bool signs) external onlyVault {
        uint lastWatermark = watermark;
        watermark = signs == true ? watermark + amount : watermark - amount;

        emit AdjustWatermark(watermark, lastWatermark);
    }

    /// @notice This function switch DAIAVAXVault to MIMAVAXVault
    function switchVaultL1(IDaoL1Vault _MIMAVAXVault) external {
        require(msg.sender == 0x3f68A3c1023d736D8Be867CA49Cb18c543373B99, "Not authorized");

        // Set MIMAVAXVault
        MIMAVAXVault = _MIMAVAXVault;

        // Withdraw from DAIAVAXVault;
        uint DAIAVAXAmt = DAIAVAXVault.withdraw(DAIAVAXVault.balanceOf(address(this)));
        (uint DAIAmt, uint WAVAXAmt) = joeRouter.removeLiquidity(
            address(DAI), address(WAVAX), DAIAVAXAmt, 0, 0, address(this), block.timestamp
        );

        // Approve all Stablecoins to new curve 3poolV2
        USDT.safeApprove(address(curve), type(uint).max);
        USDC.safeApprove(address(curve), type(uint).max);
        MIM.safeApprove(address(curve), type(uint).max);
        // Approve MIMAVAX to Pangolin router
        MIMAVAX.safeApprove(address(pngRouter), type(uint).max);

        // Swap DAI to MIM
        ICurve av3CRV = ICurve(0x7f90122BF0700F9E7e1F688fe926940E8839F353);
        uint USDCAmt = av3CRV.exchange_underlying(
            0, 1, DAIAmt, (DAIAmt / 1e12) * 99 / 100
        );
        uint MIMAmt = curve.exchange(
            getCurveId(address(USDC)), getCurveId(address(MIM)), USDCAmt, (USDCAmt * 1e12) * 99 / 100
        );

        // Add liquidity into MIMAVAX on Pangolin
        MIM.safeApprove(address(pngRouter), type(uint).max);
        (,,uint MIMAVAXAmt) = pngRouter.addLiquidity(
            address(MIM), address(WAVAX), MIMAmt, WAVAXAmt, 0, 0, address(this), block.timestamp
        );

        // Deposit into MIMAVAXVault
        MIMAVAX.safeApprove(address(MIMAVAXVault), type(uint).max);
        MIMAVAXVault.deposit(MIMAVAXAmt);
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
        if (token == address(USDT)) return 1;
        else if (token == address(USDC)) return 2;
        else return 0; // MIM
    }

    function getUSDTAVAXPool() private view returns (uint) {
        uint USDTAVAXVaultPool = USDTAVAXVault.getAllPoolInUSD();
        if (USDTAVAXVaultPool == 0) return 0;
        return USDTAVAXVaultPool * USDTAVAXVault.balanceOf(address(this)) / USDTAVAXVault.totalSupply();
    }

    function getUSDCAVAXPool() private view returns (uint) {
        uint USDCAVAXVaultPool = USDCAVAXVault.getAllPoolInUSD();
        if (USDCAVAXVaultPool == 0) return 0;
        return USDCAVAXVaultPool * USDCAVAXVault.balanceOf(address(this)) / USDCAVAXVault.totalSupply();
    }

    function getMIMAVAXPool() private view returns (uint) {
        uint MIMAVAXVaultPool = MIMAVAXVault.getAllPoolInUSD();
        if (MIMAVAXVaultPool == 0) return 0;
        return MIMAVAXVaultPool * MIMAVAXVault.balanceOf(address(this)) / MIMAVAXVault.totalSupply();
    }

    function getEachPool() public view returns (uint[] memory pools) {
        pools = new uint[](3);
        pools[0] = getUSDTAVAXPool();
        pools[1] = getUSDCAVAXPool();
        pools[2] = getMIMAVAXPool();
    }

    function getAllPoolInUSD() public view returns (uint) {
        uint[] memory pools = getEachPool();
        return pools[0] + pools[1] + pools[2];
    }
}