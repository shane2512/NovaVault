/**
 * Wallet Switcher Component
 * 
 * MetaMask-like dropdown for switching between Circle wallets.
 * Displays active wallet, allows switching, and creating new wallets.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon, PlusIcon, CheckIcon } from 'lucide-react';

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

export interface WalletSwitcherProps {
  userId: string;
  activeWallet: WalletInfo | null;
  wallets: WalletInfo[];
  onWalletSwitch: (walletId: string) => Promise<void>;
  onCreateWallet: () => Promise<void>;
  isLoading?: boolean;
}

export function WalletSwitcher({
  userId,
  activeWallet,
  wallets,
  onWalletSwitch,
  onCreateWallet,
  isLoading = false,
}: WalletSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleWalletSelect = async (walletId: string) => {
    if (walletId === activeWallet?.walletId || isSwitching) return;

    setIsSwitching(true);
    try {
      await onWalletSwitch(walletId);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to switch wallet:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleCreateWallet = async () => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      await onCreateWallet();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to create wallet:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatBalance = (balance?: string) => {
    if (!balance || balance === '0') return '0 USDC';
    
    const numBalance = parseFloat(balance);
    if (numBalance < 0.01) return '< 0.01 USDC';
    
    return `${numBalance.toFixed(2)} USDC`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading || isSwitching || isCreating}
        className={`
          flex items-center gap-2 px-4 py-2.5 rounded-lg
          bg-gray-800 hover:bg-gray-700 border border-gray-700
          transition-all duration-200
          ${isLoading || isSwitching || isCreating ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div className="flex flex-col items-start min-w-0">
          <div className="text-xs text-gray-400">Active Wallet</div>
          <div className="text-sm font-medium text-white truncate">
            {activeWallet ? activeWallet.name : 'No wallet selected'}
          </div>
          {activeWallet && (
            <div className="text-xs text-gray-500 font-mono">
              {formatAddress(activeWallet.address)}
            </div>
          )}
        </div>
        <ChevronDownIcon
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-700">
            <div className="text-sm font-semibold text-white">My Wallets</div>
            <div className="text-xs text-gray-400 mt-1">
              {wallets.length} {wallets.length === 1 ? 'wallet' : 'wallets'}
            </div>
          </div>

          {/* Wallet List */}
          <div className="max-h-80 overflow-y-auto">
            {wallets.map((wallet) => (
              <button
                key={wallet.walletId}
                onClick={() => handleWalletSelect(wallet.walletId)}
                disabled={isSwitching || isCreating}
                className={`
                  w-full px-4 py-3 flex items-center gap-3
                  hover:bg-gray-700 transition-colors
                  ${wallet.isActive ? 'bg-gray-700/50' : ''}
                  ${isSwitching || isCreating ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {/* Active Indicator */}
                <div className="flex-shrink-0">
                  {wallet.isActive ? (
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <CheckIcon className="w-3 h-3 text-white" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
                  )}
                </div>

                {/* Wallet Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-white truncate">
                      {wallet.name}
                    </div>
                    {wallet.isActive && (
                      <span className="text-xs text-green-400">Active</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">
                    {formatAddress(wallet.address)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {wallet.blockchain}
                  </div>
                </div>

                {/* Balance */}
                {wallet.balance !== undefined && (
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-medium text-white">
                      {formatBalance(wallet.balance)}
                    </div>
                  </div>
                )}
              </button>
            ))}

            {/* Empty State */}
            {wallets.length === 0 && (
              <div className="px-4 py-8 text-center">
                <div className="text-gray-400 text-sm">No wallets yet</div>
                <div className="text-gray-500 text-xs mt-1">
                  Create your first wallet to get started
                </div>
              </div>
            )}
          </div>

          {/* Footer - Create New Wallet */}
          <div className="border-t border-gray-700 p-2">
            <button
              onClick={handleCreateWallet}
              disabled={isCreating || isSwitching}
              className={`
                w-full flex items-center gap-2 px-3 py-2.5
                rounded-md text-sm font-medium
                bg-blue-600 hover:bg-blue-500 text-white
                transition-colors
                ${isCreating || isSwitching ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <PlusIcon className="w-4 h-4" />
              <span>{isCreating ? 'Creating...' : 'Create New Wallet'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
