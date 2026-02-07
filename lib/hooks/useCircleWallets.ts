/**
 * useCircleWallets Hook
 * 
 * React hook for managing Circle wallets with MPC.
 * Handles wallet creation, switching, and balance fetching.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

export interface WalletInfo {
  walletId: string;
  circleWalletId: string;
  address: string;
  blockchain: string;
  arcSmartWalletAddress?: string;
  name: string;
  isActive: boolean;
  balance?: string;
  createdAt: string;
}

export interface UseCircleWalletsOptions {
  userId: string;
  autoFetch?: boolean;
  includeBalances?: boolean;
  refreshInterval?: number; // milliseconds
}

export interface UseCircleWalletsReturn {
  wallets: WalletInfo[];
  activeWallet: WalletInfo | null;
  isLoading: boolean;
  isCreating: boolean;
  isSwitching: boolean;
  error: string | null;
  createWallet: (options?: {
    blockchain?: string;
    name?: string;
    arcSmartWalletAddress?: string;
  }) => Promise<WalletInfo>;
  switchWallet: (walletId: string) => Promise<void>;
  refreshWallets: () => Promise<void>;
  refreshBalance: (walletId?: string) => Promise<void>;
}

export function useCircleWallets({
  userId,
  autoFetch = true,
  includeBalances = true,
  refreshInterval,
}: UseCircleWalletsOptions): UseCircleWalletsReturn {
  const [wallets, setWallets] = useState<WalletInfo[]>([]);
  const [activeWallet, setActiveWallet] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch all wallets for user
   */
  const fetchWallets = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/get-wallets?userId=${userId}&includeBalances=${includeBalances}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch wallets');
      }

      const data = await response.json();

      if (data.success) {
        setWallets(data.data.wallets);
        
        const active = data.data.wallets.find((w: WalletInfo) => w.isActive);
        setActiveWallet(active || null);
      } else {
        throw new Error(data.error?.message || 'Failed to fetch wallets');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch wallets';
      setError(errorMessage);
      console.error('[useCircleWallets] Error fetching wallets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, includeBalances]);

  /**
   * Create a new wallet
   */
  const createWallet = useCallback(
    async (options?: {
      blockchain?: string;
      name?: string;
      arcSmartWalletAddress?: string;
    }): Promise<WalletInfo> => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      setIsCreating(true);
      setError(null);

      try {
        const response = await fetch('/api/create-circle-wallet', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            blockchain: options?.blockchain,
            name: options?.name,
            arcSmartWalletAddress: options?.arcSmartWalletAddress,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to create wallet');
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error?.message || 'Failed to create wallet');
        }

        // Refresh wallet list
        await fetchWallets();

        return data.data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create wallet';
        setError(errorMessage);
        console.error('[useCircleWallets] Error creating wallet:', err);
        throw err;
      } finally {
        setIsCreating(false);
      }
    },
    [userId, fetchWallets]
  );

  /**
   * Switch active wallet
   */
  const switchWallet = useCallback(
    async (walletId: string): Promise<void> => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      setIsSwitching(true);
      setError(null);

      try {
        const response = await fetch('/api/set-active-wallet', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            walletId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Failed to switch wallet');
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error?.message || 'Failed to switch wallet');
        }

        // Update local state
        setWallets((prev) =>
          prev.map((w) => ({
            ...w,
            isActive: w.walletId === walletId,
          }))
        );

        const newActiveWallet = wallets.find((w) => w.walletId === walletId);
        setActiveWallet(newActiveWallet || null);

        // Refresh to get latest balances
        await fetchWallets();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to switch wallet';
        setError(errorMessage);
        console.error('[useCircleWallets] Error switching wallet:', err);
        throw err;
      } finally {
        setIsSwitching(false);
      }
    },
    [userId, wallets, fetchWallets]
  );

  /**
   * Refresh wallet list
   */
  const refreshWallets = useCallback(async () => {
    await fetchWallets();
  }, [fetchWallets]);

  /**
   * Refresh balance for specific wallet or active wallet
   */
  const refreshBalance = useCallback(
    async (walletId?: string) => {
      const targetWalletId = walletId || activeWallet?.walletId;
      if (!targetWalletId) return;

      // Refresh all wallets to update balance
      await fetchWallets();
    },
    [activeWallet, fetchWallets]
  );

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && userId) {
      fetchWallets();
    }
  }, [autoFetch, userId, fetchWallets]);

  // Auto-refresh interval
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchWallets();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, fetchWallets]);

  return {
    wallets,
    activeWallet,
    isLoading,
    isCreating,
    isSwitching,
    error,
    createWallet,
    switchWallet,
    refreshWallets,
    refreshBalance,
  };
}
