/**
 * ENS Service - Ethereum Name Service Integration
 * Handles ENS resolution, text records, and wallet binding
 * Network: Ethereum Sepolia Testnet
 */

import { ethers } from "ethers";
import { ens_normalize } from "@adraffy/ens-normalize";

// Sepolia ENS Contract Addresses
export const ENS_CONTRACTS_SEPOLIA = {
  registry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
  baseRegistrar: "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85",
  ethRegistrarController: "0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968",
  publicResolver: "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5",
  reverseRegistrar: "0xA0a1AbcDAe1a2a4A2EF8e9113Ff0e02DD81DC0C6",
  universalResolver: "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe",
  nameWrapper: "0x0635513f179D50A207757E05759CbD106d7dFcE8",
} as const;

// Public Resolver ABI (minimal for text records)
const PUBLIC_RESOLVER_ABI = [
  "function setText(bytes32 node, string calldata key, string calldata value) external",
  "function text(bytes32 node, string calldata key) external view returns (string)",
  "function addr(bytes32 node) external view returns (address)",
  "function setAddr(bytes32 node, address addr) external",
  "function multicall(bytes[] calldata data) external returns (bytes[] memory results)",
];

// ENS Registry ABI (minimal)
const ENS_REGISTRY_ABI = [
  "function resolver(bytes32 node) external view returns (address)",
  "function owner(bytes32 node) external view returns (address)",
  "function setResolver(bytes32 node, address resolver) external",
  "function setOwner(bytes32 node, address owner) external",
  "function transferFrom(address from, address to, uint256 tokenId) external",
];

// Base Registrar ABI (for .eth names)
const BASE_REGISTRAR_ABI = [
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function transferFrom(address from, address to, uint256 tokenId) external",
  "function safeTransferFrom(address from, address to, uint256 tokenId) external",
  "function approve(address to, uint256 tokenId) external",
];

export interface ENSTextRecord {
  key: string;
  value: string;
}

export interface ENSNameInfo {
  name: string;
  normalized: string;
  node: string;
  owner: string | null;
  resolver: string | null;
  address: string | null;
}

/**
 * ENS Service for wallet identity and recovery
 */
export class ENSService {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private registry: ethers.Contract;
  private resolver?: ethers.Contract;

  constructor(providerOrSigner: ethers.Provider | ethers.Signer) {
    // Check if it's a Signer by looking for signing methods
    if ("getAddress" in providerOrSigner && typeof providerOrSigner.getAddress === "function") {
      // It's a signer
      this.signer = providerOrSigner as ethers.Signer;
      if (this.signer.provider) {
        this.provider = this.signer.provider;
      } else {
        throw new Error("Signer must have a provider");
      }
    } else {
      // It's a provider
      this.provider = providerOrSigner as ethers.Provider;
    }

    // Initialize registry contract
    this.registry = new ethers.Contract(
      ENS_CONTRACTS_SEPOLIA.registry,
      ENS_REGISTRY_ABI,
      this.signer || this.provider
    );
  }

  /**
   * Normalize ENS name according to ENSIP-15
   */
  normalizeName(name: string): string {
    return ens_normalize(name);
  }

  /**
   * Calculate namehash for ENS name
   */
  namehash(name: string): string {
    const normalized = this.normalizeName(name);
    return ethers.namehash(normalized);
  }

  /**
   * Get comprehensive name information
   */
  async getNameInfo(name: string): Promise<ENSNameInfo> {
    const normalized = this.normalizeName(name);
    const node = ethers.namehash(normalized);

    // Get resolver address from registry
    const resolverAddress = await this.registry.resolver(node);
    
    // Get owner from registry
    const owner = await this.registry.owner(node);

    // Get address if resolver exists
    let address: string | null = null;
    if (resolverAddress !== ethers.ZeroAddress) {
      try {
        address = await this.provider.resolveName(normalized);
      } catch (error) {
        console.warn("Could not resolve address:", error);
      }
    }

    return {
      name,
      normalized,
      node,
      owner: owner !== ethers.ZeroAddress ? owner : null,
      resolver: resolverAddress !== ethers.ZeroAddress ? resolverAddress : null,
      address,
    };
  }

  /**
   * Resolve ENS name to address
   */
  async resolveAddress(name: string): Promise<string | null> {
    try {
      const normalized = this.normalizeName(name);
      const address = await this.provider.resolveName(normalized);
      return address;
    } catch (error) {
      console.error("Error resolving address:", error);
      return null;
    }
  }

