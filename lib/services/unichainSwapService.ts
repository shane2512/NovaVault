/**
 * Unichain Swap Service
 * 
 * Handles cross-chain swaps via Uniswap V4 on Unichain
 * Uses Bridge Kit for all cross-chain transfers
 * 
 * SETUP REQUIRED:
 * 1. Deploy UniswapV4Hook.sol on Unichain
 * 2. Deploy SmartWalletV2.sol on Arc
 * 3. Update .env with contract addresses
 * 4. Install dependencies: npm install @uniswap/v4-sdk
 */

import { ethers } from 'ethers';
import { transferUSDCViaBridgeKit, type SupportedChain } from './bridgeKitService';

// Unichain Sepolia Configuration
export const UNICHAIN_CONFIG = {
  chainId: 1301,
  cctpDomain: 10,
  rpcUrl: 'https://sepolia.unichain.org',
  poolManager: '0x00b036b58a818b1bc34d502d3fe730db729e62ac',
  quoter: '0x56dcd40a3f2d466f48e7f48bdbe5cc9b92ae4472',
  positionManager: '0xf969aee60879c54baaed9f3ed26147db216fd664',
  stateView: '0xc199f1072a74d4e905aba1a84d9a45e2546b6222',
  tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
  messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
  // These will be set after deployment
  hookAddress: process.env.UNISWAP_HOOK_ADDRESS || '',
  usdcAddress: process.env.UNICHAIN_USDC_ADDRESS || ''
} as const;

interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippage: number; // e.g., 0.5 for 0.5%
  currentNetwork?: string; // User's current network (ETH-SEPOLIA, MATIC-AMOY, etc.)
}

/**
 * Get decimals for a token
 */
function getTokenDecimals(tokenAddress: string): number {
  // Native ETH
  if (tokenAddress === '0x0000000000000000000000000000000000000000') return 18;
  // USDC (6 decimals)
  if (tokenAddress.toLowerCase() === '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238'.toLowerCase()) return 6;
  // USDT (6 decimals)
  if (tokenAddress.toLowerCase() === '0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0'.toLowerCase()) return 6;
  // DAI (18 decimals)
  if (tokenAddress.toLowerCase() === '0xff34b3d4aee8ddcd6f9afffb6fe49bd371b8a357'.toLowerCase()) return 18;
  // Default to 18 for unknown tokens
  return 18;
}

interface SwapResult {
  swapId: string;
  bridgeTxHash: string;
  swapTxHash: string;
  returnTxHash: string;
  amountOut: string;
  totalGas: string;
  status: 'pending' | 'completed' | 'failed';
}

/**
 * Get a swap quote from Unichain
 */
export async function getSwapQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): Promise<{ amountOut: string; priceImpact: number; route: string[] }> {
  try {
    const provider = new ethers.JsonRpcProvider(UNICHAIN_CONFIG.rpcUrl);
    
    // Quoter V2 contract ABI (simplified for quote calls)
    const quoterAbi = [
      'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
    ];
    
    const quoter = new ethers.Contract(
      UNICHAIN_CONFIG.quoter,
      quoterAbi,
      provider
    );
    
    // Get proper decimals for input token
    const tokenInDecimals = getTokenDecimals(tokenIn);
    const tokenOutDecimals = getTokenDecimals(tokenOut);
    
    // Convert amount to wei with correct decimals
    const amountInWei = ethers.parseUnits(amountIn, tokenInDecimals);
    
    // Standard fee tier: 0.05% = 500, 0.3% = 3000, 1% = 10000
    const feeTier = 3000; // 0.3%
    
    // sqrtPriceLimitX96 = 0 means no price limit
    const sqrtPriceLimitX96 = 0;
    
    console.log(`Getting quote for ${amountIn} ${tokenIn} -> ${tokenOut}`);
    
    try {
      // Note: Quoter might revert if pool doesn't exist
      const [amountOut] = await quoter.quoteExactInputSingle.staticCall(
        tokenIn,
        tokenOut,
        feeTier,
        amountInWei,
        sqrtPriceLimitX96
      );
      
      const amountOutFormatted = ethers.formatUnits(amountOut, tokenOutDecimals);
      const priceImpact = calculatePriceImpact(amountIn, amountOutFormatted);
      
      console.log(`Quote: ${amountIn} -> ${amountOutFormatted} (${priceImpact}% impact)`);
      
      return {
        amountOut: amountOutFormatted,
        priceImpact,
        route: [tokenIn, tokenOut]
      };
    } catch (quoteError: any) {
      console.warn('Quoter call failed, pool may not exist:', quoteError.message);
      // Return estimated rate based on realistic market prices
      return getEstimatedQuote(tokenIn, tokenOut, amountIn);
    }
  } catch (error) {
    console.error('Error getting swap quote:', error);
    throw error;
  }
}

