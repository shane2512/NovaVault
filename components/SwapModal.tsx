'use client';

import { useState, useEffect } from 'react';
import { X, ArrowDown, Settings, AlertCircle, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useWalletStore } from '@/lib/wallet-store';

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Supported tokens for Phase 2
const TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
  { symbol: 'USDT', name: 'Tether USD', address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', decimals: 6 },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357', decimals: 18 },
];

export function SwapModal({ isOpen, onClose, onSuccess }: SwapModalProps) {
  const { selectedWallet } = useWalletStore();
  const [tokenIn, setTokenIn] = useState(TOKENS[0]); // Default to ETH
  const [tokenOut, setTokenOut] = useState(TOKENS[1]); // Default to USDC
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [showSettings, setShowSettings] = useState(false);
  const [customSlippage, setCustomSlippage] = useState('');
  
  // Swap flow state
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0); // 0=input, 1=bridging, 2=swapping, 3=returning
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [priceImpact, setPriceImpact] = useState(0);
  
  // Quote state
  const [isGettingQuote, setIsGettingQuote] = useState(false);
  
  // Transaction hashes
  const [txHashes, setTxHashes] = useState<{
    bridgeTxHash?: string;
    swapTxHash?: string;
    returnTxHash?: string;
  }>({});
  
  // Get quote when amount changes
  useEffect(() => {
    if (amountIn && parseFloat(amountIn) > 0) {
      fetchQuote();
    } else {
      setAmountOut('');
    }
  }, [amountIn, tokenIn, tokenOut]);
  
  const fetchQuote = async () => {
    setIsGettingQuote(true);
    try {
      // Call API route instead of direct service function
      const response = await fetch('/api/swap/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amountIn,
          currentNetwork: selectedWallet?.blockchain || 'ETH-SEPOLIA'
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get quote');
      }
      
      setAmountOut(data.amountOut);
      setPriceImpact(data.priceImpact);
    } catch (err) {
      console.error('Failed to get quote:', err);
    } finally {
      setIsGettingQuote(false);
    }
  };
  
  const handleSwap = async () => {
    if (!selectedWallet) {
      setError('No wallet selected');
      return;
    }

    setError('');
    setIsLoading(true);
    setStep(1);
    
    try {
      console.log('Executing swap for wallet:', selectedWallet.id);
      console.log('Network:', selectedWallet.blockchain);
      
      // Execute swap via server (sends output to Circle wallet)
      const response = await fetch('/api/swap/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amountIn,
          slippage,
          walletAddress: selectedWallet.address
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Swap failed');
      }
      
      setStep(3); // Completed
      console.log('Swap completed:', result);
      
      // Store transaction hash for block explorer link
      setTxHashes({
        swapTxHash: result.swapTxHash
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
      // Auto-close after success
      setTimeout(() => {
        onClose();
        resetModal();
      }, 3000);
      
    } catch (err: any) {
      console.error('Swap error:', err);
      setError(err.message || 'Swap failed');
      setStep(0);
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetModal = () => {
    setAmountIn('');
    setAmountOut('');
    setStep(0);
    setError('');
    setPriceImpact(0);
    setTxHashes({});
  };
  
  const getExplorerUrl = (txHash: string, network: 'sepolia' | 'unichain') => {
    if (network === 'sepolia') {
      return `https://sepolia.etherscan.io/tx/${txHash}`;
    } else {
      return `https://unichain-sepolia.blockscout.com/tx/${txHash}`;
    }
  };
  
  const switchTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn(amountOut);
    setAmountOut('');
  };
  
  const setSlippagePreset = (value: number) => {
    setSlippage(value);
    setCustomSlippage('');
  };
  
  const setCustomSlippageValue = (value: string) => {
    setCustomSlippage(value);
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0 && num <= 50) {
      setSlippage(num);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-bold">Swap Tokens</h2>
            {selectedWallet && (
              <p className="text-xs text-gray-500 mt-0.5">
                on {selectedWallet.blockchain}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Settings size={20} />
            </button>
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
        </div>
        
        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 bg-gray-50 border-b">
            <div className="mb-2">
              <label className="text-sm font-medium text-gray-700">Slippage Tolerance</label>
              <div className="flex gap-2 mt-2">
                {[0.1, 0.5, 1.0].map((value) => (
                  <button
                    key={value}
                    onClick={() => setSlippagePreset(value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      slippage === value && !customSlippage
                        ? 'bg-orange-500 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:border-orange-500'
                    }`}
                  >
                    {value}%
                  </button>
                ))}
                <input
                  type="text"
                  placeholder="Custom"
                  value={customSlippage}
                  onChange={(e) => setCustomSlippageValue(e.target.value)}
                  className="px-3 py-2 rounded-lg text-sm border border-gray-300 focus:border-orange-500 focus:outline-none w-24"
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Swap Interface */}
        <div className="p-4">
          {/* Token In */}
          <div className="bg-gray-50 rounded-xl p-4 mb-2">
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-600">You pay</label>
              <span className="text-sm text-gray-600">Balance: --</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                placeholder="0.0"
                disabled={isLoading}
                className="flex-1 bg-transparent text-2xl font-semibold outline-none disabled:opacity-50"
              />
              <select
                value={tokenIn.symbol}
                onChange={(e) => setTokenIn(TOKENS.find(t => t.symbol === e.target.value)!)}
                disabled={isLoading}
                className="px-3 py-2 bg-white rounded-lg border border-gray-300 font-medium disabled:opacity-50"
              >
                {TOKENS.map((token) => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Switch Button */}
          <div className="flex justify-center -my-3 relative z-10">
            <button
              onClick={switchTokens}
              disabled={isLoading}
              className="p-2 bg-white border-4 border-white rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <ArrowDown size={20} className="text-gray-600" />
            </button>
          </div>
          
          {/* Token Out */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <div className="flex justify-between mb-2">
              <label className="text-sm text-gray-600">You receive</label>
              {isGettingQuote && (
                <span className="text-sm text-gray-600">Getting quote...</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={amountOut}
                readOnly
                placeholder="0.0"
                className="flex-1 bg-transparent text-2xl font-semibold outline-none"
              />
              <select
                value={tokenOut.symbol}
                onChange={(e) => setTokenOut(TOKENS.find(t => t.symbol === e.target.value)!)}
                disabled={isLoading}
                className="px-3 py-2 bg-white rounded-lg border border-gray-300 font-medium disabled:opacity-50"
              >
                {TOKENS.map((token) => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Price Impact Warning */}
          {priceImpact > 2 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
              <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-yellow-800">High Price Impact</div>
                <div className="text-yellow-700">
                  This swap will have a {priceImpact.toFixed(2)}% price impact
                </div>
              </div>
            </div>
          )}
          
          {/* Swap Info */}
          {priceImpact > 0 && (
            <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg mb-4">
              <AlertCircle size={20} className="text-gray-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-700">
                <div className="font-medium text-gray-800">Swap Details</div>
                <div className="mt-1">
                  Executing on {selectedWallet?.blockchain || 'your network'} • Price impact: {priceImpact.toFixed(2)}%
                </div>
              </div>
            </div>
          )}
          
          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}
          
          {/* Progress Steps */}
          {step > 0 && (
            <div className="mb-4 space-y-2">
              {/* Show simplified steps for local ETH swaps */}
              {(tokenIn.symbol === 'ETH' || tokenOut.symbol === 'ETH') ? (
                <>
                  <div className={`flex items-center gap-3 p-3 rounded-lg ${
                    step === 1 || step === 2 ? 'bg-blue-50 border border-blue-200' : 'bg-green-50 border border-green-200'
                  }`}>
                    {step < 3 ? (
                      <Loader2 size={20} className="text-blue-600 animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</div>
                    )}
                    <span className="text-sm font-medium">
                      Executing swap on {selectedWallet?.blockchain || 'current network'}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  {/* Full 3-step process for cross-chain swaps */}
                  <div className={`flex items-center gap-3 p-3 rounded-lg ${
                    step === 1 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                  }`}>
                    {step === 1 ? (
                      <Loader2 size={20} className="text-blue-600 animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</div>
                    )}
                    <span className="text-sm font-medium">
                      Step 1: Bridging from {selectedWallet?.blockchain || 'current network'} to Unichain
                    </span>
                  </div>
                  
                  <div className={`flex items-center gap-3 p-3 rounded-lg ${
                    step === 2 ? 'bg-blue-50 border border-blue-200' : step > 2 ? 'bg-gray-50' : 'bg-gray-50 opacity-50'
                  }`}>
                    {step === 2 ? (
                      <Loader2 size={20} className="text-blue-600 animate-spin" />
                    ) : step > 2 ? (
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-300" />
                    )}
                    <span className="text-sm font-medium">Step 2: Executing swap</span>
                  </div>
                  
                  <div className={`flex items-center gap-3 p-3 rounded-lg ${
                    step === 3 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 opacity-50'
                  }`}>
                    {step === 3 ? (
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-300" />
                    )}
                    <span className="text-sm font-medium">
                      Step 3: Bridging back to {selectedWallet?.blockchain || 'current network'}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Swap Button */}
          <button
            onClick={handleSwap}
            disabled={!amountIn || !amountOut || isLoading || parseFloat(amountIn) <= 0}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Swapping...
              </>
            ) : step === 3 ? (
              <>
                <CheckCircle2 size={20} />
                Completed
              </>
            ) : (
              'Swap'
            )}
          </button>
          
          {/* Transaction Links */}
          {step === 3 && txHashes.swapTxHash && (
            <div className="mt-4 p-3 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-green-800 font-semibold text-sm">
                <CheckCircle2 size={16} />
                View Transaction on Block Explorer
              </div>
              
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-gray-700">Swap Transaction</span>
                <a 
                  href={getExplorerUrl(txHashes.swapTxHash, 'sepolia')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1 font-medium"
                >
                  View on Explorer <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
          
          {/* Info */}
          <div className="mt-4 text-xs text-gray-500 text-center">
            Powered by Uniswap V3 on {selectedWallet?.blockchain || 'your network'}
          </div>
        </div>
      </div>
    </div>
  );
}
