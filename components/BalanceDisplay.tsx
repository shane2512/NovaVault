'use client';

import { useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

interface BalanceDisplayProps {
  nativeBalance: string;
  usdcBalance: string;
  symbol: string;
  isLoading: boolean;
}

export function BalanceDisplay({ nativeBalance, usdcBalance, symbol, isLoading }: BalanceDisplayProps) {
  const [showBalance, setShowBalance] = useState(true);

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.0001) return '<0.0001';
    return num.toFixed(4);
  };

  return (
    <div className="bg-white p-8 text-center">
      <div className="flex items-center justify-center space-x-2 mb-2">
        <h2 className="text-gray-500 text-sm font-medium">Total Balance</h2>
        <button
          onClick={() => setShowBalance(!showBalance)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          {showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      </div>

      {isLoading ? (
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded w-48 mx-auto"></div>
        </div>
      ) : (
        <>
          {/* Primary Balance: USDC */}
          <div className="text-5xl font-bold text-gray-900 mb-2">
            {showBalance ? formatBalance(usdcBalance) : '••••••'}
            <span className="text-3xl ml-2 text-gray-600">USDC</span>
          </div>

          {/* Secondary Balance: ETH */}
          {parseFloat(nativeBalance) > 0 && (
            <div className="text-xl text-gray-500 font-medium">
              {showBalance ? formatBalance(nativeBalance) : '••••••'} {symbol}
            </div>
          )}
        </>
      )}
    </div>
  );
}
