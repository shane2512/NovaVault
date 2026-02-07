"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ENSService, createSepoliaENSService } from "@/lib/services/ensService";
import { ZKSecretService } from "@/lib/services/zkSecretService";
import { Shield, CheckCircle2, AlertCircle, ExternalLink, Download, Copy, Eye, EyeOff } from "lucide-react";

export default function ENSSetupPage() {
  const [step, setStep] = useState<"connect" | "name" | "secret" | "confirm" | "complete">("connect");
  const [ensName, setEnsName] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [secretHash, setSecretHash] = useState<{ hash: string; salt: string } | null>(null);
  const [ensService, setEnsService] = useState<ENSService | null>(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [nameInfo, setNameInfo] = useState<any>(null);

  // Validation states
  const [questionValidation, setQuestionValidation] = useState<any>(null);
  const [answerValidation, setAnswerValidation] = useState<any>(null);

  // Connect wallet
  const connectWallet = async () => {
    try {
      setLoading(true);
      setError("");

      if (!window.ethereum) {
        throw new Error("MetaMask not installed");
      }

      // Request accounts
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      // Check network
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (chainId !== "0xaa36a7") {
        // Sepolia = 11155111 = 0xaa36a7
        throw new Error("Please switch to Sepolia testnet");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // Use Circle wallet address from environment
      const circleWallet = process.env.NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS_ETH || 
                          "0x5f90f52ffdc875a8d93021c76d2e612a6459df63";

      setWalletAddress(circleWallet);
      setEnsService(createSepoliaENSService(signer));
      setStep("name");
      setSuccess(`MetaMask connected! Will bind to Circle wallet: ${circleWallet}`);
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  // Check ENS name
  const checkENSName = async () => {
    if (!ensService || !ensName) return;

    try {
      setLoading(true);
      setError("");

      const info = await ensService.getNameInfo(ensName);
      setNameInfo(info);

      if (!info.owner) {
        setError(
          `Name "${ensName}" is not registered. Please register it first.`
        );
        return;
      }

      const isOwner = await ensService.isNameOwner(ensName, walletAddress);
      if (!isOwner) {
        setError(`You don't own "${ensName}". Owner: ${info.owner}`);
        return;
      }

      // Check if already setup
      const identity = await ensService.getIdentity(ensName);
      if (identity.secretHash) {
        setError(
          `Name "${ensName}" already has a recovery secret setup.`
        );
        return;
      }

      setStep("secret");
      setSuccess(`Name verified! You own "${ensName}"`);
    } catch (err: any) {
      setError(err.message || "Failed to verify ENS name");
    } finally {
      setLoading(false);
    }
  };

  // Validate question
  useEffect(() => {
    if (question.length > 0) {
      const validation = ZKSecretService.validateQuestion(question);
      setQuestionValidation(validation);
    } else {
      setQuestionValidation(null);
    }
  }, [question]);

  // Validate answer
  useEffect(() => {
    if (answer.length > 0) {
      const validation = ZKSecretService.validateAnswer(answer);
      setAnswerValidation(validation);
    } else {
      setAnswerValidation(null);
    }
  }, [answer]);

  // Generate secret hash
  const generateSecret = () => {
    if (!question || !answer) {
      setError("Please enter both question and answer");
      return;
    }

    const qValidation = ZKSecretService.validateQuestion(question);
    const aValidation = ZKSecretService.validateAnswer(answer);

    if (!qValidation.valid || !aValidation.valid) {
      setError("Please fix validation errors before proceeding");
      return;
    }

    const result = ZKSecretService.generateSecretHash(question, answer);
    setSecretHash(result);
    setStep("confirm");
  };

  // Setup ENS identity
  const setupIdentity = async () => {
    if (!ensService || !secretHash) return;

    try {
      setLoading(true);
      setError("");

      // Setup identity with wallet + secret hash
      const tx = await ensService.setupIdentity(
        ensName,
        walletAddress,
        secretHash.hash,
        [
          { key: "description", value: "NovaVault Smart Wallet" },
          { key: "com.github", value: "novavault" },
        ]
      );

      setSuccess("Transaction submitted! Waiting for confirmation...");

      await tx.wait();

      // Create backup
      const backup = ZKSecretService.createBackup(
        walletAddress,
        ensName,
        secretHash.salt,
        secretHash.hash,
        "sepolia"
      );

      // Download backup
      ZKSecretService.downloadBackup(backup);

      setStep("complete");
      setSuccess("ENS identity setup complete! Backup file downloaded.");
    } catch (err: any) {
      setError(err.message || "Failed to setup identity");
    } finally {
      setLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess("Copied to clipboard!");
    setTimeout(() => setSuccess(""), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Shield className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold">ENS Identity Setup</h1>
          </div>
          <p className="text-gray-400">
            Bind your wallet to ENS and setup ZK recovery secret
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between mb-8">
          {["connect", "name", "secret", "confirm", "complete"].map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded ${
                step === s ? "bg-blue-500" : "bg-gray-700"
              } ${i > 0 ? "ml-2" : ""}`}
            />
          ))}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Error</p>
              <p className="text-sm text-gray-300">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-500/10 border border-green-500 rounded-lg p-4 mb-6 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Success</p>
              <p className="text-sm text-gray-300">{success}</p>
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-xl p-6">
          {/* Step 1: Connect Wallet */}
          {step === "connect" && (
            <div className="text-center space-y-6">
              <div className="text-6xl mb-4">🔗</div>
              <h2 className="text-2xl font-bold">Connect MetaMask</h2>
              <p className="text-gray-400">
                Connect MetaMask to manage ENS records
              </p>
              <div className="bg-blue-500/10 border border-blue-500 rounded-lg p-4 text-sm text-left">
                <p className="font-semibold text-blue-400 mb-2">
                  ℹ️ How This Works
                </p>
                <ul className="text-gray-300 space-y-1">
                  <li>• MetaMask manages your ENS name (easy UI control)</li>
                  <li>• ENS will point to your Circle wallet address</li>
                  <li>• Circle wallet: 0x5f90...df63</li>
                  <li>• Best of both: easy management + MPC security</li>
                </ul>
              </div>
              <p className="text-sm text-yellow-400">
                ⚠️ Make sure you're on Sepolia testnet
              </p>
              <button
                onClick={connectWallet}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg font-semibold disabled:opacity-50"
              >
                {loading ? "Connecting..." : "Connect MetaMask"}
              </button>
            </div>
          )}

          {/* Step 2: ENS Name */}
          {step === "name" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">ENS Name Registration</h2>
                <p className="text-gray-400 mb-4">
                  Enter the ENS name you want to bind to your wallet
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Circle Wallet Address (Will be bound to ENS)
                </label>
                <div className="bg-gray-700/50 rounded-lg p-3 font-mono text-sm">
                  {walletAddress}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  This is your Circle MPC wallet that will be linked to the ENS name
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Connected Wallet
                </label>
                <div className="bg-gray-700/50 rounded-lg p-3 font-mono text-sm">
                  {walletAddress}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  ENS Name
                </label>
                <input
                  type="text"
                  value={ensName}
                  onChange={(e) => setEnsName(e.target.value)}
                  placeholder="yourname.eth"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Don't have an ENS name?{" "}
                  <a
                    href="https://sepolia.app.ens.domains"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    Register on Sepolia <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>

              <button
                onClick={checkENSName}
                disabled={loading || !ensName}
                className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
              >
                {loading ? "Checking..." : "Verify Name"}
              </button>
            </div>
          )}

          {/* Step 3: Secret Question */}
          {step === "secret" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Create Recovery Secret</h2>
                <p className="text-gray-400 mb-4">
                  Choose a secret question only you know the answer to
                </p>
              </div>

              {/* Security Guidelines */}
              <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-4">
                <p className="font-semibold text-yellow-400 mb-2">
                  ⚠️ Security Guidelines
                </p>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>✅ Use unique, personal information only you know</li>
                  <li>✅ Make it memorable but not guessable</li>
                  <li>❌ Don't use public information (birthdate, schools, etc.)</li>
                  <li>❌ Don't use common security questions</li>
                </ul>
              </div>

              {/* Good Examples */}
              <details className="bg-gray-700/30 rounded-lg p-4">
                <summary className="cursor-pointer font-semibold text-green-400">
                  ✅ Good Examples
                </summary>
                <ul className="text-sm text-gray-300 mt-2 space-y-1">
                  <li>• "What phrase did I invent as a child?"</li>
                  <li>• "What word did I whisper before my first exam?"</li>
                  <li>• "What nickname did I give my imaginary friend?"</li>
                </ul>
              </details>

              {/* Bad Examples */}
              <details className="bg-gray-700/30 rounded-lg p-4">
                <summary className="cursor-pointer font-semibold text-red-400">
                  ❌ Bad Examples
                </summary>
                <ul className="text-sm text-gray-300 mt-2 space-y-1">
                  <li>• "What is my mother's name?" (Public)</li>
                  <li>• "What school did I go to?" (Searchable)</li>
                  <li>• "What is my birthday?" (Can be found)</li>
                </ul>
              </details>

              {/* Question Input */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Secret Question *
                </label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="What phrase did I invent as a child?"
                  rows={3}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                />
                {questionValidation && (
                  <div className="mt-2 space-y-1">
                    {questionValidation.errors?.map((err: string, i: number) => (
                      <p key={i} className="text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {err}
                      </p>
                    ))}
                    {questionValidation.warnings?.map((warn: string, i: number) => (
                      <p key={i} className="text-xs text-yellow-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {warn}
                      </p>
                    ))}
                    {questionValidation.valid &&
                      !questionValidation.warnings && (
                        <p className="text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Question looks good!
                        </p>
                      )}
                  </div>
                )}
              </div>

              {/* Answer Input */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Secret Answer *
                </label>
                <div className="relative">
                  <input
                    type={showAnswer ? "text" : "password"}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Your unique answer"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => setShowAnswer(!showAnswer)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showAnswer ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {answerValidation && (
                  <div className="mt-2 space-y-1">
                    {answerValidation.errors?.map((err: string, i: number) => (
                      <p key={i} className="text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {err}
                      </p>
                    ))}
                    {answerValidation.warnings?.map((warn: string, i: number) => (
                      <p key={i} className="text-xs text-yellow-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {warn}
                      </p>
                    ))}
                    {answerValidation.valid && !answerValidation.warnings && (
                      <p className="text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Answer looks good!
                      </p>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={generateSecret}
                disabled={
                  !question ||
                  !answer ||
                  !questionValidation?.valid ||
                  !answerValidation?.valid
                }
                className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
              >
                Generate Secret Hash
              </button>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === "confirm" && secretHash && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">Confirm Setup</h2>
                <p className="text-gray-400 mb-4">
                  Review and confirm your ENS identity setup
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-700/30 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">ENS Name</p>
                  <p className="font-mono">{ensName}</p>
                </div>

                <div className="bg-gray-700/30 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Wallet Address</p>
                  <p className="font-mono text-sm break-all">{walletAddress}</p>
                </div>

                <div className="bg-gray-700/30 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">Secret Hash</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm break-all flex-1">
                      {secretHash.hash.slice(0, 20)}...
                    </p>
                    <button
                      onClick={() => copyToClipboard(secretHash.hash)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500 rounded-lg p-4">
                <p className="font-semibold text-blue-400 mb-2">
                  📥 Backup File
                </p>
                <p className="text-sm text-gray-300">
                  After confirmation, your recovery salt will be downloaded.
                  <strong className="text-white"> Keep this file safe!</strong> You'll
                  need it to recover your wallet.
                </p>
              </div>

              <button
                onClick={setupIdentity}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
              >
                {loading ? "Setting up..." : "Confirm & Setup"}
              </button>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === "complete" && (
            <div className="text-center space-y-6">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold">Setup Complete!</h2>
              <p className="text-gray-400">
                Your ENS identity has been successfully setup
              </p>

              <div className="bg-green-500/10 border border-green-500 rounded-lg p-4">
                <p className="font-semibold text-green-400 mb-2">
                  ✅ What's been set up:
                </p>
                <ul className="text-sm text-gray-300 space-y-1 text-left">
                  <li>✓ ENS name bound to wallet address</li>
                  <li>✓ Recovery secret hash stored on-chain</li>
                  <li>✓ Backup file downloaded</li>
                </ul>
              </div>

              <div className="space-y-3">
                <a
                  href={`https://sepolia.app.ens.domains/${ensName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold"
                >
                  View on ENS App <ExternalLink className="inline w-4 h-4 ml-2" />
                </a>
                <a
                  href="/dashboard"
                  className="block w-full bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-semibold"
                >
                  Go to Dashboard
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Using ENS on Sepolia Testnet •{" "}
            <a
              href="https://docs.ens.domains"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              Learn More
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
