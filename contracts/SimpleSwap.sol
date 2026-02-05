// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SimpleSwap
 * @notice A simple DEX for testnet that allows token swaps using oracle prices
 * @dev This is for TESTNET ONLY - uses trusted price feeds
 */
contract SimpleSwap is Ownable, ReentrancyGuard {
    
    // Price oracle (simplified - in production use Chainlink)
    mapping(address => uint256) public tokenPrices; // Price in USD with 6 decimals (e.g., 3200000000 = $3200)
    
    // Fee in basis points (e.g., 30 = 0.3%)
    uint256 public swapFeeBps = 30;
    
    // Events
    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    
    event PriceUpdated(address indexed token, uint256 price);
    event FeeUpdated(uint256 newFeeBps);
    
    constructor() Ownable(msg.sender) {
        // Set initial prices (can be updated by owner)
        tokenPrices[address(0)] = 3200_000000; // ETH = $3200
        tokenPrices[0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14] = 3200_000000; // WETH = $3200
        tokenPrices[0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238] = 1_000000; // USDC = $1
        tokenPrices[0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0] = 1_000000; // USDT = $1
        tokenPrices[0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357] = 1_000000; // DAI = $1
    }
    
    /**
     * @notice Swap tokens using oracle prices
     * @param tokenIn Input token address (address(0) for ETH)
     * @param tokenOut Output token address (address(0) for ETH)
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum output amount (slippage protection)
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external payable nonReentrant returns (uint256 amountOut) {
        require(tokenIn != tokenOut, "Same token");
        require(amountIn > 0, "Zero amount");
        require(tokenPrices[tokenIn] > 0, "Price not set for tokenIn");
        require(tokenPrices[tokenOut] > 0, "Price not set for tokenOut");
        
        // Handle ETH input
        if (tokenIn == address(0)) {
            require(msg.value == amountIn, "ETH amount mismatch");
        } else {
            require(msg.value == 0, "ETH not expected");
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        }
        
        // Calculate output amount based on prices
        uint256 tokenInDecimals = tokenIn == address(0) ? 18 : getDecimals(tokenIn);
        uint256 tokenOutDecimals = tokenOut == address(0) ? 18 : getDecimals(tokenOut);
        
        // Value in USD = amountIn * priceIn / (10^tokenInDecimals)
        // amountOut = valueUSD * (10^tokenOutDecimals) / priceOut
        uint256 valueUSD = (amountIn * tokenPrices[tokenIn]) / (10 ** tokenInDecimals);
        amountOut = (valueUSD * (10 ** tokenOutDecimals)) / tokenPrices[tokenOut];
        
        // Apply fee
        uint256 fee = (amountOut * swapFeeBps) / 10000;
        amountOut = amountOut - fee;
        
        require(amountOut >= minAmountOut, "Slippage exceeded");
        
        // Transfer output tokens
        if (tokenOut == address(0)) {
            require(address(this).balance >= amountOut, "Insufficient ETH");
            payable(msg.sender).transfer(amountOut);
        } else {
            require(IERC20(tokenOut).balanceOf(address(this)) >= amountOut, "Insufficient balance");
            IERC20(tokenOut).transfer(msg.sender, amountOut);
        }
        
        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
        
        return amountOut;
    }
    
    /**
     * @notice Get quote for a swap
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @return amountOut Expected output amount (before slippage)
     */
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut) {
        require(tokenPrices[tokenIn] > 0, "Price not set for tokenIn");
        require(tokenPrices[tokenOut] > 0, "Price not set for tokenOut");
        
        uint256 tokenInDecimals = tokenIn == address(0) ? 18 : getDecimals(tokenIn);
        uint256 tokenOutDecimals = tokenOut == address(0) ? 18 : getDecimals(tokenOut);
        
        uint256 valueUSD = (amountIn * tokenPrices[tokenIn]) / (10 ** tokenInDecimals);
        amountOut = (valueUSD * (10 ** tokenOutDecimals)) / tokenPrices[tokenOut];
        
        // Apply fee
        uint256 fee = (amountOut * swapFeeBps) / 10000;
        amountOut = amountOut - fee;
        
        return amountOut;
    }
    
    /**
     * @notice Update price for a token
     * @param token Token address
     * @param price Price in USD with 6 decimals
     */
    function setPrice(address token, uint256 price) external onlyOwner {
        tokenPrices[token] = price;
        emit PriceUpdated(token, price);
    }
    
    /**
     * @notice Update swap fee
     * @param newFeeBps New fee in basis points
     */
    function setSwapFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Fee too high"); // Max 10%
        swapFeeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }
    
    /**
     * @notice Add liquidity (ETH)
     */
    function addLiquidityETH() external payable onlyOwner {
        require(msg.value > 0, "Zero amount");
    }
    
    /**
     * @notice Add liquidity (ERC20)
     */
    function addLiquidity(address token, uint256 amount) external onlyOwner {
        IERC20(token).transferFrom(msg.sender, address(this), amount);
    }
    
    /**
     * @notice Withdraw liquidity (ETH)
     */
    function withdrawETH(uint256 amount) external onlyOwner {
        payable(owner()).transfer(amount);
    }
    
    /**
     * @notice Withdraw liquidity (ERC20)
     */
    function withdrawTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
    
    /**
     * @notice Get token decimals
     */
    function getDecimals(address token) internal view returns (uint256) {
        if (token == 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238) return 6; // USDC
        if (token == 0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0) return 6; // USDT
        return 18; // Default for most tokens
    }
    
    // Allow contract to receive ETH
    receive() external payable {}
}
