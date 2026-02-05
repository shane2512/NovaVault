'use client';

import { useEffect, useState } from 'react';
import { WalletHeader } from '@/components/WalletHeader';
import { BalanceDisplay } from '@/components/BalanceDisplay';
import { ActionButtons } from '@/components/ActionButtons';
import { SendModal } from '@/components/SendModal';
import { ReceiveModal } from '@/components/ReceiveModal';
import { SwapModal } from '@/components/SwapModal';
import { CrossChainModal } from '@/components/CrossChainModal';
import { TransactionList } from '@/components/TransactionList';
import { useWalletStore } from '@/lib/wallet-store';
import { ChevronDown, Settings, Menu } from 'lucide-react';

interface WalletData {
  id: string;
  address: string;
  blockchain: string;
}

export default function WalletPage() {
  const { selectedWallet, setSelectedWallet, fetchWalletBalance } = useWalletStore();
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showCrossChainModal, setShowCrossChainModal] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [balanceData, setBalanceData] = useState({
    nativeBalance: '0',
    balance: '0',
    symbol: 'ETH',
    isLoading: true,
  });

  useEffect(() => {
    // Load wallets from environment
    const ethWallet: WalletData = {
      id: process.env.NEXT_PUBLIC_CIRCLE_WALLET_ID_ETH || '',
      address: process.env.NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS_ETH || '',
      blockchain: 'ETH-SEPOLIA',
    };

    const polygonWallet: WalletData = {
      id: process.env.NEXT_PUBLIC_CIRCLE_WALLET_ID_POLYGON || '',
      address: process.env.NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS_POLYGON || '',
      blockchain: 'MATIC-AMOY',
    };

    const arcWallet: WalletData = {
      id: process.env.NEXT_PUBLIC_CIRCLE_WALLET_ID_ARC || '',
      address: process.env.NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS_ARC || '',
      blockchain: 'ARC-TESTNET',
    };

    const availableWallets = [arcWallet, ethWallet, polygonWallet].filter(w => w.id && w.address);
    setWallets(availableWallets);

    if (availableWallets.length > 0 && !selectedWallet) {
      setSelectedWallet(availableWallets[0]);
    }
  }, []);

  useEffect(() => {
    if (selectedWallet) {
      loadBalance();
    }
  }, [selectedWallet]);

  const loadBalance = async () => {
    if (!selectedWallet) return;

    setBalanceData(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch(
        `/api/wallet/balance?address=${selectedWallet.address}&blockchain=${selectedWallet.blockchain}`
      );
      const data = await response.json();

      setBalanceData({
        nativeBalance: data.nativeBalance || '0',
        balance: data.balance || '0',
        symbol: data.symbol || 'ETH',
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load balance:', error);
      setBalanceData(prev => ({ ...prev, isLoading: false }));
    }
  };

  if (!selectedWallet) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Wallet Found</h2>
          <p className="text-gray-600 mb-6">
            Please set up your Circle wallet first
          </p>
          <a
            href="/"
            className="inline-block bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Go to Setup
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* MetaMask-like Header Bar */}
        <div className="bg-white rounded-t-2xl p-4 flex items-center justify-between shadow-lg">
          <button className="text-gray-600 hover:text-gray-900">
            <Menu size={24} />
          </button>
          
          <button
            onClick={() => setShowWalletSelector(!showWalletSelector)}
            className="flex items-center space-x-2 bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <span className="font-medium text-gray-900">
              {selectedWallet.blockchain === 'ETH-SEPOLIA' ? '🔵 Sepolia' : 
               selectedWallet.blockchain === 'MATIC-AMOY' ? '🟣 Polygon' : 
               '🌉 Arc Testnet'}
            </span>
            <ChevronDown size={16} className="text-gray-600" />
          </button>

          <button className="text-gray-600 hover:text-gray-900">
            <Settings size={24} />
          </button>
        </div>

        {/* Wallet Selector Dropdown */}
        {showWalletSelector && (
          <div className="bg-white border-x border-gray-200 shadow-lg">
            {wallets.map((wallet) => (
              <button
                key={`${wallet.id}-${wallet.blockchain}`}
                onClick={() => {
                  setSelectedWallet(wallet);
                  setShowWalletSelector(false);
                }}
                className="w-full px-6 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between border-b border-gray-100"
              >
                <span className="font-medium text-gray-900">
                  {wallet.blockchain === 'ETH-SEPOLIA' ? '🔵 Sepolia' : 
                   wallet.blockchain === 'MATIC-AMOY' ? '🟣 Polygon Amoy' :
                   '🌉 Arc Testnet'}
                </span>
                {wallet.id === selectedWallet.id && (
                  <span className="text-green-500">✓</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Main Wallet Card */}
        <div className="bg-white shadow-2xl rounded-b-2xl overflow-hidden">
          <WalletHeader
            address={selectedWallet.address}
            blockchain={selectedWallet.blockchain}
          />

          <BalanceDisplay
            nativeBalance={balanceData.nativeBalance}
            usdcBalance={balanceData.balance}
            symbol={balanceData.symbol}
            isLoading={balanceData.isLoading}
          />

          <ActionButtons
            onSend={() => setShowSendModal(true)}
            onReceive={() => setShowReceiveModal(true)}
            onSwap={() => setShowSwapModal(true)}
            onCrossChain={() => setShowCrossChainModal(true)}
            blockchain={selectedWallet.blockchain}
          />

          <TransactionList
            walletId={selectedWallet.id}
            walletAddress={selectedWallet.address}
          />
        </div>

        {/* Refresh Button */}
        <button
          onClick={loadBalance}
          className="w-full mt-4 bg-white text-gray-700 py-3 rounded-xl hover:bg-gray-50 transition-colors shadow-lg font-medium"
        >
          🔄 Refresh Balance
        </button>
      </div>

      {/* Modals */}
      <SendModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        onSuccess={loadBalance}
        walletId={selectedWallet.id}
        walletAddress={selectedWallet.address}
        blockchain={selectedWallet.blockchain}
      />

      <ReceiveModal
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        address={selectedWallet.address}
        blockchain={selectedWallet.blockchain}
      />

      <SwapModal
        isOpen={showSwapModal}
        onClose={() => setShowSwapModal(false)}
        onSuccess={loadBalance}
      />

      <CrossChainModal
        isOpen={showCrossChainModal}
        onClose={() => setShowCrossChainModal(false)}
        onSuccess={loadBalance}
      />

      <SendModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        walletId={selectedWallet.id}
        blockchain={selectedWallet.blockchain}
        currentBalance={balanceData.balance}
        symbol="USDC"
      />

      <ReceiveModal
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        address={selectedWallet.address}
        blockchain={selectedWallet.blockchain}
      />
    </div>
  );
}
