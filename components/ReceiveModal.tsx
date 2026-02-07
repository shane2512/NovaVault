'use client';

import { useState } from 'react';
import { X, Copy, Check, QrCode, ExternalLink } from 'lucide-react';

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  blockchain: string;
}

// Block Explorer URLs for each network
const BLOCK_EXPLORERS: Record<string, { url: string; name: string }> = {
  'ETH-SEPOLIA': {
    url: 'https://sepolia.etherscan.io',
    name: 'Etherscan'
  },
  'MATIC-AMOY': {
    url: 'https://amoy.polygonscan.com',
    name: 'PolygonScan'
  },
  'ARC-TESTNET': {
    url: 'https://testnet.arcscan.app',
    name: 'ArcScan'
  }
};

export function ReceiveModal({ isOpen, onClose, address, blockchain }: ReceiveModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getExplorerUrl = () => {
    const explorer = BLOCK_EXPLORERS[blockchain];
    return explorer ? `${explorer.url}/address/${address}` : null;
  };

  const explorerUrl = getExplorerUrl();
  const explorerName = BLOCK_EXPLORERS[blockchain]?.name || 'Block Explorer';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Receive</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center">
            <div className="bg-gray-100 p-8 rounded-2xl mb-4 inline-block">
              <QrCode size={150} className="text-gray-700" />
            </div>
            <p className="text-sm text-gray-600">
              Scan QR code to get address
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your {blockchain} Address
            </label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 font-mono text-sm break-all">
                {address}
              </div>
              <button
                onClick={copyAddress}
                className="flex-shrink-0 bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-colors"
              >
                {copied ? <Check size={20} /> : <Copy size={20} />}
              </button>
            </div>
            {copied && (
              <p className="text-sm text-green-600 mt-2 text-center">
                ✅ Address copied to clipboard!
              </p>
            )}
          </div>

          {explorerUrl && (
            <div className="text-center">
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                View on {explorerName}
                <ExternalLink size={14} />
              </a>
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              ⚠️ Only send {blockchain} assets to this address. Sending other assets may result in loss of funds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
