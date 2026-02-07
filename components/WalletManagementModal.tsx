'use client';

import { useState } from 'react';
import { useWalletStore } from '@/lib/wallet-store';
import { X, Plus, Wallet, Loader2, ChevronRight, Trash2 } from 'lucide-react';

interface WalletManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletManagementModal({ isOpen, onClose }: WalletManagementModalProps) {
  const { 
    wallets, 
    selectedWallet, 
    setSelectedWallet, 
    createNewWallet,
    removeWallet,
    updateWallet,
    isLoading 
  } = useWalletStore();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [walletName, setWalletName] = useState('');
  const [ensName, setEnsName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateWallet = async () => {
    setCreating(true);
    setError(null);

    try {
      console.log('🔄 Creating wallet with name:', walletName, 'ENS:', ensName);
      const newWallet = await createNewWallet(walletName || undefined);
      
      // Add ENS name if provided
      if (ensName) {
        updateWallet(newWallet.id, { ensName });
        newWallet.ensName = ensName;
      }
      
      console.log('✅ Wallet created:', {
        id: newWallet.id,
        name: newWallet.name,
        ensName: newWallet.ensName,
        networksCount: newWallet.networks?.length,
        networks: newWallet.networks?.map((n: any) => n.blockchain)
      });
      
      // Auto-select the newly created wallet
      setSelectedWallet(newWallet);
      
      // Reset form
      setWalletName('');
      setEnsName('');
      setShowCreateForm(false);
      
      console.log('✅ Wallet created with', newWallet.networks.length, 'networks');
    } catch (err: any) {
      setError(err.message || 'Failed to create wallet');
    } finally {
      setCreating(false);
    }
  };

  const handleSwitchWallet = (wallet: any) => {
    setSelectedWallet(wallet);
    onClose();
  };

  const handleRemoveWallet = (walletId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to remove this wallet? This will remove it from ALL networks.')) {
      removeWallet(walletId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">My Wallets</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!showCreateForm ? (
            <>
              {/* Wallet List */}
              <div className="space-y-3 mb-6">
                {wallets.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No wallets yet</p>
                    <p className="text-sm mt-1">Create your first wallet to get started</p>
                    <p className="text-xs mt-2 text-gray-400">
                      Each wallet supports 3 networks:<br />
                      🌊 Arc • ⟠ Ethereum • ⬡ Polygon
                    </p>
                  </div>
                ) : (
                  wallets.map((wallet) => (
                    <div
                      key={wallet.id}
                      onClick={() => handleSwitchWallet(wallet)}
                      className={`
                        p-4 rounded-xl cursor-pointer transition-all
                        ${selectedWallet?.id === wallet.id
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'bg-gray-50 border-2 border-transparent hover:border-gray-300'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">
                              {wallet.ensName || wallet.name || `Wallet ${wallet.id.substring(0, 8)}`}
                            </span>
                            {selectedWallet?.id === wallet.id && (
                              <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600">
                            {wallet.ensName && (
                              <span className="text-purple-600 font-medium">{wallet.ensName} • </span>
                            )}
                            {wallet.networks.length} networks • Multi-chain
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleRemoveWallet(wallet.id, e)}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </div>

                      {/* Network addresses preview */}
                      <div className="space-y-1 text-xs">
                        {wallet.networks.slice(0, 3).map((network, idx) => (
                          <div key={idx} className="flex items-center justify-between text-gray-500">
                            <span>
                              {network.blockchain === 'ARC-TESTNET' && '🌊 Arc'}
                              {network.blockchain === 'ETH-SEPOLIA' && '⟠ Ethereum'}
                              {network.blockchain === 'MATIC-AMOY' && '⬡ Polygon'}
                            </span>
                            <span className="font-mono">
                              {network.address.substring(0, 6)}...{network.address.substring(network.address.length - 4)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Create New Wallet Button */}
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create New Multi-Network Wallet
              </button>
              <p className="text-xs text-center text-gray-500 mt-2">
                Automatically creates wallet on Arc, Ethereum & Polygon
              </p>
            </>
          ) : (
            <>
              {/* Create Wallet Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wallet Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={walletName}
                    onChange={(e) => setWalletName(e.target.value)}
                    placeholder="My Multi-Chain Wallet"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ENS Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={ensName}
                    onChange={(e) => setEnsName(e.target.value)}
                    placeholder="wallet1.eth"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the ENS name you registered on Sepolia
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h4 className="font-medium text-blue-900 mb-2 text-sm">📋 What you'll get:</h4>
                  <ul className="space-y-1 text-xs text-blue-800">
                    <li>✅ One wallet ID across all networks</li>
                    <li>✅ Separate address per network</li>
                    <li>✅ 🌊 Arc Network (native USDC)</li>
                    <li>✅ ⟠ Ethereum Sepolia</li>
                    <li>✅ ⬡ Polygon Amoy</li>
                  </ul>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setError(null);
                      setWalletName('');
                      setEnsName('');
                    }}
                    disabled={creating}
                    className="flex-1 py-3 px-4 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateWallet}
                    disabled={creating}
                    className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Create Wallet
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
