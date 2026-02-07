/**
 * Arc Integration Example Dashboard
 * 
 * Complete example showing how to use Circle + Arc linked wallets
 * with cross-chain USDC transfers via CCTP.
 * 
 * Features:
 * - Create linked wallets (Circle + Arc)
 * - Display combined balances
 * - Initiate cross-chain transfers
 * - Track transfer status in real-time
 */

'use client';

import React, { useState } from 'react';
import { Plus, ArrowRightLeft, ListFilter } from 'lucide-react';
import ArcWalletDisplay from '@/components/ArcWalletDisplay';
import CrossChainTransferModal from '@/components/CrossChainTransferModal';
import TransferStatusTracker from '@/components/TransferStatusTracker';

export default function ArcExampleDashboard() {
  // Mock user ID (in production, get from auth context)
  const userId = 'user_123';

  // State
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);
  const [activeWalletChain, setActiveWalletChain] = useState<string | null>(null);
  const [activeWalletBalance, setActiveWalletBalance] = useState<string | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [trackingIds, setTrackingIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Create a new linked wallet
  const handleCreateWallet = async () => {
    try {
      setCreating(true);

      const response = await fetch('/api/create-linked-wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          blockchain: 'ETH-SEPOLIA',
          name: `Wallet ${new Date().toLocaleDateString()}`,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to create wallet');
      }

      console.log('Linked wallet created:', data.data);
      alert(`Wallet created successfully!\n\nCircle Address: ${data.data.circleWallet.address}\nArc Address: ${data.data.arcWallet.address}`);

      // Set as active wallet
      setActiveWalletId(data.data.walletId);
      setActiveWalletChain(data.data.circleWallet.blockchain);
      setActiveWalletBalance(data.data.balances.combined);
    } catch (error) {
      console.error('Failed to create wallet:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to create wallet'}`);
    } finally {
      setCreating(false);
    }
  };

  // Handle transfer completion
  const handleTransferComplete = (result: any) => {
    console.log('Transfer completed:', result);
    setTrackingIds((prev) => [result.trackingId, ...prev]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Arc Integration Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Circle Programmable Wallets + Arc Smart Wallets
              </p>
            </div>
            <button
              onClick={handleCreateWallet}
              disabled={creating}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              {creating ? 'Creating...' : 'Create Linked Wallet'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Wallet Display */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Wallet</h2>
              
              {activeWalletId ? (
                <div className="space-y-4">
                  <ArcWalletDisplay
                    userId={userId}
                    walletId={activeWalletId}
                    onRefresh={() => console.log('Wallet refreshed')}
                  />

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setShowTransferModal(true)}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <ArrowRightLeft className="w-5 h-5" />
                      Cross-Chain Transfer
                    </button>
                    <button
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      disabled
                    >
                      <ListFilter className="w-5 h-5" />
                      View Transactions
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Plus className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Wallet Selected
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Create a new linked wallet to get started with cross-chain USDC transfers
                  </p>
                  <button
                    onClick={handleCreateWallet}
                    disabled={creating}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Your First Wallet'}
                  </button>
                </div>
              )}
            </div>

            {/* Transfer Trackers */}
            {trackingIds.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Transfers</h2>
                <div className="space-y-4">
                  {trackingIds.map((trackingId) => (
                    <TransferStatusTracker
                      key={trackingId}
                      trackingId={trackingId}
                      autoRefresh={true}
                      refreshInterval={10000}
                      onStatusChange={(status) => console.log('Status updated:', status)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Info & Features */}
          <div className="space-y-6">
            {/* Features Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Features</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">MPC Security</p>
                    <p className="text-xs text-gray-600">Multi-party computation for key management</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Smart Wallet Control</p>
                    <p className="text-xs text-gray-600">Arc smart wallets with programmable logic</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">CCTP Transfers</p>
                    <p className="text-xs text-gray-600">Native cross-chain USDC with Circle's protocol</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 text-sm">✓</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Multi-Chain Support</p>
                    <p className="text-xs text-gray-600">Ethereum, Avalanche, Polygon, Arbitrum, Base, Arc</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Integration Info */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-100">
              <h3 className="font-semibold text-gray-900 mb-3">How It Works</h3>
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  <p>
                    <strong>Create Wallet:</strong> Generates both a Circle MPC wallet and Arc smart wallet
                  </p>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <p>
                    <strong>Link Wallets:</strong> Arc smart wallet is linked to Circle wallet for unified control
                  </p>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    3
                  </span>
                  <p>
                    <strong>Cross-Chain:</strong> Transfer USDC across chains using Circle's CCTP protocol
                  </p>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    4
                  </span>
                  <p>
                    <strong>Track Status:</strong> Monitor transfers in real-time with automatic attestation
                  </p>
                </li>
              </ol>
            </div>

            {/* API Endpoints Reference */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-semibold text-gray-900 mb-4">API Endpoints</h3>
              <div className="space-y-2 text-xs font-mono">
                <div className="p-2 bg-green-50 rounded border border-green-200">
                  <span className="text-green-600 font-bold">POST</span>{' '}
                  <span className="text-gray-700">/api/create-linked-wallet</span>
                </div>
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <span className="text-blue-600 font-bold">GET</span>{' '}
                  <span className="text-gray-700">/api/get-linked-wallet</span>
                </div>
                <div className="p-2 bg-green-50 rounded border border-green-200">
                  <span className="text-green-600 font-bold">POST</span>{' '}
                  <span className="text-gray-700">/api/cross-chain-transfer</span>
                </div>
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <span className="text-blue-600 font-bold">GET</span>{' '}
                  <span className="text-gray-700">/api/cross-chain-status</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Cross-Chain Transfer Modal */}
      {activeWalletId && activeWalletChain && (
        <CrossChainTransferModal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          userId={userId}
          sourceWalletId={activeWalletId}
          sourceChain={activeWalletChain}
          maxAmount={activeWalletBalance || undefined}
          onTransferComplete={handleTransferComplete}
        />
      )}
    </div>
  );
}
