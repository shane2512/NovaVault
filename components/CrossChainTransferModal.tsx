/**
 * Cross-Chain Transfer Modal Component
 * 
 * Modal for initiating USDC cross-chain transfers via Circle CCTP.
 * Supports transfers between supported chains with real-time status tracking.
 */

'use client';

import React, { useState } from 'react';
import { X, ArrowRight, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export interface CrossChainTransferRequest {
  userId: string;
  sourceWalletId: string;
  destinationChain: string;
  destinationAddress: string;
  amount: string;
}

export interface CrossChainTransferResult {
  trackingId: string;
  sourceTxHash: string;
  estimatedTime: string;
  explorerUrls: {
    source: string;
    destination?: string;
  };
}

interface CrossChainTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  sourceWalletId: string;
  sourceChain: string;
  maxAmount?: string;
  onTransferComplete?: (result: CrossChainTransferResult) => void;
}

// Supported chains for CCTP
const SUPPORTED_CHAINS = [
  { id: 'ETH-SEPOLIA', name: 'Ethereum Sepolia', icon: '⟠' },
  { id: 'AVAX-FUJI', name: 'Avalanche Fuji', icon: '🔺' },
  { id: 'MATIC-AMOY', name: 'Polygon Amoy', icon: '⬡' },
  { id: 'ARB-SEPOLIA', name: 'Arbitrum Sepolia', icon: '🔷' },
  { id: 'BASE-SEPOLIA', name: 'Base Sepolia', icon: '🔵' },
  { id: 'ARC-TESTNET', name: 'Arc Testnet', icon: '🌀' },
];

export function CrossChainTransferModal({
  isOpen,
  onClose,
  userId,
  sourceWalletId,
  sourceChain,
  maxAmount,
  onTransferComplete,
}: CrossChainTransferModalProps) {
  const [destinationChain, setDestinationChain] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CrossChainTransferResult | null>(null);

  // Reset state when modal closes
  const handleClose = () => {
    setDestinationChain('');
    setDestinationAddress('');
    setAmount('');
    setError(null);
    setResult(null);
    onClose();
  };

  // Validate Ethereum address format
  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // Handle transfer submission
  const handleTransfer = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validation
      if (!destinationChain) {
        throw new Error('Please select a destination chain');
      }

      if (!destinationAddress) {
        throw new Error('Please enter a destination address');
      }

      if (!isValidAddress(destinationAddress)) {
        throw new Error('Invalid Ethereum address format');
      }

      if (!amount || parseFloat(amount) <= 0) {
        throw new Error('Please enter a valid amount');
      }

      if (maxAmount && parseFloat(amount) > parseFloat(maxAmount)) {
        throw new Error(`Amount exceeds available balance (${maxAmount} USDC)`);
      }

      // Make API request
      const response = await fetch('/api/cross-chain-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          sourceWalletId,
          destinationChain,
          destinationAddress,
          amount,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Transfer failed');
      }

      console.log('Cross-chain transfer initiated:', data.data);
      setResult(data.data);
      onTransferComplete?.(data.data);
    } catch (err) {
      console.error('Transfer error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initiate transfer');
    } finally {
      setLoading(false);
    }
  };

  // Set max amount
  const handleMaxAmount = () => {
    if (maxAmount) {
      setAmount(maxAmount);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Cross-Chain Transfer</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {!result ? (
            <div className="space-y-4">
              {/* Source Chain (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From Chain
                </label>
                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <span className="text-gray-900 font-medium">
                    {SUPPORTED_CHAINS.find((c) => c.id === sourceChain)?.icon}{' '}
                    {SUPPORTED_CHAINS.find((c) => c.id === sourceChain)?.name || sourceChain}
                  </span>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <ArrowRight className="w-6 h-6 text-gray-400" />
              </div>

              {/* Destination Chain */}
              <div>
                <label htmlFor="destinationChain" className="block text-sm font-medium text-gray-700 mb-2">
                  To Chain
                </label>
                <select
                  id="destinationChain"
                  value={destinationChain}
                  onChange={(e) => setDestinationChain(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                >
                  <option value="">Select destination chain</option>
                  {SUPPORTED_CHAINS.filter((chain) => chain.id !== sourceChain).map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.icon} {chain.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination Address */}
              <div>
                <label htmlFor="destinationAddress" className="block text-sm font-medium text-gray-700 mb-2">
                  Destination Address
                </label>
                <input
                  id="destinationAddress"
                  type="text"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter the recipient's wallet address on the destination chain
                </p>
              </div>

              {/* Amount */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                    Amount (USDC)
                  </label>
                  {maxAmount && (
                    <button
                      onClick={handleMaxAmount}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      disabled={loading}
                    >
                      Max: {parseFloat(maxAmount).toFixed(2)}
                    </button>
                  )}
                </div>
                <input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Info Box */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Note:</strong> Cross-chain transfers typically take 10-15 minutes to complete.
                  You'll receive a tracking ID to monitor the transfer status.
                </p>
              </div>
            </div>
          ) : (
            /* Success Result */
            <div className="space-y-4">
              <div className="flex items-center justify-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
              </div>

              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Transfer Initiated!
                </h3>
                <p className="text-sm text-gray-600">
                  Your cross-chain transfer has been submitted
                </p>
              </div>

              <div className="space-y-2">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Tracking ID</p>
                  <p className="text-sm font-mono text-gray-900 break-all">{result.trackingId}</p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Source Transaction</p>
                  <a
                    href={result.explorerUrls.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    View on Explorer
                    <ArrowRight className="w-3 h-3" />
                  </a>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-1">Estimated Time</p>
                  <p className="text-sm text-gray-900">{result.estimatedTime}</p>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  Use the tracking ID to check your transfer status in the dashboard.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          {!result ? (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Processing...' : 'Initiate Transfer'}
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CrossChainTransferModal;
