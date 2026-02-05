'use client';

import { ArrowUpRight, ArrowDownLeft, Repeat, ArrowLeftRight } from 'lucide-react';

interface ActionButtonsProps {
  onSend: () => void;
  onReceive: () => void;
  onSwap?: () => void;
  onCrossChain?: () => void;
  blockchain?: string;
}

export function ActionButtons({ onSend, onReceive, onSwap, onCrossChain, blockchain }: ActionButtonsProps) {
  const isArcNetwork = blockchain === 'ARC-TESTNET';
  
  return (
    <div className="bg-white border-t border-gray-200 p-6">
      {isArcNetwork && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            ⚠️ Arc Network sending coming soon. Use Sepolia/Polygon to send, then bridge to Arc.
          </p>
        </div>
      )}
      <div className="flex justify-around">
        <button
          onClick={onSend}
          disabled={isArcNetwork}
          className={`flex flex-col items-center space-y-2 group ${isArcNetwork ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className={`w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white transition-colors ${!isArcNetwork ? 'group-hover:bg-blue-600' : ''}`}>
            <ArrowUpRight size={24} />
          </div>
          <span className="text-sm font-medium text-gray-700">Send</span>
        </button>

        <button
          onClick={onReceive}
          className="flex flex-col items-center space-y-2 group"
        >
          <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center text-white group-hover:bg-green-600 transition-colors">
            <ArrowDownLeft size={24} />
          </div>
          <span className="text-sm font-medium text-gray-700">Receive</span>
        </button>

        {onSwap && (
          <button
            onClick={onSwap}
            className="flex flex-col items-center space-y-2 group"
          >
            <div className="w-14 h-14 bg-purple-500 rounded-full flex items-center justify-center text-white group-hover:bg-purple-600 transition-colors">
              <Repeat size={24} />
            </div>
            <span className="text-sm font-medium text-gray-700">Swap</span>
          </button>
        )}
        
        {onCrossChain && (
          <button
            onClick={onCrossChain}
            className="flex flex-col items-center space-y-2 group"
          >
            <div className="w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center text-white group-hover:bg-orange-600 transition-colors">
              <ArrowLeftRight size={24} />
            </div>
            <span className="text-sm font-medium text-gray-700">Bridge</span>
          </button>
        )}
      </div>
    </div>
  );
}
