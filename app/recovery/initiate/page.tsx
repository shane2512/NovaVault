/**
 * Recovery Initiation Page
 * User enters old ENS name + new wallet address to start recovery
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, AlertCircle, ArrowRight, Users, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function RecoveryInitiatePage() {
  const router = useRouter();
  const [oldENSName, setOldENSName] = useState('');
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [recoveryData, setRecoveryData] = useState<{
    recoveryId: string;
    guardians: string[];
    threshold: number;
  } | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/recovery/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldENSName,
          newWalletAddress
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to initiate recovery');
      }
      
      setRecoveryData({
        recoveryId: result.recoveryId,
        guardians: result.guardians,
        threshold: result.threshold
      });
      
    } catch (err: any) {
      setError(err.message || 'Failed to initiate recovery');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (recoveryData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Success Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle2 className="text-green-600" size={32} />
              </div>
              <h1 className="text-3xl font-bold mb-2">Recovery Initiated!</h1>
              <p className="text-gray-600">
                Waiting for guardian approvals
              </p>
            </div>
            
            {/* Recovery Info */}
            <div className="bg-gray-50 rounded-xl p-6 mb-6 space-y-4">
              <div>
                <div className="text-sm text-gray-500 mb-1">Recovery ID</div>
                <div className="font-mono text-sm bg-white px-3 py-2 rounded border">
                  {recoveryData.recoveryId}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-500 mb-1">ENS Name</div>
                <div className="font-medium">{oldENSName}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-500 mb-1">New Wallet</div>
                <div className="font-mono text-sm break-all">{newWalletAddress}</div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <div className="text-sm text-gray-500">Recovery Threshold</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {recoveryData.threshold} of {recoveryData.guardians.length}
                  </div>
                  <div className="text-xs text-gray-500">guardians required</div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm text-gray-500">Status</div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                    <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse"></div>
                    Pending Approvals
                  </div>
                </div>
              </div>
            </div>
            
            {/* Guardians List */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Users size={20} className="text-gray-600" />
                <h3 className="font-semibold">Guardians</h3>
              </div>
              <div className="space-y-2">
                {recoveryData.guardians.map((guardian, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg"
                  >
                    <div>
                      <div className="text-sm text-gray-500">Guardian {index + 1}</div>
                      <div className="font-mono text-sm">{guardian}</div>
                    </div>
                    <div className="text-sm text-gray-400">Waiting...</div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Next Steps */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <AlertCircle className="text-blue-600 flex-shrink-0" size={20} />
                <div className="text-sm text-gray-700">
                  <p className="font-medium mb-2">Next Steps:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Share Recovery ID with your guardians</li>
                    <li>Guardians visit the Guardian Dashboard</li>
                    <li>They approve the recovery request</li>
                    <li>Once threshold is met, recovery executes automatically</li>
                  </ol>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => router.push(`/recovery/status?id=${recoveryData.recoveryId}`)}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                Track Recovery Status
                <ArrowRight size={20} />
              </button>
            </div>
            
            <div className="text-center mt-4">
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="text-4xl font-bold mb-2">Wallet Recovery</h1>
          <p className="text-gray-600">
            Recover your wallet using guardian approval
          </p>
        </div>
        
        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Old ENS Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Your ENS Name
              </label>
              <input
                type="text"
                value={oldENSName}
                onChange={(e) => setOldENSName(e.target.value)}
                placeholder="yourdomain.eth"
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                ENS name linked to the wallet you want to recover
              </p>
            </div>
            
            {/* New Wallet Address */}
            <div>
              <label className="block text-sm font-medium mb-2">
                New Wallet Address
              </label>
              <input
                type="text"
                value={newWalletAddress}
                onChange={(e) => setNewWalletAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                The new wallet address that will receive ownership
              </p>
            </div>
            
            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="text-blue-600 flex-shrink-0" size={20} />
                <div className="text-sm text-gray-700">
                  <p className="font-medium mb-1">Recovery Process:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>System retrieves guardians from your ENS records</li>
                    <li>Recovery request sent to all guardians</li>
                    <li>Guardians approve or reject the request</li>
                    <li>When threshold is met, recovery executes</li>
                    <li>ENS and funds transfer to new wallet</li>
                  </ol>
                </div>
              </div>
            </div>
            
            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
            
            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Initiating Recovery...
                </>
              ) : (
                <>
                  Initiate Recovery
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </div>
        
        {/* Links */}
        <div className="mt-6 text-center space-y-2">
          <Link
            href="/recovery/guardian-dashboard"
            className="block text-blue-600 hover:text-blue-700 font-medium"
          >
            Are you a guardian? View Recovery Requests →
          </Link>
          <Link
            href="/dashboard"
            className="block text-gray-600 hover:text-gray-800"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
