/**
 * Manual CCTP Integration for Sepolia → Arc Transfer
 * 
 * Based on Circle's official documentation for transferring USDC between EVM chains.
 * This implementation uses Circle MPC wallets to execute CCTP contract calls.
 * 
 * Flow:
 * 1. Approve USDC to TokenMessenger
 * 2. Call depositForBurn to burn USDC on source chain
 * 3. Retrieve attestation from Circle's Iris API
 * 4. Call receiveMessage to mint USDC on destination chain
 * 
 * @see https://developers.circle.com/stablecoins/docs/transfer-usdc-from-ethereum-to-arc
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { randomUUID } from 'crypto';
import { ethers } from 'ethers';

// Contract Addresses (Testnet)
const ETHEREUM_SEPOLIA_USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const ETHEREUM_SEPOLIA_TOKEN_MESSENGER = '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa';
const ARC_TESTNET_MESSAGE_TRANSMITTER = '0xe737e5cebeeba77efe34d4aa090756590b1ce275';

// Domain IDs
const ETHEREUM_SEPOLIA_DOMAIN = 0;
const ARC_TESTNET_DOMAIN = 26;

// Circle Iris API (Attestation Service)
const IRIS_API_URL = 'https://iris-api-sandbox.circle.com';

interface AttestationMessage {
  message: string;
  attestation: string;
  status: string;
}

interface AttestationResponse {
  messages: AttestationMessage[];
}

export interface CCTPTransferParams {
  walletId: string; // Sepolia wallet ID
  arcWalletId: string; // Arc wallet ID (must be from same wallet set)
  amount: string; // USDC amount (e.g., "1.0")
  destinationAddress: string; // Recipient address on Arc
}

/**
 * Complete CCTP transfer from Sepolia to Arc using Circle MPC wallet
 */
export async function transferUSDCToArc(params: CCTPTransferParams): Promise<{
  success: boolean;
  burnTxHash: string;
  mintTxHash: string;
  amount: string;
}> {
  const { walletId, arcWalletId, amount, destinationAddress } = params;

  console.log('🌉 Starting CCTP Transfer: Sepolia → Arc...');
  console.log(`   Amount: ${amount} USDC`);
  console.log(`   Destination: ${destinationAddress}`);
  console.log('');

  const circleClient = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  });

  // Convert amount to smallest unit (6 decimals for USDC)
  const amountInWei = ethers.parseUnits(amount, 6).toString();
  const maxFee = '500'; // 0.0005 USDC

  // Format addresses as bytes32
  const destinationAddressBytes32 = ethers.zeroPadValue(destinationAddress, 32);
  const destinationCallerBytes32 = ethers.ZeroHash; // Allow any address to call receiveMessage

  try {
    // Step 1: Approve USDC
    console.log('📝 Step 1: Approving USDC for TokenMessenger...');
    const approveResponse = await circleClient.createContractExecutionTransaction({
      walletId,
      idempotencyKey: randomUUID(),
      contractAddress: ETHEREUM_SEPOLIA_USDC,
      abiFunctionSignature: 'approve(address,uint256)',
      abiParameters: [
        ETHEREUM_SEPOLIA_TOKEN_MESSENGER,
        '10000000000' // 10,000 USDC allowance
      ],
      fee: {
        type: 'level',
        config: { feeLevel: 'MEDIUM' }
      }
    });

    const approveTxId = approveResponse.data?.id;
    console.log(`   Transaction ID: ${approveTxId}`);
    console.log('   Waiting for confirmation...');

    await waitForTransaction(circleClient, approveTxId!);
    console.log('   ✅ Approval confirmed');
    console.log('');

    // Step 2: Burn USDC on Sepolia
    console.log('🔥 Step 2: Burning USDC on Ethereum Sepolia...');
    console.log(`   Amount: ${amount} USDC`);
    console.log(`   Destination Domain: ${ARC_TESTNET_DOMAIN} (Arc Testnet)`);

    const burnResponse = await circleClient.createContractExecutionTransaction({
      walletId,
      idempotencyKey: randomUUID(),
      contractAddress: ETHEREUM_SEPOLIA_TOKEN_MESSENGER,
      abiFunctionSignature: 'depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)',
      abiParameters: [
        amountInWei,                      // amount
        ARC_TESTNET_DOMAIN.toString(),    // destinationDomain
        destinationAddressBytes32,         // mintRecipient
        ETHEREUM_SEPOLIA_USDC,            // burnToken
        destinationCallerBytes32,          // destinationCaller
        maxFee,                           // maxFee
        '1000'                            // minFinalityThreshold (Fast Transfer)
      ],
      fee: {
        type: 'level',
        config: { feeLevel: 'MEDIUM' }
      }
    });

    const burnTxId = burnResponse.data?.id;
    console.log(`   Transaction ID: ${burnTxId}`);
    console.log('   Waiting for confirmation...');

    const burnResult = await waitForTransaction(circleClient, burnTxId!);
    const burnTxHash = burnResult.txHash;
    
    console.log(`   ✅ Burn confirmed!`);
    console.log(`   TX Hash: ${burnTxHash}`);
    console.log('');

    // Step 3: Retrieve attestation from Circle's Iris API
    console.log('✉️  Step 3: Retrieving attestation from Circle...');
    console.log('   This may take 10-20 seconds...');

    const attestation = await retrieveAttestation(burnTxHash);
    
    console.log('   ✅ Attestation received!');
    console.log('');

    // Step 4: Mint USDC on Arc
    console.log('💎 Step 4: Minting USDC on Arc Testnet...');
    console.log(`   Using Arc wallet: ${arcWalletId}`);
    console.log('   Creating mint transaction...');
    
    // Use the Arc wallet from the wallet set
    try {
      const mintResponse = await circleClient.createContractExecutionTransaction({
        walletId: arcWalletId, // Use Arc wallet ID from wallet set
        idempotencyKey: randomUUID(),
        blockchain: 'ARC-TESTNET',
        contractAddress: ARC_TESTNET_MESSAGE_TRANSMITTER,
        abiFunctionSignature: 'receiveMessage(bytes,bytes)',
        abiParameters: [
          attestation.message,
          attestation.attestation
        ],
        fee: {
          type: 'level',
          config: { feeLevel: 'MEDIUM' }
        }
      });

      const mintTxId = mintResponse.data?.id;
      console.log(`   Transaction ID: ${mintTxId}`);
      console.log('   Waiting for confirmation...');

      const mintResult = await waitForTransaction(circleClient, mintTxId!);
      const mintTxHash = mintResult.txHash;

      console.log(`   ✅ Mint confirmed!`);
      console.log(`   TX Hash: ${mintTxHash}`);
      console.log('');

      console.log('🎉 CCTP Transfer Complete!');
      console.log(`   ${amount} USDC transferred from Sepolia to Arc`);
      console.log(`   Burn TX: ${burnTxHash}`);
      console.log(`   Mint TX: ${mintTxHash}`);

      return {
        success: true,
        burnTxHash,
        mintTxHash,
        amount,
      };
    } catch (mintError: any) {
      console.error('   ❌ Mint transaction failed:', mintError.message);
      throw new Error(
        `Mint failed: ${mintError.message}. ` +
        `Burn TX: ${burnTxHash} - USDC is safe. ` +
        `Verify Arc wallet ${arcWalletId} has sufficient USDC for gas fees.`
      );
    }

  } catch (error: any) {
    console.error('❌ CCTP Transfer failed:', error.message);
    throw error;
  }
}

