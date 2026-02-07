// Circle Wallet Store using Zustand
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

export interface NetworkBalance {
  blockchain: string;
  address: string;
  balance: string;
  nativeBalance: string;
  symbol: string;
  walletId?: string; // Circle wallet ID for this specific network
}

export interface Wallet {
  id: string; // Circle Primary Wallet ID
  walletSetId?: string; // Wallet Set ID (for multi-chain wallets)
  name?: string;
  ensName?: string; // ENS name for this wallet (e.g., wallet1.eth)
  networks: NetworkBalance[]; // Multiple networks for one wallet
  createdAt?: string;
}

interface WalletState {
  wallets: Wallet[];
  selectedWallet: Wallet | null;
  selectedNetwork: string; // Current active network (ARC-TESTNET, ETH-SEPOLIA, etc)
  isLoading: boolean;
  error: string | null;
  
  // Actions
  addWallet: (wallet: Wallet) => void;
  removeWallet: (walletId: string) => void;
  updateWallet: (walletId: string, updates: Partial<Wallet>) => void;
  setWallets: (wallets: Wallet[]) => void;
  setSelectedWallet: (wallet: Wallet | null) => void;
  setSelectedNetwork: (blockchain: string) => void;
  createNewWallet: (name?: string) => Promise<Wallet>;
  fetchAllNetworkBalances: (wallet: Wallet) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getActiveNetwork: () => NetworkBalance | null;
}

// Custom storage that safely handles SSR/build time
const safeStorage = {
  getItem: (name: string): string | null => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(name);
      } catch (e) {
        console.warn('[WalletStore] Failed to read from localStorage:', e);
        return null;
      }
    }
    return null;
  },
  setItem: (name: string, value: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(name, value);
      } catch (e) {
        console.warn('[WalletStore] Failed to write to localStorage:', e);
      }
    }
  },
  removeItem: (name: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(name);
      } catch (e) {
        console.warn('[WalletStore] Failed to remove from localStorage:', e);
      }
    }
  },
};

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      wallets: [],
      selectedWallet: null,
      selectedNetwork: 'ARC-TESTNET',
      isLoading: false,
      error: null,

      addWallet: (wallet) => {
        const wallets = get().wallets;
        if (!wallets.find(w => w.id === wallet.id)) {
          set({ wallets: [...wallets, wallet] });
        }
      },

      removeWallet: (walletId) => {
        const wallets = get().wallets.filter(w => w.id !== walletId);
        set({ wallets });
        if (get().selectedWallet?.id === walletId) {
          set({ selectedWallet: wallets[0] || null });
        }
      },

      updateWallet: (walletId, updates) => {
        const wallets = get().wallets.map(w =>
          w.id === walletId ? { ...w, ...updates } : w
        );
        set({ wallets });
        if (get().selectedWallet?.id === walletId) {
          set({ selectedWallet: { ...get().selectedWallet!, ...updates } });
        }
      },

      setWallets: (wallets) => set({ wallets }),
      
      setSelectedWallet: (wallet) => set({ selectedWallet: wallet }),
      
      setSelectedNetwork: (blockchain) => set({ selectedNetwork: blockchain }),

      getActiveNetwork: () => {
        const { selectedWallet, selectedNetwork } = get();
        if (!selectedWallet || !selectedWallet.networks) return null;
        return selectedWallet.networks.find(n => n.blockchain === selectedNetwork) || null;
      },

      createNewWallet: async (name) => {
        set({ isLoading: true, error: null });
        try {
          // Always create wallet on all 3 networks using wallet sets
          const blockchains = ['ARC-TESTNET', 'ETH-SEPOLIA', 'MATIC-AMOY'];
          
          console.log('💳 Creating multi-chain wallet with wallet set...');
          console.log('   Blockchains:', blockchains);
          
          const response = await axios.post('/api/wallet/create-multi', {
            name,
            blockchains: blockchains
          });

          console.log('📦 API response:', response.data);

          if (response.data.success) {
            const newWallet = response.data.wallet;
            console.log('✅ New wallet structure:', {
              id: newWallet.id,
              networksCount: newWallet.networks?.length,
              networks: newWallet.networks
            });
            get().addWallet(newWallet);
            set({ isLoading: false });
            return newWallet;
          } else {
            throw new Error(response.data.error || 'Failed to create wallet');
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.message || error.message || 'Failed to create wallet';
          set({ isLoading: false, error: errorMessage });
          throw new Error(errorMessage);
        }
      },
      
      fetchAllNetworkBalances: async (wallet) => {
        if (!wallet || !wallet.networks || wallet.networks.length === 0) {
          console.warn('No networks to fetch balances for');
          return;
        }
        
        console.log(`🔄 Fetching balances for ${wallet.networks.length} networks...`);
        set({ isLoading: true, error: null });
        try {
          const updatedNetworks = await Promise.all(
            wallet.networks.map(async (network) => {
              try {
                console.log(`   Requesting ${network.blockchain}: ${network.address}`);
                const response = await axios.get(
                  `/api/wallet/balance?address=${network.address}&blockchain=${network.blockchain}`
                );
                console.log(`   ✅ ${network.blockchain} response:`, {
                  balance: response.data.balance,
                  nativeBalance: response.data.nativeBalance,
                  error: response.data.error
                });
                return {
                  ...network,
                  balance: response.data.balance || '0',
                  nativeBalance: response.data.nativeBalance || '0',
                  symbol: response.data.symbol || 'ETH',
                };
              } catch (err) {
                console.error(`   ❌ Failed to fetch balance for ${network.blockchain}:`, (err as any).response?.data || (err as Error).message);
                return network; // Return unchanged on error
              }
            })
          );

          const updatedWallet = {
            ...wallet,
            networks: updatedNetworks,
          };
          
          console.log('✅ All balances updated:', updatedNetworks.map(n => `${n.blockchain}: ${n.balance} USDC`));
          
          const wallets = get().wallets.map(w => 
            w.id === wallet.id ? updatedWallet : w
          );
          
          set({ 
            wallets,
            selectedWallet: get().selectedWallet?.id === wallet.id ? updatedWallet : get().selectedWallet,
            isLoading: false 
          });
        } catch (error) {
          console.error('❌ Failed to fetch balances:', error);
          set({ 
            error: 'Failed to fetch wallet balances',
            isLoading: false 
          });
        }
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error: error }),
    }),
    {
      name: 'novavault-wallets',
      storage: {
        getItem: (name) => {
          const str = safeStorage.getItem(name);
          return str ? JSON.parse(str) : null;
        },
        setItem: (name, value) => {
          safeStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          safeStorage.removeItem(name);
        },
      },
    }
  )
);