  /**
   * Reverse resolve address to ENS name
   */
  async reverseLookup(address: string): Promise<string | null> {
    try {
      const name = await this.provider.lookupAddress(address);
      return name;
    } catch (error) {
      console.error("Error in reverse lookup:", error);
      return null;
    }
  }

  /**
   * Get resolver contract for a name
   */
  async getResolverContract(name: string): Promise<ethers.Contract | null> {
    const normalized = this.normalizeName(name);
    const node = ethers.namehash(normalized);

    const resolverAddress = await this.registry.resolver(node);
    
    if (resolverAddress === ethers.ZeroAddress) {
      return null;
    }

    return new ethers.Contract(
      resolverAddress,
      PUBLIC_RESOLVER_ABI,
      this.signer || this.provider
    );
  }

  /**
   * Get text record from ENS
   */
  async getTextRecord(name: string, key: string): Promise<string | null> {
    try {
      const resolver = await this.getResolverContract(name);
      if (!resolver) {
        throw new Error("No resolver found for name");
      }

      const node = this.namehash(name);
      const value = await resolver.text(node, key);
      
      return value || null;
    } catch (error) {
      console.error(`Error getting text record ${key}:`, error);
      return null;
    }
  }

  /**
   * Get multiple text records in parallel
   */
  async getTextRecords(name: string, keys: string[]): Promise<Record<string, string | null>> {
    const results = await Promise.all(
      keys.map(async (key) => ({
        key,
        value: await this.getTextRecord(name, key),
      }))
    );

    return Object.fromEntries(results.map((r) => [r.key, r.value]));
  }

