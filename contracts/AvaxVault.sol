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
    function exchange_underlying(int128 i, int128 j, uint dx, uint min_dy) external;
}

interface IChainlink {
    function latestAnswer() external view returns (int256);
}

interface IStrategy {
    function invest(uint amount, uint[] calldata tokenPriceMin) external;
    function withdraw(uint sharePerc, uint[] calldata tokenPriceMin) external;
    function collectProfitAndUpdateWatermark() external returns (uint);
    function adjustWatermark(uint amount, bool signs) external; 
    function reimburse(uint farmIndex, uint sharePerc, uint[] calldata tokenPriceMin) external returns (uint);
    function emergencyWithdraw() external;
    function profitFeePerc() external view returns (uint);
    function setProfitFeePerc(uint profitFeePerc) external;
    function watermark() external view returns (uint);
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
    ICurve constant curve = ICurve(0x7f90122BF0700F9E7e1F688fe926940E8839F353); // av3pool
    IStrategy public strategy;
    uint[] public percKeepInVault;
    uint public fees;

    uint[] public networkFeeTier;
    uint[] public networkFeePerc;

    // Temporarily variable for LP token distribution only
    address[] addresses;
    mapping(address => uint) public depositAmt; // Amount in USD (18 decimals)
    uint public totalPendingDepositAmt; // Total pending amount to invest

    address public treasuryWallet;
    address public communityWallet;
    address public admin;

    event Deposit(address caller, uint amtDeposit, address tokenDeposit);
    event Withdraw(address caller, uint amtWithdraw, address tokenWithdraw, uint shareBurned);
    event Invest(uint amount);
    event DistributeLPToken(address receiver, uint shareMinted);
    event TransferredOutFees(uint fees, address token);
    event Reimburse(uint farmIndex, address token, uint amount);
    event Reinvest(uint amount);
    event SetNetworkFeeTier(uint[] oldNetworkFeeTier, uint[] newNetworkFeeTier);
    event SetNetworkFeePerc(uint[] oldNetworkFeePerc, uint[] newNetworkFeePerc);
    event SetProfitFeePerc(uint oldProfitFeePerc, uint profitFeePerc);
    event SetPercKeepInVault(uint[] oldPercKeepInVault, uint[] newPercKeepInVault);
    event SetAddresses(
        address oldTreasuryWallet, address newTreasuryWallet,
        address oldCommunityWallet, address newCommunityWallet,
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

        networkFeeTier = [50000*1e18+1, 100000*1e18, 1000000*1e18];
        networkFeePerc = [100, 75, 50, 25];

        percKeepInVault = [300, 300, 300]; // USDT, USDC, DAI

        USDT.safeApprove(address(joeRouter), type(uint).max);
        USDT.safeApprove(address(curve), type(uint).max);
        USDC.safeApprove(address(joeRouter), type(uint).max);
        USDC.safeApprove(address(curve), type(uint).max);
        DAI.safeApprove(address(joeRouter), type(uint).max);
        DAI.safeApprove(address(curve), type(uint).max);
        WAVAX.safeApprove(address(joeRouter), type(uint).max);
        WAVAX.safeApprove(address(strategy), type(uint).max);
    }

    function deposit(uint amount, IERC20Upgradeable token) external nonReentrant whenNotPaused {
        require(msg.sender == tx.origin, "Only EOA");
        require(amount > 0, "Amount must > 0");
        require(token == USDT || token == USDC || token == DAI, "Invalid token deposit");

        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token != DAI) amount *= 1e12;
        uint amtDeposit = amount;

        uint _networkFeePerc;
        if (amount < networkFeeTier[0]) _networkFeePerc = networkFeePerc[0]; // Tier 1
        else if (amount <= networkFeeTier[1]) _networkFeePerc = networkFeePerc[1]; // Tier 2
        else if (amount < networkFeeTier[2]) _networkFeePerc = networkFeePerc[2]; // Tier 3
        else _networkFeePerc = networkFeePerc[3]; // Custom Tier
        uint fee = amount * _networkFeePerc / 10000;
        fees += fee;
        amount -= fee;

