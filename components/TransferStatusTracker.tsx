/**
 * Transfer Status Tracker Component
 * 
 * Real-time tracker for monitoring CCTP cross-chain transfer status.
 * Shows progress stages: Pending → In Transit → Attesting → Confirmed
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, Clock, ArrowRight, ExternalLink } from 'lucide-react';

export interface TransferStatus {
  status: 'PENDING' | 'IN_TRANSIT' | 'ATTESTING' | 'CONFIRMED' | 'FAILED';
  sourceChain: string;
  destinationChain: string;
  amount: string;
  sourceTxHash?: string;
  destinationTxHash?: string;
  attestation?: string;
  estimatedCompletion?: string;
}

interface TransferStatusTrackerProps {
  trackingId: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  onStatusChange?: (status: TransferStatus) => void;
}

const STATUS_STEPS = [
  {
    key: 'PENDING',
    label: 'Pending',
    description: 'Transaction submitted to source chain',
    icon: Clock,
  },
  {
    key: 'IN_TRANSIT',
    label: 'In Transit',
    description: 'Tokens burned on source chain',
    icon: Loader2,
  },
  {
    key: 'ATTESTING',
    label: 'Attesting',
    description: 'Circle attestation in progress',
    icon: Loader2,
  },
  {
    key: 'CONFIRMED',
    label: 'Confirmed',
    description: 'Tokens minted on destination chain',
    icon: CheckCircle,
  },
];

export function TransferStatusTracker({
  trackingId,
  autoRefresh = true,
  refreshInterval = 10000, // 10 seconds
  onStatusChange,
}: TransferStatusTrackerProps) {
  const [status, setStatus] = useState<TransferStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch transfer status
  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/cross-chain-status?trackingId=${trackingId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch status');
      }

      const newStatus = data.data;
      setStatus(newStatus);
      setError(null);
      onStatusChange?.(newStatus);
    } catch (err) {
      console.error('Failed to fetch transfer status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [trackingId]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !status || status.status === 'CONFIRMED' || status.status === 'FAILED') {
      return;
    }

    const interval = setInterval(fetchStatus, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, status]);

  // Get current step index
  const getCurrentStepIndex = (): number => {
    if (!status) return -1;
    return STATUS_STEPS.findIndex((step) => step.key === status.status);
  };

  // Format amount
  const formatAmount = (amount: string): string => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  // Format transaction hash
  const formatTxHash = (hash: string): string => {
    if (!hash) return '';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
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
        <div className="flex items-start gap-3">
          <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-900 font-medium">Error loading transfer</p>
            <p className="text-red-700 text-sm mt-1">{error}</p>
            <button
              onClick={fetchStatus}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <p className="text-gray-600">Transfer not found</p>
      </div>
    );
  }

  const currentStepIndex = getCurrentStepIndex();
  const isFailed = status.status === 'FAILED';
  const isComplete = status.status === 'CONFIRMED';

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-4 ${
        isFailed ? 'bg-red-50 border-b border-red-200' :
        isComplete ? 'bg-green-50 border-b border-green-200' :
        'bg-blue-50 border-b border-blue-200'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Cross-Chain Transfer</h3>
            <p className="text-sm text-gray-600 mt-0.5">
              {status.sourceChain} → {status.destinationChain}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              {formatAmount(status.amount)} <span className="text-base font-normal">USDC</span>
            </p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="px-6 py-6">
        <div className="relative">
          {/* Progress Line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
          <div
            className={`absolute left-4 top-0 w-0.5 transition-all duration-500 ${
              isFailed ? 'bg-red-500' : 'bg-blue-500'
            }`}
            style={{
              height: isComplete ? '100%' : `${(currentStepIndex / (STATUS_STEPS.length - 1)) * 100}%`,
            }}
          ></div>

          {/* Steps */}
          <div className="space-y-6 relative">
            {STATUS_STEPS.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex || isComplete;
              const Icon = step.icon;

              return (
                <div key={step.key} className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 transition-colors ${
                      isFailed && isActive
                        ? 'bg-red-500'
                        : isCompleted
                        ? 'bg-blue-500'
                        : isActive
                        ? 'bg-blue-500'
                        : 'bg-gray-200'
                    }`}
                  >
                    {isActive && !isCompleted && !isFailed ? (
                      <Icon className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Icon className={`w-5 h-5 ${isCompleted || isActive ? 'text-white' : 'text-gray-400'}`} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-0.5">
                    <p className={`font-medium ${isActive || isCompleted ? 'text-gray-900' : 'text-gray-500'}`}>
                      {step.label}
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Transaction Details */}
      {(status.sourceTxHash || status.destinationTxHash) && (
        <div className="px-6 py-4 bg-gray-50 border-t space-y-3">
          {status.sourceTxHash && (
            <div>
              <p className="text-xs text-gray-600 mb-1">Source Transaction</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-gray-900">
                  {formatTxHash(status.sourceTxHash)}
                </code>
                <a
                  href={`#`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {status.destinationTxHash && (
            <div>
              <p className="text-xs text-gray-600 mb-1">Destination Transaction</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-gray-900">
                  {formatTxHash(status.destinationTxHash)}
                </code>
                <a
                  href={`#`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {status.estimatedCompletion && !isComplete && (
            <div>
              <p className="text-xs text-gray-600 mb-1">Estimated Completion</p>
              <p className="text-sm text-gray-900">{status.estimatedCompletion}</p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Tracking ID: {trackingId.slice(0, 8)}...</span>
          {autoRefresh && !isComplete && !isFailed && (
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Auto-refreshing
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default TransferStatusTracker;
