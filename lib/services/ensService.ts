/**
 * ENS Service - Ethereum Name Service Integration
 * Handles ENS resolution, text records, and wallet binding
 * Network: Ethereum Sepolia Testnet
 */

import { ethers } from "ethers";
import ens_normalize from "@adraffy/ens-normalize";

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
    if ("provider" in providerOrSigner && providerOrSigner.provider) {
      // It's a signer
      this.signer = providerOrSigner;
      this.provider = providerOrSigner.provider;
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