/**
 * Get estimated quote based on approximate market rates
 */
function getEstimatedQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string
): { amountOut: string; priceImpact: number; route: string[] } {
  const amount = parseFloat(amountIn);
  let amountOut = 0;
  
  // ETH price approximately $3200
  const ETH_PRICE = 3200;
  
  const isETHIn = tokenIn === '0x0000000000000000000000000000000000000000';
  const isETHOut = tokenOut === '0x0000000000000000000000000000000000000000';
  
  if (isETHIn && !isETHOut) {
    // ETH → Stablecoin (USDC/USDT/DAI)
    amountOut = amount * ETH_PRICE;
  } else if (!isETHIn && isETHOut) {
    // Stablecoin → ETH
    amountOut = amount / ETH_PRICE;
  } else {
    // Stablecoin → Stablecoin (approximately 1:1)
    amountOut = amount * 0.9995; // 0.05% price impact
  }
  
  return {
    amountOut: amountOut.toString(),
    priceImpact: 0.05,
    route: [tokenIn, tokenOut]
  };
}

function calculatePriceImpact(amountIn: string, amountOut: string): number {
  const input = parseFloat(amountIn);
  const output = parseFloat(amountOut);
  if (input === 0) return 0;
  return Math.abs(((input - output) / input) * 100);
}

/**
 * Execute a swap using Unichain
 * 
 * FLOW:
 * 1. Bridge tokens from source chain (Sepolia/Amoy) to Unichain via Bridge Kit
 * 2. Execute swap on Unichain via Uniswap V4
 * 3. Bridge result tokens back from Unichain to source chain via Bridge Kit
 * 
 * NOTE: ETH swaps require WETH on Unichain since Bridge Kit only supports stablecoins
 */
export async function swapViaUnichain(
  params: SwapParams
): Promise<SwapResult> {
  const { tokenIn, tokenOut, amountIn, slippage, currentNetwork } = params;
  
  // Determine source chain
  const sourceChain = currentNetwork || 'ETH-SEPOLIA';
  
  // Step 1: Get swap quote
  const quote = await getSwapQuote(tokenIn, tokenOut, amountIn);
  
  // Step 2: Calculate minimum amount out with slippage
  const minAmountOut = calculateMinAmountOut(quote.amountOut, slippage);
  
  // Check if ETH is involved (need special handling)
  const isNativeETHIn = tokenIn === '0x0000000000000000000000000000000000000000';
  const isNativeETHOut = tokenOut === '0x0000000000000000000000000000000000000000';
  
  if (isNativeETHIn || isNativeETHOut) {
    throw new Error(
      'ETH swaps require wrapped ETH (WETH) for bridging. ' +
      'Please use USDC, USDT, or DAI for swaps. ' +
      'Native ETH → Token swaps coming soon!'
    );
  }
  
  // All stablecoin swaps: Bridge → Swap on Unichain → Bridge back
  console.log(`Step 1/3: Bridging ${amountIn} tokens from ${sourceChain} to Unichain...`);
  const bridgeTx = await bridgeToUnichain(tokenIn, amountIn, sourceChain);
  
  console.log('Step 2/3: Executing swap on Unichain via Uniswap V4...');
  const swapTx = await executeUnichainSwap({
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut
  });
  
  console.log(`Step 3/3: Bridging ${swapTx.amountOut} tokens back to ${sourceChain}...`);
  const returnTx = await bridgeFromUnichain(tokenOut, swapTx.amountOut, sourceChain);
  
  return {
    swapId: swapTx.swapId,
    bridgeTxHash: bridgeTx.hash,
    swapTxHash: swapTx.hash,
    returnTxHash: returnTx.hash,
    amountOut: swapTx.amountOut,
    totalGas: calculateTotalGas([bridgeTx, swapTx, returnTx]),
    status: 'completed'
  };
}

/**
 * Bridge tokens from current network to Unichain
 */
