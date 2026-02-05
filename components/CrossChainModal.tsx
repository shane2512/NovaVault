'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

// Type definition for supported chains
export type SupportedChain = 'ETH-SEPOLIA' | 'MATIC-AMOY' | 'ARC-TESTNET' | 'UNICHAIN-SEPOLIA';

interface CrossChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CHAINS = [
  { id: 'ETH-SEPOLIA' as SupportedChain, name: 'Ethereum Sepolia', icon: '⟠' },
  { id: 'MATIC-AMOY' as SupportedChain, name: 'Polygon Amoy', icon: '⬣' },
  { id: 'ARC-TESTNET' as SupportedChain, name: 'Arc Testnet', icon: '◈' },
];

export function CrossChainModal({ isOpen, onClose, onSuccess }: CrossChainModalProps) {
  const [sourceChain, setSourceChain] = useState<SupportedChain>('ETH-SEPOLIA');
  const [destChain, setDestChain] = useState<SupportedChain>('ARC-TESTNET');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'burning' | 'attesting' | 'minting' | 'completed' | 'error'>('idle');
  const [error, setError] = useState('');
  const [txHashes, setTxHashes] = useState<{ burn?: string; mint?: string }>({});
  const [bridgeMethod, setBridgeMethod] = useState<'bridge-kit' | 'manual-cctp' | null>(null);
  
  // Balance state
  const [balances, setBalances] = useState<Record<SupportedChain, string>>({
    'ETH-SEPOLIA': '0',
    'MATIC-AMOY': '0',
    'ARC-TESTNET': '0',
  });
  const [totalBalance, setTotalBalance] = useState('0');
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  
  const walletAddress = process.env.NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS || '0x5f90f52ffdc875a8d93021c76d2e612a6459df63';
  
  // Load balances on mount
  useEffect(() => {
    if (isOpen) {
      loadBalances();
    }
  }, [isOpen]);
  
  const loadBalances = async () => {
    setIsLoadingBalances(true);
    try {
      // Call API route instead of direct service function
      const response = await fetch(`/api/cctp/balance?address=${walletAddress}`);
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
    
    setError('');
    setIsLoading(true);
    setStatus('burning');
    
    try {
      console.log('Starting transfer:', { sourceChain, destChain, amount });
      
      // Call API route instead of direct service function
      const response = await fetch('/api/cctp/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceChain,
          destinationChain: destChain,
          amount,
          recipient: walletAddress
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Bridge failed');
      }
      
      // Store which method was used
      setBridgeMethod(result.method || 'bridge-kit');
      
      setTxHashes({
        burn: result.burnTxHash,
        mint: result.mintTxHash
      });
      
      setStatus('completed');
      
      // Reload balances
      setTimeout(() => {
        loadBalances();
      }, 2000);
      
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
      setError(err.message || 'Transfer failed');
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
    if (sourceChain === 'ARC-TESTNET' || destChain === 'ARC-TESTNET') {
      return '~2-3 minutes';
    }
    return '~1-2 minutes';
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
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
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
          
          {/* Transfer Info */}
          <div className="bg-blue-50 rounded-lg p-3 mb-4 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Estimated time:</span>
              <span className="font-medium text-gray-900">{getEstimatedTime()}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Bridge protocol:</span>
              <span className="font-medium text-gray-900">Circle CCTP</span>
            </div>
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
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{error}</div>
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
              {txHashes.burn && (
                <a
                  href={getExplorerLink(sourceChain, txHashes.burn)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-700 hover:text-green-800 block mb-1"
                >
                  View burn transaction →
                </a>
              )}
              {txHashes.mint && (
                <a
                  href={getExplorerLink(destChain, txHashes.mint)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-700 hover:text-green-800 block"
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
    </div>
  );
}
