const { ethers } = require('ethers');

const NETWORKS = {
  'ETH-SEPOLIA': {
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    chainId: 11155111,
    explorer: 'https://sepolia.etherscan.io'
  },
  'MATIC-AMOY': {
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    chainId: 80002,
    explorer: 'https://amoy.polygonscan.com'
  }
};

const CONTRACTS = {
  swapRouter02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  swapRouter: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  quoterV2: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
  weth: {
    'ETH-SEPOLIA': '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    'MATIC-AMOY': '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9'
  }
};

async function checkContract(provider, address, name) {
  try {
    const code = await provider.getCode(address);
    const exists = code && code !== '0x' && code.length > 2;
    return { name, address, exists, code: code.slice(0, 20) + '...' };
  } catch (error) {
    return { name, address, exists: false, error: error.message };
  }
}

async function verifyNetwork(networkName, config) {
  console.log(`\n🔍 Checking ${networkName}...`);
  console.log(`RPC: ${config.rpcUrl}`);
  
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  
  // Check all contracts
  const results = await Promise.all([
    checkContract(provider, CONTRACTS.swapRouter02, 'SwapRouter02'),
    checkContract(provider, CONTRACTS.swapRouter, 'SwapRouter'),
    checkContract(provider, CONTRACTS.quoterV2, 'QuoterV2'),
    checkContract(provider, CONTRACTS.factory, 'Factory'),
    checkContract(provider, CONTRACTS.weth[networkName], 'WETH')
  ]);
  
  results.forEach(result => {
    const status = result.exists ? '✅' : '❌';
    console.log(`${status} ${result.name}: ${result.address}`);
    if (result.error) console.log(`   Error: ${result.error}`);
  });
  
  return results.every(r => r.exists);
}

async function main() {
  console.log('🔍 Verifying Uniswap V3 Contracts on Testnets\n');
  
  for (const [name, config] of Object.entries(NETWORKS)) {
    await verifyNetwork(name, config);
  }
  
  console.log('\n✅ Verification complete!');
}

main().catch(console.error);
