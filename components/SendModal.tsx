'use client';

import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletId: string;
  blockchain: string;
  currentBalance: string;
  symbol: string;
}

export function SendModal({ isOpen, onClose, walletId, blockchain, currentBalance, symbol }: SendModalProps) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    setError('');
    setIsLoading(true);

    try {
      if (!to || !amount) {
        throw new Error('Please fill in all fields');
      }

      if (parseFloat(amount) <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      if (parseFloat(amount) > parseFloat(currentBalance)) {
        throw new Error('Insufficient balance');
      }

      const response = await axios.post('/api/wallet/send', {
        walletId,
        to,
        amount,
        blockchain,
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setTo('');
        setAmount('');
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to send transaction');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Send USDC</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {success ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-gray-900">Transaction Sent!</h3>
              <p className="text-gray-600 mt-2">Your transaction is being processed</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    step="0.0001"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => setAmount(currentBalance)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 text-sm font-medium hover:text-blue-600"
                  >
                    MAX
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Available: {parseFloat(currentBalance).toFixed(4)} USDC
                </p>
              </div>

              {error && (
                <div className="flex items-start space-x-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                onClick={handleSend}
                disabled={isLoading || !to || !amount}
                className="w-full bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Sending...' : 'Send'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
