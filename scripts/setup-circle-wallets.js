/**
 * Circle Wallets Setup Script
 * Creates wallet set and first wallet on Arc Testnet
 */

require("dotenv").config();
const { initiateDeveloperControlledWalletsClient } = require("@circle-fin/developer-controlled-wallets");

async function main() {
  console.log("🔷 Circle Wallets Setup");
  console.log("═══════════════════════════════════════════\n");

  // Check environment variables
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.error("❌ Missing required environment variables:");
    console.error("   - CIRCLE_API_KEY");
    console.error("   - CIRCLE_ENTITY_SECRET");
    console.error("\n📖 See CIRCLE_WALLETS_SETUP.md for instructions");
    process.exit(1);
  }

  console.log("✅ Environment variables found");
  
  // Validate API key format
  if (!apiKey.startsWith("TEST_API_KEY:") && !apiKey.startsWith("LIVE_API_KEY:")) {
    console.error("❌ Invalid API key format");
    console.error("   Expected: TEST_API_KEY:uuid:secret");
    console.error("   Example: TEST_API_KEY:12345678-1234-1234-1234-123456789abc:yoursecret");
    console.error("\n📖 Get your API key from: https://console.circle.com/");
    process.exit(1);
  }

  // Validate entity secret format (should be 64 hex characters)
  if (!/^[a-f0-9]{64}$/i.test(entitySecret)) {
    console.error("❌ Invalid entity secret format");
    console.error("   Expected: 64 hexadecimal characters (32 bytes)");
    console.error("   Example: 713c72b42884c5585afe38d95e6654e558f9685c4710b53ea635aa647d741c51");
    console.error("\n📖 Generate one with: npm run circle:generate-secret");
    process.exit(1);
  }

  console.log("📡 Initializing Circle Wallets SDK...\n");

  try {
    // Initialize client
    console.log("🔑 API Key:", apiKey.substring(0, 30) + "...");
    console.log("🔐 Entity Secret:", entitySecret.substring(0, 20) + "...\n");
    
    const client = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });

    // Step 1: Create Wallet Set
    console.log("📁 Step 1: Creating Wallet Set...");
    
    let walletSet;
    try {
      // Simplified request - try without name first
      console.log("   Attempting with minimal parameters...\n");
      const walletSetResponse = await client.createWalletSet({
        idempotencyKey: `wset${Date.now()}`,
      });

      walletSet = walletSetResponse.data?.walletSet;
      if (!walletSet) {
        throw new Error("Failed to create wallet set - no data returned");
      }

      console.log("✅ Wallet Set Created!");
      console.log(`   ID: ${walletSet.id}`);
      console.log(`   Name: ${walletSet.name}\n`);

    } catch (walletSetError) {
      console.error("   Failed:", walletSetError.message);
      if (walletSetError.response?.data) {
        console.error("   Details:", JSON.stringify(walletSetError.response.data, null, 2));
      }
      throw walletSetError;
    }

    // Step 2: Create Wallet
    console.log("💼 Step 2: Creating Wallet...");
    console.log("   Testing blockchain support...\n");
    
    // Try different blockchains to find supported ones
    const blockchains = ["ARC-TESTNET", "ETH-SEPOLIA", "MATIC-AMOY", "AVAX-FUJI"];
    let wallet = null;
    let usedBlockchain = null;
    
    for (const blockchain of blockchains) {
      try {
        console.log(`   Trying: ${blockchain}...`);
        const walletsResponse = await client.createWallets({
          idempotencyKey: `wallet-${blockchain}-${Date.now()}`,
          walletSetId: walletSet.id,
          blockchains: [blockchain],
          count: 1,
          accountType: "EOA",
        });

        wallet = walletsResponse.data?.wallets?.[0];
        if (wallet) {
          usedBlockchain = blockchain;
          console.log(`   ✅ Success with ${blockchain}!\n`);
          break;
        }
      } catch (err) {
        console.log(`   ❌ ${blockchain} not supported\n`);
      }
    }
    
    if (!wallet) {
      throw new Error("No supported blockchain found. Arc Testnet and common testnets all failed.");
    }
    
    console.log("✅ Wallet Created!");
    console.log(`   Address: ${wallet.address}`);
    console.log(`   ID: ${wallet.id}`);
    console.log(`   Blockchain: ${wallet.blockchain}`);
    console.log(`   State: ${wallet.state}\n`);
    
    if (usedBlockchain !== "ARC-TESTNET") {
      console.log("⚠️  Note: Arc Testnet is not yet supported by Circle");
      console.log(`   Created wallet on ${usedBlockchain} instead\n`);
    }

    // Display next steps
    console.log("═══════════════════════════════════════════");
    console.log("🎉 Setup Complete!\n");
    console.log("📝 Add this to your .env file:");
    console.log(`   CIRCLE_WALLET_SET_ID=${walletSet.id}\n`);
    
    if (usedBlockchain === "ARC-TESTNET") {
      console.log("💰 Get testnet USDC:");
      console.log("   1. Visit: https://faucet.circle.com/");
      console.log("   2. Select: Arc Testnet");
      console.log(`   3. Enter: ${wallet.address}\n`);
    } else {
      console.log(`⚠️  Wallet created on ${usedBlockchain}`);
      console.log("   Arc Testnet support coming soon from Circle\n");
      console.log("💰 Get testnet tokens:");
      console.log(`   1. Visit appropriate faucet for ${usedBlockchain}`);
      console.log(`   2. Enter: ${wallet.address}\n`);
    }
    
    console.log("🚀 Next: npm run dev");
    console.log("═══════════════════════════════════════════");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    
    if (error.response?.data) {
      console.error("   API Response:", JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.response?.status === 401) {
      console.error("\n🔑 Authentication failed. Check:");
      console.error("   1. API key is correct (from https://console.circle.com/)");
      console.error("   2. API key is active and not expired");
      console.error("   3. Entity secret matches what was registered");
    } else if (error.response?.status === 400) {
      console.error("\n⚠️  Bad request. Common issues:");
      console.error("   1. Entity secret not registered in Circle Console");
      console.error("   2. API key format incorrect");
      console.error("   3. Blockchain not supported (Arc Testnet may not be available yet)");
      console.error("\n💡 Try:");
      console.error("   - Verify entity secret is registered: npm run circle:register-secret");
      console.error("   - Check Circle's supported blockchains documentation");
    }
    
    console.error("\n📖 See CIRCLE_WALLETS_SETUP.md for detailed instructions");
    process.exit(1);
  }
}

main();
