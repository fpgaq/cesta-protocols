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

contract StableStableStrategy is Initializable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable constant USDT = IERC20Upgradeable(0xc7198437980c041c805A1EDcbA50c1Ce5db95118);
    IERC20Upgradeable constant USDC = IERC20Upgradeable(0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664);
    IERC20Upgradeable constant DAI = IERC20Upgradeable(0xd586E7F844cEa2F87f50152665BCbc2C279D8d70);

    IERC20Upgradeable constant USDTUSDC = IERC20Upgradeable(0x2E02539203256c83c7a9F6fA6f8608A32A2b1Ca2);
    IERC20Upgradeable constant USDTDAI = IERC20Upgradeable(0xa6908C7E3Be8F4Cd2eB704B5cB73583eBF56Ee62);
    IERC20Upgradeable constant USDCDAI = IERC20Upgradeable(0x63ABE32d0Ee76C05a11838722A63e012008416E6);

    IRouter constant joeRouter = IRouter(0x60aE616a2155Ee3d9A68541Ba4544862310933d4);
    ICurve constant curve = ICurve(0x7f90122BF0700F9E7e1F688fe926940E8839F353); // av3pool

    IDaoL1Vault public USDTUSDCVault;
    IDaoL1Vault public USDTDAIVault;
    IDaoL1Vault public USDCDAIVault;

    address public vault;
    uint public watermark; // In USD (18 decimals)
    uint public profitFeePerc;

    event InvestUSDTUSDC(uint USDAmt, uint USDTUSDCAmt);
    event InvestUSDTDAI(uint USDAmt, uint USDTDAIAmt);
    event InvestUSDCDAI(uint USDAmt, uint USDCDAIAmt);
    event Withdraw(uint amount, uint USDAmt);
    event WithdrawUSDTUSDC(uint lpTokenAmt, uint USDAmt);
    event WithdrawUSDTDAI(uint lpTokenAmt, uint USDAmt);
    event WithdrawUSDCDAI(uint lpTokenAmt, uint USDAmt);
    event CollectProfitAndUpdateWatermark(uint currentWatermark, uint lastWatermark, uint fee);
    event AdjustWatermark(uint currentWatermark, uint lastWatermark);
    event Reimburse(uint USDAmt);
    event EmergencyWithdraw(uint USDAmt);

    modifier onlyVault {
        require(msg.sender == vault, "Only vault");
        _;
    }

    function initialize(
        address _USDTUSDCVault, address _USDTDAIVault, address _USDCDAIVault
    ) external initializer {

        USDTUSDCVault = IDaoL1Vault(_USDTUSDCVault);
        USDTDAIVault = IDaoL1Vault(_USDTDAIVault);
        USDCDAIVault = IDaoL1Vault(_USDCDAIVault);

        profitFeePerc = 2000;

        USDC.safeApprove(address(joeRouter), type(uint).max);
        USDC.safeApprove(address(curve), type(uint).max);
        USDT.safeApprove(address(joeRouter), type(uint).max);
        USDT.safeApprove(address(curve), type(uint).max);
        DAI.safeApprove(address(joeRouter), type(uint).max);
        DAI.safeApprove(address(curve), type(uint).max);

        USDTUSDC.safeApprove(address(USDTUSDCVault), type(uint).max);
        USDTUSDC.safeApprove(address(joeRouter), type(uint).max);
        USDTDAI.safeApprove(address(USDTDAIVault), type(uint).max);
        USDTDAI.safeApprove(address(joeRouter), type(uint).max);
        USDCDAI.safeApprove(address(USDCDAIVault), type(uint).max);
        USDCDAI.safeApprove(address(joeRouter), type(uint).max);
    }

    function invest(uint USDTAmt, uint[] calldata amountsOutMin) external onlyVault {
        USDT.safeTransferFrom(vault, address(this), USDTAmt);

        // Full Stablecoins farm don't need rebalance invest
        uint portionUSDTAmt = USDTAmt * 3333 / 10000;
        investUSDTUSDC(portionUSDTAmt);
        investUSDTDAI(portionUSDTAmt);
        investUSDCDAI(portionUSDTAmt);

        amountsOutMin[0]; // To remove unused variable warning
    }

    function investUSDTUSDC(uint USDTAmt) private {
        uint halfUSDT = USDTAmt / 2;
        uint USDCAmt = curve.exchange_underlying(
            getCurveId(address(USDT)), getCurveId(address(USDC)), halfUSDT, halfUSDT * 99 / 100
        );

        (,,uint USDTUSDCAmt) = joeRouter.addLiquidity(
            address(USDT), address(USDC), halfUSDT, USDCAmt, 0, 0, address(this), block.timestamp
        );

        USDTUSDCVault.deposit(USDTUSDCAmt);
        emit InvestUSDTUSDC(USDTAmt, USDTUSDCAmt);
    }

    function investUSDTDAI(uint USDTAmt) private {
        uint halfUSDT = USDTAmt / 2;
        uint DAIAmt = curve.exchange_underlying(
            getCurveId(address(USDT)), getCurveId(address(DAI)), halfUSDT, (halfUSDT * 1e12) * 99 / 100
        );

        (,,uint USDTDAIAmt) = joeRouter.addLiquidity(
            address(USDT), address(DAI), halfUSDT, DAIAmt, 0, 0, address(this), block.timestamp
        );

        USDTDAIVault.deposit(USDTDAIAmt);
        emit InvestUSDTDAI(USDTAmt, USDTDAIAmt);
    }

    function investUSDCDAI(uint USDTAmt) private {
        uint USDCAmt = curve.exchange_underlying(
            getCurveId(address(USDT)), getCurveId(address(USDC)), USDTAmt, USDTAmt * 99 / 100
        );

        uint halfUSDC = USDCAmt / 2;
        uint DAIAmt = curve.exchange_underlying(
            getCurveId(address(USDC)), getCurveId(address(DAI)), halfUSDC, (halfUSDC * 1e12) * 99 / 100
        );
        (,,uint USDCDAIAmt) = joeRouter.addLiquidity(
            address(USDC), address(DAI), halfUSDC, DAIAmt, 0, 0, address(this), block.timestamp
        );

        USDCDAIVault.deposit(USDCDAIAmt);
        emit InvestUSDCDAI(USDTAmt, USDCDAIAmt);
    }

    /// @param amount Amount to withdraw in USD
    function withdraw(uint amount, uint[] calldata amountsOutMin) external onlyVault returns (uint USDTAmt) {
        uint sharePerc = amount * 1e18 / getAllPoolInUSD();

        uint USDTAmtBefore = USDT.balanceOf(address(this));
        withdrawUSDTUSDC(sharePerc);
        withdrawUSDTDAI(sharePerc);
        withdrawUSDCDAI(sharePerc);
        USDTAmt = USDT.balanceOf(address(this)) - USDTAmtBefore;

        USDT.safeTransfer(vault, USDTAmt);

        amountsOutMin[0]; // To remove unused variable warning
        emit Withdraw(amount, USDTAmt);
    }

    function withdrawUSDTUSDC(uint sharePerc) private {
        uint USDTUSDCAmt = USDTUSDCVault.withdraw(USDTUSDCVault.balanceOf(address(this)) * sharePerc / 1e18);

        (uint USDTAmt, uint USDCAmt) = joeRouter.removeLiquidity(
            address(USDT), address(USDC), USDTUSDCAmt, 0, 0, address(this), block.timestamp
        );

        USDTAmt += curve.exchange_underlying(
            getCurveId(address(USDC)), getCurveId(address(USDT)), USDCAmt, USDCAmt * 99 / 100
        );

        emit WithdrawUSDTUSDC(USDTUSDCAmt, USDTAmt);
    }

    function withdrawUSDTDAI(uint sharePerc) private {
        uint USDTDAIAmt = USDTDAIVault.withdraw(USDTDAIVault.balanceOf(address(this)) * sharePerc / 1e18);

        (uint USDTAmt, uint DAIAmt) = joeRouter.removeLiquidity(
            address(USDT), address(DAI), USDTDAIAmt, 0, 0, address(this), block.timestamp
        );

        DAIAmt += curve.exchange_underlying(
            getCurveId(address(DAI)), getCurveId(address(USDT)), DAIAmt, (DAIAmt / 1e12) * 99 / 100
        );

        emit WithdrawUSDTDAI(USDTDAIAmt, USDTAmt);
    }

    function withdrawUSDCDAI(uint sharePerc) private {
        uint USDCDAIAmt = USDCDAIVault.withdraw(USDCDAIVault.balanceOf(address(this)) * sharePerc / 1e18);

        (uint USDCAmt, uint DAIAmt) = joeRouter.removeLiquidity(
            address(USDC), address(DAI), USDCDAIAmt, 0, 0, address(this), block.timestamp
        );

        uint USDTAmt = curve.exchange_underlying(
            getCurveId(address(USDC)), getCurveId(address(USDT)), USDCAmt, USDCAmt * 99 / 100
        );
        USDTAmt += curve.exchange_underlying(
            getCurveId(address(DAI)), getCurveId(address(USDT)), DAIAmt, (DAIAmt / 1e12) * 99 / 100
        );

        emit WithdrawUSDCDAI(USDCDAIAmt, USDTAmt);
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
    function reimburse(uint farmIndex, uint amount, uint amountsOutMin) external onlyVault returns (uint USDTAmt) {
        if (farmIndex == 0) withdrawUSDTUSDC(amount * 1e18 / getUSDTUSDCPool());
        else if (farmIndex == 1) withdrawUSDTDAI(amount * 1e18 / getUSDTDAIPool());
        else if (farmIndex == 2) withdrawUSDCDAI(amount * 1e18 / getUSDCDAIPool());

        USDTAmt = USDT.balanceOf(address(this));
        USDT.safeTransfer(vault, USDTAmt);

        amountsOutMin; // To remove unused variable warning

        emit Reimburse(USDTAmt);
    }

    function emergencyWithdraw() external onlyVault {
        // 1e18 == 100% of share
        withdrawUSDTUSDC(1e18);
        withdrawUSDTDAI(1e18);
        withdrawUSDCDAI(1e18);

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

    function getUSDTUSDCPool() private view returns (uint) {
        uint USDTUSDCVaultPool = USDTUSDCVault.getAllPoolInUSD();
        if (USDTUSDCVaultPool == 0) return 0;
        return USDTUSDCVaultPool * USDTUSDCVault.balanceOf(address(this)) / USDTUSDCVault.totalSupply();
    }

    function getUSDTDAIPool() private view returns (uint) {
        uint USDTDAIVaultPool = USDTDAIVault.getAllPoolInUSD();
        if (USDTDAIVaultPool == 0) return 0;
        return USDTDAIVaultPool * USDTDAIVault.balanceOf(address(this)) / USDTDAIVault.totalSupply();
    }

    function getUSDCDAIPool() private view returns (uint) {
        uint USDCDAIVaultPool = USDCDAIVault.getAllPoolInUSD();
        if (USDCDAIVaultPool == 0) return 0;
        return USDCDAIVaultPool * USDCDAIVault.balanceOf(address(this)) / USDCDAIVault.totalSupply();
    }

    function getEachPool() private view returns (uint[] memory pools) {
        pools = new uint[](3);
        pools[0] = getUSDTUSDCPool();
        pools[1] = getUSDTDAIPool();
        pools[2] = getUSDCDAIPool();
    }

    function getAllPoolInUSD() public view returns (uint) {
        uint[] memory pools = getEachPool();
        return pools[0] + pools[1] + pools[2];
    }
}