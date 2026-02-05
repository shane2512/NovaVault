/**
 * Circle ENS Service V3 - Private Key Signing
 * 
 * Uses a hot wallet (private key) to sign ENS transactions
 * Circle wallet remains the recovery target in ENS records
 * 
 * Architecture:
 * - Hot Wallet (PRIVATE_KEY): Signs ENS setText transactions
 * - Circle Wallet: Stores in ENS records as recovery target
 * - Recovery Flow: User provides ENS name + secret → recovers Circle wallet
 */

import { ethers } from "ethers";
import { ens_normalize } from "@adraffy/ens-normalize";

// ENS Contract addresses on Sepolia
const SEPOLIA_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
const SEPOLIA_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";

// Contract ABIs
const ENS_REGISTRY_ABI = [
  "function owner(bytes32 node) external view returns (address)",
  "function resolver(bytes32 node) external view returns (address)",
  "function setOwner(bytes32 node, address owner) external",
];

const PUBLIC_RESOLVER_ABI = [
  "function setText(bytes32 node, string calldata key, string calldata value) external",
  "function text(bytes32 node, string calldata key) external view returns (string)",
];

/**
 * Circle ENS Service V3 - Private Key Signing Approach
 */
export class CircleENSServiceV3 {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private registry: ethers.Contract;
  private circleWalletAddress: string;

  constructor(config: {
    rpcUrl: string;
    privateKey: string;
    circleWalletAddress: string;
  }) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.signer = new ethers.Wallet(config.privateKey, this.provider);
    
    this.registry = new ethers.Contract(
      SEPOLIA_REGISTRY,
      ENS_REGISTRY_ABI,
      this.signer
    );

    this.circleWalletAddress = config.circleWalletAddress;

