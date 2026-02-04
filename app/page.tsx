export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="text-center max-w-3xl mx-auto px-4">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-6">
          NovaVault
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-4">
          Cross-Chain Recoverable DeFi Smart Wallet
        </p>
        <p className="text-gray-500 dark:text-gray-400 mb-12">
          Built on Arc Network • USDC Native • ZK Recovery
        </p>
        
        <div className="space-y-4">
          <a
            href="/wallet"
            className="inline-block bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all"
          >
            🚀 Open Wallet
          </a>
          
          <div className="mt-8 text-sm text-gray-500 dark:text-gray-400">
            Circle Developer-Controlled Wallets • Arc Testnet Ready
          </div>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8 text-left">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="text-3xl mb-3">💎</div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">USDC Native</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Pay gas fees in USDC on Arc Network
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="text-3xl mb-3">🔒</div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Self Custody</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              You control your keys and funds
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Smart Wallet</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Advanced features via smart contracts
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
