/**
 * Client-side swap execution using Circle wallet
 */

import { ethers } from 'ethers';

const SWAP_CONTRACT = '0xf398e521dda27C1Ff8102A00D856b127037eA130';

const SWAP_ABI = [
  'function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) external payable returns (uint256 amountOut)',
  'function getQuote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

export interface ClientSwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippage: number;
  userAddress: string;
  signer: ethers.Signer;
}

export async function executeClientSwap(params: ClientSwapParams) {
  const { tokenIn, tokenOut, amountIn, slippage, signer } = params;
  
  // Check network
  const provider = await signer.provider;
  if (!provider) throw new Error('No provider');
  
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  
  console.log('Network chainId:', chainId);
  
  // Only Sepolia (11155111) has the swap contract
  if (chainId !== 11155111) {
    throw new Error(`Swap contract only deployed on Sepolia (chainId: 11155111). Current network: ${chainId}. Please switch to Sepolia network.`);
  }
  
  // Get token decimals
  const tokenInDecimals = getTokenDecimals(tokenIn);
  const tokenOutDecimals = getTokenDecimals(tokenOut);
  
  const amountInWei = ethers.parseUnits(amountIn, tokenInDecimals);
  
  // Get quote from contract
  const swapContract = new ethers.Contract(SWAP_CONTRACT, SWAP_ABI, provider);
  
  const tokenInAddress = tokenIn === '0x0000000000000000000000000000000000000000' 
    ? ethers.ZeroAddress 
    : tokenIn;
  const tokenOutAddress = tokenOut === '0x0000000000000000000000000000000000000000' 
    ? ethers.ZeroAddress 
    : tokenOut;
  
  console.log('Getting quote from contract...');
  console.log('Token in:', tokenInAddress);
  console.log('Token out:', tokenOutAddress);
  console.log('Amount in:', amountInWei.toString());
  
  try {
    const amountOutWei = await swapContract.getQuote(
      tokenInAddress,
      tokenOutAddress,
      amountInWei
    );
    
    console.log('Quote received:', amountOutWei.toString());
    console.log('Quote received:', amountOutWei.toString());
  
    // Calculate minimum output with slippage
    const minAmountOutWei = (amountOutWei * BigInt(Math.floor((100 - slippage) * 100))) / BigInt(10000);
    
    const isETHIn = tokenIn === '0x0000000000000000000000000000000000000000';
    
    // Approve tokens if not ETH
    if (!isETHIn) {
      const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);
      
      // Check current allowance
      const userAddress = await signer.getAddress();
      const currentAllowance = await tokenContract.allowance(userAddress, SWAP_CONTRACT);
      
      if (currentAllowance < amountInWei) {
        console.log('Approving tokens...');
        const approveTx = await tokenContract.approve(SWAP_CONTRACT, amountInWei);
        await approveTx.wait();
        console.log('Approval complete');
      }
    }
    
    // Execute swap
    const swapContractWithSigner = new ethers.Contract(SWAP_CONTRACT, SWAP_ABI, signer);
    
    console.log('Executing swap...');
    const swapTx = await swapContractWithSigner.swap(
      tokenInAddress,
      tokenOutAddress,
      amountInWei,
      minAmountOutWei,
      { value: isETHIn ? amountInWei : 0 }
    );
    
    console.log('Waiting for confirmation...');
    const receipt = await swapTx.wait();
    
    return {
      hash: receipt.hash,
      amountOut: ethers.formatUnits(amountOutWei, tokenOutDecimals),
      gasUsed: receipt.gasUsed.toString(),
      status: 'completed' as const
    };
  } catch (error: any) {
    console.error('Swap contract error:', error);
    throw new Error(`Swap failed: ${error.message || 'Unknown error'}`);
  }
}

function getTokenDecimals(address: string): number {
  if (address === '0x0000000000000000000000000000000000000000') return 18;
  if (address.toLowerCase() === '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238') return 6; // USDC
  if (address.toLowerCase() === '0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0') return 6; // USDT
  return 18;
}
