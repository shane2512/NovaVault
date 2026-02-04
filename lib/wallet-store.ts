// Circle Wallet Store using Zustand
import { create } from 'zustand';
import axios from 'axios';

export interface Wallet {
  id: string;
  address: string;
  blockchain: string;
  balance?: string;
  nativeBalance?: string;
}

interface WalletState {
  wallets: Wallet[];
  selectedWallet: Wallet | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setWallets: (wallets: Wallet[]) => void;
  setSelectedWallet: (wallet: Wallet | null) => void;
  fetchWalletBalance: (wallet: Wallet) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallets: [],
  selectedWallet: null,
  isLoading: false,
  error: null,

  setWallets: (wallets) => set({ wallets }),
  
  setSelectedWallet: (wallet) => set({ selectedWallet: wallet }),
  
  fetchWalletBalance: async (wallet) => {
    set({ isLoading: true, error: null });
    try {
      // Call your backend API to get balance
      const response = await axios.get(`/api/wallet/balance?address=${wallet.address}&blockchain=${wallet.blockchain}`);
      
      const updatedWallet = {
        ...wallet,
        balance: response.data.balance,
        nativeBalance: response.data.nativeBalance,
      };
      
      const wallets = get().wallets.map(w => 
        w.id === wallet.id ? updatedWallet : w
      );
      
      set({ 
        wallets,
        selectedWallet: get().selectedWallet?.id === wallet.id ? updatedWallet : get().selectedWallet,
        isLoading: false 
      });
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      set({ 
        error: 'Failed to fetch wallet balance',
        isLoading: false 
      });
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
