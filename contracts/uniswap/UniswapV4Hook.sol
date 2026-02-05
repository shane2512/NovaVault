// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {BaseHook} from "./BaseHook.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";

/**
 * @title UniswapV4Hook
 * @notice Custom hook for NovaVault wallet swaps on Unichain
 * @dev Deploy this contract on Unichain network
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Deploy on Unichain testnet
 * 2. Update .env with: UNICHAIN_HOOK_ADDRESS=<deployed_address>
 * 3. Register hook with PoolManager
 */
contract UniswapV4Hook is BaseHook {
    
    // Track swap origins for security
    mapping(address => bool) public authorizedWallets;
    
    // Swap statistics
    struct SwapStats {
        uint256 totalSwaps;
        uint256 totalVolume;
        uint256 lastSwapTimestamp;
    }
    mapping(address => SwapStats) public walletStats;
    
    // Events
    event WalletAuthorized(address indexed wallet);
    event SwapExecuted(
        address indexed sender,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    
    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}
    
    /**
     * @notice Get hook permissions
     * @dev Specify which hooks this contract implements
     */
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,  // We use beforeSwap
            afterSwap: true,   // We use afterSwap
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }
    
    /**
     * @notice Hook called before swap execution
     * @param sender The address initiating the swap
     * @param key The pool key
     * @param params The swap parameters
     * @param hookData Custom data passed from the swap initiator
     * @return The function selector if successful
     */
    function beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata hookData
    ) external override returns (bytes4, BeforeSwapDelta, uint24) {
        // Verify sender is authorized
        require(authorizedWallets[sender], "Unauthorized wallet");
        
        // Log swap initiation
        emit SwapExecuted(
            sender,
            Currency.unwrap(key.currency0),
            Currency.unwrap(key.currency1),
            params.amountSpecified > 0 ? uint256(params.amountSpecified) : uint256(-params.amountSpecified),
            0  // amountOut calculated in afterSwap
        );
        
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }
    
    /**
     * @notice Hook called after swap execution
     * @param sender The address initiating the swap
     * @param key The pool key
     * @param params The swap parameters
     * @param delta The balance changes from the swap
     * @param hookData Custom data passed from the swap initiator
     * @return The function selector if successful
     */
    function afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external override returns (bytes4, int128) {
        // Update wallet statistics
        SwapStats storage stats = walletStats[sender];
        stats.totalSwaps++;
        stats.lastSwapTimestamp = block.timestamp;
        
        uint256 volume = params.amountSpecified > 0 
            ? uint256(params.amountSpecified) 
            : uint256(-params.amountSpecified);
        stats.totalVolume += volume;
        
        return (BaseHook.afterSwap.selector, 0);
    }
    
    // Stub implementations for required hooks we don't use
    function afterAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external override returns (bytes4, BalanceDelta) {
        return (BaseHook.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }
    
    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external override returns (bytes4, BalanceDelta) {
        return (BaseHook.afterRemoveLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }
    
    /**
     * @notice Authorize a wallet to use this hook
     * @param wallet The wallet address to authorize
     */
    function authorizeWallet(address wallet) external {
        require(msg.sender == address(poolManager), "Only PoolManager");
        authorizedWallets[wallet] = true;
        emit WalletAuthorized(wallet);
    }
    
    /**
     * @notice Get swap statistics for a wallet
     * @param wallet The wallet address
     * @return totalSwaps Total number of swaps
     * @return totalVolume Total volume traded
     * @return lastSwapTimestamp Last swap timestamp
     */
    function getWalletStats(address wallet) external view returns (
        uint256 totalSwaps,
        uint256 totalVolume,
        uint256 lastSwapTimestamp
    ) {
        SwapStats memory stats = walletStats[wallet];
        return (stats.totalSwaps, stats.totalVolume, stats.lastSwapTimestamp);
    }
}
