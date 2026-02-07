'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react';
import axios from 'axios';

interface Transaction {
  id: string;
  state: string;
  amounts: string[];
  destinationAddress: string;
  sourceAddress?: string;
  txHash?: string;
  createDate: string;
}

interface TransactionListProps {
  walletId: string;
  walletAddress: string;
}

export function TransactionList({ walletId, walletAddress }: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, [walletId]);

  const fetchTransactions = async () => {
    try {
      const response = await axios.get(`/api/wallet/transactions?walletId=${walletId}`);
      setTransactions(response.data.transactions || []);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const shortenAddress = (addr: string | undefined) => {
    if (!addr) return 'Unknown';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getTransactionType = (tx: Transaction) => {
    if (tx.sourceAddress && tx.sourceAddress.toLowerCase() === walletAddress.toLowerCase()) {
      return 'sent';
    }
    return 'received';
  };

  const getStatusColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'complete':
        return 'text-green-600';
      case 'pending':
        return 'text-yellow-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-24"></div>
              </div>
              <div className="h-4 bg-gray-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-b-2xl">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>
      
      {transactions.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500">No transactions yet</p>
          <p className="text-sm text-gray-400 mt-1">Your activity will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => {
            const type = getTransactionType(tx);
            const isSent = type === 'sent';

            return (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isSent ? 'bg-red-100' : 'bg-green-100'
                  }`}>
                    {isSent ? (
                      <ArrowUpRight className="text-red-600" size={20} />
                    ) : (
                      <ArrowDownLeft className="text-green-600" size={20} />
                    )}
                  </div>
                  
                  <div>
                    <p className="font-medium text-gray-900">
                      {isSent ? 'Sent' : 'Received'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {isSent ? 'To' : 'From'} {shortenAddress(
                        isSent ? tx.destinationAddress : tx.sourceAddress
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`font-medium ${isSent ? 'text-red-600' : 'text-green-600'}`}>
                    {isSent ? '-' : '+'}{tx.amounts[0] || '0'}
                  </p>
                  <p className={`text-xs ${getStatusColor(tx.state)}`}>
                    {tx.state}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
