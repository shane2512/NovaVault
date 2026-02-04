'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface WalletHeaderProps {
  address: string;
  blockchain: string;
}

export function WalletHeader({ address, blockchain }: WalletHeaderProps) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getExplorerUrl = () => {
    if (blockchain === 'ETH-SEPOLIA') {
      return `https://sepolia.etherscan.io/address/${address}`;
    } else if (blockchain === 'MATIC-AMOY') {
      return `https://amoy.polygonscan.com/address/${address}`;
    }
    return '#';
  };

  return (
    <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-t-2xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white text-sm opacity-90">{blockchain}</span>
        <a
          href={getExplorerUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white hover:opacity-80 transition-opacity"
        >
          <ExternalLink size={16} />
        </a>
      </div>
      
      <div className="flex items-center justify-center space-x-2">
        <div className="bg-white bg-opacity-20 rounded-lg px-4 py-2 flex items-center space-x-2">
          <span className="text-white font-mono text-sm">
            {shortenAddress(address)}
          </span>
          <button
            onClick={copyAddress}
            className="text-white hover:bg-white hover:bg-opacity-20 p-1 rounded transition-all"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
