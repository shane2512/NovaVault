/**
 * Recovery Flow Page
 * Complete guardian-based recovery interface
 */

"use client";

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ethers } from 'ethers';
import { Shield, Users, Clock, CheckCircle, AlertCircle, Loader } from 'lucide-react';

type RecoveryStep = 'INPUT' | 'INITIATED' | 'APPROVING' | 'READY' | 'EXECUTING' | 'COMPLETED';

interface GuardianStatus {
  address: string;
  approved: boolean;
}

export default function RecoveryPage() {
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<RecoveryStep>('INPUT');
  const [ensName, setEnsName] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [namehash, setNamehash] = useState('');
  const [guardians, setGuardians] = useState<GuardianStatus[]>([]);
  const [threshold, setThreshold] = useState(0);
  const [approvalCount, setApprovalCount] = useState(0);
  const [estimatedExecutionTime, setEstimatedExecutionTime] = useState<string>('');
  const [remainingMinutes, setRemainingMinutes] = useState(0);

  // Poll for status updates
  useEffect(() => {
    if (namehash && (step === 'INITIATED' || step === 'APPROVING' || step === 'READY')) {
      const interval = setInterval(() => {
        checkRecoveryStatus();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [namehash, step]);

  const checkRecoveryStatus = async () => {
    if (!namehash) return;

    try {
      const response = await fetch(`/api/recovery/status?namehash=${namehash}`);
      const data = await response.json();

      if (data.success && data.status) {
        setApprovalCount(data.status.approvalCount);
        setThreshold(data.status.threshold);
        
        if (data.status.guardians) {
          setGuardians(data.status.guardians);
        }

        if (data.status.estimatedExecutionTime) {
          setEstimatedExecutionTime(data.status.estimatedExecutionTime);
        }

        // Update step based on status
        if (data.status.status === 'APPROVED' || data.status.approvalCount >= data.status.threshold) {
          setStep('READY');
        } else if (data.status.approvalCount > 0) {
          setStep('APPROVING');
        }
      }
    } catch (err) {
      console.error('Status check failed:', err);
    }
  };

  const canExecute = async () => {
    if (!namehash) return false;

    try {
      const response = await fetch(`/api/recovery/execute?namehash=${namehash}`);
      const data = await response.json();

      if (data.success) {
        setRemainingMinutes(data.remainingMinutes || 0);
        return data.canExecute;
      }
    } catch (err) {
      console.error('Cannot check execution status:', err);
    }

    return false;
  };

  const initiateRecovery = async () => {
    if (!ensName || !address || !newOwner) {
      setError('Please enter ENS name and new owner address');
      return;
    }

    if (!ethers.isAddress(newOwner)) {
      setError('Invalid new owner address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check if recovery can be initiated
      const checkResponse = await fetch(`/api/recovery/initiate?ensName=${ensName}`);
      const checkData = await checkResponse.json();

      if (!checkData.success || !checkData.canInitiate) {
        setError(checkData.error || 'Cannot initiate recovery: Guardian configuration not found');
        setLoading(false);
        return;
      }

      // Initiate recovery
      const response = await fetch('/api/recovery/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ensName,
          currentOwner: address,
          newOwner,
        }),
      });

      const data = await response.json();

      if (data.success && data.request) {
        setNamehash(data.request.namehash);
        setGuardians(data.request.guardians.map((addr: string) => ({
          address: addr,
          approved: false,
        })));
        setThreshold(data.request.threshold);
        setApprovalCount(0);
        setStep('INITIATED');
      } else {
        setError(data.error || 'Failed to initiate recovery');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recovery initiation failed');
    } finally {
      setLoading(false);
    }
  };

  const executeRecovery = async () => {
    if (!namehash) return;

    const canExec = await canExecute();
    if (!canExec) {
      setError(`Cannot execute yet. Please wait ${remainingMinutes} more minutes.`);
      return;
    }

    setLoading(true);
    setError('');
    setStep('EXECUTING');

    try {
      const response = await fetch('/api/recovery/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namehash }),
      });

      const data = await response.json();

      if (data.success) {
        setStep('COMPLETED');
      } else {
        setError(data.error || 'Recovery execution failed');
        setStep('READY');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
      setStep('READY');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white flex items-center space-x-3">
              <Shield className="w-10 h-10 text-purple-600" />
              <span>Wallet Recovery</span>
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Guardian-based recovery for your NovaVault wallet
            </p>
          </div>
          <ConnectButton />
        </div>

        <div className="max-w-3xl mx-auto">
          {/* Step Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {['INPUT', 'INITIATED', 'APPROVING', 'READY', 'EXECUTING', 'COMPLETED'].map((s, idx) => (
                <div key={s} className="flex items-center">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold
                    ${step === s ? 'bg-purple-600 text-white' : 
                      ['INPUT', 'INITIATED', 'APPROVING', 'READY', 'EXECUTING', 'COMPLETED'].indexOf(step) > idx
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-300 text-gray-600'}
                  `}>
                    {['INPUT', 'INITIATED', 'APPROVING', 'READY', 'EXECUTING', 'COMPLETED'].indexOf(step) > idx ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  {idx < 5 && (
                    <div className={`w-16 h-1 ${
                      ['INPUT', 'INITIATED', 'APPROVING', 'READY', 'EXECUTING', 'COMPLETED'].indexOf(step) > idx
                        ? 'bg-green-500'
                        : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            {/* Step 1: Input */}
            {step === 'INPUT' && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Initiate Recovery</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      ENS Name
                    </label>
                    <input
                      type="text"
                      value={ensName}
                      onChange={(e) => setEnsName(e.target.value)}
                      placeholder="alice.eth"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      New Owner Address
                    </label>
                    <input
                      type="text"
                      value={newOwner}
                      onChange={(e) => setNewOwner(e.target.value)}
                      placeholder="0x..."
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This will be the new owner address after recovery
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={initiateRecovery}
                  disabled={!isConnected || loading || !ensName || !newOwner}
                  className="w-full mt-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
                >
                  {loading ? (
                    <span className="flex items-center justify-center space-x-2">
                      <Loader className="w-5 h-5 animate-spin" />
                      <span>Initiating...</span>
                    </span>
                  ) : (
                    'Initiate Recovery'
                  )}
                </button>
              </div>
            )}

            {/* Step 2-4: Guardian Approvals */}
            {(step === 'INITIATED' || step === 'APPROVING' || step === 'READY') && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Guardian Approvals</h2>
                
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      <span className="font-medium">
                        {approvalCount} of {threshold} Approvals
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {approvalCount >= threshold ? (
                        <span className="text-green-600 font-medium">✓ Threshold Met</span>
                      ) : (
                        <span>Waiting for guardians...</span>
                      )}
                    </div>
                  </div>

                  {/* Guardian List */}
                  <div className="space-y-2">
                    {guardians.map((guardian, idx) => (
                      <div
                        key={guardian.address}
                        className={`p-3 rounded-lg border ${
                          guardian.approved
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Guardian {idx + 1}</p>
                            <p className="text-xs font-mono text-gray-500">
                              {guardian.address}
                            </p>
                          </div>
                          {guardian.approved && (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {step === 'READY' && (
                  <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Gateway Delay Period
                      </p>
                    </div>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {remainingMinutes > 0
                        ? `Recovery can be executed in ${remainingMinutes} minutes`
                        : 'Recovery is ready to execute!'}
                    </p>
                    {estimatedExecutionTime && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Estimated time: {new Date(estimatedExecutionTime).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                {step === 'READY' && remainingMinutes === 0 && (
                  <button
                    onClick={executeRecovery}
                    disabled={loading}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    {loading ? 'Executing...' : 'Execute Recovery'}
                  </button>
                )}
              </div>
            )}

            {/* Step 5: Executing */}
            {step === 'EXECUTING' && (
              <div className="text-center py-12">
                <Loader className="w-16 h-16 text-purple-600 animate-spin mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Executing Recovery...</h2>
                <p className="text-gray-600">
                  Processing 4-phase recovery flow
                </p>
                <div className="mt-6 text-sm text-gray-500 space-y-1">
                  <p>Phase 1: On-chain settlement ✓</p>
                  <p>Phase 2: Gateway policy check ⏳</p>
                  <p>Phase 3: Circle wallet migration</p>
                  <p>Phase 4: Ownership rotation</p>
                </div>
              </div>
            )}

            {/* Step 6: Completed */}
            {step === 'COMPLETED' && (
              <div className="text-center py-12">
                <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Recovery Complete!</h2>
                <p className="text-gray-600 mb-6">
                  Your wallet has been successfully recovered
                </p>
                <a
                  href="/dashboard"
                  className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold"
                >
                  Go to Dashboard
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
