/**
 * ENS Recovery Service
 * Manages guardian configuration and recovery policy in ENS text records
 */

import { ethers } from 'ethers';

// ENS Registry and Public Resolver addresses on Sepolia
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
const PUBLIC_RESOLVER = '0x4B1488B7a6B320d2D721406204aBc3eeAa9AD329'; // Sepolia

// Sepolia RPC endpoints for fallback
const SEPOLIA_RPC_URLS = [
  'https://eth-sepolia.api.onfinality.io/public',
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://rpc.sentio.xyz/sepolia',
  'https://ethereum-sepolia-public.nodies.app',
  'https://ethereum-sepolia.rpc.subquery.network/public',
  'https://sepolia.drpc.org'
];

// Helper function to get a provider with fallback
async function getSepoliaProvider(): Promise<ethers.JsonRpcProvider> {
  for (const rpcUrl of SEPOLIA_RPC_URLS) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      // Test the connection
      await provider.getBlockNumber();
      return provider;
    } catch (error) {
      console.log(`Failed to connect to ${rpcUrl}, trying next...`);
      continue;
    }
  }
  // Fallback to first RPC if all fail
  return new ethers.JsonRpcProvider(SEPOLIA_RPC_URLS[0]);
}

// ENS Text Record Keys (ENSIP-5)
const GUARDIAN_KEYS = {
  GUARDIAN_1: 'guardian1',
  GUARDIAN_2: 'guardian2',
  GUARDIAN_3: 'guardian3',
  GUARDIAN_4: 'guardian4',
  GUARDIAN_5: 'guardian5',
  THRESHOLD: 'threshold',
  WALLET_ADDRESS: 'wallet',
  EXECUTION_LAYER: 'executionLayer',
  RECOVERY_VERSION: 'recoveryVersion'
};

/**
 * Calculate ENS namehash (ENSIP-1)
 */
export function namehash(name: string): string {
  if (!name) return '0x0000000000000000000000000000000000000000000000000000000000000000';
  
  const normalized = name.toLowerCase();
  const labels = normalized.split('.');
  
  let node = '0x0000000000000000000000000000000000000000000000000000000000000000';
  
  for (let i = labels.length - 1; i >= 0; i--) {
    const labelHash = ethers.keccak256(ethers.toUtf8Bytes(labels[i]));
    node = ethers.keccak256(ethers.concat([node, labelHash]));
  }
  
  return node;
}

/**
 * Get resolver address for an ENS name
 */
export async function getResolver(ensName: string): Promise<string> {
  const provider = await getSepoliaProvider();
  
  const registryAbi = [
    'function resolver(bytes32 node) external view returns (address)'
  ];
  
  const registry = new ethers.Contract(ENS_REGISTRY, registryAbi, provider);
  const node = namehash(ensName);
  
  const resolverAddress = await registry.resolver(node);
  
  if (resolverAddress === ethers.ZeroAddress) {
    throw new Error(`No resolver found for ${ensName}`);
  }
  
  return resolverAddress;
}

/**
 * Read text record from ENS
 */
export async function getTextRecord(
  ensName: string,
  key: string
): Promise<string | null> {
  try {
    const provider = await getSepoliaProvider();
    const resolverAddress = await getResolver(ensName);
    
    const resolverAbi = [
      'function text(bytes32 node, string calldata key) external view returns (string memory)'
    ];
    
    const resolver = new ethers.Contract(resolverAddress, resolverAbi, provider);
    const node = namehash(ensName);
    
    const value = await resolver.text(node, key);
    return value || null;
  } catch (error) {
    console.error(`Failed to read text record ${key} from ${ensName}:`, error);
    return null;
  }
}

/**
 * Set text record in ENS (requires ownership)
 */
export async function setTextRecord(
  ensName: string,
  key: string,
  value: string,
  signerPrivateKey: string
): Promise<string> {
  const provider = await getSepoliaProvider();
  const signer = new ethers.Wallet(signerPrivateKey, provider);
  
  const resolverAddress = await getResolver(ensName);
  
  const resolverAbi = [
    'function setText(bytes32 node, string calldata key, string calldata value) external'
  ];
  
  const resolver = new ethers.Contract(resolverAddress, resolverAbi, signer);
  const node = namehash(ensName);
  
  const tx = await resolver.setText(node, key, value);
  await tx.wait();
  
  return tx.hash;
}

