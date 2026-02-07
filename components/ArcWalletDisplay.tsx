/**
 * Arc Wallet Display Component
 * 
 * Displays linked wallet information (Circle + Arc) with combined balances.
 * Shows both wallet addresses, deployment status, and cross-chain capabilities.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Copy, Check, ExternalLink, Shield, Wallet } from 'lucide-react';

export interface LinkedWallet {
  walletId: string;
  userId: string;
  name: string;
  circleWallet: {
    id: string;
    address: string;
    blockchain: string;
  };
  arcWallet: {
    address: string;
    isDeployed: boolean;
    version: string;
  };
  balances: {
    circle: string;
    arc: string;
    combined: string;
  };
  createdAt: string;
  lastSynced: string;
}

interface ArcWalletDisplayProps {
  userId: string;
  walletId: string;
  onRefresh?: () => void;
}

export function ArcWalletDisplay({ userId, walletId, onRefresh }: ArcWalletDisplayProps) {
  const [wallet, setWallet] = useState<LinkedWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // Fetch linked wallet data
  useEffect(() => {
    fetchWallet();
  }, [userId, walletId]);

  const fetchWallet = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/get-linked-wallet?userId=${userId}&walletId=${walletId}`
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch wallet');
      }

      setWallet(data.data);
    } catch (err) {
      console.error('Failed to fetch linked wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch wallet');
    } finally {
      setLoading(false);
    }
  };

  // Copy address to clipboard
  const copyAddress = async (address: string, label: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(label);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  // Format address for display
  const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Format balance
  const formatBalance = (balance: string): string => {
    const num = parseFloat(balance);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchWallet();
    onRefresh?.();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-600 font-medium">Error loading wallet</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
        <button
          onClick={fetchWallet}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <p className="text-gray-600">Wallet not found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-lg">{wallet.name}</h3>
            <p className="text-blue-100 text-sm">Linked Wallet (Circle + Arc)</p>
          </div>
          <button
            onClick={handleRefresh}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Combined Balance */}
      <div className="px-6 py-8 bg-gradient-to-br from-gray-50 to-white border-b">
        <div className="text-center">
          <p className="text-gray-600 text-sm mb-2">Total Balance</p>
          <p className="text-4xl font-bold text-gray-900">
            ${formatBalance(wallet.balances.combined)}
          </p>
          <p className="text-gray-500 text-xs mt-2">USDC across all chains</p>
        </div>
      </div>

      {/* Circle Wallet Section */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-5 h-5 text-blue-600" />
          <h4 className="font-semibold text-gray-900">Circle Wallet</h4>
        </div>
        
        <div className="space-y-2 ml-7">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Address:</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-gray-900">
                {formatAddress(wallet.circleWallet.address)}
              </span>
              <button
                onClick={() => copyAddress(wallet.circleWallet.address, 'circle')}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Copy address"
              >
                {copiedAddress === 'circle' ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Balance:</span>
            <span className="text-sm font-medium text-gray-900">
              ${formatBalance(wallet.balances.circle)} USDC
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Chain:</span>
            <span className="text-sm text-gray-900">{wallet.circleWallet.blockchain}</span>
          </div>
        </div>
      </div>

      {/* Arc Smart Wallet Section */}
      <div className="px-6 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-purple-600" />
          <h4 className="font-semibold text-gray-900">Arc Smart Wallet</h4>
          {wallet.arcWallet.isDeployed ? (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
              Deployed
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
              Not Deployed
            </span>
          )}
        </div>
        
        <div className="space-y-2 ml-7">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Address:</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-gray-900">
                {formatAddress(wallet.arcWallet.address)}
              </span>
              <button
                onClick={() => copyAddress(wallet.arcWallet.address, 'arc')}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Copy address"
              >
                {copiedAddress === 'arc' ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Balance:</span>
            <span className="text-sm font-medium text-gray-900">
              ${formatBalance(wallet.balances.arc)} USDC
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Version:</span>
            <span className="text-sm text-gray-900">{wallet.arcWallet.version}</span>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-6 py-3 bg-gray-50 border-t">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Created: {new Date(wallet.createdAt).toLocaleDateString()}</span>
          <span>Synced: {new Date(wallet.lastSynced).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}

export default ArcWalletDisplay;
