/**
 * Guardian Setup Modal
 * Allows wallet owners to configure their recovery guardians
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';

interface GuardianSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentENSName?: string;
  currentWalletAddress?: string;
  onSuccess?: () => void;
}

export default function GuardianSetupModal({
  isOpen,
  onClose,
  currentENSName,
  currentWalletAddress,
  onSuccess
}: GuardianSetupModalProps) {
  const [guardians, setGuardians] = useState<string[]>(['']);
  const [threshold, setThreshold] = useState(1);
  const [ensName, setEnsName] = useState(currentENSName || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [txHashes, setTxHashes] = useState<string[]>([]);
  
  // Sync ENS name when prop changes
  useEffect(() => {
    console.log('🔐 GuardianSetupModal props:', {
      currentWalletAddress,
      currentENSName,
      isOpen
    });
    if (currentENSName) {
      setEnsName(currentENSName);
    }
  }, [currentENSName, currentWalletAddress, isOpen]);
  
  const addGuardian = () => {
    if (guardians.length < 5) {
      setGuardians([...guardians, '']);
    }
  };
  
  const removeGuardian = (index: number) => {
    if (guardians.length > 1) {
      const updated = guardians.filter((_, i) => i !== index);
      setGuardians(updated);
      if (threshold > updated.length) {
        setThreshold(updated.length);
      }
    }
  };
  
  const updateGuardian = (index: number, value: string) => {
    const updated = [...guardians];
    updated[index] = value;
    setGuardians(updated);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      // Filter out empty guardians
      const validGuardians = guardians.filter(g => g.trim() !== '');
      
      if (validGuardians.length === 0) {
        throw new Error('At least one guardian required');
      }
      
      if (threshold > validGuardians.length) {
        throw new Error('Threshold cannot exceed number of guardians');
      }
      
      if (!ensName) {
        throw new Error('ENS name required');
      }
      
      if (!currentWalletAddress) {
        throw new Error('Wallet address not available. Please ensure your wallet is loaded.');
      }
      
      // Validate guardian addresses
      for (const guardian of validGuardians) {
        if (!/^0x[a-fA-F0-9]{40}$/.test(guardian)) {
          throw new Error(`Invalid guardian address: ${guardian}`);
        }
      }
      
      // Call API to set guardian configuration
      const response = await fetch('/api/ens/set-guardians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ensName,
          guardians: validGuardians,
          threshold,
          walletAddress: currentWalletAddress
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to set guardians');
      }
      
      setSuccess(true);
      setTxHashes(result.txHashes || []);
      
      if (onSuccess) {
        setTimeout(onSuccess, 2000);
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to configure guardians');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <Shield className="text-blue-600" size={24} />
            <div>
              <h2 className="text-xl font-bold">Guardian Setup</h2>
              <p className="text-sm text-gray-500">Configure wallet recovery</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Wallet Address Display */}
          {currentWalletAddress && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Wallet Address
              </label>
              <p className="font-mono text-sm break-all">{currentWalletAddress}</p>
            </div>
          )}
          
          {!currentWalletAddress && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-yellow-600 flex-shrink-0" size={20} />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Wallet Address Missing</p>
                <p className="text-xs mt-1">Please select a wallet before configuring guardians</p>
              </div>
            </div>
          )}
          
          {/* ENS Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              ENS Name
            </label>
            <input
              type="text"
              value={ensName}
              onChange={(e) => setEnsName(e.target.value)}
              placeholder="yourdomain.eth"
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Guardian config will be stored in your ENS text records
            </p>
          </div>
          
          {/* Guardians */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium">
                Guardian Addresses
              </label>
              <button
                type="button"
                onClick={addGuardian}
                disabled={guardians.length >= 5}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={16} />
                Add Guardian
              </button>
            </div>
            
            <div className="space-y-3">
              {guardians.map((guardian, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={guardian}
                      onChange={(e) => updateGuardian(index, e.target.value)}
                      placeholder={`Guardian ${index + 1} Address (0x...)`}
                      className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>
                  {guardians.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGuardian(index)}
                      className="p-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <p className="text-xs text-gray-500 mt-2">
              Up to 5 guardians. Each must be a valid Ethereum address.
            </p>
          </div>
          
          {/* Threshold */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Recovery Threshold
            </label>
            <select
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Array.from({ length: guardians.filter(g => g.trim()).length || 1 }, (_, i) => i + 1).map(num => (
                <option key={num} value={num}>
                  {num} of {guardians.filter(g => g.trim()).length || 1} guardians required
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Minimum number of guardian approvals needed for recovery
            </p>
          </div>
          
          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="text-blue-600 flex-shrink-0" size={20} />
              <div className="text-sm text-gray-700">
                <p className="font-medium mb-1">How Guardian Recovery Works:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Guardians approve recovery request ({threshold} required)</li>
                  <li>ENS ownership transfers to new wallet</li>
                  <li>All funds migrate to new wallet across chains</li>
                  <li>Your wallet is recovered securely</li>
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
          
          {/* Success */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-green-600 flex-shrink-0" size={20} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">Guardians Configured!</p>
                  <p className="text-xs text-green-700 mt-1">
                    {txHashes.length} transaction{txHashes.length !== 1 ? 's' : ''} confirmed
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || success || !currentWalletAddress}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              title={!currentWalletAddress ? 'Wallet address required' : ''}
            >
              {isLoading ? 'Configuring...' : success ? '✓ Configured' : 'Set Guardians'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