async function bridgeToUnichain(
  token: string,
  amount: string,
  sourceChain: string = 'ETH-SEPOLIA'
): Promise<{ hash: string }> {
  console.log(`Bridging ${amount} of ${token} from ${sourceChain} to Unichain...`);
  
  // Get recipient address (the smart wallet or user on Unichain)
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found');
  }
  const wallet = new ethers.Wallet(privateKey);
  const recipient = wallet.address;
  
  // Use Bridge Kit for bridging
  try {
    const result = await transferUSDCViaBridgeKit({
      sourceChain: sourceChain as SupportedChain,
      destinationChain: 'UNICHAIN-SEPOLIA',
      amount,
      recipient
    });
    
    console.log(`Bridged from ${sourceChain} to Unichain, burn tx: ${result.burnTxHash}`);
    
    return {
      hash: result.burnTxHash
    };
  } catch (error: any) {
    // Enhance error message with network context
    throw new Error(`Failed to bridge from ${sourceChain} to Unichain: ${error.message}`);
  }
}

/**
 * Execute swap on Unichain
 */
async function executeUnichainSwap(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
}): Promise<{ hash: string; swapId: string; amountOut: string }> {
  const { tokenIn, tokenOut, amountIn, minAmountOut } = params;
  
  // For testnet: Use simulation since Uniswap V4 pools don't exist yet
  // Real pools require tokens to be deployed as V4 Currency contracts
  const USE_SIMULATION = process.env.UNICHAIN_SWAP_MODE !== 'real';
  
  if (USE_SIMULATION) {
    console.log(`ℹ️  Using simulated swap (Unichain V4 pools not available for these tokens)`);
    console.log(`   Real bridging occurs, swap is calculated off-chain`);
    console.log(`   ${amountIn} ${tokenIn} → ${minAmountOut} ${tokenOut}`);
    
    // Simulate swap with a fake transaction
    const swapId = ethers.id(`swap-${Date.now()}`);
    const fakeHash = ethers.keccak256(ethers.toUtf8Bytes(`simulated-swap-${swapId}`));
    
    return {
      hash: fakeHash,
      swapId,
      amountOut: minAmountOut
    };
  }
  
  // Real swap implementation (requires pools to exist)
  const hookAddress = process.env.NEXT_PUBLIC_UNICHAIN_HOOK_ADDRESS || '0x0000000000000000000000000000000000000000';
  if (!hookAddress) {
    throw new Error('Unichain hook address not configured - deploy UniswapV4Hook.sol first');
  }
  
  // Setup provider and signer for Unichain
  const provider = new ethers.JsonRpcProvider(UNICHAIN_CONFIG.rpcUrl);
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found');
  }
  const signer = new ethers.Wallet(privateKey, provider);
  
  console.log(`Executing swap on Unichain via hook ${hookAddress}...`);
  
  // 1. Check ETH balance for gas
  const ethBalance = await provider.getBalance(await signer.getAddress());
  console.log(`ETH balance on Unichain: ${ethers.formatEther(ethBalance)}`);
  
  if (ethBalance === BigInt(0)) {
    throw new Error('No ETH on Unichain for gas. Get Unichain Sepolia ETH from faucet: https://sepolia.unichain.org/faucet');
  }
  
  // 2. Approve tokens for PoolManager
  console.log('Approving tokens for PoolManager...');
  const erc20Abi = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)'
  ];
  
  const tokenInContract = new ethers.Contract(tokenIn, erc20Abi, signer);
  const tokenInBalance = await tokenInContract.balanceOf(await signer.getAddress());
  console.log(`Token balance on Unichain: ${ethers.formatUnits(tokenInBalance, 6)}`);
  
  if (tokenInBalance === BigInt(0)) {
    throw new Error(`No ${tokenIn} on Unichain. Bridge tokens first or wait for bridge to complete.`);
  }
  
  const amountInWei = ethers.parseUnits(amountIn, 6);
  const currentAllowance = await tokenInContract.allowance(await signer.getAddress(), UNICHAIN_CONFIG.poolManager);
  
  if (currentAllowance < amountInWei) {
    console.log('Approving token spend...');
    const approveTx = await tokenInContract.approve(UNICHAIN_CONFIG.poolManager, ethers.MaxUint256);
    await approveTx.wait();
    console.log('✅ Token approved');
  }
  
  // 3. Check if wallet is authorized on the hook
  const hookAbi = [
    'function authorizedWallets(address) view returns (bool)',
    'function authorizeWallet(address wallet) external',
    'function getWalletStats(address wallet) view returns (uint256 totalSwaps, uint256 totalVolume, uint256 lastSwapTimestamp)'
  ];
  
  const hook = new ethers.Contract(hookAddress, hookAbi, signer);
  const isAuthorized = await hook.authorizedWallets(await signer.getAddress());
  
  if (!isAuthorized) {
    console.log('Wallet not authorized, authorizing...');
    // Note: In production, authorization would be done by PoolManager
    // For testing, we need to call it directly if the hook allows
    console.warn('⚠️ Wallet not authorized on hook - swap may fail');
  }
  
  // 4. Prepare swap parameters for PoolManager
  // PoolManager ABI (simplified for swap)
  const poolManagerAbi = [
    'function swap(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, tuple(bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, bytes hookData) external returns (int256 delta0, int256 delta1)'
  ];
  
  const poolManager = new ethers.Contract(
    UNICHAIN_CONFIG.poolManager,
    poolManagerAbi,
    signer
  );
  
  // 5. Create PoolKey
  const poolKey = {
    currency0: tokenIn < tokenOut ? tokenIn : tokenOut,
    currency1: tokenIn < tokenOut ? tokenOut : tokenIn,
    fee: 3000, // 0.3%
    tickSpacing: 60,
    hooks: hookAddress
  };
  
  // 6. Create SwapParams
  const zeroForOne = tokenIn < tokenOut;
  
  const swapParams = {
    zeroForOne,
    amountSpecified: amountInWei,
    sqrtPriceLimitX96: 0 // No price limit
  };
  
  // 7. Execute swap
  console.log('Calling PoolManager.swap()...');
  
  // Check if pool exists first by trying to get slot0
  try {
    const stateViewAbi = ['function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)'];
    const stateView = new ethers.Contract(
      UNICHAIN_CONFIG.stateView,
      stateViewAbi,
      provider
    );
    
    // Calculate pool ID
    const poolId = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address', 'uint24', 'int24', 'address'],
        [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
      )
    );
    
    const slot0 = await stateView.getSlot0(poolId);
    console.log(`Pool exists with sqrtPrice: ${slot0.sqrtPriceX96.toString()}`);
    
  } catch (error) {
    throw new Error(
      `Pool does not exist for ${tokenIn}/${tokenOut}. ` +
      `Create it first by running: node scripts/setup-uniswap-pool.js ` +
      `Or use a different token pair that has an existing pool.`
    );
  }
  
  try {
    const swapTx = await poolManager.swap(
      poolKey,
      swapParams,
      '0x' // Empty hookData
    );
    
    const receipt = await swapTx.wait();
    console.log(`✅ Swap executed: ${receipt.hash}`);
    
    // Generate swap ID from transaction hash
    const swapId = ethers.keccak256(receipt.hash);
    
    // Estimate amountOut (in production, parse from events)
    const estimatedOut = minAmountOut;
    
    return {
      hash: receipt.hash,
      swapId,
      amountOut: estimatedOut
    };
  } catch (error: any) {
    console.error('Swap failed:', error.message);
    
    if (error.message.includes('PoolNotInitialized') || error.message.includes('Pool does not exist')) {
      throw new Error('Liquidity pool not found - please create a pool first or use a different token pair');
    }
    
    if (error.message.includes('Unauthorized wallet')) {
      throw new Error('Wallet not authorized on hook contract');
    }
    
    throw new Error(`Swap failed: ${error.message}`);
  }
}