/**
 * Retrieve attestation from Circle's Iris API
 */
async function retrieveAttestation(
  transactionHash: string
): Promise<AttestationMessage> {
  const url = `${IRIS_API_URL}/v2/messages/${ETHEREUM_SEPOLIA_DOMAIN}?transactionHash=${transactionHash}`;
  
  const maxAttempts = 60; // 5 minutes
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const response = await fetch(url, { method: 'GET' });

      if (!response.ok) {
        if (response.status === 404) {
          // Message not yet available, wait and retry
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        const text = await response.text().catch(() => '');
        console.error(`   ⚠️  API Error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      const data = await response.json() as AttestationResponse;

      if (data?.messages?.[0]?.status === 'complete') {
        return data.messages[0];
      }

      console.log(`   Waiting for attestation... (attempt ${attempts}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error: any) {
      console.error(`   ⚠️  Error fetching attestation: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  throw new Error('Attestation timeout - message not attested after 5 minutes');
}

/**
 * Wait for Circle transaction to be confirmed
 */
async function waitForTransaction(
  client: ReturnType<typeof initiateDeveloperControlledWalletsClient>,
  txId: string
): Promise<{ state: string; txHash: string }> {
  const maxAttempts = 60;
  const delayMs = 5000;

  for (let i = 0; i < maxAttempts; i++) {
    const txResponse = await client.getTransaction({ id: txId });
    const state = txResponse.data?.transaction?.state;
    const txHash = txResponse.data?.transaction?.txHash;

    if (state === 'COMPLETE' || state === 'CONFIRMED') {
      return { state, txHash: txHash || '' };
    }

    if (state === 'FAILED' || state === 'DENIED') {
      const errorReason = txResponse.data?.transaction?.errorReason;
      throw new Error(`Transaction ${state}: ${errorReason || 'Unknown error'}`);
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  throw new Error('Transaction timeout - not confirmed after 5 minutes');
}
