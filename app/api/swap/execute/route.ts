import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getTxExplorerUrl } from '@/lib/services/circleCCTPService';

const SWAP_CONTRACT = '0xf398e521dda27C1Ff8102A00D856b127037eA130';

// Multiple RPC endpoints for fallback
const RPC_URLS = [
  'https://eth-sepolia.api.onfinality.io/public',
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://rpc.sentio.xyz/sepolia',
  'https://ethereum-sepolia-public.nodies.app',
  'https://ethereum-sepolia.rpc.subquery.network/public',
  'https://sepolia.drpc.org'
];

export async function POST(request: NextRequest) {
  console.log('\n🔄 ========== SWAP EXECUTION STARTED ==========');
  try {
    const body = await request.json();
    console.log('📥 Request body:', body);
    
    const { tokenIn, tokenOut, amountIn, slippage, walletAddress } = body;
    
    if (!walletAddress) {
      console.error('❌ No wallet address provided');
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }
    
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      console.error('❌ PRIVATE_KEY not configured');
      return NextResponse.json(
        { error: 'PRIVATE_KEY not configured in .env.local' },
        { status: 500 }
      );
    }
    console.log('✅ Private key configured');
    
    // Get token decimals
    const tokenInDecimals = getTokenDecimals(tokenIn);
    const tokenOutDecimals = getTokenDecimals(tokenOut);
    const amountInWei = ethers.parseUnits(amountIn, tokenInDecimals);
    
    // Try each RPC with timeout
    let lastError: Error | null = null;
    
    console.log('🔗 Trying RPC endpoints...');
    for (let i = 0; i < RPC_URLS.length; i++) {
      const rpcUrl = RPC_URLS[i];
      console.log(`🔗 [${i + 1}/${RPC_URLS.length}] Attempting: ${rpcUrl}`);
      try {
        const result = await Promise.race([
          executeSwapWithRPC(
            rpcUrl,
            privateKey,
            tokenIn,
            tokenOut,
            amountInWei,
            slippage,
            walletAddress,
            tokenInDecimals,
            tokenOutDecimals
          ),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('RPC timeout (15s)')), 15000)
          )
        ]);
        
        console.log('✅ Swap executed successfully!');
        console.log('🔄 ========== SWAP EXECUTION COMPLETED ==========\n');
        return NextResponse.json(result);
        
      } catch (error: any) {
        console.error(`❌ RPC failed: ${error.message}`);
        lastError = error;
        continue;
      }
    }
    
    // All RPCs failed
    console.error('❌ All RPC endpoints failed');
    console.error('Last error:', lastError);
    throw lastError || new Error('All RPC endpoints failed');
    
  } catch (error: any) {
    console.error('❌ SWAP EXECUTION FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.log('🔄 ========== SWAP EXECUTION FAILED ==========\n');
    return NextResponse.json(
      { error: error.message || 'Swap failed' },
      { status: 500 }
    );
  }
}

async function executeSwapWithRPC(
  rpcUrl: string,
  privateKey: string,
  tokenIn: string,
  tokenOut: string,
  amountInWei: bigint,
  slippage: number,
  walletAddress: string,
  tokenInDecimals: number,
  tokenOutDecimals: number
) {
  console.log('  📡 Connecting to RPC...');
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  console.log('  ✅ Signer created');
  
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
  
  // Get quote from contract
  console.log('  💰 Getting quote from contract...');
  const amountOutWei = await swapContract.getQuote(
    tokenInAddress,
    tokenOutAddress,
    amountInWei
  );
  console.log('  ✅ Quote received:', amountOutWei.toString());
  
  const minAmountOutWei = (amountOutWei * BigInt(Math.floor((100 - slippage) * 100))) / BigInt(10000);
  
  const isETHIn = tokenIn === '0x0000000000000000000000000000000000000000';
  
  // Approve tokens if not ETH
  if (!isETHIn) {
    console.log('  🔓 Approving tokens...');
    const tokenContract = new ethers.Contract(
      tokenIn,
      ['function approve(address spender, uint256 amount) returns (bool)'],
      signer
    );
    const approveTx = await tokenContract.approve(SWAP_CONTRACT, amountInWei);
    await approveTx.wait();
    console.log('  ✅ Tokens approved');
  }
  
  // Execute swap
  console.log('  🔄 Executing swap on contract...');
  const swapTx = await swapContract.swap(
    tokenInAddress,
    tokenOutAddress,
    amountInWei,
    minAmountOutWei,
    { value: isETHIn ? amountInWei : 0 }
  );
  console.log('  ⏳ Waiting for confirmation...');
  const receipt = await swapTx.wait();
  console.log('  ✅ Swap confirmed! TX:', receipt.hash);
  
  // Transfer received tokens to Circle wallet
  const isETHOut = tokenOut === '0x0000000000000000000000000000000000000000';
  
  console.log('  📤 Transferring output to Circle wallet...');
  if (!isETHOut) {
    const erc20Abi = ['function transfer(address to, uint256 amount) returns (bool)'];
    const tokenContract = new ethers.Contract(tokenOut, erc20Abi, signer);
    const transferTx = await tokenContract.transfer(walletAddress, amountOutWei);
    await transferTx.wait();
    console.log('  ✅ Tokens transferred');
  } else {
    const ethTransfer = await signer.sendTransaction({
      to: walletAddress,
      value: amountOutWei
    });
    await ethTransfer.wait();
    console.log('  ✅ ETH transferred');
  }
  
  const explorerUrl = getTxExplorerUrl('ETH-SEPOLIA', receipt.hash);
  
  return {
    swapTxHash: receipt.hash,
    explorerUrl,
    amountOut: ethers.formatUnits(amountOutWei, tokenOutDecimals),
    status: 'completed'
  };
}

function getTokenDecimals(address: string): number {
  if (address === '0x0000000000000000000000000000000000000000') return 18;
  if (address.toLowerCase() === '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238') return 6; // USDC
  if (address.toLowerCase() === '0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0') return 6; // USDT
  return 18;
}