    console.log(`CircleENSServiceV3 initialized:`);
    console.log(`  Signer Address: ${this.signer.address}`);
    console.log(`  Circle Wallet: ${this.circleWalletAddress}`);
  }

  /**
   * Normalize ENS name
   */
  normalizeName(name: string): string {
    try {
      return ens_normalize(name);
    } catch (error) {
      throw new Error(`Invalid ENS name: ${(error as Error).message}`);
    }
  }

  /**
   * Get namehash
   */
  getNamehash(name: string): string {
    const normalized = this.normalizeName(name);
    return ethers.namehash(normalized);
  }

  /**
   * Check if signer owns the ENS name
   */
  async ownsName(ensName: string): Promise<boolean> {
    const node = this.getNamehash(ensName);
    const owner = await this.registry.owner(node);
    return owner.toLowerCase() === this.signer.address.toLowerCase();
  }

  /**
   * Get resolver address
   */
  async getResolver(ensName: string): Promise<string> {
    const node = this.getNamehash(ensName);
    return await this.registry.resolver(node);
  }

  /**
   * Get name info
   */
  async getNameInfo(ensName: string) {
    const node = this.getNamehash(ensName);

    const [owner, resolverAddress] = await Promise.all([
      this.registry.owner(node),
      this.registry.resolver(node),
    ]);

    const result: any = {
      name: ensName,
      node,
      owner,
      resolver: resolverAddress,
      isRegistered: owner !== ethers.ZeroAddress,
      ownedBySigner: owner.toLowerCase() === this.signer.address.toLowerCase(),
      ownedByCircleWallet: owner.toLowerCase() === this.circleWalletAddress.toLowerCase(),
    };

    if (resolverAddress !== ethers.ZeroAddress) {
      try {
        const resolver = new ethers.Contract(
          resolverAddress,
          PUBLIC_RESOLVER_ABI,
          this.provider
        );

        const identityKeys = [
          "wallet",
          "zkSecretHash",
          "description",
          "walletType",
        ];

        const records: Record<string, string> = {};
        const results = await Promise.all(
          identityKeys.map((key) => resolver.text(node, key))
        );

        identityKeys.forEach((key, index) => {
          records[key] = results[index];
        });

        result.identity = records;
      } catch (error) {
        result.identity = {};
      }
    }

    return result;
  }

  /**
   * Set single ENS text record using private key signing
   */
  async setTextRecord(
    ensName: string,
    key: string,
    value: string
  ): Promise<{ txHash: string }> {
    // Verify signer owns the name
    const isOwner = await this.ownsName(ensName);
    if (!isOwner) {
      throw new Error(
        `Signer wallet (${this.signer.address}) does not own ${ensName}`
      );
    }

    // Get resolver
    const resolverAddress = await this.getResolver(ensName);
    if (resolverAddress === ethers.ZeroAddress) {
      throw new Error(`No resolver set for ${ensName}`);
    }

    // Create resolver contract with signer
    const resolver = new ethers.Contract(
      resolverAddress,
      PUBLIC_RESOLVER_ABI,
      this.signer
    );

    const node = this.getNamehash(ensName);

    console.log(`Setting ${key} for ${ensName}...`);
    console.log(`  Node: ${node}`);
    console.log(`  Value: ${value}`);

    // Sign and send transaction
    const tx = await resolver.setText(node, key, value);
    console.log(`  Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`  Confirmed in block ${receipt.blockNumber}`);

    if (receipt.status === 0) {
      throw new Error(`Transaction failed: ${tx.hash}`);
    }

    return { txHash: tx.hash };
  }

  /**
   * Set multiple records (one by one with confirmation)
   */
  async setMultipleRecords(
    ensName: string,
    records: Array<{ key: string; value: string }>
  ): Promise<{ txHash: string }> {
    let lastTxHash = "";

    for (const record of records) {
      const result = await this.setTextRecord(ensName, record.key, record.value);
      lastTxHash = result.txHash;

      // Small delay between transactions
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return { txHash: lastTxHash };
  }

  /**
   * Setup complete ENS identity
   * Note: ENS records point to Circle wallet for recovery
   */
  async setupIdentity(
    ensName: string,
    identityData: {
      zkSecretHash: string;
      description?: string;
    }
  ): Promise<{ txHash: string }> {
    const records: Array<{ key: string; value: string }> = [
      { key: "wallet", value: this.circleWalletAddress }, // Circle wallet!
      { key: "zkSecretHash", value: identityData.zkSecretHash },
      { key: "walletType", value: "circle-mpc" },
    ];

    if (identityData.description) {
      records.push({ key: "description", value: identityData.description });
    }

    return await this.setMultipleRecords(ensName, records);
  }

  /**
   * Transfer ENS ownership from signer to Circle wallet
   */
  async transferToCircleWallet(ensName: string): Promise<{ txHash: string }> {
    const node = this.getNamehash(ensName);

    const isOwner = await this.ownsName(ensName);
    if (!isOwner) {
      throw new Error(`Signer does not own ${ensName}`);
    }

    console.log(`Transferring ${ensName} to Circle wallet...`);
    const tx = await this.registry.setOwner(node, this.circleWalletAddress);
    console.log(`  Transaction sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`  Confirmed in block ${receipt.blockNumber}`);

    if (receipt.status === 0) {
      throw new Error(`Transfer failed: ${tx.hash}`);
    }

    return { txHash: tx.hash };
  }

  /**
   * Get signer balance (for gas checks)
   */
  async getSignerBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.signer.address);
    return ethers.formatEther(balance);
  }
}

/**
 * Create service from environment variables
 */
export function createCircleENSServiceV3(): CircleENSServiceV3 {
  const privateKey = process.env.PRIVATE_KEY;
  const circleWalletAddress = process.env.CIRCLE_WALLET_ADDRESS_ETH;
  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC;

  if (!privateKey || !circleWalletAddress || !rpcUrl) {
    throw new Error("Missing required environment variables");
  }

  return new CircleENSServiceV3({
    privateKey,
    circleWalletAddress,
    rpcUrl,
  });
}