/**
 * Batch set multiple text records
 */
export async function setMultipleTextRecords(
  ensName: string,
  records: Record<string, string>,
  signerPrivateKey: string
): Promise<string[]> {
  const txHashes: string[] = [];
  
  for (const [key, value] of Object.entries(records)) {
    const hash = await setTextRecord(ensName, key, value, signerPrivateKey);
    txHashes.push(hash);
  }
  
  return txHashes;
}

/**
 * Get guardian configuration from ENS
 */
export async function getGuardianConfig(ensName: string): Promise<{
  guardians: string[];
  threshold: number;
  walletAddress: string | null;
  executionLayer: string | null;
  recoveryVersion: string | null;
}> {
  const guardians: string[] = [];
  
  // Read all possible guardian slots
  for (let i = 1; i <= 5; i++) {
    const key = `guardian${i}`;
    const address = await getTextRecord(ensName, key);
    if (address && ethers.isAddress(address)) {
      guardians.push(address);
    }
  }
  
  const thresholdStr = await getTextRecord(ensName, GUARDIAN_KEYS.THRESHOLD);
  const threshold = thresholdStr ? parseInt(thresholdStr) : 0;
  
  const walletAddress = await getTextRecord(ensName, GUARDIAN_KEYS.WALLET_ADDRESS);
  const executionLayer = await getTextRecord(ensName, GUARDIAN_KEYS.EXECUTION_LAYER);
  const recoveryVersion = await getTextRecord(ensName, GUARDIAN_KEYS.RECOVERY_VERSION);
  
  return {
    guardians,
    threshold,
    walletAddress,
    executionLayer,
    recoveryVersion
  };
}

/**
 * Set guardian configuration in ENS
 */
export async function setGuardianConfig(
  ensName: string,
  guardians: string[],
  threshold: number,
  walletAddress: string,
  signerPrivateKey: string
): Promise<{
  success: boolean;
  txHashes: string[];
}> {
  if (guardians.length === 0) {
    throw new Error('At least one guardian required');
  }
  
  if (threshold > guardians.length) {
    throw new Error('Threshold cannot exceed number of guardians');
  }
  
  if (threshold < 1) {
    throw new Error('Threshold must be at least 1');
  }
  
  // Validate addresses
  for (const guardian of guardians) {
    if (!ethers.isAddress(guardian)) {
      throw new Error(`Invalid guardian address: ${guardian}`);
    }
  }
  
  if (!ethers.isAddress(walletAddress)) {
    throw new Error(`Invalid wallet address: ${walletAddress}`);
  }
  
  // Build records object
  const records: Record<string, string> = {
    [GUARDIAN_KEYS.THRESHOLD]: threshold.toString(),
    [GUARDIAN_KEYS.WALLET_ADDRESS]: walletAddress,
    [GUARDIAN_KEYS.EXECUTION_LAYER]: 'arc-gateway',
    [GUARDIAN_KEYS.RECOVERY_VERSION]: 'v2'
  };
  
  // Add guardians (clear unused slots)
  for (let i = 1; i <= 5; i++) {
    const key = `guardian${i}`;
    records[key] = i <= guardians.length ? guardians[i - 1] : '';
  }
  
  const txHashes = await setMultipleTextRecords(ensName, records, signerPrivateKey);
  
  return {
    success: true,
    txHashes
  };
}

/**
 * Validate guardian can approve recovery
 */
export async function validateGuardian(
  ensName: string,
  guardianAddress: string
): Promise<boolean> {
  const config = await getGuardianConfig(ensName);
  return config.guardians.includes(guardianAddress.toLowerCase());
}

/**
 * Transfer ENS ownership to new address
 */
export async function transferENSOwnership(
  ensName: string,
  newOwner: string,
  signerPrivateKey: string
): Promise<string> {
  const provider = await getSepoliaProvider();
  const signer = new ethers.Wallet(signerPrivateKey, provider);
  
  const registryAbi = [
    'function setOwner(bytes32 node, address owner) external'
  ];
  
  const registry = new ethers.Contract(ENS_REGISTRY, registryAbi, signer);
  const node = namehash(ensName);
  
  const tx = await registry.setOwner(node, newOwner);
  await tx.wait();
  
  return tx.hash;
}
