/**
 * Blockchain Event Listener Service
 * 
 * Monitors RecoveryController.sol for RecoveryApproved events 
 * and triggers fund migration execution automatically.
 */

import { ethers } from 'ethers';

export class RecoveryEventListener {
  private provider: ethers.Provider;
  private recoveryControllerAddress: string;
  private contract: ethers.Contract;
  
  // RecoveryController ABI (minimal)
  private readonly RECOVERY_CONTROLLER_ABI = [
    'event RecoveryApproved(bytes32 indexed node, address indexed newOwner, uint256 timestamp)',
    'function getRecoveryRequest(bytes32 namehash) external view returns (address currentOwner, address newOwner, address[] memory guardians, uint256 threshold, uint256 approvalCount, uint256 createdAt, uint256 expiresAt, uint8 status, string memory circleWalletId)'
  ];

  constructor() {
    // Initialize provider (Arc Network)
    const rpcUrl = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // RecoveryController contract address (deployed on Arc)
    this.recoveryControllerAddress = process.env.RECOVERY_CONTROLLER_ADDRESS!;

    if (!this.recoveryControllerAddress) {
      throw new Error('RECOVERY_CONTROLLER_ADDRESS environment variable is required');
    }

    this.contract = new ethers.Contract(
      this.recoveryControllerAddress,
      this.RECOVERY_CONTROLLER_ABI,
      this.provider
    );
  }

  /**
   * Start listening for RecoveryApproved events
   */
  public startListening(): void {
    console.log('🎧 Starting recovery event listener...');
    console.log('📍 Contract:', this.recoveryControllerAddress);

    // Listen for RecoveryApproved events
    this.contract.on('RecoveryApproved', async (node, newOwner, timestamp, event) => {
      try {
        console.log('🔔 RecoveryApproved event detected!');
        console.log('📝 Event details:', {
          node,
          newOwner,
          timestamp: timestamp.toString(),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash
        });

        // Get full recovery request details
        const recoveryDetails = await this.contract.getRecoveryRequest(node);
        const [currentOwner, , guardians, threshold, approvalCount, createdAt, expiresAt, status, circleWalletId] = recoveryDetails;

        console.log('📊 Recovery request details:', {
          currentOwner,
          newOwner,
          guardians,
          threshold: threshold.toString(),
          approvalCount: approvalCount.toString(),
          circleWalletId,
          status: status.toString()
        });

        // Trigger recovery execution via API
        await this.triggerRecoveryExecution({
          eventHash: event.transactionHash,
          ensNode: node,
          newWalletAddress: newOwner,
          oldWalletId: circleWalletId
        });

      } catch (error) {
        console.error('❌ Failed to process RecoveryApproved event:', error);
      }
    });

    console.log('✅ Recovery event listener started successfully');
  }

  /**
   * Stop listening for events
   */
  public stopListening(): void {
    console.log('🛑 Stopping recovery event listener...');
    this.contract.removeAllListeners('RecoveryApproved');
    console.log('✅ Recovery event listener stopped');
  }

  /**
   * Trigger recovery execution via API call
   */
  private async triggerRecoveryExecution(params: {
    eventHash: string;
    ensNode: string;
    newWalletAddress: string;
    oldWalletId: string;
  }): Promise<void> {
    try {
      console.log('🚀 Triggering recovery execution...');

      const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const endpoint = `${apiUrl}/api/recovery/execute`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });

      const result = await response.json();

      if (response.ok) {
        console.log('✅ Recovery execution started:', result);
      } else {
        console.error('❌ Recovery execution failed:', result);
      }

    } catch (error) {
      console.error('❌ Failed to trigger recovery execution:', error);
    }
  }

  /**
   * Get past RecoveryApproved events (for recovery/sync)
   */
  public async getPastEvents(fromBlock: number = 0): Promise<any[]> {
    try {
      console.log(`🔍 Fetching past RecoveryApproved events from block ${fromBlock}...`);

      const events = await this.contract.queryFilter(
        this.contract.filters.RecoveryApproved(),
        fromBlock,
        'latest'
      );

      console.log(`📋 Found ${events.length} past RecoveryApproved events`);

      return events.map(event => {
        // Type guard for EventLog (has args property)
        if ('args' in event) {
          return {
            node: event.args?.node,
            newOwner: event.args?.newOwner,
            timestamp: event.args?.timestamp?.toString(),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
          };
        }
        // Fallback for Log type (no args)
        return {
          node: undefined,
          newOwner: undefined,
          timestamp: undefined,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash
        };
      });

    } catch (error) {
      console.error('❌ Failed to fetch past events:', error);
      return [];
    }
  }
}

// Export singleton instance
let eventListener: RecoveryEventListener | null = null;

export function getRecoveryEventListener(): RecoveryEventListener {
  if (!eventListener) {
    eventListener = new RecoveryEventListener();
  }
  return eventListener;
}

// Auto-start event listener if in production/server environment
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  console.log('🤖 Auto-starting recovery event listener in production...');
  const listener = getRecoveryEventListener();
  
  // Start listening with error handling
  try {
    listener.startListening();
  } catch (error) {
    console.error('❌ Failed to auto-start recovery event listener:', error);
  }

  // Graceful shutdown on process termination
  process.on('SIGINT', () => {
    console.log('📡 Gracefully shutting down recovery event listener...');
    listener.stopListening();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('📡 Gracefully shutting down recovery event listener...');
    listener.stopListening();
    process.exit(0);
  });
}