//SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
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

    function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts);
}

interface IPair is IERC20Upgradeable {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

interface IMasterChef {
    function deposit(uint pid, uint amount) external;
    function withdraw(uint pid, uint amount) external;
    function userInfo(uint pid, address account) external view returns (uint amount, uint rewardDebt);
    function poolInfo(uint pid) external view returns (address lpToken, uint allocPoint, uint lastRewardBlock, uint accJOEPerShare);
    function pendingTokens(uint pid, address account) external view returns (uint);
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

interface IChainlink {
    function latestAnswer() external view returns (int256);
}

interface IWAVAX is IERC20Upgradeable {
    function withdraw(uint amount) external;
}

contract AvaxVaultL1Kovan is Initializable, ERC20Upgradeable, ReentrancyGuardUpgradeable, OwnableUpgradeable, PausableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeERC20Upgradeable for IPair;
    using SafeERC20Upgradeable for IWAVAX;

    IRouter public router;
    IMasterChef public masterChef;
    IStakingReward public stakingReward;
    uint public poolId;
    bool public isPng;

    IPair public lpToken;
    IERC20Upgradeable public token0;
    IERC20Upgradeable public token1;
    uint token0Decimal;
    uint token1Decimal;
    IWAVAX constant WAVAX = IWAVAX(0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7); 
    IERC20Upgradeable public rewardToken;
    
    address public treasuryWallet;
    address public communityWallet;
    address public admin; 

    uint public yieldFeePerc;
    uint public depositFeePerc;

    mapping(address => bool) public isWhitelisted;

    event Deposit(address caller, uint amtDeposited, uint sharesMinted);
    event Withdraw(address caller, uint amtWithdrawed, uint sharesBurned);
    event Invest(uint amtInvested);
    event Yield(uint amount);
    event EmergencyWithdraw(uint amtTokenWithdrawed);
    event SetWhitelistAddress(address _address, bool status);
    event SetFee(uint _yieldFeePerc, uint _depositFeePerc);
    event SetTreasuryWallet(address treasuryWallet);
    event SetCommunityWallet(address communityWallet);
    event SetAdminWallet(address admin);
    event SetStrategistWallet(address strategistWallet);
    event SetAdmin(address admin);

    modifier onlyOwnerOrAdmin {
        require(msg.sender == owner() || msg.sender == address(admin), "Only owner or admin");
        _;
    }

    function initialize(
            string calldata name, string calldata symbol,
            IRouter _router, address _stakingContract, IERC20Upgradeable _rewardToken, uint _poolId, bool _isPng,
            address _treasuryWallet, address _communityWallet, address _admin
        ) external initializer {
        __ERC20_init(name, symbol);
        __Ownable_init();

        router = _router;
        if (_isPng) {
            stakingReward = IStakingReward(_stakingContract);
            isPng = true;
        } else {
            masterChef = IMasterChef(_stakingContract);
        }
        rewardToken = _rewardToken;

        poolId = _poolId;
        address _lpToken;
        // if (_isPng) _lpToken = stakingReward.stakingToken();
        // else (_lpToken,,,) = masterChef.poolInfo(_poolId);
        // lpToken = IPair(_lpToken);
        // token0 = IERC20Upgradeable(lpToken.token0());
        // token1 = IERC20Upgradeable(lpToken.token1());
        // token0Decimal = ERC20Upgradeable(address(token0)).decimals();
        // token1Decimal = ERC20Upgradeable(address(token1)).decimals();

        treasuryWallet = _treasuryWallet;
        communityWallet = _communityWallet;
        admin = _admin;

        yieldFeePerc = 2000;
        depositFeePerc = 1000;

        // token0.safeApprove(address(_router), type(uint).max);
        // token1.safeApprove(address(_router), type(uint).max);
        // lpToken.safeApprove(address(_router), type(uint).max);
        // if (isPng) lpToken.safeApprove(_stakingContract, type(uint).max);
        // else lpToken.safeApprove(address(masterChef), type(uint).max);
        // if (address(rewardToken) != address(token0) && address(rewardToken) != address(token1)) {
        //     rewardToken.safeApprove(address(_router), type(uint).max);
        // }
        // if (address(token0) != address(WAVAX) && address(token1) != address(WAVAX)) {
        //     WAVAX.safeApprove(address(_router), type(uint).max);
        // }
    }

    function deposit(uint amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must > 0");
        require(isWhitelisted[msg.sender], "Not whitelisted");
        uint amtDeposit = amount;

        uint pool = getAllPool();
        lpToken.safeTransferFrom(msg.sender, address(this), amount);

        uint _totalSupply = totalSupply();
        uint share = _totalSupply == 0 ? amount : amount * _totalSupply / pool;
        _mint(msg.sender, share);
        emit Deposit(msg.sender, amtDeposit, share);
    }

