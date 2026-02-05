import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

const SWAP_CONTRACT = '0xf398e521dda27C1Ff8102A00D856b127037eA130';

export async function POST(request: NextRequest) {
  try {
    const { tokenIn, tokenOut, amountIn, slippage, walletAddress } = await request.json();
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }
    
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { error: 'Server wallet not configured' },
        { status: 500 }
      );
    }
    
    // Get token decimals
    const tokenInDecimals = getTokenDecimals(tokenIn);
    const tokenOutDecimals = getTokenDecimals(tokenOut);
    
    const amountInWei = ethers.parseUnits(amountIn, tokenInDecimals);
    
    // Connect to Sepolia
    const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    const signer = new ethers.Wallet(privateKey, provider);
    
    const swapAbi = [
      'function getQuote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut)',
      'function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) external payable returns (uint256 amountOut)'
    ];
    
    const swapContract = new ethers.Contract(SWAP_CONTRACT, swapAbi, signer);
    
    const tokenInAddress = tokenIn === '0x0000000000000000000000000000000000000000' 
      ? ethers.ZeroAddress 
      : tokenIn;
    const tokenOutAddress = tokenOut === '0x0000000000000000000000000000000000000000' 
      ? ethers.ZeroAddress 
      : tokenOut;
    
    // Get quote
    const amountOutWei = await swapContract.getQuote(
      tokenInAddress,
      tokenOutAddress,
      amountInWei
    );
    
    const minAmountOutWei = (amountOutWei * BigInt(Math.floor((100 - slippage) * 100))) / 10000n;
    
    const isETHIn = tokenIn === '0x0000000000000000000000000000000000000000';
    
    // For ERC20 input, need to transfer tokens from user wallet first
    if (!isETHIn) {
      // User needs to have already approved and we need tokens in contract
      // For now, return error - user must have ETH to swap
      return NextResponse.json(
        { error: 'Only ETH swaps supported currently. ERC20 swaps require Circle wallet integration.' },
        { status: 400 }
      );
    }
    
    // Execute swap on behalf of Circle wallet
    // Note: This requires server wallet to have ETH, but sends output to Circle wallet
    console.log('Executing swap for Circle wallet:', walletAddress);
    
    // Modify contract to support beneficiary parameter or send tokens back
    // For now, execute swap and output goes to server wallet, then transfer to user
    const swapTx = await swapContract.swap(
      tokenInAddress,
      tokenOutAddress,
      amountInWei,
      minAmountOutWei,
      { value: isETHIn ? amountInWei : 0 }
    );
    
    const receipt = await swapTx.wait();
    
    // Transfer received tokens to Circle wallet
    if (tokenOut !== '0x0000000000000000000000000000000000000000') {
      const erc20Abi = ['function transfer(address to, uint256 amount) returns (bool)'];
      const tokenContract = new ethers.Contract(tokenOut, erc20Abi, signer);
      
      const transferTx = await tokenContract.transfer(walletAddress, amountOutWei);
      await transferTx.wait();
      console.log('Transferred output tokens to Circle wallet');
    } else {
      // Transfer ETH to Circle wallet
      const ethTransfer = await signer.sendTransaction({
        to: walletAddress,
        value: amountOutWei
      });
      await ethTransfer.wait();
      console.log('Transferred ETH to Circle wallet');
    }
    
    return NextResponse.json({
      swapTxHash: receipt.hash,
      amountOut: ethers.formatUnits(amountOutWei, tokenOutDecimals),
      status: 'completed'
    });
    
  } catch (error: any) {
    console.error('Swap execution error:', error);
    return NextResponse.json(
      { error: error.message || 'Swap failed' },
      { status: 500 }
    );
  }
}

function getTokenDecimals(address: string): number {
  if (address === '0x0000000000000000000000000000000000000000') return 18;
  if (address.toLowerCase() === '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238') return 6; // USDC
  if (address.toLowerCase() === '0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0') return 6; // USDT
  return 18;
}
