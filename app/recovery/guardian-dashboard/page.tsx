/**
 * Guardian Dashboard
 * Shows recovery requests that need guardian approval
 */

'use client';

import { useState, useEffect } from 'react';
import { Shield, CheckCircle2, AlertCircle, Clock, Users } from 'lucide-react';
import Link from 'next/link';

interface RecoveryRequest {
  id: string;
  oldENSName: string;
  oldWalletAddress: string;
  newWalletAddress: string;
  guardians: string[];
  threshold: number;
  approvals: string[];
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed';
  createdAt: number;
}

export default function GuardianDashboardPage() {
  const [guardianAddress, setGuardianAddress] = useState('');
  const [recoveries, setRecoveries] = useState<RecoveryRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [approvingId, setApprovingId] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  // Auto-refresh every 5 seconds when enabled
  useEffect(() => {
    if (autoRefresh && guardianAddress) {
      const interval = setInterval(() => {
        fetchRecoveries();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [autoRefresh, guardianAddress]);
  
  const fetchRecoveries = async () => {
    if (!guardianAddress) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(
        `/api/recovery/status?guardianAddress=${encodeURIComponent(guardianAddress)}`
      );
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch recoveries');
      }
      
      setRecoveries(result.recoveries || []);
      
      // Enable auto-refresh if there are pending recoveries
      const hasPending = (result.recoveries || []).some((r: RecoveryRequest) => r.status === 'pending');
      setAutoRefresh(hasPending);
      
    } catch (err: any) {
      setError(err.message || 'Failed to load recovery requests');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleApprove = async (recoveryId: string) => {
    setApprovingId(recoveryId);
    setError('');
    
    try {
      const response = await fetch('/api/recovery/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recoveryId,
          guardianAddress
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve recovery');
      }
      
      // Immediately refresh list to show updated status
      await fetchRecoveries();
      
      // Show success message with current approval count
      const recovery = recoveries.find(r => r.id === recoveryId);
      const newApprovalCount = result.approvalsCount || (recovery ? recovery.approvals.length + 1 : 1);
      const threshold = result.threshold || recovery?.threshold || 0;
      
      if (newApprovalCount >= threshold) {
        alert(`✅ Recovery approved! Threshold met (${newApprovalCount}/${threshold}) - Recovery will execute automatically.`);
      } else {
        alert(`✅ Approval recorded! (${newApprovalCount}/${threshold})`);
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to approve recovery');
      alert(`❌ ${err.message || 'Failed to approve recovery'}`);
    } finally {
      setApprovingId('');
    }
  };
  
  const hasApproved = (recovery: RecoveryRequest) => {
    return recovery.approvals
      .map(a => a.toLowerCase())
      .includes(guardianAddress.toLowerCase());
  };
  
  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      executing: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-full mb-4">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="text-4xl font-bold mb-2">Guardian Dashboard</h1>
          <p className="text-gray-600">
            Approve wallet recovery requests
          </p>
        </div>
        
        {/* Guardian Address Input */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <label className="block text-sm font-medium mb-2">
            Your Guardian Address
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={guardianAddress}
              onChange={(e) => setGuardianAddress(e.target.value)}
              placeholder="0x..."
              className="flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
            />
            <button
              onClick={fetchRecoveries}
              disabled={isLoading || !guardianAddress}
              className="px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Load Requests'}
            </button>
          </div>
          {autoRefresh && (
            <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
              Auto-refreshing every 5 seconds
            </div>
          )}
        </div>
        
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}
        
        {/* Recovery Requests */}
        {recoveries.length > 0 ? (
          <div className="space-y-4">
            {recoveries.map((recovery) => (
              <div
                key={recovery.id}
                className="bg-white rounded-xl shadow p-6"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold mb-1">{recovery.oldENSName}</h3>
                    <p className="text-sm text-gray-500">
                      Recovery ID: {recovery.id}
                    </p>
                  </div>
                  {getStatusBadge(recovery.status)}
                </div>
                
                {/* Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Old Wallet</div>
                    <div className="font-mono text-sm break-all">{recovery.oldWalletAddress}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">New Wallet</div>
                    <div className="font-mono text-sm break-all">{recovery.newWalletAddress}</div>
                  </div>
                </div>
                
                {/* Progress */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-gray-600" />
                      <span className="text-sm font-medium">Approvals</span>
                    </div>
                    <span className="text-sm font-bold text-purple-600">
                      {recovery.approvals.length} / {recovery.threshold}
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full bg-purple-600 rounded-full transition-all"
                      style={{ width: `${(recovery.approvals.length / recovery.threshold) * 100}%` }}
                    />
                  </div>
                  
                  {/* Guardians List */}
                  <div className="mt-3 space-y-1">
                    {recovery.guardians.map((guardian, index) => {
                      const approved = recovery.approvals
                        .map(a => a.toLowerCase())
                        .includes(guardian.toLowerCase());
                      
                      return (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          {approved ? (
                            <CheckCircle2 size={14} className="text-green-600" />
                          ) : (
                            <Clock size={14} className="text-gray-400" />
                          )}
                          <span className={approved ? 'text-green-600 font-medium' : 'text-gray-500'}>
                            Guardian {index + 1}: {guardian.substring(0, 10)}...
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Created */}
                <div className="text-xs text-gray-500 mb-4">
                  Created: {new Date(recovery.createdAt).toLocaleString()}
                </div>
                
                {/* Actions */}
                {recovery.status === 'pending' && (
                  <div>
                    {hasApproved(recovery) ? (
                      <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
                        <CheckCircle2 size={16} />
                        You have approved this recovery
                      </div>
                    ) : (
                      <button
                        onClick={() => handleApprove(recovery.id)}
                        disabled={approvingId === recovery.id}
                        className="w-full py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {approvingId === recovery.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Approving...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={20} />
                            Approve Recovery
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
                
                {recovery.status === 'approved' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 text-sm text-blue-800">
                    <AlertCircle size={16} />
                    Threshold met! Recovery will execute automatically.
                  </div>
                )}
                
                {recovery.status === 'completed' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-sm text-green-800">
                    <CheckCircle2 size={16} />
                    Recovery completed successfully!
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : guardianAddress && !isLoading ? (
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <Shield className="mx-auto text-gray-300 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Recovery Requests
            </h3>
            <p className="text-gray-500">
              You don't have any pending recovery requests for this address.
            </p>
          </div>
        ) : null}
        
        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link
            href="/dashboard"
            className="text-gray-600 hover:text-gray-800"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
