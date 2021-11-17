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

interface IDaoL1Vault is IERC20Upgradeable {
    function deposit(uint amount) external;
    function withdraw(uint share) external returns (uint);
    function getAllPoolInUSD() external view returns (uint);
    function getAllPoolInAVAX() external view returns (uint);
}

interface IChainlink {
    function latestAnswer() external view returns (int256);
}

contract DeXAvaxStrategy is Initializable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable constant WAVAX = IERC20Upgradeable(0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7);
    IERC20Upgradeable constant JOE = IERC20Upgradeable(0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd);
    IERC20Upgradeable constant PNG = IERC20Upgradeable(0x60781C2586D68229fde47564546784ab3fACA982);
    IERC20Upgradeable constant LYD = IERC20Upgradeable(0x4C9B4E1AC6F24CdE3660D5E4Ef1eBF77C710C084);

    IERC20Upgradeable constant JOEAVAX = IERC20Upgradeable(0x454E67025631C065d3cFAD6d71E6892f74487a15);
    IERC20Upgradeable constant PNGAVAX = IERC20Upgradeable(0xd7538cABBf8605BdE1f4901B47B8D42c61DE0367);
    IERC20Upgradeable constant LYDAVAX = IERC20Upgradeable(0xFba4EdaAd3248B03f1a3261ad06Ad846A8e50765);

    IRouter constant joeRouter = IRouter(0x60aE616a2155Ee3d9A68541Ba4544862310933d4);
    IRouter constant pngRouter = IRouter(0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106);
    IRouter constant lydRouter = IRouter(0xA52aBE4676dbfd04Df42eF7755F01A3c41f28D27);

    IDaoL1Vault public JOEAVAXVault;
    IDaoL1Vault public PNGAVAXVault;
    IDaoL1Vault public LYDAVAXVault;

    address public vault;
    uint public watermark; // In USD (18 decimals)
    uint public profitFeePerc;

    event TargetComposition (uint JOEAVAXTargetPool, uint PNGAVAXTargetPool, uint LYDAVAXTargetPool);
    event CurrentComposition (uint JOEAVAXCCurrentPool, uint PNGAVAXCurrentPool, uint LYDAVAXCurrentPool);
    event InvestJOEAVAX(uint WAVAXAmt, uint JOEAVAXAmt);
    event InvestPNGAVAX(uint WAVAXAmt, uint PNGAVAXAmt);
    event InvestLYDAVAX(uint WAVAXAmt, uint LYDAVAXAmt);
    event Withdraw(uint amount, uint WAVAXAmt);
    event WithdrawJOEAVAX(uint lpTokenAmt, uint WAVAXAmt);
    event WithdrawPNGAVAX(uint lpTokenAmt, uint WAVAXAmt);
    event WithdrawLYDAVAX(uint lpTokenAmt, uint WAVAXAmt);
    event CollectProfitAndUpdateWatermark(uint currentWatermark, uint lastWatermark, uint fee);
    event AdjustWatermark(uint currentWatermark, uint lastWatermark);
    event Reimburse(uint WAVAXAmt);
    event EmergencyWithdraw(uint WAVAXAmt);

    modifier onlyVault {
        require(msg.sender == vault, "Only vault");
        _;
    }

    function initialize(
        address _JOEAVAXVault, address _PNGAVAXVault, address _LYDAVAXVault
    ) external initializer {

        JOEAVAXVault = IDaoL1Vault(_JOEAVAXVault);
        PNGAVAXVault = IDaoL1Vault(_PNGAVAXVault);
        LYDAVAXVault = IDaoL1Vault(_LYDAVAXVault);

        profitFeePerc = 2000;

        WAVAX.safeApprove(address(joeRouter), type(uint).max);
        WAVAX.safeApprove(address(pngRouter), type(uint).max);
        WAVAX.safeApprove(address(lydRouter), type(uint).max);
        JOE.safeApprove(address(joeRouter), type(uint).max);
        PNG.safeApprove(address(pngRouter), type(uint).max);
        LYD.safeApprove(address(lydRouter), type(uint).max);

        JOEAVAX.safeApprove(address(JOEAVAXVault), type(uint).max);
        JOEAVAX.safeApprove(address(joeRouter), type(uint).max);
        PNGAVAX.safeApprove(address(PNGAVAXVault), type(uint).max);
        PNGAVAX.safeApprove(address(pngRouter), type(uint).max);
        LYDAVAX.safeApprove(address(LYDAVAXVault), type(uint).max);
        LYDAVAX.safeApprove(address(lydRouter), type(uint).max);
    }

    function invest(uint WAVAXAmt, uint[] calldata amountsOutMin) external onlyVault {
        WAVAX.safeTransferFrom(vault, address(this), WAVAXAmt);

        uint[] memory pools = getEachPool();
        uint pool = pools[0] + pools[1] + pools[2] + WAVAXAmt;
        uint JOEAVAXTargetPool = pool * 4500 / 10000; // 45%
        uint PNGAVAXTargetPool = JOEAVAXTargetPool; // 45%
        uint LYDAVAXTargetPool = pool * 1000 / 10000; // 10%

        // Rebalancing invest
        if (
            JOEAVAXTargetPool > pools[0] &&
            PNGAVAXTargetPool > pools[1] &&
            LYDAVAXTargetPool > pools[2]
        ) {
            investJOEAVAX(JOEAVAXTargetPool - pools[0], amountsOutMin[3]);
            investPNGAVAX(PNGAVAXTargetPool - pools[1], amountsOutMin[4]);
            investLYDAVAX(LYDAVAXTargetPool - pools[2], amountsOutMin[5]);
        } else {
            uint furthest;
            uint farmIndex;
            uint diff;

            if (JOEAVAXTargetPool > pools[0]) {
                diff = JOEAVAXTargetPool - pools[0];
                furthest = diff;
                farmIndex = 0;
            }
            if (PNGAVAXTargetPool > pools[1]) {
                diff = PNGAVAXTargetPool - pools[1];
                if (diff > furthest) {
                    furthest = diff;
                    farmIndex = 1;
                }
            }
            if (LYDAVAXTargetPool > pools[2]) {
                diff = LYDAVAXTargetPool - pools[2];
                if (diff > furthest) {
                    furthest = diff;
                    farmIndex = 2;
                }
            }

            if (farmIndex == 0) investJOEAVAX(WAVAXAmt, amountsOutMin[3]);
            else if (farmIndex == 1) investPNGAVAX(WAVAXAmt, amountsOutMin[4]);
            else investLYDAVAX(WAVAXAmt, amountsOutMin[5]);
        }

        emit TargetComposition(JOEAVAXTargetPool, PNGAVAXTargetPool, LYDAVAXTargetPool);
        emit CurrentComposition(pools[0], pools[1], pools[2]);
    }

    function investJOEAVAX(uint WAVAXAmt, uint amountOutMin) private {
        uint halfWAVAX = WAVAXAmt / 2;

        uint JOEAmt = joeRouter.swapExactTokensForTokens(
            halfWAVAX, amountOutMin, getPath(address(WAVAX), address(JOE)), address(this), block.timestamp
        )[1];

        (,,uint JOEAVAXAmt) = joeRouter.addLiquidity(
            address(JOE), address(WAVAX), JOEAmt, halfWAVAX, 0, 0, address(this), block.timestamp
        );

        JOEAVAXVault.deposit(JOEAVAXAmt);

        emit InvestJOEAVAX(WAVAXAmt, JOEAVAXAmt);
    }

    function investPNGAVAX(uint WAVAXAmt, uint amountOutMin) private {
        uint halfWAVAX = WAVAXAmt / 2;

        uint PNGAmt = pngRouter.swapExactTokensForTokens(
            halfWAVAX, amountOutMin, getPath(address(WAVAX), address(PNG)), address(this), block.timestamp
        )[1];

        (,,uint PNGAVAXAmt) = pngRouter.addLiquidity(
            address(PNG), address(WAVAX), PNGAmt, halfWAVAX, 0, 0, address(this), block.timestamp
        );

        PNGAVAXVault.deposit(PNGAVAXAmt);

        emit InvestPNGAVAX(WAVAXAmt, PNGAVAXAmt);
    }

    function investLYDAVAX(uint WAVAXAmt, uint amountOutMin) private {
        uint halfWAVAX = WAVAXAmt / 2;

        uint LYDAmt = lydRouter.swapExactTokensForTokens(
            halfWAVAX, amountOutMin, getPath(address(WAVAX), address(LYD)), address(this), block.timestamp
        )[1];

        (,,uint LYDAVAXAmt) = lydRouter.addLiquidity(
            address(LYD), address(WAVAX), LYDAmt, halfWAVAX, 0, 0, address(this), block.timestamp
        );

        LYDAVAXVault.deposit(LYDAVAXAmt);

        emit InvestLYDAVAX(WAVAXAmt, LYDAVAXAmt);
    }

    /// @param amount Amount to withdraw in USD
    function withdraw(uint amount, uint[] calldata amountsOutMin) external onlyVault returns (uint WAVAXAmt) {
        uint sharePerc = amount * 1e18 / getAllPoolInUSD();

        uint WAVAXAmtBefore = WAVAX.balanceOf(address(this));
        withdrawJOEAVAX(sharePerc, amountsOutMin[1]);
        withdrawPNGAVAX(sharePerc, amountsOutMin[2]);
        withdrawLYDAVAX(sharePerc, amountsOutMin[3]);
        WAVAXAmt = WAVAX.balanceOf(address(this)) - WAVAXAmtBefore;

        WAVAX.safeTransfer(vault, WAVAXAmt);

        emit Withdraw(amount, WAVAXAmt);
    }

    function withdrawJOEAVAX(uint sharePerc, uint amountOutMin) private {
        uint JOEAVAXAmt = JOEAVAXVault.withdraw(JOEAVAXVault.balanceOf(address(this)) * sharePerc / 1e18);

        (uint JOEAmt, uint WAVAXAmt) = joeRouter.removeLiquidity(
            address(JOE), address(WAVAX), JOEAVAXAmt, 0, 0, address(this), block.timestamp
        );

        uint _WAVAXAmt = joeRouter.swapExactTokensForTokens(
            JOEAmt, amountOutMin, getPath(address(JOE), address(WAVAX)), address(this), block.timestamp
        )[1];

        emit WithdrawJOEAVAX(JOEAVAXAmt, WAVAXAmt + _WAVAXAmt);
    }

    function withdrawPNGAVAX(uint sharePerc, uint amountOutMin) private {
        uint PNGAVAXAmt = PNGAVAXVault.withdraw(PNGAVAXVault.balanceOf(address(this)) * sharePerc / 1e18);

        (uint PNGAmt, uint WAVAXAmt) = pngRouter.removeLiquidity(
            address(PNG), address(WAVAX), PNGAVAXAmt, 0, 0, address(this), block.timestamp
        );

        uint _WAVAXAmt = pngRouter.swapExactTokensForTokens(
            PNGAmt, amountOutMin, getPath(address(PNG), address(WAVAX)), address(this), block.timestamp
        )[1];

        emit WithdrawPNGAVAX(PNGAVAXAmt, WAVAXAmt + _WAVAXAmt);
    }

    function withdrawLYDAVAX(uint sharePerc, uint amountOutMin) private {
        uint LYDAVAXAmt = LYDAVAXVault.withdraw(LYDAVAXVault.balanceOf(address(this)) * sharePerc / 1e18);

        (uint LYDAmt, uint WAVAXAmt) = lydRouter.removeLiquidity(
            address(LYD), address(WAVAX), LYDAVAXAmt, 0, 0, address(this), block.timestamp
        );

        uint _WAVAXAmt = lydRouter.swapExactTokensForTokens(
            LYDAmt, amountOutMin, getPath(address(LYD), address(WAVAX)), address(this), block.timestamp
        )[1];

        emit WithdrawLYDAVAX(LYDAVAXAmt, WAVAXAmt + _WAVAXAmt);
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
    function reimburse(uint farmIndex, uint amount, uint amountOutMin) external onlyVault returns (uint WAVAXAmt) {
        if (farmIndex == 0) withdrawJOEAVAX(amount * 1e18 / getJOEAVAXPool(), amountOutMin);
        else if (farmIndex == 1) withdrawPNGAVAX(amount * 1e18 / getPNGAVAXPool(), amountOutMin);
        else if (farmIndex == 2) withdrawLYDAVAX(amount * 1e18 / getLYDAVAXPool(), amountOutMin);

        WAVAXAmt = WAVAX.balanceOf(address(this));
        WAVAX.safeTransfer(vault, WAVAXAmt);

        emit Reimburse(WAVAXAmt);
    }

    function emergencyWithdraw() external onlyVault {
        // 1e18 == 100% of share
        withdrawJOEAVAX(1e18, 0);
        withdrawPNGAVAX(1e18, 0);
        withdrawLYDAVAX(1e18, 0);

        uint WAVAXAmt = WAVAX.balanceOf(address(this));
        WAVAX.safeTransfer(vault, WAVAXAmt);
        watermark = 0;
        
        emit EmergencyWithdraw(WAVAXAmt);
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

    function getJOEAVAXPool() private view returns (uint) {
        uint JOEAVAXVaultPool = JOEAVAXVault.getAllPoolInAVAX();
        if (JOEAVAXVaultPool == 0) return 0;
        return JOEAVAXVaultPool * JOEAVAXVault.balanceOf(address(this)) / JOEAVAXVault.totalSupply();
    }

    function getPNGAVAXPool() private view returns (uint) {
        uint PNGAVAXVaultPool = PNGAVAXVault.getAllPoolInAVAX();
        if (PNGAVAXVaultPool == 0) return 0;
        return PNGAVAXVaultPool * PNGAVAXVault.balanceOf(address(this)) / PNGAVAXVault.totalSupply();
    }

    function getLYDAVAXPool() private view returns (uint) {
        uint LYDAVAXVaultPool = LYDAVAXVault.getAllPoolInAVAX();
        if (LYDAVAXVaultPool == 0) return 0;
        return LYDAVAXVaultPool * LYDAVAXVault.balanceOf(address(this)) / LYDAVAXVault.totalSupply();
    }

    function getEachPool() private view returns (uint[] memory pools) {
        pools = new uint[](3);
        pools[0] = getJOEAVAXPool();
        pools[1] = getPNGAVAXPool();
        pools[2] = getLYDAVAXPool();
    }

    /// @notice This function return only farms TVL in AVAX
    function getAllPoolInAVAX() public view returns (uint) {
        uint[] memory pools = getEachPool();
        return pools[0] + pools[1] + pools[2];
    }

    function getAllPoolInUSD() public view returns (uint) {
        uint AVAXPriceInUSD = uint(IChainlink(0x0A77230d17318075983913bC2145DB16C7366156).latestAnswer()); // 8 decimals
        require(AVAXPriceInUSD > 0, "ChainLink error");
        return getAllPoolInAVAX() * AVAXPriceInUSD / 1e8;
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