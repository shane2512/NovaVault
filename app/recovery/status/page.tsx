/**
 * Recovery Status Tracking Page
 * Real-time monitoring of recovery progress
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Shield, CheckCircle2, Clock, AlertCircle, ArrowRight, Users, Loader, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface RecoveryStatus {
  id: string;
  oldENSName: string;
  oldWalletAddress: string;
  newWalletAddress: string;
  guardians: string[];
  threshold: number;
  approvals: string[];
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed';
  createdAt: number;
  executionStartedAt?: number;
  completedAt?: number;
  failedAt?: number;
  executionPhase?: string;
  settlementTxId?: string;
  ensTransferTxHash?: string;
  rotationTxHash?: string;
  policyId?: string;
  error?: string;
}

function RecoveryStatusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const recoveryId = searchParams.get('id');
  
  const [status, setStatus] = useState<RecoveryStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [pollingEnabled, setPollingEnabled] = useState(true);
  
  // Fetch recovery status
  const fetchStatus = async () => {
    if (!recoveryId) return;
    
    try {
      const response = await fetch(
        `/api/recovery/status?recoveryId=${encodeURIComponent(recoveryId)}`
      );
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch status');
      }
      
      setStatus(result.recovery);
      setError('');
      
      // Stop polling if recovery is completed or failed
      if (result.recovery?.status === 'completed' || result.recovery?.status === 'failed') {
        setPollingEnabled(false);
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to load recovery status');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [recoveryId]);
  
  // Auto-refresh every 3 seconds
  useEffect(() => {
    if (!pollingEnabled) return;
    
    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [recoveryId, pollingEnabled]);
  
  if (!recoveryId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
            <h2 className="text-2xl font-bold mb-2">Invalid Recovery ID</h2>
            <p className="text-gray-600 mb-6">
              Please provide a valid recovery ID in the URL.
            </p>
            <Link
              href="/recovery/initiate"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Initiate New Recovery
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  if (isLoading && !status) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <Loader className="mx-auto text-blue-600 animate-spin mb-4" size={48} />
            <h2 className="text-xl font-medium text-gray-900">
              Loading Recovery Status...
            </h2>
          </div>
        </div>
      </div>
    );
  }
  
  if (error && !status) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-6">
              <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
              <h2 className="text-2xl font-bold mb-2">Error</h2>
              <p className="text-red-600">{error}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchStatus}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
              <Link
                href="/recovery/initiate"
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition-colors text-center"
              >
                Start New Recovery
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!status) return null;
  
  const progressPercentage = (status.approvals.length / status.threshold) * 100;
  const isApproved = status.status === 'approved' || status.approvals.length >= status.threshold;
  const isExecuting = status.status === 'executing';
  const isCompleted = status.status === 'completed';
  const isFailed = status.status === 'failed';
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'executing':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="text-4xl font-bold mb-2">Recovery Status</h1>
          <p className="text-gray-600">
            Real-time tracking of your wallet recovery
          </p>
        </div>
        
        {/* Auto-refresh indicator */}
        {pollingEnabled && (
          <div className="mb-6 flex items-center justify-center gap-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            Auto-refreshing every 3 seconds
          </div>
        )}
        
        {/* Main Status Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">{status.oldENSName}</h2>
              <p className="text-sm text-gray-500">Recovery ID: {status.id}</p>
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(status.status)}`}>
              {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
            </div>
          </div>
          
          {/* Progress Timeline */}
          <div className="relative mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className={`flex items-center gap-2 ${status.status !== 'pending' ? 'text-green-600' : 'text-blue-600'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${status.status !== 'pending' ? 'bg-green-600' : 'bg-blue-600'}`}>
                  {status.status !== 'pending' ? (
                    <CheckCircle2 className="text-white" size={20} />
                  ) : (
                    <div className="w-4 h-4 bg-white rounded-full"></div>
                  )}
                </div>
                <span className="font-medium">Initiated</span>
              </div>
              
              <div className={`flex items-center gap-2 ${isApproved ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isApproved ? 'bg-green-600' : 'bg-gray-200'}`}>
                  {isApproved ? (
                    <CheckCircle2 className="text-white" size={20} />
                  ) : (
                    <Clock className="text-gray-500" size={16} />
                  )}
                </div>
                <span className="font-medium">Approved</span>
              </div>
              
              <div className={`flex items-center gap-2 ${isExecuting || isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isExecuting || isCompleted ? 'bg-green-600' : 'bg-gray-200'}`}>
                  {isExecuting || isCompleted ? (
                    isCompleted ? (
                      <CheckCircle2 className="text-white" size={20} />
                    ) : (
                      <Loader className="text-white animate-spin" size={16} />
                    )
                  ) : (
                    <Clock className="text-gray-500" size={16} />
                  )}
                </div>
                <span className="font-medium">Executing</span>
              </div>
              
              <div className={`flex items-center gap-2 ${isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? 'bg-green-600' : 'bg-gray-200'}`}>
                  {isCompleted ? (
                    <CheckCircle2 className="text-white" size={20} />
                  ) : (
                    <Clock className="text-gray-500" size={16} />
                  )}
                </div>
                <span className="font-medium">Completed</span>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                style={{
                  width: isCompleted ? '100%' : isExecuting ? '75%' : isApproved ? '50%' : '25%'
                }}
              ></div>
            </div>
          </div>
          
          {/* Wallet Addresses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Old Wallet</div>
              <div className="font-mono text-sm break-all">{status.oldWalletAddress}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">New Wallet</div>
              <div className="font-mono text-sm break-all">{status.newWalletAddress}</div>
            </div>
          </div>
          
          {/* Guardian Approvals */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="text-blue-600" size={20} />
                <span className="font-semibold">Guardian Approvals</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {status.approvals.length} / {status.threshold}
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="relative w-full h-3 bg-white rounded-full overflow-hidden mb-4">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            
            {/* Guardian List */}
            <div className="space-y-2">
              {status.guardians.map((guardian, index) => {
                const hasApproved = status.approvals
                  .map(a => a.toLowerCase())
                  .includes(guardian.toLowerCase());
                
                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      hasApproved ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {hasApproved ? (
                        <CheckCircle2 className="text-green-600 flex-shrink-0" size={20} />
                      ) : (
                        <Clock className="text-gray-400 flex-shrink-0" size={20} />
                      )}
                      <div>
                        <div className="text-xs text-gray-500">Guardian {index + 1}</div>
                        <div className="font-mono text-sm">{guardian.substring(0, 16)}...</div>
                      </div>
                    </div>
                    <span className={`text-sm font-medium ${hasApproved ? 'text-green-600' : 'text-gray-400'}`}>
                      {hasApproved ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Status Messages */}
        {status.status === 'pending' && !isApproved && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Clock className="text-yellow-600 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-1">Waiting for Guardian Approvals</h3>
                <p className="text-sm text-yellow-800">
                  Need {status.threshold - status.approvals.length} more approval(s) to proceed with recovery.
                  Share this page with your guardians or direct them to the Guardian Dashboard.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {isApproved && !isExecuting && !isCompleted && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-blue-600 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Threshold Met!</h3>
                <p className="text-sm text-blue-800">
                  Required approvals received. Recovery can now be executed.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {isExecuting && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Loader className="text-purple-600 flex-shrink-0 animate-spin" size={20} />
              <div>
                <h3 className="font-semibold text-purple-900 mb-1">Recovery in Progress</h3>
                <p className="text-sm text-purple-800 mb-3">
                  Executing recovery process with automated settlement...
                </p>
                
                {/* Execution Phase Details */}
                {status.executionPhase && (
                  <div className="bg-white bg-opacity-50 rounded-lg p-3 mb-3">
                    <div className="text-xs font-medium text-purple-900 mb-2">Current Phase:</div>
                    <div className="text-sm font-mono text-purple-800">
                      {status.executionPhase.replace('_', ' ').toLowerCase()}
                    </div>
                  </div>
                )}
                
                <div className="space-y-1 text-xs text-purple-700">
                  <div className={status.executionPhase === 'POLICY_CREATED' || 
                                status.executionPhase === 'GATEWAY_APPROVED' || 
                                status.executionPhase === 'SETTLEMENT_COMPLETED' || 
                                status.executionPhase === 'ENS_TRANSFERRED' ||
                                status.executionPhase === 'COMPLETED' ? 
                                '✅ text-green-700' : '• text-purple-600'}>
                    Creating recovery policy
                  </div>
                  <div className={status.executionPhase === 'GATEWAY_APPROVED' || 
                                status.executionPhase === 'SETTLEMENT_COMPLETED' || 
                                status.executionPhase === 'ENS_TRANSFERRED' ||
                                status.executionPhase === 'COMPLETED' ? 
                                '✅ text-green-700' : '• text-purple-600'}>
                    Processing gateway approvals
                  </div>
                  <div className={status.executionPhase === 'SETTLEMENT_COMPLETED' || 
                                status.executionPhase === 'ENS_TRANSFERRED' ||
                                status.executionPhase === 'COMPLETED' ? 
                                '✅ text-green-700' : '• text-purple-600'}>
                    Executing USDC settlement
                  </div>
                  <div className={status.executionPhase === 'ENS_TRANSFERRED' ||
                                status.executionPhase === 'COMPLETED' ? 
                                '✅ text-green-700' : '• text-purple-600'}>
                    Transferring ENS ownership
                  </div>
                  <div className={status.executionPhase === 'COMPLETED' ? 
                                '✅ text-green-700' : '• text-purple-600'}>
                    Rotating wallet ownership
                  </div>
                </div>
                
                {/* Transaction Details */}
                {(status.settlementTxId || status.ensTransferTxHash || status.rotationTxHash) && (
                  <div className="mt-3 space-y-1 text-xs">
                    {status.settlementTxId && (
                      <div className="text-purple-700">
                        Settlement TX: <span className="font-mono">{status.settlementTxId}</span>
                      </div>
                    )}
                    {status.ensTransferTxHash && (
                      <div className="text-purple-700">
                        ENS Transfer TX: <span className="font-mono">{status.ensTransferTxHash.slice(0, 20)}...</span>
                      </div>
                    )}
                    {status.rotationTxHash && (
                      <div className="text-purple-700">
                        Rotation TX: <span className="font-mono">{status.rotationTxHash.slice(0, 20)}...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {isCompleted && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-green-600 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-green-900 mb-1">Recovery Completed!</h3>
                <p className="text-sm text-green-800 mb-3">
                  Complete recovery successful! ENS name ownership and all USDC funds have been transferred to the new wallet.
                </p>
                
                {/* Transaction Details */}
                {(status.settlementTxId || status.ensTransferTxHash || status.rotationTxHash) && (
                  <div className="bg-white bg-opacity-50 rounded-lg p-3 mb-3">
                    <div className="text-xs font-medium text-green-900 mb-2">Transaction Details:</div>
                    <div className="space-y-1 text-xs text-green-800">
                      {status.settlementTxId && (
                        <div>
                          <span className="font-medium">USDC Settlement:</span> 
                          <span className="font-mono ml-1">{status.settlementTxId}</span>
                        </div>
                      )}
                      {status.ensTransferTxHash && (
                        <div>
                          <span className="font-medium">ENS Transfer:</span> 
                          <span className="font-mono ml-1">{status.ensTransferTxHash.slice(0, 20)}...</span>
                        </div>
                      )}
                      {status.rotationTxHash && (
                        <div>
                          <span className="font-medium">Wallet Ownership:</span> 
                          <span className="font-mono ml-1">{status.rotationTxHash.slice(0, 20)}...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {status.completedAt && (
                  <p className="text-xs text-green-700">
                    Completed at: {new Date(status.completedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {isFailed && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Recovery Failed</h3>
                <p className="text-sm text-red-800">
                  {status.error || 'An error occurred during recovery. Please contact support.'}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Timestamps */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h3 className="font-semibold mb-4">Timeline</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Created</span>
              <span className="font-mono">{new Date(status.createdAt).toLocaleString()}</span>
            </div>
            {status.executionStartedAt && (
              <div className="flex justify-between">
                <span className="text-gray-600">Execution Started</span>
                <span className="font-mono">{new Date(status.executionStartedAt).toLocaleString()}</span>
              </div>
            )}
            {status.completedAt && (
              <div className="flex justify-between">
                <span className="text-gray-600">Completed</span>
                <span className="font-mono">{new Date(status.completedAt).toLocaleString()}</span>
              </div>
            )}
            {status.failedAt && (
              <div className="flex justify-between">
                <span className="text-red-600">Failed</span>
                <span className="font-mono">{new Date(status.failedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
          
          {/* Execution Details */}
          {(status.settlementTxId || status.ensTransferTxHash || status.rotationTxHash || status.policyId) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="font-medium text-sm mb-2 text-gray-700">Execution Details</h4>
              <div className="space-y-1 text-xs text-gray-600">
                {status.policyId && (
                  <div className="flex justify-between">
                    <span>Policy ID</span>
                    <span className="font-mono">{status.policyId}</span>
                  </div>
                )}
                {status.settlementTxId && (
                  <div className="flex justify-between">
                    <span>USDC Settlement TX</span>
                    <span className="font-mono">{status.settlementTxId}</span>
                  </div>
                )}
                {status.ensTransferTxHash && (
                  <div className="flex justify-between">
                    <span>ENS Transfer TX</span>
                    <span className="font-mono">{status.ensTransferTxHash.slice(0, 24)}...</span>
                  </div>
                )}
                {status.rotationTxHash && (
                  <div className="flex justify-between">
                    <span>Wallet Ownership TX</span>
                    <span className="font-mono">{status.rotationTxHash.slice(0, 24)}...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/recovery/initiate"
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition-colors text-center"
          >
            Start New Recovery
          </Link>
          <Link
            href="/recovery/guardian-dashboard"
            className="flex-1 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors text-center flex items-center justify-center gap-2"
          >
            <Shield size={20} />
            Guardian Dashboard
          </Link>
          <Link
            href="/dashboard"
            className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-center"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RecoveryStatusPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <Loader className="mx-auto text-blue-600 animate-spin mb-4" size={48} />
            <h2 className="text-xl font-medium text-gray-900">
              Loading...
            </h2>
          </div>
        </div>
      </div>
    }>
      <RecoveryStatusContent />
    </Suspense>
  );
}