    function withdraw(uint share) external nonReentrant returns (uint withdrawAmt) {
        require(share > 0, "Share must > 0");
        require(share <= balanceOf(msg.sender), "Not enough shares to withdraw");

        uint lpTokenBalInVault = lpToken.balanceOf(address(this));
        uint lpTokenBalInFarm;
        if (isPng) {
            lpTokenBalInFarm = stakingReward.balanceOf(address(this));
        } else {
            (lpTokenBalInFarm,) = masterChef.userInfo(poolId, address(this));
        }
        withdrawAmt = (lpTokenBalInVault + lpTokenBalInFarm) * share / totalSupply();
        _burn(msg.sender, share);

        if (withdrawAmt > lpTokenBalInVault) {
            uint amtToWithdraw = withdrawAmt - lpTokenBalInVault;
            if (isPng) {
                stakingReward.withdraw(amtToWithdraw);
            } else {
                masterChef.withdraw(poolId, amtToWithdraw);
            }
        }

        lpToken.safeTransfer(msg.sender, withdrawAmt);
        emit Withdraw(msg.sender, withdrawAmt, share);
    }

    function invest() public onlyOwnerOrAdmin whenNotPaused {
        if (isPng) stakingReward.stake(lpToken.balanceOf(address(this)));
        else masterChef.deposit(poolId, lpToken.balanceOf(address(this)));
    }

    function yield() external onlyOwnerOrAdmin whenNotPaused {
        if (isPng) stakingReward.getReward();
        else masterChef.withdraw(poolId, 0);

        uint WAVAXAmt = (router.swapExactTokensForTokens(
            rewardToken.balanceOf(address(this)), 0,
            getPath(address(rewardToken), address(WAVAX)), address(this), block.timestamp
        ))[1];

        uint fee = WAVAXAmt * yieldFeePerc / 10000;
        WAVAX.withdraw(fee);
        WAVAXAmt = WAVAXAmt - fee;

        uint portionAVAX = address(this).balance / 2;
        (bool _a,) = admin.call{value: portionAVAX}("");
        require(_a, "Fee transfer failed");
        (bool _t,) = communityWallet.call{value: portionAVAX}("");
        require(_t, "Fee transfer failed");

        uint token0Amt;
        uint token1Amt;
        uint halfWAVAXAmt = WAVAXAmt / 2;
        if (token0 == WAVAX) {
            token1Amt = swap(address(WAVAX), address(token1), halfWAVAXAmt);
            token0Amt = halfWAVAXAmt;
        } else if (token1 == WAVAX) {
            token0Amt = swap(address(WAVAX), address(token0), halfWAVAXAmt);
            token1Amt = halfWAVAXAmt;
        } else {
            token0Amt = swap(address(WAVAX), address(token0), halfWAVAXAmt);
            token1Amt = swap(address(WAVAX), address(token1), halfWAVAXAmt);
        }

        router.addLiquidity(address(token0), address(token1), token0Amt, token1Amt, 0, 0, address(this), block.timestamp);

        emit Yield(WAVAXAmt);
    }

    receive() external payable {}

    function emergencyWithdraw() external onlyOwnerOrAdmin {
        _pause();
        (uint lpTokenAmtInFarm,) = masterChef.userInfo(poolId, address(this));
        if (lpTokenAmtInFarm > 0) {
            masterChef.withdraw(poolId, lpTokenAmtInFarm);
        }
        emit EmergencyWithdraw(lpTokenAmtInFarm);
    }

    function reinvest() external onlyOwnerOrAdmin whenPaused {
        _unpause();
        invest();
    }

    function swap(address from, address to, uint amount) private returns (uint) {
        return router.swapExactTokensForTokens(amount, 0, getPath(from, to), address(this), block.timestamp)[1];
    }

    function setWhitelistAddress(address _addr, bool _status) external onlyOwnerOrAdmin {
        isWhitelisted[_addr] = _status;
        emit SetWhitelistAddress(_addr, _status);
    }

    function setFee(uint _yieldFeePerc, uint _depositFeePerc) external onlyOwner {
        yieldFeePerc = _yieldFeePerc;
        depositFeePerc = _depositFeePerc;
        emit SetFee(_yieldFeePerc, _depositFeePerc);
    }

    function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
        treasuryWallet = _treasuryWallet;
        emit SetTreasuryWallet(_treasuryWallet);
    }

    function setCommunityWallet(address _communityWallet) external onlyOwner {
        communityWallet = _communityWallet;
        emit SetCommunityWallet(_communityWallet);
    }

    function setAdmin(address _admin) external onlyOwner {
        admin = _admin;
        emit SetAdmin(_admin);
    }

