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
    function getAllPoolInAVAX() external view returns (uint);
    function getAllPoolInUSD() external view returns (uint);
}

contract StableAvaxStrategy is Initializable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable constant USDT = IERC20Upgradeable(0xc7198437980c041c805A1EDcbA50c1Ce5db95118);
    IERC20Upgradeable constant USDC = IERC20Upgradeable(0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664);
    IERC20Upgradeable constant DAI = IERC20Upgradeable(0xd586E7F844cEa2F87f50152665BCbc2C279D8d70);
    IERC20Upgradeable constant WAVAX = IERC20Upgradeable(0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7);

    IERC20Upgradeable constant USDTAVAX = IERC20Upgradeable(0x5Fc70cF6A4A858Cf4124013047e408367EBa1ace);
    IERC20Upgradeable constant USDCAVAX = IERC20Upgradeable(0xbd918Ed441767fe7924e99F6a0E0B568ac1970D9);
    IERC20Upgradeable constant DAIAVAX = IERC20Upgradeable(0x87Dee1cC9FFd464B79e058ba20387c1984aed86a);

    IRouter constant joeRouter = IRouter(0x60aE616a2155Ee3d9A68541Ba4544862310933d4);
    IRouter constant pngRouter = IRouter(0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106);
    IRouter constant lydRouter = IRouter(0xA52aBE4676dbfd04Df42eF7755F01A3c41f28D27);
    ICurve constant curve = ICurve(0x7f90122BF0700F9E7e1F688fe926940E8839F353); // av3pool

    IDaoL1Vault public USDTAVAXVault;
    IDaoL1Vault public USDCAVAXVault;
    IDaoL1Vault public DAIAVAXVault;

    address public vault;
    uint public watermark; // In USD (18 decimals)
    uint public profitFeePerc;

    event InvestUSDTAVAX(uint USDAmt, uint USDTAVAXAmt);
    event InvestUSDCAVAX(uint USDAmt, uint USDCAVAXAmt);
    event InvestDAIAVAX(uint USDAmt, uint DAIAVAXAmt);
    event Withdraw(uint amount, uint USDAmt);
    event WithdrawUSDTAVAX(uint lpTokenAmt, uint USDAmt);
    event WithdrawUSDCAVAX(uint lpTokenAmt, uint USDAmt);
    event WithdrawDAIAVAX(uint lpTokenAmt, uint USDAmt);
    event CollectProfitAndUpdateWatermark(uint currentWatermark, uint lastWatermark, uint fee);
    event AdjustWatermark(uint currentWatermark, uint lastWatermark);
    event Reimburse(uint USDAmt);
    event EmergencyWithdraw(uint USDAmt);

    modifier onlyVault {
        require(msg.sender == vault, "Only vault");
        _;
    }

    function initialize(
        address _USDTAVAXVault, address _USDCAVAXVault, address _DAIAVAXVault
    ) external initializer {

        USDTAVAXVault = IDaoL1Vault(_USDTAVAXVault);
        USDCAVAXVault = IDaoL1Vault(_USDCAVAXVault);
        DAIAVAXVault = IDaoL1Vault(_DAIAVAXVault);

        profitFeePerc = 2000;

        USDT.safeApprove(address(lydRouter), type(uint).max);
        USDT.safeApprove(address(curve), type(uint).max);
        USDC.safeApprove(address(pngRouter), type(uint).max);
        USDC.safeApprove(address(curve), type(uint).max);
        DAI.safeApprove(address(joeRouter), type(uint).max);
        DAI.safeApprove(address(curve), type(uint).max);
        WAVAX.safeApprove(address(lydRouter), type(uint).max);
        WAVAX.safeApprove(address(pngRouter), type(uint).max);
        WAVAX.safeApprove(address(joeRouter), type(uint).max);

        USDTAVAX.safeApprove(address(USDTAVAXVault), type(uint).max);
        USDTAVAX.safeApprove(address(lydRouter), type(uint).max);
        USDCAVAX.safeApprove(address(USDCAVAXVault), type(uint).max);
        USDCAVAX.safeApprove(address(pngRouter), type(uint).max);
        DAIAVAX.safeApprove(address(DAIAVAXVault), type(uint).max);
        DAIAVAX.safeApprove(address(joeRouter), type(uint).max);
    }

    function invest(uint USDTAmt, uint[] calldata amountsOutMin) external onlyVault {
        USDT.safeTransferFrom(vault, address(this), USDTAmt);

        // Stablecoins-AVAX farm don't need rebalance invest
        investUSDTAVAX(USDTAmt * 500 / 10000, amountsOutMin[3]);
        investUSDCAVAX(USDTAmt * 4500 / 10000, amountsOutMin[4]);
        investDAIAVAX(USDTAmt * 5000 / 10000, amountsOutMin[5]);
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
        uint USDCAmt = curve.exchange_underlying(
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

    function investDAIAVAX(uint USDTAmt, uint amountOutMin) private {
        uint DAIAmt = curve.exchange_underlying(
            getCurveId(address(USDT)), getCurveId(address(DAI)), USDTAmt, (USDTAmt * 1e12) * 99 / 100
        );
        uint halfDAI = DAIAmt / 2;

        uint WAVAXAmt = joeRouter.swapExactTokensForTokens(
            halfDAI, amountOutMin, getPath(address(DAI), address(WAVAX)), address(this), block.timestamp
        )[1];

        (,,uint DAIAVAXAmt) = joeRouter.addLiquidity(
            address(DAI), address(WAVAX), halfDAI, WAVAXAmt, 0, 0, address(this), block.timestamp
        );

        DAIAVAXVault.deposit(DAIAVAXAmt);

        emit InvestDAIAVAX(USDTAmt, DAIAVAXAmt);
    }

    /// @param amount Amount to withdraw in USD
    function withdraw(uint amount, uint[] calldata amountsOutMin) external onlyVault returns (uint USDTAmt) {
        uint sharePerc = amount * 1e18 / getAllPoolInUSD();

        uint USDTAmtBefore = USDT.balanceOf(address(this));
        withdrawUSDTAVAX(sharePerc, amountsOutMin[1]);
        withdrawUSDCAVAX(sharePerc, amountsOutMin[2]);
        withdrawDAIAVAX(sharePerc, amountsOutMin[3]);
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

        uint USDTAmt = curve.exchange_underlying(
            getCurveId(address(USDC)), getCurveId(address(USDT)), USDCAmt, USDCAmt * 99 / 100
        );

        emit WithdrawUSDCAVAX(USDCAVAXAmt, USDTAmt);
    }

    function withdrawDAIAVAX(uint sharePerc, uint amountOutMin) private {
        uint DAIAVAXAmt = DAIAVAXVault.withdraw(DAIAVAXVault.balanceOf(address(this)) * sharePerc / 1e18);

        (uint DAIAmt, uint WAVAXAmt) = joeRouter.removeLiquidity(
            address(DAI), address(WAVAX), DAIAVAXAmt, 0, 0, address(this), block.timestamp
        );

        DAIAmt += joeRouter.swapExactTokensForTokens(
            WAVAXAmt, amountOutMin, getPath(address(WAVAX), address(DAI)), address(this), block.timestamp
        )[1];

        uint USDTAmt = curve.exchange_underlying(
            getCurveId(address(DAI)), getCurveId(address(USDT)), DAIAmt, (DAIAmt / 1e12) * 99 / 100
        );

        emit WithdrawDAIAVAX(DAIAVAXAmt, USDTAmt);
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
    function reimburse(uint farmIndex, uint amount, uint tokenPriceMin) external onlyVault returns (uint USDTAmt) {
        if (farmIndex == 0) withdrawUSDTAVAX(amount * 1e18 / getUSDTAVAXPool(), tokenPriceMin);
        else if (farmIndex == 1) withdrawUSDCAVAX(amount * 1e18 / getUSDCAVAXPool(), tokenPriceMin);
        else if (farmIndex == 2) withdrawDAIAVAX(amount * 1e18 / getDAIAVAXPool(), tokenPriceMin);

        USDTAmt = USDT.balanceOf(address(this));
        USDT.safeTransfer(vault, USDTAmt);

        emit Reimburse(USDTAmt);
    }

    function emergencyWithdraw() external onlyVault {
        // 1e18 == 100% of share
        withdrawUSDTAVAX(1e18, 0);
        withdrawUSDCAVAX(1e18, 0);
        withdrawDAIAVAX(1e18, 0);

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

    function getDAIAVAXPool() private view returns (uint) {
        uint DAIAVAXVaultPool = DAIAVAXVault.getAllPoolInUSD();
        if (DAIAVAXVaultPool == 0) return 0;
        return DAIAVAXVaultPool * DAIAVAXVault.balanceOf(address(this)) / DAIAVAXVault.totalSupply();
    }

    function getEachPool() private view returns (uint[] memory pools) {
        pools = new uint[](3);
        pools[0] = getUSDTAVAXPool();
        pools[1] = getUSDCAVAXPool();
        pools[2] = getDAIAVAXPool();
    }

    function getAllPoolInUSD() public view returns (uint) {
        uint[] memory pools = getEachPool();
        return pools[0] + pools[1] + pools[2];
    }
}