        if (depositAmt[msg.sender] == 0) {
            addresses.push(msg.sender);
            depositAmt[msg.sender] = amount;
        } else depositAmt[msg.sender] += amount;
        totalPendingDepositAmt += amount;

        emit Deposit(msg.sender, amtDeposit, address(token));
    }

    function withdraw(uint share, IERC20Upgradeable token, uint[] calldata amountsOutMin) external nonReentrant {
        require(msg.sender == tx.origin, "Only EOA");
        require(share > 0 || share <= balanceOf(msg.sender), "Invalid share amount");
        require(token == USDT || token == USDC || token == DAI, "Invalid token withdraw");

        uint _totalSupply = totalSupply();
        uint withdrawAmt = (getAllPoolInUSD() - totalPendingDepositAmt) * share / _totalSupply;
        _burn(msg.sender, share);

        uint tokenAmtInVault = token.balanceOf(address(this));
        if (token != DAI) tokenAmtInVault *= 1e12;
        if (withdrawAmt < tokenAmtInVault) {
            // Enough token in vault to withdraw
            if (token != DAI) withdrawAmt /= 1e12;
            token.safeTransfer(msg.sender, withdrawAmt);
        } else {
            // Not enough token in vault to withdraw, try if enough if swap from other token in vault
            (address token1, uint token1AmtInVault, address token2, uint token2AmtInVault) = getOtherTokenAndBal(token);
            if (withdrawAmt < tokenAmtInVault + token1AmtInVault) {
                // Enough if swap from token1 in vault
                uint amtSwapFromToken1 = withdrawAmt - tokenAmtInVault;
                if (token1 != address(DAI)) amtSwapFromToken1 /= 1e12;
                curve.exchange_underlying(getCurveId(token1), getCurveId(address(token)), amtSwapFromToken1, amtSwapFromToken1 * 99 / 100);
                withdrawAmt = token.balanceOf(address(this));
                token.safeTransfer(msg.sender, withdrawAmt);
            } else if (withdrawAmt < tokenAmtInVault + token1AmtInVault + token2AmtInVault) {
                // Not enough if swap from token1 in vault but enough if swap from token1 + token2 in vault
                uint amtSwapFromToken2 = withdrawAmt - tokenAmtInVault - token1AmtInVault;
                if (token1AmtInVault > 0) {
                    if (token1 != address(DAI)) token1AmtInVault /= 1e12;
                    curve.exchange_underlying(getCurveId(token1), getCurveId(address(token)), token1AmtInVault, token1AmtInVault * 99 / 100);
                }
                if (token2AmtInVault > 0) {
                    uint minAmtOutToken2 = amtSwapFromToken2 * 99 / 100;
                    if (token2 != address(DAI)) amtSwapFromToken2 /= 1e12;
                    if (token != DAI) minAmtOutToken2 /= 1e12;
                    curve.exchange_underlying(getCurveId(token2), getCurveId(address(token)), amtSwapFromToken2, minAmtOutToken2);
                }
                withdrawAmt = token.balanceOf(address(this));
                token.safeTransfer(msg.sender, withdrawAmt);
            } else {
                // Not enough if swap from token1 + token2 in vault, need to withdraw from strategy
                if (!paused()) {
                    withdrawAmt = withdrawFromStrategy(token, withdrawAmt, tokenAmtInVault, amountsOutMin);
                } else {
                    // When paused there is always enough Stablecoins in vault
                }
            }
        }

        emit Withdraw(msg.sender, withdrawAmt, address(token), share);
    }

    function withdrawFromStrategy(
        IERC20Upgradeable token, uint withdrawAmt, uint tokenAmtInVault, uint[] calldata amountsOutMin
    ) private returns (uint) {
        strategy.withdraw(withdrawAmt - tokenAmtInVault, amountsOutMin);
        strategy.adjustWatermark(withdrawAmt - tokenAmtInVault, false);
        if (token != DAI) tokenAmtInVault /= 1e12;
        uint WAVAXAmt = WAVAX.balanceOf(address(this));
        withdrawAmt = (joeRouter.swapExactTokensForTokens(
            WAVAXAmt, amountsOutMin[0], getPath(address(WAVAX), address(token)), address(this), block.timestamp
        )[1]) + tokenAmtInVault;
        
        token.safeTransfer(msg.sender, withdrawAmt);
        return withdrawAmt;
    }

    function invest(uint[] calldata amountsOutMin) public whenNotPaused {
        require(
            msg.sender == admin ||
            msg.sender == owner() ||
            msg.sender == address(this), "Only authorized caller"
        );

        if (strategy.watermark() > 0) collectProfitAndUpdateWatermark();
        (uint USDTAmt, uint USDCAmt, uint DAIAmt) = transferOutFees();

        (uint WAVAXAmt, uint tokenAmtToInvest, uint pool) = swapTokenToWAVAX(USDTAmt, USDCAmt, DAIAmt, amountsOutMin);
        if (tokenAmtToInvest > 0) {
            strategy.invest(WAVAXAmt, amountsOutMin);
            strategy.adjustWatermark(tokenAmtToInvest, true);
        }
        distributeLPToken(pool);

        emit Invest(WAVAXAmt);
    }

    function collectProfitAndUpdateWatermark() public whenNotPaused {
        require(
            msg.sender == address(this) ||
            msg.sender == admin ||
            msg.sender == owner(), "Only authorized caller"
        );
        uint fee = strategy.collectProfitAndUpdateWatermark();
        if (fee > 0) fees = fees + fee;
    }

    function distributeLPToken(uint pool) private {
        pool -= totalPendingDepositAmt; // Pool before new invest
        uint _newInvestedPool = totalSupply() == 0 ? getAllPoolInUSD() : getAllPoolInUSD() - pool;
        address[] memory _addresses = addresses;
        for (uint i; i < _addresses.length; i ++) {
            address depositAcc = _addresses[i];
            uint _depositAmt = depositAmt[depositAcc];
            uint _depositAmtAfterSlippage = _newInvestedPool * _depositAmt / totalPendingDepositAmt;
            uint share = totalSupply() == 0 ? _depositAmtAfterSlippage : _depositAmtAfterSlippage * totalSupply() / pool;
            _mint(depositAcc, share);
            pool += _depositAmtAfterSlippage; // Update pool for next loop
            depositAmt[depositAcc] = 0;
            emit DistributeLPToken(depositAcc, share);
        }
        delete addresses;
        totalPendingDepositAmt = 0;
    }

    function transferOutFees() public returns (uint USDTAmt, uint USDCAmt, uint DAIAmt) {
        require(
            msg.sender == address(this) ||
            msg.sender == admin ||
            msg.sender == owner(), "Only authorized caller"
        );

        USDTAmt = USDT.balanceOf(address(this));
        USDCAmt = USDC.balanceOf(address(this));
        DAIAmt = DAI.balanceOf(address(this));

        uint _fees = fees;
        if (_fees != 0) {
            IERC20Upgradeable token;
            if (USDTAmt * 1e12 > _fees) {
                token = USDT;
                _fees = _fees / 1e12;
                USDTAmt = USDTAmt - _fees;
            } else if (USDCAmt * 1e12 > _fees) {
                token = USDC;
                _fees = _fees / 1e12;
                USDCAmt = USDCAmt - _fees;
            } else if (DAIAmt > _fees) {
                token = DAI;
                DAIAmt = DAIAmt - _fees;
            } else return (USDTAmt, USDCAmt, DAIAmt);

            uint _fee = _fees / 2;
            token.safeTransfer(treasuryWallet, _fee);
            token.safeTransfer(communityWallet, _fees - _fee);

            fees = 0;
            emit TransferredOutFees(_fees, address(token)); // Decimal follow _token
        }
    }

    function swapTokenToWAVAX(
        uint USDTAmt, uint USDCAmt, uint DAIAmt, uint[] calldata amountsOutMin
    ) private returns (uint WAVAXAmt, uint tokenAmtToInvest, uint pool) {
        uint[] memory _percKeepInVault = percKeepInVault;
        pool = getAllPoolInUSD();

        uint USDTAmtKeepInVault = calcTokenKeepInVault(_percKeepInVault[0], pool) / 1e12;
        if (USDTAmt > USDTAmtKeepInVault + 1e6) {
            USDTAmt -= USDTAmtKeepInVault;
            WAVAXAmt = swap(address(USDT), address(WAVAX), USDTAmt, amountsOutMin[0]);
            tokenAmtToInvest = USDTAmt * 1e12;
        }

        uint USDCAmtKeepInVault = calcTokenKeepInVault(_percKeepInVault[1], pool) / 1e12;
        if (USDCAmt > USDCAmtKeepInVault + 1e6) {
            USDCAmt -= USDCAmtKeepInVault;
            uint _WAVAXAmt = swap(address(USDC), address(WAVAX), USDCAmt, amountsOutMin[1]);
            WAVAXAmt += _WAVAXAmt;
            tokenAmtToInvest = tokenAmtToInvest + USDCAmt * 1e12;
        }

        uint DAIAmtKeepInVault = calcTokenKeepInVault(_percKeepInVault[2], pool);
        if (DAIAmt > DAIAmtKeepInVault + 1e18) {
            DAIAmt -= DAIAmtKeepInVault;
            uint _WAVAXAmt = swap(address(DAI), address(WAVAX), DAIAmt, amountsOutMin[2]);
            WAVAXAmt += _WAVAXAmt;
            tokenAmtToInvest = tokenAmtToInvest + DAIAmt;
        }
    }

    function calcTokenKeepInVault(uint _percKeepInVault, uint pool) private pure returns (uint) {
        return pool * _percKeepInVault / 10000;
    }

    /// @param amount Amount to reimburse (decimal follow token)
    function reimburse(uint farmIndex, address token, uint amount, uint[] calldata amountsOutMin) external onlyOwnerOrAdmin {
        uint WAVAXAmt;
        WAVAXAmt = joeRouter.getAmountsOut(amount, getPath(token, address(WAVAX)))[1];
        WAVAXAmt = strategy.reimburse(farmIndex, WAVAXAmt, amountsOutMin);
        swap(address(WAVAX), token, WAVAXAmt, amountsOutMin[0]);

        if (token != address(DAI)) amount *= 1e12;
        strategy.adjustWatermark(amount, false);

        emit Reimburse(farmIndex, token, amount);
    }

    function emergencyWithdraw() external onlyOwnerOrAdmin whenNotPaused {
        _pause();
        
        strategy.emergencyWithdraw();
        uint portionWAVAXAmt = WAVAX.balanceOf(address(this)) / 3;
        swap(address(WAVAX), address(USDT), portionWAVAXAmt, 0);
        swap(address(WAVAX), address(USDC), portionWAVAXAmt, 0);
        swap(address(WAVAX), address(DAI), portionWAVAXAmt, 0);
    }

    function reinvest(uint[] calldata amountsOutMin) external onlyOwnerOrAdmin whenPaused {
        _unpause();

        (uint USDTAmt, uint USDCAmt, uint DAIAmt) = transferOutFees();
        (uint WAVAXAmt, uint tokenAmtToInvest,) = swapTokenToWAVAX(USDTAmt, USDCAmt, DAIAmt, amountsOutMin);
        strategy.invest(WAVAXAmt, amountsOutMin);
        strategy.adjustWatermark(tokenAmtToInvest, true);

        emit Reinvest(WAVAXAmt);
    }
    
    function releaseLPToken() external onlyOwner {
        require(paused(), "Not paused");
        
        distributeLPToken(getAllPoolInUSD());
    }

    function swap(address from, address to, uint amount, uint amountOutMin) private returns (uint) {
        return joeRouter.swapExactTokensForTokens(
            amount, amountOutMin, getPath(from, to), address(this), block.timestamp
        )[1];
    }

    function setNetworkFeeTier(uint[] calldata _networkFeeTier) external onlyOwner {
        require(_networkFeeTier[0] != 0, "Minimun amount cannot be 0");
        require(_networkFeeTier[1] > _networkFeeTier[0], "Maximun amount must > minimun amount");
        require(_networkFeeTier[2] > networkFeeTier[1], "Must > tier 2");

        uint[] memory oldNetworkFeeTier = networkFeeTier;
        networkFeeTier = _networkFeeTier;
        emit SetNetworkFeeTier(oldNetworkFeeTier, _networkFeeTier);
    }

    function setNetworkFeePerc(uint[] calldata _networkFeePerc) external onlyOwner {
        require(_networkFeePerc[0] < 3001 && _networkFeePerc[1] < 3001 && _networkFeePerc[2] < 3001, "Not allow > 30%");
        require(_networkFeePerc[3] < networkFeePerc[2], "Not allow > tier 2");

        uint[] memory oldNetworkFeePerc = networkFeePerc;
        networkFeePerc = _networkFeePerc;

        emit SetNetworkFeePerc(oldNetworkFeePerc, _networkFeePerc);
    }

    function setProfitFeePerc(uint profitFeePerc) external onlyOwner {
        require(profitFeePerc < 3001, "Profit fee cannot > 30%");

        uint oldProfitFeePerc = strategy.profitFeePerc();
        strategy.setProfitFeePerc(profitFeePerc);

        emit SetProfitFeePerc(oldProfitFeePerc, profitFeePerc);
    }

    function setPercKeepInVault(uint[] calldata _percKeepInVault) external onlyOwner {
        uint[] memory oldPercKeepInVault = percKeepInVault;
        percKeepInVault = _percKeepInVault;

        emit SetPercKeepInVault(oldPercKeepInVault, _percKeepInVault);
    }

    function setAddresses(address _treasuryWallet, address _communityWallet, address _admin) external onlyOwner {
        address oldTreasuryWallet = treasuryWallet;
        address oldCommunityWallet = communityWallet;
        address oldAdmin = admin;

        treasuryWallet = _treasuryWallet;
        communityWallet = _communityWallet;
        admin = _admin;

        emit SetAddresses(oldTreasuryWallet, _treasuryWallet, oldCommunityWallet, _communityWallet, oldAdmin, _admin);
    }

    function getOtherTokenAndBal(IERC20Upgradeable token) private view returns (
        address token1, uint token1AmtInVault, address token2, uint token2AmtInVault
    ) {
        if (token == USDT) {
            token1 = address(USDC);
            token1AmtInVault = USDC.balanceOf(address(this)) * 1e12;
            token2 = address(DAI);
            token2AmtInVault = DAI.balanceOf(address(this));
        } else if (token == USDC) {
            token1 = address(USDT);
            token1AmtInVault = USDT.balanceOf(address(this)) * 1e12;
            token2 = address(DAI);
            token2AmtInVault = DAI.balanceOf(address(this));
        } else {
            token1 = address(USDT);
            token1AmtInVault = USDT.balanceOf(address(this)) * 1e12;
            token2 = address(USDC);
            token2AmtInVault = USDC.balanceOf(address(this)) * 1e12;
        }
    }

    function getCurveId(address token) private pure returns (int128) {
        if (token == address(USDT)) return 2;
        else if (token == address(USDC)) return 1;
        else return 0; // DAI
    }

    function getPath(address tokenA, address tokenB) private pure returns (address[] memory path) {
        path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
    }

    function getTotalPendingDeposits() external view returns (uint) {
        return addresses.length;
    }

    function getAllPoolInUSD() public view returns (uint) {
        // AVAXPriceInUSD amount in 8 decimals
        uint AVAXPriceInUSD = uint(IChainlink(0x0A77230d17318075983913bC2145DB16C7366156).latestAnswer());
        require(AVAXPriceInUSD > 0, "ChainLink error");

        uint tokenKeepInVault = USDT.balanceOf(address(this)) * 1e12 +
            USDC.balanceOf(address(this)) * 1e12 + DAI.balanceOf(address(this));

        if (paused()) return WAVAX.balanceOf(address(this)) * AVAXPriceInUSD / 1e8 + tokenKeepInVault - fees;
        uint strategyPoolInUSD = strategy.getAllPoolInAVAX() * AVAXPriceInUSD / 1e8;
        
        return strategyPoolInUSD + tokenKeepInVault - fees;
    }

    /// @notice Can be use for calculate both user shares & APR    
    function getPricePerFullShare() external view returns (uint) {
        return (getAllPoolInUSD() - totalPendingDepositAmt) * 1e18 / totalSupply();
    }
}