/**
 * Fresh Circle Wallets Setup
 * Generates new entity secret, registers it, creates wallet set and wallets
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { 
  generateEntitySecret,
  registerEntitySecretCiphertext,
  initiateDeveloperControlledWalletsClient 
} = require("@circle-fin/developer-controlled-wallets");

async function updateEnvFile(updates) {
  const envPath = path.join(process.cwd(), ".env");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }
  
  fs.writeFileSync(envPath, envContent.trim() + "\n");
}

async function main() {
  console.log("🔷 Fresh Circle Wallets Setup");
  console.log("═══════════════════════════════════════════\n");

  // Check API key
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    console.error("❌ Missing CIRCLE_API_KEY in .env file");
    console.error("   Get one from: https://console.circle.com/");
    process.exit(1);
  }

  console.log("✅ API Key found");
  console.log("🔑", apiKey.substring(0, 30) + "...\n");

  try {
    // Step 1: Generate Entity Secret
    console.log("📝 Step 1: Generating new Entity Secret...");
    
    // Generate 32 random bytes as hex string
    const crypto = require("crypto");
    const entitySecret = crypto.randomBytes(32).toString("hex");
    
    console.log("✅ Entity Secret generated");
    console.log("🔐", entitySecret.substring(0, 20) + "...\n");

    // Step 2: Register Entity Secret
    console.log("🔒 Step 2: Registering Entity Secret with Circle...");
    const recoveryDir = path.join(process.cwd(), "recovery");
    if (!fs.existsSync(recoveryDir)) {
      fs.mkdirSync(recoveryDir, { recursive: true });
    }

    const registrationResponse = await registerEntitySecretCiphertext({
      apiKey: apiKey,
      entitySecret: entitySecret,
      recoveryFileDownloadPath: recoveryDir,
    });

    console.log("✅ Entity Secret registered with Circle");
    console.log("💾 Recovery file saved in:", recoveryDir);
    console.log("⚠️  CRITICAL: Backup this recovery file securely!\n");

    // Update .env with new entity secret
    await updateEnvFile({
      CIRCLE_ENTITY_SECRET: entitySecret,
    });
    console.log("✅ Updated .env with new CIRCLE_ENTITY_SECRET\n");

    // Step 3: Initialize Circle Client
    console.log("🔧 Step 3: Initializing Circle Wallets SDK...");
    const client = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });
    console.log("✅ SDK initialized\n");

    // Step 4: Create Wallet Set
    console.log("📁 Step 4: Creating Wallet Set...");
    const walletSetResponse = await client.createWalletSet({
      idempotencyKey: `wset-${Date.now()}`,
      name: `NovaVault-${Date.now()}`,
    });

    const walletSet = walletSetResponse.data?.walletSet;
    if (!walletSet) {
      throw new Error("Failed to create wallet set");
    }

    console.log("✅ Wallet Set created");
    console.log("   ID:", walletSet.id);
    console.log("   Name:", walletSet.name || "Unnamed");
    console.log("   Custody Type:", walletSet.custodyType);
    console.log("   Created:", walletSet.createDate, "\n");

    // Update .env with wallet set ID
    await updateEnvFile({
      CIRCLE_WALLET_SET_ID: walletSet.id,
    });
    console.log("✅ Updated .env with CIRCLE_WALLET_SET_ID\n");

    // Step 5: Create Wallets on supported blockchains
    console.log("💼 Step 5: Creating Wallets...");
    console.log("   Testing multiple blockchains for compatibility\n");

    const blockchainsToTry = [
      { name: "ETH-SEPOLIA", type: "EOA" },
      { name: "MATIC-AMOY", type: "SCA" },
      { name: "AVAX-FUJI", type: "EOA" },
      { name: "ARB-SEPOLIA", type: "EOA" },
      { name: "BASE-SEPOLIA", type: "EOA" },
    ];

    const createdWallets = [];

    for (const blockchain of blockchainsToTry) {
      try {
        console.log(`   Trying ${blockchain.name} (${blockchain.type})...`);
        
        const walletsResponse = await client.createWallets({
          idempotencyKey: `wallet-${blockchain.name}-${Date.now()}`,
          walletSetId: walletSet.id,
          blockchains: [blockchain.name],
          count: 1,
          accountType: blockchain.type,
        });

        const wallet = walletsResponse.data?.wallets?.[0];
        if (wallet) {
          createdWallets.push({ blockchain: blockchain.name, wallet });
          console.log(`   ✅ Success!`);
          console.log(`      Address: ${wallet.address}`);
          console.log(`      ID: ${wallet.id}\n`);
          break; // Stop after first success
        }
      } catch (err) {
        console.log(`   ❌ ${blockchain.name} not available\n`);
      }
    }

    if (createdWallets.length === 0) {
      throw new Error("Failed to create wallet on any supported blockchain");
    }

    const primaryWallet = createdWallets[0];

    // Update .env with wallet info
    await updateEnvFile({
      CIRCLE_WALLET_ID: primaryWallet.wallet.id,
      CIRCLE_WALLET_ADDRESS: primaryWallet.wallet.address,
      CIRCLE_WALLET_BLOCKCHAIN: primaryWallet.blockchain,
    });
    console.log("✅ Updated .env with wallet details\n");

    // Display summary
    console.log("═══════════════════════════════════════════");
    console.log("🎉 Fresh Setup Complete!\n");
    console.log("📝 Your .env has been updated with:");
    console.log(`   CIRCLE_ENTITY_SECRET=${entitySecret.substring(0, 20)}...`);
    console.log(`   CIRCLE_WALLET_SET_ID=${walletSet.id}`);
    console.log(`   CIRCLE_WALLET_ID=${primaryWallet.wallet.id}`);
    console.log(`   CIRCLE_WALLET_ADDRESS=${primaryWallet.wallet.address}`);
    console.log(`   CIRCLE_WALLET_BLOCKCHAIN=${primaryWallet.blockchain}\n`);

    console.log("💰 Get Testnet Tokens:");
    console.log("   Visit: https://faucet.circle.com/");
    console.log(`   Select: ${primaryWallet.blockchain}`);
    console.log(`   Address: ${primaryWallet.wallet.address}\n`);

    console.log("💾 IMPORTANT: Backup your recovery file!");
    console.log(`   Location: ${recoveryDir}`);
    console.log("   Store it securely offline (USB, encrypted backup)\n");

    console.log("🚀 Next Steps:");
    console.log("   1. Backup recovery file");
    console.log("   2. Get testnet tokens from faucet");
    console.log("   3. Run: npm run dev");
    console.log("═══════════════════════════════════════════");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    
    if (error.response?.data) {
      console.error("   API Response:", JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.response?.status === 401) {
      console.error("\n🔑 Authentication failed:");
      console.error("   - Check API key in Circle Console");
      console.error("   - Verify API key has Developer Wallets permissions");
      console.error("   - Get new key from: https://console.circle.com/");
    } else if (error.response?.status === 409) {
      console.error("\n⚠️  Entity secret already registered");
      console.error("   This means you already have an active setup");
      console.error("   Use the existing entity secret or create new API key");
    } else if (error.response?.status === 400) {
      console.error("\n⚠️  Invalid request:");
      console.error("   - Check API key format and permissions");
      console.error("   - Verify Circle account is properly configured");
      console.error("   - Contact Circle support if issue persists");
    }
    
    console.error("\n💡 Troubleshooting:");
    console.error("   1. Verify API key at: https://console.circle.com/");
    console.error("   2. Check API key permissions include Developer Wallets");
    console.error("   3. Try generating new API key if issues persist");
    console.error("\n📖 See CIRCLE_WALLETS_SETUP.md for detailed guide");
    
    process.exit(1);
  }
}

main();
