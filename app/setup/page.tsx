"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ethers } from "ethers";
import { arcService, ARC_CONFIG } from "@/lib/services/arcService";

export default function SetupPage() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<string>("");
  const [balance, setBalance] = useState<string>("0");

  useEffect(() => {
    if (address && isConnected) {
      loadBalance();
    }
  }, [address, isConnected]);

  const loadBalance = async () => {
    if (!address) return;
    try {
      const bal = await arcService.getUSDCBalanceFormatted(address);
      setBalance(bal);
    } catch (error) {
      console.error("Error loading balance:", error);
    }
  };

  const deployWallet = async () => {
    if (!window.ethereum || !address) {
      alert("Please connect your wallet first");
      return;
    }

    setIsDeploying(true);
    setDeploymentStatus("🔄 Deploying SmartWallet contract...");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      await arcService.connect(signer);

      // Import the contract ABI and bytecode
      const SmartWalletArtifact = await import("../../artifacts/contracts/arc/SmartWallet.sol/SmartWallet.json");
      
      const factory = new ethers.ContractFactory(
        SmartWalletArtifact.abi,
        SmartWalletArtifact.bytecode,
        signer
      );

      setDeploymentStatus("📝 Sending deployment transaction...");
      const contract = await factory.deploy();
      
      setDeploymentStatus("⏳ Waiting for confirmation...");
      await contract.waitForDeployment();
      
      const deployedAddress = await contract.getAddress();
      setWalletAddress(deployedAddress);
      
      setDeploymentStatus(`✅ Wallet deployed successfully!`);
      
      // Save to localStorage
      localStorage.setItem("smartWalletAddress", deployedAddress);
      
      setTimeout(() => {
        window.location.href = `/dashboard?wallet=${deployedAddress}`;
      }, 2000);
    } catch (error: any) {
      console.error("Deployment error:", error);
      setDeploymentStatus(`❌ Deployment failed: ${error.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              NovaVault
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Create your recoverable smart wallet
            </p>
          </div>
          <ConnectButton />
        </div>

        {/* Main Content */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Setup Your Smart Wallet
            </h2>

            {/* Network Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                🌐 Arc Network Testnet
              </h3>
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <p>Chain ID: {ARC_CONFIG.chainId}</p>
                <p>Native Gas Token: USDC (18 decimals)</p>
                <p>
                  Faucet:{" "}
                  <a
                    href="https://faucet.circle.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-600"
                  >
                    https://faucet.circle.com/
                  </a>
                </p>
              </div>
            </div>

            {/* Connection Status */}
            {isConnected && address ? (
              <div className="mb-6">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <p className="text-sm text-green-700 dark:text-green-300">
                    ✅ Connected
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 font-mono mt-1">
                    {address}
                  </p>
                  <p className="text-lg font-bold text-green-700 dark:text-green-300 mt-2">
                    {balance} USDC
                  </p>
                </div>

                {parseFloat(balance) === 0 && (
                  <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      ⚠️ You need testnet USDC to deploy your wallet and pay for
                      gas fees.
                    </p>
                    <a
                      href="https://faucet.circle.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 underline mt-2 inline-block"
                    >
                      Get testnet USDC →
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    👆 Please connect your wallet to continue
                  </p>
                </div>
              </div>
            )}

            {/* Deployment Button */}
            <button
              onClick={deployWallet}
              disabled={!isConnected || isDeploying || parseFloat(balance) === 0}
              className={`w-full py-4 rounded-lg font-semibold text-white text-lg transition-all ${
                !isConnected || isDeploying || parseFloat(balance) === 0
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl"
              }`}
            >
              {isDeploying ? "⏳ Deploying..." : "🚀 Deploy Smart Wallet"}
            </button>

            {/* Deployment Status */}
            {deploymentStatus && (
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {deploymentStatus}
                </p>
                {walletAddress && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Contract Address:
                    </p>
                    <p className="text-xs font-mono text-blue-600 dark:text-blue-400 break-all">
                      {walletAddress}
                    </p>
                    <a
                      href={arcService.getExplorerUrl(walletAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 underline mt-2 inline-block"
                    >
                      View on Arcscan →
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Info */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                📖 What happens next?
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                <li>✓ Deploy your SmartWallet contract to Arc Network</li>
                <li>✓ You become the owner of the wallet</li>
                <li>✓ Manage USDC and ERC-20 tokens</li>
                <li>✓ Full control over deposits, withdrawals, and transfers</li>
              </ul>
            </div>
          </div>

          {/* Phase Info */}
          <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Phase 1: Basic Smart Wallet • Arc Network Testnet
          </div>
        </div>
      </div>
    </div>
  );
}