  /**
   * Set text record on ENS (requires signer)
   */
  async setTextRecord(
    name: string,
    key: string,
    value: string
  ): Promise<ethers.ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error("Signer required for setting records");
    }

    const resolver = await this.getResolverContract(name);
    if (!resolver) {
      throw new Error("No resolver found for name");
    }

    const node = this.namehash(name);

    // Get resolver with signer
    const resolverWithSigner = resolver.connect(this.signer) as ethers.Contract;

    // Set text record
    const tx = await resolverWithSigner.setText(node, key, value);
    return tx;
  }

  /**
   * Set multiple text records in a single transaction (multicall)
   */
  async setMultipleRecords(
    name: string,
    records: ENSTextRecord[]
  ): Promise<ethers.ContractTransactionResponse> {
    if (!this.signer) {
      throw new Error("Signer required for setting records");
    }

    const resolver = await this.getResolverContract(name);
    if (!resolver) {
      throw new Error("No resolver found for name");
    }

    const node = this.namehash(name);
    const resolverWithSigner = resolver.connect(this.signer) as ethers.Contract;

    // Encode each setText call
    const calls = records.map((record) => {
      return resolverWithSigner.interface.encodeFunctionData("setText", [
        node,
        record.key,
        record.value,
      ]);
    });

    // Execute multicall
    const tx = await resolverWithSigner.multicall(calls);
    return tx;
  }

  /**
   * Set wallet address record
   */
  async setWalletRecord(
    name: string,
    walletAddress: string
  ): Promise<ethers.ContractTransactionResponse> {
    return this.setTextRecord(name, "wallet", walletAddress);
  }

  /**
   * Get wallet address from text records
   */
  async getWalletRecord(name: string): Promise<string | null> {
    return this.getTextRecord(name, "wallet");
  }

  /**
   * Set ZK secret hash record
   */
  async setSecretHashRecord(
    name: string,
    secretHash: string
  ): Promise<ethers.ContractTransactionResponse> {
    return this.setTextRecord(name, "zkSecretHash", secretHash);
  }

  /**
   * Get ZK secret hash from text records
   */
  async getSecretHashRecord(name: string): Promise<string | null> {
    return this.getTextRecord(name, "zkSecretHash");
  }

  /**
   * Setup complete ENS identity (wallet + secret hash)
   */
  async setupIdentity(
    name: string,
    walletAddress: string,
    secretHash: string,
    additionalRecords?: ENSTextRecord[]
  ): Promise<ethers.ContractTransactionResponse> {
    const records: ENSTextRecord[] = [
      { key: "wallet", value: walletAddress },
      { key: "zkSecretHash", value: secretHash },
      ...(additionalRecords || []),
    ];

    return this.setMultipleRecords(name, records);
  }

  /**
   * Get complete identity information
   */
  async getIdentity(name: string): Promise<{
    wallet: string | null;
    secretHash: string | null;
    description: string | null;
    avatar: string | null;
  }> {
    const records = await this.getTextRecords(name, [
      "wallet",
      "zkSecretHash",
      "description",
      "avatar",
    ]);

    return {
      wallet: records.wallet,
      secretHash: records.zkSecretHash,
      description: records.description,
      avatar: records.avatar,
    };
  }

  /**
   * Verify name ownership
   */
  async isNameOwner(name: string, address: string): Promise<boolean> {
    try {
      const node = this.namehash(name);
      const owner = await this.registry.owner(node);
      return owner.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error("Error checking name ownership:", error);
      return false;
    }
  }

  /**
   * Check if name is available (not registered)
   */
  async isNameAvailable(name: string): Promise<boolean> {
    try {
      const node = this.namehash(name);
      const owner = await this.registry.owner(node);
      return owner === ethers.ZeroAddress;
    } catch (error) {
      console.error("Error checking name availability:", error);
      return false;
    }
  }

  /**
   * Get registration URL for Sepolia testnet
   */
  getRegistrationUrl(name: string): string {
    const normalized = this.normalizeName(name);
    return `https://sepolia.app.ens.domains/${normalized}`;
  }

  /**
   * Get name management URL
   */
  getManagementUrl(name: string): string {
    const normalized = this.normalizeName(name);
    return `https://sepolia.app.ens.domains/${normalized}`;
  }

  // ============================================
  // GUARDIAN MANAGEMENT (Recovery System)
  // ============================================

  /**
   * Set guardian configuration for recovery
   * @param name ENS name
   * @param guardians Array of guardian addresses
   * @param threshold Required approval count
   */
  async setGuardianConfig(
    name: string,
    guardians: string[],
    threshold: number
  ): Promise<ethers.ContractTransactionResponse> {
    // Validate
    if (!guardians || guardians.length === 0) {
      throw new Error('Guardians array cannot be empty');
    }

    if (threshold < 1 || threshold > guardians.length) {
      throw new Error('Invalid threshold');
    }

    // Validate all addresses
    for (const guardian of guardians) {
      if (!ethers.isAddress(guardian)) {
        throw new Error(`Invalid guardian address: ${guardian}`);
      }
    }

    // Set both guardians and threshold records
    return this.setMultipleRecords(name, [
      { key: 'guardians', value: JSON.stringify(guardians) },
      { key: 'threshold', value: threshold.toString() },
      { key: 'recoveryChain', value: 'arc-testnet' },
    ]);
  }

  /**
   * Get guardian configuration
   * @param name ENS name
   * @returns Guardian addresses and threshold
   */
  async getGuardianConfig(name: string): Promise<{
    guardians: string[];
    threshold: number;
  }> {
    const records = await this.getTextRecords(name, ['guardians', 'threshold']);

    if (!records.guardians || !records.threshold) {
      throw new Error('Guardian configuration not found');
    }

    const guardians = JSON.parse(records.guardians) as string[];
    const threshold = parseInt(records.threshold, 10);

    return { guardians, threshold };
  }

  /**
   * Add guardian to existing configuration
   * @param name ENS name
   * @param newGuardian Guardian address to add
   */
  async addGuardian(name: string, newGuardian: string): Promise<ethers.ContractTransactionResponse> {
    if (!ethers.isAddress(newGuardian)) {
      throw new Error('Invalid guardian address');
    }

    const config = await this.getGuardianConfig(name);

    // Check if already a guardian
    if (config.guardians.some(g => g.toLowerCase() === newGuardian.toLowerCase())) {
      throw new Error('Address is already a guardian');
    }

    // Add new guardian
    const updatedGuardians = [...config.guardians, newGuardian];

    return this.setTextRecord(name, 'guardians', JSON.stringify(updatedGuardians));
  }

  /**
   * Remove guardian from configuration
   * @param name ENS name
   * @param guardianToRemove Guardian address to remove
   */
  async removeGuardian(
    name: string,
    guardianToRemove: string
  ): Promise<ethers.ContractTransactionResponse> {
    const config = await this.getGuardianConfig(name);

    // Filter out the guardian
    const updatedGuardians = config.guardians.filter(
      g => g.toLowerCase() !== guardianToRemove.toLowerCase()
    );

    if (updatedGuardians.length === config.guardians.length) {
      throw new Error('Guardian not found');
    }

    if (updatedGuardians.length === 0) {
      throw new Error('Cannot remove all guardians');
    }

    // Update threshold if needed
    const records: ENSTextRecord[] = [
      { key: 'guardians', value: JSON.stringify(updatedGuardians) },
    ];

    // If threshold is now invalid, adjust it
    if (config.threshold > updatedGuardians.length) {
      records.push({ key: 'threshold', value: updatedGuardians.length.toString() });
    }

    return this.setMultipleRecords(name, records);
  }

  /**
   * Update recovery threshold
   * @param name ENS name
   * @param newThreshold New threshold value
   */
  async updateThreshold(
    name: string,
    newThreshold: number
  ): Promise<ethers.ContractTransactionResponse> {
    const config = await this.getGuardianConfig(name);

    if (newThreshold < 1 || newThreshold > config.guardians.length) {
      throw new Error('Invalid threshold');
    }

    return this.setTextRecord(name, 'threshold', newThreshold.toString());
  }

  /**
   * Setup complete recovery configuration
   * @param name ENS name
   * @param walletAddress Arc smart wallet address
   * @param circleWalletId Circle Wallet ID
   * @param guardians Guardian addresses
   * @param threshold Required approvals
   */
  async setupRecoveryConfig(
    name: string,
    walletAddress: string,
    circleWalletId: string,
    guardians: string[],
    threshold: number
  ): Promise<ethers.ContractTransactionResponse> {
    // Validate inputs
    if (!ethers.isAddress(walletAddress)) {
      throw new Error('Invalid wallet address');
    }

    if (!guardians || guardians.length === 0) {
      throw new Error('Guardians array cannot be empty');
    }

    if (threshold < 1 || threshold > guardians.length) {
      throw new Error('Invalid threshold');
    }

    for (const guardian of guardians) {
      if (!ethers.isAddress(guardian)) {
        throw new Error(`Invalid guardian address: ${guardian}`);
      }
    }

    // Set all records in one transaction
    const records: ENSTextRecord[] = [
      { key: 'wallet', value: walletAddress },
      { key: 'circleWalletId', value: circleWalletId },
      { key: 'guardians', value: JSON.stringify(guardians) },
      { key: 'threshold', value: threshold.toString() },
      { key: 'recoveryChain', value: 'arc-testnet' },
      { key: 'recoveryVersion', value: 'v1' },
    ];

    return this.setMultipleRecords(name, records);
  }

  /**
   * Get complete recovery metadata
   * @param name ENS name
   * @returns All recovery configuration
   */
  async getRecoveryMetadata(name: string): Promise<{
    wallet: string | null;
    circleWalletId: string | null;
    guardians: string[];
    threshold: number;
    recoveryChain: string | null;
    recoveryVersion: string | null;
  }> {
    const records = await this.getTextRecords(name, [
      'wallet',
      'circleWalletId',
      'guardians',
      'threshold',
      'recoveryChain',
      'recoveryVersion',
    ]);

    // Parse guardians and threshold
    let guardians: string[] = [];
    let threshold = 0;

    if (records.guardians) {
      try {
        guardians = JSON.parse(records.guardians) as string[];
      } catch (error) {
        console.error('Failed to parse guardians:', error);
      }
    }

    if (records.threshold) {
      threshold = parseInt(records.threshold, 10);
    }

    return {
      wallet: records.wallet,
      circleWalletId: records.circleWalletId,
      guardians,
      threshold,
      recoveryChain: records.recoveryChain,
      recoveryVersion: records.recoveryVersion,
    };
  }

  /**
   * Check if address is a guardian for a name
   * @param name ENS name
   * @param address Address to check
   * @returns True if address is a guardian
   */
  async isGuardian(name: string, address: string): Promise<boolean> {
    try {
      const config = await this.getGuardianConfig(name);
      return config.guardians.some(g => g.toLowerCase() === address.toLowerCase());
    } catch (error) {
      console.error('Error checking guardian status:', error);
      return false;
    }
  }

  /**
   * Get Circle Wallet ID from ENS
   * @param name ENS name
   * @returns Circle Wallet ID or null
   */
  async getCircleWalletId(name: string): Promise<string | null> {
    return this.getTextRecord(name, 'circleWalletId');
  }

  /**
   * Set Circle Wallet ID in ENS
   * @param name ENS name
   * @param walletId Circle Wallet ID
   */
  async setCircleWalletId(
    name: string,
    walletId: string
  ): Promise<ethers.ContractTransactionResponse> {
    return this.setTextRecord(name, 'circleWalletId', walletId);
  }

  // ============================================
  // ENS OWNERSHIP TRANSFER (For Recovery)
  // ============================================

  /**
   * Transfer ENS name ownership to new address
   * Critical for recovery: transfers both registry and registrar ownership
   * @param name ENS name (e.g., 'vitalik.eth')
   * @param newOwner New owner address
   * @returns Transaction response
   */
  async transferENSOwnership(
    name: string,
    newOwner: string
  ): Promise<{ registryTx: string; registrarTx?: string }> {
    if (!this.signer) {
      throw new Error('Signer required for ENS ownership transfer');
    }

    console.log(`[ENS] REAL ENS ownership transfer: ${name} to ${newOwner}`);

    try {
      const normalized = this.normalizeName(name);
      const node = ethers.namehash(normalized);
      
      // 1. Transfer registry ownership
      const registry = new ethers.Contract(
        ENS_CONTRACTS_SEPOLIA.registry,
        ENS_REGISTRY_ABI,
        this.signer
      );
      
      const registryTx = await registry.setOwner(node, newOwner);
      console.log(`[ENS] ✅ REAL Registry ownership transferred:`, registryTx.hash);

      let registrarTxHash: string | undefined;

      // 2. Transfer registrar ownership (for .eth names)
      if (normalized.endsWith('.eth')) {
        try {
          const label = normalized.replace('.eth', '');
          const tokenId = ethers.keccak256(ethers.toUtf8Bytes(label));
          
          const registrar = new ethers.Contract(
            ENS_CONTRACTS_SEPOLIA.baseRegistrar,
            BASE_REGISTRAR_ABI,
            this.signer
          );

          const currentOwner = await this.signer.getAddress();
          const registrarTx = await registrar.transferFrom(currentOwner, newOwner, tokenId);
          registrarTxHash = registrarTx.hash;
          
          console.log(`[ENS] ✅ REAL Registrar ownership transferred:`, registrarTx.hash);
        } catch (registrarError) {
          console.warn('[ENS] Registrar transfer failed (may not own registrar):', registrarError);
        }
      }

      // 3. Update wallet text record to new owner
      try {
        await this.setTextRecord(name, 'wallet', newOwner);
        console.log(`[ENS] ✅ REAL Wallet text record updated to new owner`);
      } catch (textError) {
        console.warn('[ENS] Text record update failed:', textError);
      }

      return { 
        registryTx: registryTx.hash,
        registrarTx: registrarTxHash
      };
    } catch (error) {
      console.error('[ENS] REAL ownership transfer failed:', error);
      throw new Error(`ENS ownership transfer failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current ENS owner (registry owner)
   * @param name ENS name
   * @returns Owner address
   */
  async getENSOwner(name: string): Promise<string> {
    try {
      const normalized = this.normalizeName(name);
      const node = ethers.namehash(normalized);
      
      const registry = new ethers.Contract(
        ENS_CONTRACTS_SEPOLIA.registry,
        ENS_REGISTRY_ABI,
        this.signer || this.provider
      );
      
      const owner = await registry.owner(node);
      return owner;
    } catch (error) {
      console.error('[ENS] Failed to get owner:', error);
      throw new Error(`Failed to get ENS owner: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Create ENS service instance for Sepolia testnet
 */
export function createSepoliaENSService(
  providerOrSigner: ethers.Provider | ethers.Signer
): ENSService {
  return new ENSService(providerOrSigner);
}

/**
 * Get Sepolia provider
 */
export function getSepoliaProvider(): ethers.JsonRpcProvider {
  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com";
  return new ethers.JsonRpcProvider(rpcUrl);
}

// Singleton instance for read-only operations
let _sepoliaENSService: ENSService | null = null;

/**
 * Get shared ENS service instance (read-only)
 */
export function getENSService(): ENSService {
  if (!_sepoliaENSService) {
    const provider = getSepoliaProvider();
    _sepoliaENSService = new ENSService(provider);
  }
  return _sepoliaENSService;
}
