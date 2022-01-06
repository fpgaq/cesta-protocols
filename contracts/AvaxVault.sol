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

interface IChainlink {
    function latestAnswer() external view returns (int256);
}

interface IStrategy {
    function invest(uint amount, uint[] calldata tokenPriceMin) external;
    function withdraw(uint sharePerc, uint[] calldata tokenPriceMin) external;
    function collectProfitAndUpdateWatermark() external returns (uint, uint);
    function adjustWatermark(uint amount, bool signs) external;
    function emergencyWithdraw() external;
    function setProfitFeePerc(uint _profitFeePerc) external;
    function getAllPoolInAVAX() external view returns (uint);
}

contract AvaxVault is Initializable, ERC20Upgradeable, OwnableUpgradeable, 
        ReentrancyGuardUpgradeable, PausableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable constant USDT = IERC20Upgradeable(0xc7198437980c041c805A1EDcbA50c1Ce5db95118);
    IERC20Upgradeable constant USDC = IERC20Upgradeable(0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664);
    IERC20Upgradeable constant DAI = IERC20Upgradeable(0xd586E7F844cEa2F87f50152665BCbc2C279D8d70);
    IERC20Upgradeable constant WAVAX = IERC20Upgradeable(0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7);

    IRouter constant joeRouter = IRouter(0x60aE616a2155Ee3d9A68541Ba4544862310933d4);
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
        USDC.safeApprove(address(joeRouter), type(uint).max);
        DAI.safeApprove(address(joeRouter), type(uint).max);
        WAVAX.safeApprove(address(joeRouter), type(uint).max);
        WAVAX.safeApprove(address(strategy), type(uint).max);
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
        
        uint WAVAXAmt = swap(address(token), address(WAVAX), amount, amountsOutMin[0]);
        strategy.invest(WAVAXAmt, amountsOutMin);
        
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

        uint _totalSupply = totalSupply();
        _burn(msg.sender, share);

        uint withdrawAmt;
        if (paused()) {
            uint amtWithdrawInWAVAX = WAVAX.balanceOf(address(this)) * share / _totalSupply;
            withdrawAmt = swap(address(WAVAX), address(token), amtWithdrawInWAVAX, amountsOutMin[0]);
        } else {
            withdrawAmt = (getAllPoolInUSD()) * share / _totalSupply;
            strategy.withdraw(withdrawAmt, amountsOutMin);
            strategy.adjustWatermark(withdrawAmt, false);
            withdrawAmt = swap(address(WAVAX), address(token), WAVAX.balanceOf(address(this)), amountsOutMin[0]);
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

    function swap(address from, address to, uint amount, uint amountOutMin) private returns (uint) {
        address[] memory path = new address[](2);
        path[0] = from;
        path[1] = to;
        return joeRouter.swapExactTokensForTokens(
            amount, amountOutMin, path, address(this), block.timestamp
        )[1];
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

    function getAllPoolInUSD() public view returns (uint) {
        // AVAXPriceInUSD amount in 8 decimals
        uint AVAXPriceInUSD = uint(IChainlink(0x0A77230d17318075983913bC2145DB16C7366156).latestAnswer());
        require(AVAXPriceInUSD > 0, "ChainLink error");

        if (paused()) return WAVAX.balanceOf(address(this)) * AVAXPriceInUSD / 1e8;
        return (strategy.getAllPoolInAVAX() - fees) * AVAXPriceInUSD / 1e8;
    }

    /// @notice Can be use for calculate both user shares & APR    
    function getPricePerFullShare() public view returns (uint) {
        return getAllPoolInUSD() * 1e18 / totalSupply();
    }
}