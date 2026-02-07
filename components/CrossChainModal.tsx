'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';

// Type definition for supported chains
export type SupportedChain = 'ETH-SEPOLIA' | 'MATIC-AMOY' | 'ARC-TESTNET';

interface CrossChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CHAINS = [
  { id: 'ETH-SEPOLIA' as SupportedChain, name: 'Ethereum Sepolia', icon: '⟠', cctpSupported: true, cctpToArc: true },
  { id: 'MATIC-AMOY' as SupportedChain, name: 'Polygon Amoy', icon: '⬣', cctpSupported: true, cctpToArc: false },
  { id: 'ARC-TESTNET' as SupportedChain, name: 'Arc Testnet', icon: '◈', cctpSupported: true, cctpToArc: true },
];

export function CrossChainModal({ isOpen, onClose, onSuccess }: CrossChainModalProps) {
  const { selectedWallet, getActiveNetwork } = useWalletStore();
  const activeNetwork = getActiveNetwork();
  
  const [sourceChain, setSourceChain] = useState<SupportedChain>('ETH-SEPOLIA');
  const [destChain, setDestChain] = useState<SupportedChain>('ARC-TESTNET'); // Default to Arc for Sepolia
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'burning' | 'attesting' | 'minting' | 'completed' | 'error'>('idle');
  const [error, setError] = useState('');
  const [txHashes, setTxHashes] = useState<{ burn?: string; mint?: string }>({});
  const [explorerUrls, setExplorerUrls] = useState<{ burn?: string; mint?: string }>({});
  const [bridgeMethod, setBridgeMethod] = useState<'bridge-kit' | 'manual-cctp' | 'standard-cctp' | null>(null);
  
  // Balance state
  const [balances, setBalances] = useState<Record<SupportedChain, string>>({
    'ETH-SEPOLIA': '0',
    'MATIC-AMOY': '0',
    'ARC-TESTNET': '0',
  });
  const [totalBalance, setTotalBalance] = useState('0');
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  
  // Get wallet address from active network (same address across all networks)
  const walletAddress = activeNetwork?.address || selectedWallet?.networks?.[0]?.address;
  
  // Load balances on mount
  useEffect(() => {
    console.log('🌉 Bridge modal effect triggered:', { isOpen, walletAddress, selectedWallet: selectedWallet?.name });
    
    if (isOpen && walletAddress) {
      console.log('🔄 Loading bridge balances for address:', walletAddress);
      loadBalances();
    } else if (isOpen && !walletAddress) {
      console.error('❌ Bridge modal opened but no wallet address available');
    }
  }, [isOpen, walletAddress]);
  
  const loadBalances = async () => {
    setIsLoadingBalances(true);
    try {
      // Call API route with cache-busting timestamp to force fresh data
      const timestamp = Date.now();
      const response = await fetch(`/api/cctp/balance?address=${walletAddress}&t=${timestamp}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch balances');
      }
      
      setTotalBalance(result.total);
      
      const balanceMap: Record<SupportedChain, string> = {
        'ETH-SEPOLIA': '0',
        'MATIC-AMOY': '0',
        'ARC-TESTNET': '0',
      };
      
      result.breakdown.forEach((item: { chain: SupportedChain; balance: string }) => {
        balanceMap[item.chain] = item.balance;
      });
      
      setBalances(balanceMap);
    } catch (err) {
      console.error('Failed to load balances:', err);
    } finally {
      setIsLoadingBalances(false);
    }
  };
  
  const handleTransfer = async () => {
    if (parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    if (parseFloat(amount) > parseFloat(balances[sourceChain])) {
      setError('Insufficient balance on source chain');
      return;
    }
    
    if (sourceChain === destChain) {
      setError('Source and destination chains must be different');
      return;
    }

    if (!selectedWallet?.id) {
      setError('No Circle wallet selected');
      return;
    }

    setError('');
    setIsLoading(true);
    setStatus('burning');
    
    try {
      // Check if this involves Arc (requires manual CCTP)
      const involvesArc = sourceChain === 'ARC-TESTNET' || destChain === 'ARC-TESTNET';
      
      if (involvesArc) {
        // Manual CCTP for Arc transfers
        console.log('🚀 Starting Manual CCTP (Arc) transfer:', { 
          sourceChain, 
          destChain, 
          amount, 
          recipient: walletAddress
        });

        // Only support Sepolia ↔ Arc for now
        if (sourceChain !== 'ETH-SEPOLIA' && destChain !== 'ARC-TESTNET') {
          throw new Error('Arc bridge currently supports Sepolia → Arc only');
        }
        
        // Get wallet IDs for each chain
        const sepoliaNetwork = selectedWallet.networks.find(n => n.blockchain === 'ETH-SEPOLIA');
        const arcNetwork = selectedWallet.networks.find(n => n.blockchain === 'ARC-TESTNET');
        
        if (!sepoliaNetwork?.walletId || !arcNetwork?.walletId) {
          throw new Error('Wallet not configured for multi-chain transfers. Please create a new multi-chain wallet.');
        }

        setStatus('burning');
        const response = await fetch('/api/cctp/manual-bridge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sepoliaWalletId: sepoliaNetwork.walletId,
            arcWalletId: arcNetwork.walletId,
            amount,
            destinationAddress: walletAddress
          })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Manual CCTP bridge failed');
        }
        
        setBridgeMethod('manual-cctp');
        setTxHashes({
          burn: result.burnTxHash,
          mint: result.mintTxHash,
        });
        
        setExplorerUrls({
          burn: result.explorerUrls?.burn,
          mint: result.explorerUrls?.mint,
        });
        
        console.log('✅ Manual CCTP transfer complete!');
        console.log('   Burn TX:', result.burnTxHash);
        console.log('   Mint TX:', result.mintTxHash);
        
        setStatus('completed');
        
      } else {
        // Standard CCTP: Point-to-point bridge (Sepolia ↔ Amoy)
        console.log('🌉 Starting Standard CCTP bridge:', { 
          sourceChain, 
          destChain, 
          amount, 
          recipient: walletAddress,
          circleWalletId: selectedWallet.id
        });
        
        const response = await fetch('/api/cctp/bridge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceChain,
            destinationChain: destChain,
            amount,
            recipient: walletAddress,
            circleWalletId: selectedWallet.id
          })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Bridge failed');
        }
        
        setBridgeMethod(result.method || 'circle-cctp-direct');
        
        setTxHashes({
          burn: result.burnTxHash,
          mint: undefined,
        });
        
        setExplorerUrls({
          burn: result.burnExplorerUrl,
          mint: undefined,
        });
        
        console.log('✅ CCTP bridge initiated!');
        console.log('   Burn TX:', result.burnTxHash);
        console.log('   USDC will mint on destination in 10-20 minutes');
        
        setStatus('completed');
      }
      
      // Optimistically update balances
      const newSourceBalance = (parseFloat(balances[sourceChain]) - parseFloat(amount)).toFixed(6);
      setBalances(prev => ({
        ...prev,
        [sourceChain]: newSourceBalance
      }));
      
      // Reload balances after confirmation
      setTimeout(() => {
        console.log('🔄 Reloading balances after bridge confirmation...');
        loadBalances();
      }, 15000); // 15 seconds to allow blockchain confirmation
      
      if (onSuccess) {
        onSuccess();
      }
      
      // Auto-close after success
      setTimeout(() => {
        onClose();
        resetModal();
      }, 5000);
      
    } catch (err: any) {
      console.error('Transfer failed:', err);
      
      // Format error message for display
      let errorMessage = err.message || 'Transfer failed';
      
      // Make multi-line errors more readable
      if (errorMessage.includes('\n')) {
        errorMessage = errorMessage.split('\n')[0]; // Show first line only
      }
      
      setError(errorMessage);
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetModal = () => {
    setAmount('');
    setStatus('idle');
    setError('');
    setTxHashes({});
    setExplorerUrls({});
  };
  
  const setMaxAmount = () => {
    setAmount(balances[sourceChain]);
  };
  
  const switchChains = () => {
    const temp = sourceChain;
    setSourceChain(destChain);
    setDestChain(temp);
  };
  
  const getEstimatedTime = () => {
    // Manual CCTP for Arc transfers: 10-20 seconds (burn + attestation + mint)
    if (sourceChain === 'ARC-TESTNET' || destChain === 'ARC-TESTNET') {
      return '~10-20 seconds';
    }
    // Standard CCTP for Sepolia ↔ Amoy
    return '~15-20 minutes';
  };
  
  const getExplorerLink = (chain: SupportedChain, txHash: string) => {
    const explorers = {
      'ETH-SEPOLIA': `https://sepolia.etherscan.io/tx/${txHash}`,
      'MATIC-AMOY': `https://amoy.polygonscan.com/tx/${txHash}`,
      'ARC-TESTNET': `https://testnet.arcscan.com/tx/${txHash}`,
    };
    return explorers[chain];
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-xl font-bold">Cross-Chain Transfer</h2>
          <button
            onClick={() => {
              onClose();
              resetModal();
            }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Bridge Wallet Warning */}
        <div className="p-4 bg-amber-50 border-b border-amber-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm">
              <p className="font-semibold text-amber-900 mb-1">Bridge Wallet Required</p>
              <p className="text-amber-800 mb-2">
                Bridging uses a separate wallet that needs USDC on the source chain.
              </p>
              <p className="text-xs text-amber-700">
                Bridge wallet: <code className="bg-amber-100 px-1 py-0.5 rounded">0x2801...70EC</code>
                {' '}·{' '}
                <a 
                  href="https://faucet.circle.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-amber-900"
                >
                  Get testnet USDC →
                </a>
              </p>
            </div>
          </div>
        </div>
        
        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1">
        {/* Unified Balance */}
        <div className="p-4 bg-gradient-to-r from-orange-50 to-orange-100 border-b">
          <div className="text-sm text-gray-600 mb-1">Total USDC Across All Chains</div>
          <div className="text-3xl font-bold text-gray-900">
            {isLoadingBalances ? (
              <div className="flex items-center gap-2">
                <Loader2 size={24} className="animate-spin" />
                <span className="text-lg">Loading...</span>
              </div>
            ) : (
              `${parseFloat(totalBalance).toFixed(2)} USDC`
            )}
          </div>
          
          {/* Balance Breakdown */}
          <div className="mt-3 space-y-1">
            {CHAINS.map((chain) => (
              <div key={chain.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{chain.icon} {chain.name}</span>
                <span className="font-medium text-gray-900">{balances[chain.id]} USDC</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Transfer Interface */}
        <div className="p-4">
          {/* Bridge Kit Configuration Notice */}
          {sourceChain !== destChain && !process.env.NEXT_PUBLIC_BRIDGE_ENABLED && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <div className="flex gap-2">
                <span className="text-amber-600 flex-shrink-0 text-xl">⚙️</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900 mb-1">
                    Circle API Configuration Required
                  </p>
                  <p className="text-xs text-amber-800 leading-relaxed mb-2">
                    To enable cross-chain bridging with your Circle wallets, configure Circle API credentials in <code className="bg-amber-100 px-1 py-0.5 rounded">.env.local</code>:
                  </p>
                  <code className="block text-xs bg-amber-900 text-amber-50 p-2 rounded mb-2 overflow-x-auto">
                    CIRCLE_API_KEY=your_api_key<br/>
                    CIRCLE_ENTITY_SECRET=your_entity_secret
                  </code>
                  <p className="text-xs text-amber-700">
                    <b>Note:</b> This uses Circle's Programmable Wallets SDK to interact with CCTP contracts directly. No bridge wallet needed!
                  </p>
                </div>
              </div>
            </div>
          )}

          {sourceChain !== destChain && process.env.NEXT_PUBLIC_BRIDGE_ENABLED && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex gap-2">
                <span className="text-blue-600 flex-shrink-0 text-xl">🌉</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    Direct Circle Wallet CCTP Bridging
                  </p>
                  <div className="text-xs text-blue-800 leading-relaxed space-y-1">
                    <p><b>Step 1:</b> Approve USDC spend to CCTP TokenMessenger contract</p>
                    <p><b>Step 2:</b> Call depositForBurn (burns USDC on source chain)</p>
                    <p><b>Automatic:</b> Circle attests and mints USDC on destination (~10-20 min)</p>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    ✅ All transactions from YOUR Circle wallet - no bridge wallet needed!
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Source Chain */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
            <div className="flex gap-2">
              {CHAINS.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setSourceChain(chain.id)}
                  disabled={isLoading}
                  className={`flex-1 p-3 rounded-lg border-2 transition-colors disabled:opacity-50 ${
                    sourceChain === chain.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{chain.icon}</div>
                  <div className="text-xs font-medium">{chain.name.split(' ')[0]}</div>
                </button>
              ))}
            </div>
          </div>
          
          {/* Amount Input */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-600">Amount</label>
              <button
                onClick={setMaxAmount}
                disabled={isLoading}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium disabled:opacity-50"
              >
                MAX
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                disabled={isLoading}
                className="flex-1 bg-transparent text-2xl font-semibold outline-none disabled:opacity-50"
              />
              <span className="text-xl font-semibold text-gray-700">USDC</span>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Available: {balances[sourceChain]} USDC
            </div>
          </div>
          
          {/* Switch Button */}
          <div className="flex justify-center -my-2 relative z-10 mb-4">
            <button
              onClick={switchChains}
              disabled={isLoading}
              className="p-2 bg-white border-4 border-white rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <ArrowRight size={20} className="text-gray-600 transform rotate-90" />
            </button>
          </div>
          
          {/* Destination Chain */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
            <div className="flex gap-2">
              {CHAINS.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setDestChain(chain.id)}
                  disabled={isLoading}
                  className={`flex-1 p-3 rounded-lg border-2 transition-colors disabled:opacity-50 ${
                    destChain === chain.id
                      ? chain.cctpSupported 
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-yellow-500 bg-yellow-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${!chain.cctpSupported ? 'opacity-60' : ''}`}
                >
                  <div className="text-2xl mb-1">{chain.icon}</div>
                  <div className="text-xs font-medium">{chain.name.split(' ')[0]}</div>
                  {!chain.cctpSupported && (
                    <div className="text-[10px] text-yellow-600 mt-1">Coming Soon</div>
                  )}
                </button>
              ))}
            </div>
            {destChain === 'ARC-TESTNET' && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="text-yellow-600 mt-0.5" size={16} />
                  <div className="text-xs text-yellow-800">
                    <strong>Arc Network:</strong> CCTP bridging to Arc is not yet supported. 
                    Currently supported routes: Sepolia ↔ Polygon Amoy
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Transfer Info */}
          <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Estimated time:</span>
              <span className="font-medium text-gray-900">{getEstimatedTime()}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Bridge protocol:</span>
              <span className="font-medium text-gray-900">
                {destChain === 'ARC-TESTNET' || sourceChain === 'ARC-TESTNET' ? 'Circle Gateway' : 'Circle CCTP'}
              </span>
            </div>
            {destChain === 'ARC-TESTNET' && (
              <div className="mt-2 pt-2 border-t border-blue-200">
                <div className="text-xs text-blue-700">
                  <strong>Gateway:</strong> Unified balance model with instant minting (&lt;500ms)
                </div>
              </div>
            )}
            {bridgeMethod && (
              <div className="flex justify-between">
                <span className="text-gray-600">Method:</span>
                <span className="font-medium text-gray-900">
                  {bridgeMethod === 'bridge-kit' ? 'Bridge Kit SDK' : 'Manual CCTP'}
                </span>
              </div>
            )}
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700 whitespace-pre-line flex-1">{error}</div>
            </div>
          )}
          
          {/* Status Display */}
          {status !== 'idle' && status !== 'error' && (
            <div className="mb-4 space-y-2">
              {/* Burning */}
              <div className={`flex items-center gap-3 p-3 rounded-lg ${
                status === 'burning' ? 'bg-blue-50 border border-blue-200' : 
                ['attesting', 'minting', 'completed'].includes(status) ? 'bg-gray-50' : 'bg-gray-50 opacity-50'
              }`}>
                {status === 'burning' ? (
                  <Loader2 size={20} className="text-blue-600 animate-spin" />
                ) : ['attesting', 'minting', 'completed'].includes(status) ? (
                  <CheckCircle2 size={20} className="text-green-600" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-300" />
                )}
                <span className="text-sm font-medium">Burning USDC on source chain</span>
              </div>
              
              {/* Attesting */}
              <div className={`flex items-center gap-3 p-3 rounded-lg ${
                status === 'attesting' ? 'bg-blue-50 border border-blue-200' : 
                ['minting', 'completed'].includes(status) ? 'bg-gray-50' : 'bg-gray-50 opacity-50'
              }`}>
                {status === 'attesting' ? (
                  <Loader2 size={20} className="text-blue-600 animate-spin" />
                ) : ['minting', 'completed'].includes(status) ? (
                  <CheckCircle2 size={20} className="text-green-600" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-300" />
                )}
                <span className="text-sm font-medium">Waiting for Circle attestation</span>
              </div>
              
              {/* Minting */}
              <div className={`flex items-center gap-3 p-3 rounded-lg ${
                status === 'minting' ? 'bg-blue-50 border border-blue-200' : 
                status === 'completed' ? 'bg-gray-50' : 'bg-gray-50 opacity-50'
              }`}>
                {status === 'minting' ? (
                  <Loader2 size={20} className="text-blue-600 animate-spin" />
                ) : status === 'completed' ? (
                  <CheckCircle2 size={20} className="text-green-600" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-300" />
                )}
                <span className="text-sm font-medium">Minting USDC on destination chain</span>
              </div>
            </div>
          )}
          
          {/* Success Message */}
          {status === 'completed' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 size={20} className="text-green-600" />
                <span className="font-medium text-green-900">Transfer Completed!</span>
              </div>
              <p className="text-sm text-green-700 mb-3">
                Your USDC has been burned on {sourceChain.split('-')[0]}. The attestation process will complete in ~15 minutes, then USDC will be minted on {destChain.split('-')[0]}.
              </p>
              {explorerUrls.burn && (
                <a
                  href={explorerUrls.burn}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-green-700 hover:text-green-800 font-medium bg-white px-3 py-2 rounded-lg border border-green-200 hover:border-green-300 transition-colors"
                >
                  View Transaction on Explorer →
                </a>
              )}
              {explorerUrls.mint && (
                <a
                  href={explorerUrls.mint}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-700 hover:text-green-800 block mt-2"
                >
                  View mint transaction →
                </a>
              )}
            </div>
          )}
          
          {/* Transfer Button */}
          <button
            onClick={handleTransfer}
            disabled={!amount || isLoading || parseFloat(amount) <= 0 || status === 'completed'}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Transferring...
              </>
            ) : status === 'completed' ? (
              'Transfer Completed!'
            ) : (
              'Transfer'
            )}
          </button>
          
          {/* Info */}
          <div className="mt-4 text-xs text-gray-500 text-center">
            Powered by Circle CCTP (Cross-Chain Transfer Protocol)
          </div>
        </div>
        </div>
        {/* End Scrollable Content */}
      </div>
    </div>
  );
}
