"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ethers } from "ethers";
import { arcUtils } from "@/lib/services/arcUtils";

interface WalletData {
  address: string;
  balance: string;
  owner: string;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const { address: userAddress, isConnected } = useAccount();
  
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [txStatus, setTxStatus] = useState("");

  useEffect(() => {
    const wallet = searchParams.get("wallet") || localStorage.getItem("smartWalletAddress") || "";
    setWalletAddress(wallet);
    
    if (wallet && isConnected) {
      loadWalletData(wallet);
    } else {
      setLoading(false);
    }
  }, [searchParams, isConnected]);

  const loadWalletData = async (wallet: string) => {
    try {
      setLoading(true);
      
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      await arcUtils.connect(signer);

      // Load contract ABI
      const SmartWalletArtifact = await import("../../artifacts/contracts/arc/SmartWallet.sol/SmartWallet.json");
      const contract = new ethers.Contract(wallet, SmartWalletArtifact.abi, signer);

      const [balance, owner] = await Promise.all([
        contract.getBalance(),
        contract.owner(),
      ]);

      setWalletData({
        address: wallet,
        balance: ethers.formatUnits(balance, 18),
        owner: owner,
      });
    } catch (error) {
      console.error("Error loading wallet data:", error);
      setTxStatus("❌ Error loading wallet data");
    } finally {
      setLoading(false);
    }
  };

  const depositUSDC = async () => {
    if (!walletAddress || !sendAmount) return;

    try {
      setIsSending(true);
      setTxStatus("🔄 Depositing USDC...");

      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();

      const tx = await signer.sendTransaction({
        to: walletAddress,
        value: ethers.parseUnits(sendAmount, 18),
      });

      setTxStatus("⏳ Waiting for confirmation...");
      await tx.wait();

      setTxStatus("✅ Deposit successful!");
      setSendAmount("");
      
      // Reload wallet data
      await loadWalletData(walletAddress);
    } catch (error: any) {
      console.error("Deposit error:", error);
      setTxStatus(`❌ Deposit failed: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const sendUSDC = async () => {
    if (!walletAddress || !sendTo || !sendAmount) return;

    try {
      setIsSending(true);
      setTxStatus("🔄 Sending USDC...");

      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();

      const SmartWalletArtifact = await import("../../artifacts/contracts/arc/SmartWallet.sol/SmartWallet.json");
      const contract = new ethers.Contract(walletAddress, SmartWalletArtifact.abi, signer);

      const tx = await contract.sendUSDC(sendTo, ethers.parseUnits(sendAmount, 18));

      setTxStatus("⏳ Waiting for confirmation...");
      const receipt = await tx.wait();

      setTxStatus(`✅ Sent ${sendAmount} USDC!`);
      setSendTo("");
      setSendAmount("");
      
      // Reload wallet data
      await loadWalletData(walletAddress);
    } catch (error: any) {
      console.error("Send error:", error);
      setTxStatus(`❌ Send failed: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const withdrawUSDC = async () => {
    if (!walletAddress || !sendAmount) return;

    try {
      setIsSending(true);
      setTxStatus("🔄 Withdrawing USDC...");

      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();

      const SmartWalletArtifact = await import("../../artifacts/contracts/arc/SmartWallet.sol/SmartWallet.json");
      const contract = new ethers.Contract(walletAddress, SmartWalletArtifact.abi, signer);

      const tx = await contract.withdrawUSDC(ethers.parseUnits(sendAmount, 18));

      setTxStatus("⏳ Waiting for confirmation...");
      await tx.wait();

      setTxStatus(`✅ Withdrawn ${sendAmount} USDC!`);
      setSendAmount("");
      
      // Reload wallet data
      await loadWalletData(walletAddress);
    } catch (error: any) {
      console.error("Withdraw error:", error);
      setTxStatus(`❌ Withdraw failed: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            No Wallet Found
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Please deploy a wallet first
          </p>
          <a
            href="/setup"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Go to Setup
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Wallet Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Manage your Arc Network smart wallet
            </p>
          </div>
          <ConnectButton />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 dark:text-gray-300 mt-4">Loading wallet...</p>
          </div>
        ) : walletData ? (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Wallet Info */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                💼 Wallet Information
              </h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Contract Address</p>
                  <p className="font-mono text-sm text-gray-900 dark:text-white break-all">
                    {walletData.address}
                  </p>
                  <a
                    href={arcUtils.getExplorerUrl(walletData.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 underline"
                  >
                    View on Arcscan →
                  </a>
                </div>

                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Owner</p>
                  <p className="font-mono text-sm text-gray-900 dark:text-white break-all">
                    {walletData.owner}
                  </p>
                  {userAddress?.toLowerCase() === walletData.owner.toLowerCase() ? (
                    <span className="text-xs text-green-600 dark:text-green-400">✓ You are the owner</span>
                  ) : (
                    <span className="text-xs text-red-600 dark:text-red-400">⚠️ You are not the owner</span>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Balance</p>
                  <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                    {parseFloat(walletData.balance).toFixed(6)} USDC
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid md:grid-cols-3 gap-6">
              {/* Deposit */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  💰 Deposit USDC
                </h3>
                <input
                  type="number"
                  placeholder="Amount"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 dark:bg-gray-700 dark:text-white"
                  disabled={isSending}
                />
                <button
                  onClick={depositUSDC}
                  disabled={isSending || !sendAmount}
                  className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  Deposit
                </button>
              </div>

              {/* Send */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  📤 Send USDC
                </h3>
                <input
                  type="text"
                  placeholder="Recipient address"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-2 dark:bg-gray-700 dark:text-white text-sm"
                  disabled={isSending}
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 dark:bg-gray-700 dark:text-white"
                  disabled={isSending}
                />
                <button
                  onClick={sendUSDC}
                  disabled={isSending || !sendTo || !sendAmount}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Send
                </button>
              </div>

              {/* Withdraw */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  🏦 Withdraw USDC
                </h3>
                <input
                  type="number"
                  placeholder="Amount"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 dark:bg-gray-700 dark:text-white"
                  disabled={isSending}
                />
                <button
                  onClick={withdrawUSDC}
                  disabled={isSending || !sendAmount}
                  className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                >
                  Withdraw
                </button>
              </div>
            </div>

            {/* Transaction Status */}
            {txStatus && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
                <p className="text-gray-900 dark:text-white">{txStatus}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-300">
              Connect your wallet to view dashboard
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
