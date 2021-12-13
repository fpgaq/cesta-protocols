// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface IRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts);
}

interface ICurve {
    function exchange_underlying(int128 i, int128 j, uint dx, uint min_dy) external returns (uint);
}

interface IStrategy {
    function invest(uint amount, uint[] calldata amountsOutMin) external;
    function withdraw(uint sharePerc, uint[] calldata amountsOutMin) external;
    function collectProfitAndUpdateWatermark() external returns (uint, uint);
    function adjustWatermark(uint amount, bool signs) external;
    function emergencyWithdraw() external;
    function setProfitFeePerc(uint _profitFeePerc) external;
    function getAllPoolInUSD() external view returns (uint);
}

contract AvaxStableVault is Initializable, ERC20Upgradeable, OwnableUpgradeable, 
        ReentrancyGuardUpgradeable, PausableUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable constant USDT = IERC20Upgradeable(0xc7198437980c041c805A1EDcbA50c1Ce5db95118);
    IERC20Upgradeable constant USDC = IERC20Upgradeable(0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664);
    IERC20Upgradeable constant DAI = IERC20Upgradeable(0xd586E7F844cEa2F87f50152665BCbc2C279D8d70);

    IRouter constant joeRouter = IRouter(0x60aE616a2155Ee3d9A68541Ba4544862310933d4);
    ICurve constant curve = ICurve(0x7f90122BF0700F9E7e1F688fe926940E8839F353); // av3pool
    IStrategy public strategy;
    address public proxy;

    address public treasuryWallet;
    address public communityWallet;
    address public admin;
    address public community;

    uint public networkFeePerc;
    uint public fees; // In USD, 18 decimals

    event Deposit(address caller, uint amtDeposit, address tokenDeposit, uint fees);
    event Withdraw(address caller, uint amtWithdraw, address tokenWithdraw, uint shareBurned);
    event Invest(uint amount);
    event SetAddresses(
        address oldTreasuryWallet, address newTreasuryWallet,
        address oldcommunityWallet, address newcommunityWallet,
        address oldAdmin, address newAdmin
    );
    
    modifier onlyOwnerOrAdmin {
        require(msg.sender == owner() || msg.sender == address(admin), "Only owner or admin");
        _;
    }

    function initialize(
        string calldata name, string calldata ticker,
        address _treasuryWallet, address _communityWallet, address _admin,
        address _strategy
    ) external initializer {
        __ERC20_init(name, ticker);
        __Ownable_init();

        strategy = IStrategy(_strategy);

        treasuryWallet = _treasuryWallet;
        communityWallet = _communityWallet;
        admin = _admin;

        USDT.safeApprove(address(joeRouter), type(uint).max);
        USDT.safeApprove(address(curve), type(uint).max);
        USDC.safeApprove(address(joeRouter), type(uint).max);
        USDC.safeApprove(address(curve), type(uint).max);
        DAI.safeApprove(address(joeRouter), type(uint).max);
        DAI.safeApprove(address(curve), type(uint).max);
        USDT.safeApprove(address(strategy), type(uint).max);
    }

    function deposit(uint amount, IERC20Upgradeable token, uint[] calldata amountsOutMin) external nonReentrant whenNotPaused {
        require(msg.sender == tx.origin, "Only EOA");
        require(amount > 0, "Amount must > 0");
        require(token == USDT || token == USDC || token == DAI, "Invalid token deposit");

        token.safeTransferFrom(msg.sender, address(this), amount);

        uint poolBeforeInvest = collectProfitAndUpdateWatermark();

        uint fee = amount * networkFeePerc / 10000;
        token.safeTransfer(treasuryWallet, fee * 4 / 5);
        token.safeTransfer(communityWallet, fee * 1 / 5);
        amount -= fee;

        uint amountToAdjust = token != DAI ? amount * 1e12 : amount; // Change to 18 decimals
        strategy.adjustWatermark(amountToAdjust, true);
        
        uint USDTAmt;
        if (token != USDT) {
            uint amountOut = token == DAI ? amount / 1e12 : amount;
            USDTAmt = curve.exchange_underlying(
                getCurveId(address(token)), getCurveId(address(USDT)), amount, amountOut * 99 / 100
            );
        } else {
            USDTAmt = amount;
        }
        strategy.invest(USDTAmt, amountsOutMin);
        
        uint _totalSupply = totalSupply();
        uint depositAmtAfterSlippage = _totalSupply == 0 ? getAllPoolInUSD() : getAllPoolInUSD() - poolBeforeInvest;
        uint share = _totalSupply == 0 ? depositAmtAfterSlippage : depositAmtAfterSlippage * _totalSupply / poolBeforeInvest;
        _mint(msg.sender, share);

        emit Deposit(msg.sender, amount, address(token), fees);
    }

    function withdraw(uint share, IERC20Upgradeable token, uint[] calldata amountsOutMin) external nonReentrant {
        require(msg.sender == tx.origin, "Only EOA");
        require(share > 0 || share <= balanceOf(msg.sender), "Invalid share amount");
        require(token == USDT || token == USDC || token == DAI, "Invalid token withdraw");

        uint withdrawAmt = (getAllPoolInUSD()) * share / totalSupply();
        _burn(msg.sender, share);

        if (!paused()) {
            strategy.withdraw(withdrawAmt, amountsOutMin);
            strategy.adjustWatermark(withdrawAmt, false);
            withdrawAmt = USDT.balanceOf(address(this));
        }
        
        if (token != USDT) {
            withdrawAmt = curve.exchange_underlying(
                getCurveId(address(USDT)), getCurveId(address(token)), withdrawAmt, withdrawAmt * 99 / 100
            );
        }

        
        token.safeTransfer(msg.sender, withdrawAmt);

        emit Withdraw(msg.sender, withdrawAmt, address(token), share);
    }

    function collectProfitAndUpdateWatermark() public whenNotPaused returns (uint) {
        (uint previousProfitFee, uint allPoolInUSD) = strategy.collectProfitAndUpdateWatermark();
        if (previousProfitFee > 0) fees += previousProfitFee;

        return allPoolInUSD;
    }

    function releaseFees() external onlyOwnerOrAdmin {
        uint feeInLPToken = fees * 1e18 / getPricePerFullShare();
        _mint(address(treasuryWallet), feeInLPToken * 4 / 5);
        _mint(address(treasuryWallet), feeInLPToken * 1 / 5);
        fees = 0;
    }

    function emergencyWithdraw() external onlyOwnerOrAdmin whenNotPaused {
        _pause();

        strategy.emergencyWithdraw();
    }

    function setAddresses(address _treasuryWallet, address _communityWallet, address _admin) external onlyOwner {
        address oldTreasuryWallet = treasuryWallet;
        address oldcommunityWallet = communityWallet;
        address oldAdmin = admin;

        treasuryWallet = _treasuryWallet;
        communityWallet = _communityWallet;
        admin = _admin;

        emit SetAddresses(oldTreasuryWallet, _treasuryWallet, oldcommunityWallet, _communityWallet, oldAdmin, _admin);
    }

    function setFees(uint _networkFeePerc, uint _profitFeePerc) external onlyOwner {
        networkFeePerc = _networkFeePerc;
        strategy.setProfitFeePerc(_profitFeePerc);
    }

    function setProxy(address _proxy) external onlyOwner {
        proxy = _proxy;
    }

    function getCurveId(address token) private pure returns (int128) {
        if (token == address(USDT)) return 2;
        else if (token == address(USDC)) return 1;
        else return 0; // DAI
    }

    function getAllPoolInUSD() public view returns (uint) {
        if (paused()) return USDT.balanceOf(address(this));
        return strategy.getAllPoolInUSD();
    }

    /// @notice Can be use for calculate both user shares & APR    
    function getPricePerFullShare() public view returns (uint) {
        return getAllPoolInUSD() * 1e18 / totalSupply();
    }
}