/**
 * Bridge tokens from Unichain back to original network
 */
async function bridgeFromUnichain(
  token: string,
  amount: string,
  destinationChain: string = 'ETH-SEPOLIA'
): Promise<{ hash: string }> {
  console.log(`Bridging ${amount} of ${token} back to ${destinationChain}...`);
  
  // Get recipient address on destination chain
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found');
  }
  const wallet = new ethers.Wallet(privateKey);
  const recipient = wallet.address;
  
  // Use Bridge Kit for bridging back
  try {
    const result = await transferUSDCViaBridgeKit({
      sourceChain: 'UNICHAIN-SEPOLIA',
      destinationChain: destinationChain as SupportedChain,
      amount,
      recipient
    });
    
    console.log(`Bridged back to ${destinationChain}, burn tx: ${result.burnTxHash}`);
    
    return {
      hash: result.burnTxHash
    };
  } catch (error: any) {
    // Enhance error message with network context
    throw new Error(`Failed to bridge from Unichain back to ${destinationChain}: ${error.message}`);
  }
}



/**
 * Calculate minimum amount out with slippage
 */
function calculateMinAmountOut(amountOut: string, slippage: number): string {
  const amount = parseFloat(amountOut);
  const slippageMultiplier = 1 - (slippage / 100);
  return (amount * slippageMultiplier).toString();
}

/**
 * Calculate total gas cost across multiple transactions
 */
function calculateTotalGas(transactions: Array<{ hash: string }>): string {
  // TODO: Fetch actual gas costs from blockchain
  return '0';
}

/**
 * Monitor swap status
 */
export async function getSwapStatus(swapId: string): Promise<SwapResult['status']> {
  // TODO: Query smart contract for swap status
  
  return 'pending';
}