    function getPath(address tokenA, address tokenB) private pure returns (address[] memory path) {
        path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
    }

    function getLpTokenPriceInAVAX() private view returns (uint) {
        (uint112 reserveToken0, uint112 reserveToken1,) = lpToken.getReserves();

        uint totalReserveTokenInAVAX;
        if (token0 == WAVAX) {
            uint token1PriceInAVAX = router.getAmountsOut(10 ** token1Decimal, getPath(address(token1), address(WAVAX)))[1];
            uint reserveToken1InAVAX = reserveToken1 * token1PriceInAVAX / 10 ** token1Decimal;
            totalReserveTokenInAVAX = reserveToken0 + reserveToken1InAVAX;
        } else if (token1 == WAVAX) {
            uint token0PriceInAVAX = router.getAmountsOut(10 ** token0Decimal, getPath(address(token0), address(WAVAX)))[1];
            uint reserveToken0InAVAX = reserveToken0 * token0PriceInAVAX / 10 ** token0Decimal;
            totalReserveTokenInAVAX = reserveToken1 + reserveToken0InAVAX;
        } else {
            uint token0PriceInAVAX = router.getAmountsOut(10 ** token0Decimal, getPath(address(token0), address(WAVAX)))[1];
            uint reserveToken0InAVAX = reserveToken0 * token0PriceInAVAX / 10 ** token0Decimal;

            uint token1PriceInAVAX;
            if (address(lpToken) == 0x4EE072c5946B4cdc00CBdeB4A4E54A03CF6d08d3) {
                // This calculation specific for LYD-DAI only, since no DAI-AVAX pool in Lydia
                // Use USDT-AVAX pool to calculate instead
                address USDTAddr = 0xc7198437980c041c805A1EDcbA50c1Ce5db95118;
                uint USDTPriceInAVAX = router.getAmountsOut(1e18, getPath(address(token1), USDTAddr))[1];
                token1PriceInAVAX = router.getAmountsOut(USDTPriceInAVAX, getPath(USDTAddr, address(WAVAX)))[1];
            } else {
                token1PriceInAVAX = router.getAmountsOut(10 ** token1Decimal, getPath(address(token1), address(WAVAX)))[1];
            }

            uint reserveToken1InAVAX = reserveToken1 * token1PriceInAVAX / 10 ** token1Decimal;
            totalReserveTokenInAVAX = reserveToken0InAVAX + reserveToken1InAVAX;
        }

        return totalReserveTokenInAVAX * 1e18 / lpToken.totalSupply();
    }

    function getLpTokenPriceInUSD() private view returns (uint) {
        uint AVAXPriceInUSD = uint(IChainlink(0x0A77230d17318075983913bC2145DB16C7366156).latestAnswer()); // 8 decimals
        require(AVAXPriceInUSD != 0, "ChainLink error");
        return getLpTokenPriceInAVAX() * AVAXPriceInUSD / 1e8;
    }

    /// @return Pending rewards in rewardToken
    /// @dev Rewards also been claimed while deposit or withdraw through masterChef contract
    function getPendingRewards() external view returns (uint) {
        uint pendingRewards;
        if (isPng) {
            // Pangolin stakingReward contract
            pendingRewards = stakingReward.earned(address(this));
        } else if (address(rewardToken) == 0x4C9B4E1AC6F24CdE3660D5E4Ef1eBF77C710C084) {
            // Lydia masterChef use different function for pendingTokens
            pendingRewards = masterChef.pendingLyd(poolId, address(this));
        } else {
            // Trader Joe masterChef
            pendingRewards = masterChef.pendingTokens(poolId, address(this));
        }

        return pendingRewards + rewardToken.balanceOf(address(this));
    }

    function getAllPool() public view returns (uint) {
        uint lpTokenAmtInFarm;
        if (isPng) lpTokenAmtInFarm = stakingReward.balanceOf(address(this));
        else (lpTokenAmtInFarm, ) = masterChef.userInfo(poolId, address(this));
        return lpToken.balanceOf(address(this)) + lpTokenAmtInFarm;
    }

    function getAllPoolInAVAX() public view returns (uint) {
        return getAllPool() * getLpTokenPriceInAVAX() / 1e18;
    }

    function getAllPoolInUSD() public view returns (uint) {
        return getAllPool() * getLpTokenPriceInUSD() / 1e18;
    }

    /// @param inUSD true for calculate user share in USD, false for calculate APR
    function getPricePerFullShare(bool inUSD) external view returns (uint) {
        uint _totalSupply = totalSupply();
        if (_totalSupply == 0) return 0;
        return inUSD == true ?
            getAllPoolInUSD() * 1e18 / _totalSupply :
            getAllPool() * 1e18 / _totalSupply;
    }
}
