/**
 * React Hook for Circle Bridge Kit Integration
 * 
 * Provides a simple interface to bridge USDC using Circle Programmable Wallets + Bridge Kit
 * Handles authentication, transaction signing, and status tracking
 */

import { useState, useCallback, useEffect } from 'react';
import { W3SSdk } from '@circle-fin/w3s-pw-web-sdk';
import { BridgeKit } from '@circle-fin/bridge-kit';
import { 
  bridgeUSDCWithCircleWallet, 
  initializeCircleWebSDK,
  SupportedChain 
} from '../services/circleBridgeKitService';

interface BridgeState {
  isInitialized: boolean;
  isAuthenticated: boolean;
  isBridging: boolean;
  error: string | null;
  operationId: string | null;
  burnTxHash: string | null;
  mintTxHash: string | null;
  burnExplorerUrl: string | null;
  mintExplorerUrl: string | null;
  status: 'idle' | 'authenticating' | 'bridging' | 'waiting-mint' | 'complete' | 'error';
}

export function useCircleBridgeKit() {
  const [circleSDK, setCircleSDK] = useState<W3SSdk | null>(null);
  const [bridgeKit, setBridgeKit] = useState<BridgeKit | null>(null);
  
  const [state, setState] = useState<BridgeState>({
    isInitialized: false,
    isAuthenticated: false,
    isBridging: false,
    error: null,
    operationId: null,
    burnTxHash: null,
    mintTxHash: null,
    burnExplorerUrl: null,
    mintExplorerUrl: null,
    status: 'idle',
  });

  /**
   * Initialize Circle SDK and Bridge Kit (call once on mount)
   */
  const initialize = useCallback(async (appId: string) => {
    try {
      console.log('🔧 Initializing Circle Bridge Kit...');
      
      // Initialize Circle Web SDK
      const sdk = initializeCircleWebSDK(appId);
      setCircleSDK(sdk);
      
      // Initialize Bridge Kit
      const kit = new BridgeKit();
      setBridgeKit(kit);
      
      setState(prev => ({
        ...prev,
        isInitialized: true,
        error: null,
      }));
      
      console.log('✅ Circle Bridge Kit initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Bridge Kit:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Initialization failed',
        status: 'error',
      }));
    }
  }, []);

  /**
   * Bridge USDC between chains
   */
  const bridge = useCallback(async ({
    sourceChain,
    destinationChain,
    amount,
    recipient,
    walletId,
  }: {
    sourceChain: SupportedChain;
    destinationChain: SupportedChain;
    amount: string;
    recipient?: string;
    walletId: string;
  }) => {
    if (!circleSDK) {
      throw new Error('Circle SDK not initialized. Call initialize() first.');
    }

    try {
      setState(prev => ({
        ...prev,
        isBridging: true,
        status: 'authenticating',
        error: null,
      }));

      console.log('🔐 Authenticating with Circle...');

      // Execute bridge with Circle SDK
      const result = await bridgeUSDCWithCircleWallet({
        sourceChain,
        destinationChain,
        amount,
        recipient,
        walletId,
        circleSDK,
      });

      console.log('✅ Bridge transaction initiated:', result);

      setState(prev => ({
        ...prev,
        isBridging: false,
        isAuthenticated: true,
        operationId: result.operationId,
        burnTxHash: result.burnTxHash,
        mintTxHash: result.mintTxHash || null,
        burnExplorerUrl: result.burnExplorerUrl,
        mintExplorerUrl: result.mintExplorerUrl || null,
        status: result.mintTxHash ? 'complete' : 'waiting-mint',
        error: null,
      }));

      return result;
    } catch (error) {
      console.error('❌ Bridge failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Bridge operation failed';
      
      setState(prev => ({
        ...prev,
        isBridging: false,
        error: errorMessage,
        status: 'error',
      }));

      throw error;
    }
  }, [circleSDK]);

  /**
   * Reset bridge state
   */
  const reset = useCallback(() => {
    setState({
      isInitialized: state.isInitialized,
      isAuthenticated: false,
      isBridging: false,
      error: null,
      operationId: null,
      burnTxHash: null,
      mintTxHash: null,
      burnExplorerUrl: null,
      mintExplorerUrl: null,
      status: 'idle',
    });
  }, [state.isInitialized]);

  /**
   * Poll for mint transaction (CCTP takes 10-20 minutes on testnet)
   */
  useEffect(() => {
    if (state.status === 'waiting-mint' && state.operationId) {
      console.log('⏳ Waiting for mint transaction...');
      
      // TODO: Implement polling logic using Bridge Kit's status API
      // For now, this is a placeholder
      const pollInterval = setInterval(async () => {
        try {
          // Check if mint transaction is complete
          // This would use Bridge Kit's getStatus() method
          console.log('Polling for mint status...');
        } catch (error) {
          console.error('Error polling mint status:', error);
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(pollInterval);
    }
  }, [state.status, state.operationId]);

  return {
    // State
    ...state,
    
    // Actions
    initialize,
    bridge,
    reset,
    
    // SDK instances (for advanced usage)
    circleSDK,
    bridgeKit,
  };
}
