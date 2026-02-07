'use client';

import { useEffect, useState, useRef } from 'react';
import { WalletHeader } from '@/components/WalletHeader';
import { BalanceDisplay } from '@/components/BalanceDisplay';
import { ActionButtons } from '@/components/ActionButtons';
import { SendModal } from '@/components/SendModal';
import { ReceiveModal } from '@/components/ReceiveModal';
import { SwapModal } from '@/components/SwapModal';
import { CrossChainModal } from '@/components/CrossChainModal';
import { TransactionList } from '@/components/TransactionList';
import { WalletManagementModal } from '@/components/WalletManagementModal';
import GuardianSetupModal from '@/components/GuardianSetupModal';
import { useWalletStore, type NetworkBalance } from '@/lib/wallet-store';
import { ChevronDown, Settings, Wallet as WalletIcon, Plus, RefreshCw, Shield } from 'lucide-react';

export default function WalletPage() {
  const { 
    wallets, 
    selectedWallet, 
    selectedNetwork,
    setSelectedWallet, 
    setSelectedNetwork,
    setWallets,
    fetchAllNetworkBalances,
    getActiveNetwork,
    addWallet 
  } = useWalletStore();
  
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showCrossChainModal, setShowCrossChainModal] = useState(false);
  const [showNetworkSelector, setShowNetworkSelector] = useState(false);
  const [showWalletManagement, setShowWalletManagement] = useState(false);
  const [showGuardianSetup, setShowGuardianSetup] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastFetchedWalletId = useRef<string | null>(null);

  const activeNetwork = getActiveNetwork();

  // Debug logging
  useEffect(() => {
    console.log('🔍 Wallet Debug:', {
      walletsCount: wallets.length,
      selectedWallet: selectedWallet?.id,
      selectedWalletNetworks: selectedWallet?.networks?.length,
      fullSelectedWallet: selectedWallet, // Show full wallet object
      selectedNetwork,
      activeNetwork: activeNetwork?.blockchain,
      isInitialized
    });
  }, [wallets, selectedWallet, selectedNetwork, activeNetwork, isInitialized]);

  // Load wallets from environment on first mount (backward compatibility)
  useEffect(() => {
    if (isInitialized) return;
    
    // MIGRATION: Clear old wallet structure from localStorage
    const storedData = localStorage.getItem('wallet-storage');
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        if (parsed.state?.wallets && parsed.state.wallets.length > 0) {
          // Check if ANY wallet is missing the networks array
          const needsMigration = parsed.state.wallets.some((w: any) => !w.networks);
          if (needsMigration) {
            console.log('🔄 Detected old wallet structure - clearing ALL localStorage');
            localStorage.removeItem('wallet-storage');
            // Force clear wallets from state
            setWallets([]);
            setSelectedWallet(null);
            setSelectedNetwork('ARC-TESTNET');
          }
        }
      } catch (e) {
        console.error('Failed to parse localStorage:', e);
        localStorage.removeItem('wallet-storage');
      }
    }
    
    // Check if we have env wallet configured
    const arcWalletId = process.env.NEXT_PUBLIC_CIRCLE_WALLET_ID_ARC;
    const arcAddress = process.env.NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS_ARC;
    const ethAddress = process.env.NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS_ETH;
    const polygonAddress = process.env.NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS_POLYGON;

    if (arcWalletId && arcAddress) {
      // Create multi-network wallet from env variables
      // Note: EVM networks (Arc, Sepolia, Polygon) share the same address for a given wallet ID
      const envWallet = {
        id: arcWalletId,
        name: 'My Wallet',
        networks: [
          {
            blockchain: 'ARC-TESTNET',
            address: arcAddress,
            balance: '0',
            nativeBalance: '0',
            symbol: 'ETH',
          },
          {
            blockchain: 'ETH-SEPOLIA',
            address: ethAddress || arcAddress, // Use Arc address if Sepolia not set
            balance: '0',
            nativeBalance: '0',
            symbol: 'ETH',
          },
          {
            blockchain: 'MATIC-AMOY',
            address: polygonAddress || arcAddress, // Use Arc address if Polygon not set
            balance: '0',
            nativeBalance: '0',
            symbol: 'MATIC',
          },
        ],
        createdAt: new Date().toISOString(),
      };

      // Add env wallet if it doesn't exist
      if (!wallets.find(w => w.id === envWallet.id)) {
        addWallet(envWallet);
        // Don't select here - let the separate effect handle it
      } else if (!selectedWallet) {
        // If wallet already exists but not selected, select it
        const existingWallet = wallets.find(w => w.id === envWallet.id);
        if (existingWallet) {
          setSelectedWallet(existingWallet);
          if (existingWallet.networks && existingWallet.networks.length > 0 && !selectedNetwork) {
            setSelectedNetwork(existingWallet.networks[0].blockchain);
          }
        }
      }
    }

    setIsInitialized(true);
  }, [isInitialized, wallets, selectedWallet, selectedNetwork, addWallet, setSelectedWallet, setSelectedNetwork, setWallets]);

  // Separate effect: Auto-select first wallet if none selected
  useEffect(() => {
    if (isInitialized && !selectedWallet && wallets.length > 0) {
      console.log('🔄 Auto-selecting first wallet');
      setSelectedWallet(wallets[0]);
      if (wallets[0].networks && wallets[0].networks.length > 0) {
        setSelectedNetwork(wallets[0].networks[0].blockchain);
      }
    }
  }, [isInitialized, wallets, selectedWallet, setSelectedWallet, setSelectedNetwork]);

  // Ensure selectedNetwork is set when wallet changes
  useEffect(() => {
    if (selectedWallet && !selectedNetwork && selectedWallet.networks && selectedWallet.networks.length > 0) {
      console.log('🔄 Auto-selecting first network for wallet');
      setSelectedNetwork(selectedWallet.networks[0].blockchain);
    }
  }, [selectedWallet, selectedNetwork, setSelectedNetwork]);

  // Initial balance fetch - only triggers once per wallet selection
  useEffect(() => {
    if (selectedWallet && selectedWallet.id !== lastFetchedWalletId.current) {
      console.log('💰 Fetching initial balances for wallet:', selectedWallet.id);
      console.log('   Networks:', selectedWallet.networks.map(n => `${n.blockchain}: ${n.address}`));
      lastFetchedWalletId.current = selectedWallet.id;
      refreshBalances();
    }
  }, [selectedWallet?.id]);

  const refreshBalances = async () => {
    if (!selectedWallet) return;
    console.log('🔄 Manual refresh triggered');
    setIsRefreshing(true);
    try {
      await fetchAllNetworkBalances(selectedWallet);
      console.log('✅ Balances refreshed successfully');
    } catch (error) {
      console.error('❌ Failed to refresh balances:', error);
      alert('Failed to refresh balances. Check console for details.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const getNetworkDisplay = (blockchain: string) => {
    const displays: Record<string, string> = {
      'ETH-SEPOLIA': '⟠ Ethereum',
      'MATIC-AMOY': '⬡ Polygon',
      'ARC-TESTNET': '🌊 Arc',
    };
    return displays[blockchain] || blockchain;
  };

  const getNetworkIcon = (blockchain: string) => {
    const icons: Record<string, string> = {
      'ETH-SEPOLIA': '⟠',
      'MATIC-AMOY': '⬡',
      'ARC-TESTNET': '🌊',
    };
    return icons[blockchain] || '🔷';
  };

  // Show wallet creation prompt if no wallets
  if (wallets.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl max-w-md">
          <div className="text-6xl mb-4">💳</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Wallets Found</h2>
          <p className="text-gray-600 mb-4">
            Create your first multi-network Circle wallet
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm text-blue-900 font-medium mb-2">Each wallet includes:</p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>🌊 Arc Network (native USDC)</li>
              <li>⟠ Ethereum Sepolia</li>
              <li>⬡ Polygon Amoy</li>
            </ul>
          </div>
          <button
            onClick={() => setShowWalletManagement(true)}
            className="inline-flex items-center gap-2 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium mb-4 w-full justify-center"
          >
            <Plus className="w-5 h-5" />
            Create Multi-Network Wallet
          </button>
          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-3">Or import existing wallet</p>
            <a
              href="/setup"
              className="inline-block text-blue-500 hover:text-blue-600 font-medium text-sm"
            >
              Go to Setup Page →
            </a>
          </div>
        </div>

        <WalletManagementModal
          isOpen={showWalletManagement}
          onClose={() => setShowWalletManagement(false)}
        />
      </div>
    );
  }

  if (!selectedWallet || !activeNetwork) {
    console.log('⏳ Showing spinner:', { 
      hasSelectedWallet: !!selectedWallet, 
      hasActiveNetwork: !!activeNetwork,
      selectedNetwork 
    });
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* MetaMask-like Header Bar */}
        <div className="bg-white rounded-t-2xl p-4 flex items-center justify-between shadow-lg">
          <button 
            onClick={() => setShowWalletManagement(true)}
            className="text-gray-600 hover:text-gray-900 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Manage Wallets"
          >
            <WalletIcon size={24} />
          </button>
          
          <button
            onClick={() => setShowNetworkSelector(!showNetworkSelector)}
            className="flex items-center space-x-2 bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <span className="font-medium text-gray-900">
              {getNetworkDisplay(selectedNetwork)}
            </span>
            <ChevronDown size={16} className="text-gray-600" />
          </button>

          <button 
            onClick={() => setShowWalletManagement(true)}
            className="text-gray-600 hover:text-gray-900 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings size={24} />
          </button>
        </div>

        {/* Network Switcher Dropdown */}
        {showNetworkSelector && selectedWallet && (
          <div className="bg-white border-x border-gray-200 shadow-lg">
            {selectedWallet.networks.map((network) => (
              <button
                key={network.blockchain}
                onClick={() => {
                  setSelectedNetwork(network.blockchain);
                  setShowNetworkSelector(false);
                }}
                className="w-full px-6 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between border-b border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getNetworkIcon(network.blockchain)}</span>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 text-sm">
                      {getNetworkDisplay(network.blockchain)}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      {network.address.substring(0, 8)}...{network.address.substring(network.address.length - 6)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {network.blockchain === selectedNetwork && (
                    <span className="text-green-500 text-sm">✓ Active</span>
                  )}
                  {network.balance !== '0' && (
                    <p className="text-xs text-gray-600">{network.balance} USDC</p>
                  )}
                </div>
              </button>
            ))}
            <div className="px-6 py-3 bg-gray-50 text-xs text-gray-600 text-center">
              Same wallet, different networks
            </div>
          </div>
        )}

        {/* Main Wallet Card */}
        <div className="bg-white shadow-2xl rounded-b-2xl overflow-hidden">
          {/* ENS Name Banner */}
          {selectedWallet?.ensName && (
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-80">ENS Identity</p>
                  <p className="text-lg font-bold">{selectedWallet.ensName}</p>
                </div>
                <div className="bg-white/20 px-3 py-1 rounded-full text-xs">
                  ✓ Verified
                </div>
              </div>
            </div>
          )}

          <WalletHeader
            address={activeNetwork.address}
            blockchain={selectedNetwork}
          />

          <BalanceDisplay
            nativeBalance={activeNetwork.nativeBalance}
            usdcBalance={activeNetwork.balance}
            symbol={activeNetwork.symbol}
            isLoading={isRefreshing}
          />

          <ActionButtons
            onSend={() => setShowSendModal(true)}
            onReceive={() => setShowReceiveModal(true)}
            onSwap={() => setShowSwapModal(true)}
            onCrossChain={() => setShowCrossChainModal(true)}
            blockchain={selectedNetwork}
          />

          {/* Guardian Setup Banner */}
          <div className="border-t border-gray-200 p-4 bg-gradient-to-r from-purple-50 to-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                  <Shield className="text-white" size={20} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">Guardian Recovery</h4>
                  <p className="text-xs text-gray-600">Secure your wallet with trusted guardians</p>
                </div>
              </div>
              <button
                onClick={() => {
                  console.log('🔐 Opening Guardian Setup:', {
                    activeNetworkAddress: activeNetwork?.address,
                    fallbackAddress: selectedWallet?.networks[0]?.address,
                    ensName: selectedWallet?.ensName
                  });
                  setShowGuardianSetup(true);
                }}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                Setup Guardians
              </button>
            </div>
          </div>

          <TransactionList
            walletId={selectedWallet.id}
            walletAddress={activeNetwork.address}
          />
        </div>

        {/* Network Summary Card */}
        <div className="mt-4 bg-white rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">All Networks</h3>
            <button
              onClick={refreshBalances}
              disabled={isRefreshing}
              className="text-blue-600 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1 text-sm"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          <div className="space-y-2">
            {selectedWallet.networks.map((network) => (
              <div
                key={network.blockchain}
                onClick={() => setSelectedNetwork(network.blockchain)}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  network.blockchain === selectedNetwork
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'bg-gray-50 border-2 border-transparent hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getNetworkIcon(network.blockchain)}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {getNetworkDisplay(network.blockchain)}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {network.balance} USDC
                    </p>
                    <p className="text-xs text-gray-500">
                      {network.nativeBalance} {network.symbol}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      <SendModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        walletId={activeNetwork?.walletId || selectedWallet.id}
        blockchain={selectedNetwork}
        currentBalance={activeNetwork.balance}
        symbol={activeNetwork.symbol}
      />

      <ReceiveModal
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        address={activeNetwork.address}
        blockchain={selectedNetwork}
      />

      <SwapModal
        isOpen={showSwapModal}
        onClose={() => setShowSwapModal(false)}
        onSuccess={refreshBalances}
      />

      <CrossChainModal
        isOpen={showCrossChainModal}
        onClose={() => setShowCrossChainModal(false)}
        onSuccess={refreshBalances}
      />

      <WalletManagementModal
        isOpen={showWalletManagement}
        onClose={() => setShowWalletManagement(false)}
      />

      <GuardianSetupModal
        isOpen={showGuardianSetup}
        onClose={() => setShowGuardianSetup(false)}
        currentWalletAddress={activeNetwork?.address || selectedWallet?.networks[0]?.address}
        currentENSName={selectedWallet?.ensName}
      />
    </div>
  );
}
