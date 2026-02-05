/**
 * Use Existing Circle Setup
 * Works with already-registered entity secret
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { initiateDeveloperControlledWalletsClient } = require("@circle-fin/developer-controlled-wallets");

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
  console.log("🔷 Circle Wallets Setup (Using Existing Registration)");
  console.log("═══════════════════════════════════════════\n");

  // Check credentials
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.error("❌ Missing credentials in .env:");
    console.error("   - CIRCLE_API_KEY");
    console.error("   - CIRCLE_ENTITY_SECRET");
    process.exit(1);
  }

  console.log("✅ Credentials found");
  console.log("🔑 API Key:", apiKey.substring(0, 30) + "...");
  console.log("🔐 Entity Secret:", entitySecret.substring(0, 20) + "...\n");

  try {
    // Initialize client with existing credentials
    console.log("🔧 Initializing Circle SDK...");
    const client = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });
    console.log("✅ SDK initialized\n");

    // Try to list existing wallet sets first
    console.log("🔍 Checking for existing wallet sets...");
    try {
      const existingSetsResponse = await client.listWalletSets();
      const existingSets = existingSetsResponse.data?.walletSets || [];
      
      if (existingSets.length > 0) {
        console.log(`✅ Found ${existingSets.length} existing wallet set(s)\n`);
        
        const walletSet = existingSets[0];
        console.log("📁 Using existing Wallet Set:");
        console.log("   ID:", walletSet.id);
        console.log("   Custody Type:", walletSet.custodyType);
        console.log("   Created:", walletSet.createDate, "\n");

        // Update .env
        await updateEnvFile({
          CIRCLE_WALLET_SET_ID: walletSet.id,
        });

        // Check for existing wallets
        console.log("🔍 Checking for existing wallets...");
        const walletsResponse = await client.listWallets({});
        const existingWallets = walletsResponse.data?.wallets || [];

        if (existingWallets.length > 0) {
          console.log(`✅ Found ${existingWallets.length} existing wallet(s)\n`);
          
          const wallet = existingWallets[0];
          console.log("💼 Primary Wallet:");
          console.log("   Address:", wallet.address);
          console.log("   ID:", wallet.id);
          console.log("   Blockchain:", wallet.blockchain);
          console.log("   Type:", wallet.accountType);
          console.log("   State:", wallet.state, "\n");

          // Update .env
          await updateEnvFile({
            CIRCLE_WALLET_ID: wallet.id,
            CIRCLE_WALLET_ADDRESS: wallet.address,
            CIRCLE_WALLET_BLOCKCHAIN: wallet.blockchain,
          });

          console.log("═══════════════════════════════════════════");
          console.log("🎉 Setup Complete (Using Existing Wallets)!\n");
          console.log("📝 Your .env has been updated");
          console.log("💰 Wallet Address:", wallet.address);
          console.log(`🌐 Blockchain: ${wallet.blockchain}\n`);
          console.log("Get testnet tokens:");
          console.log("   Visit: https://faucet.circle.com/");
          console.log(`   Select: ${wallet.blockchain}`);
          console.log(`   Address: ${wallet.address}\n`);
          console.log("🚀 Next: npm run dev");
          console.log("═══════════════════════════════════════════");
          return;
        }

        // Create new wallet if none exist
        console.log("📝 No wallets found, creating new wallet...\n");
        
        const blockchainsToTry = [
          { name: "ETH-SEPOLIA", type: "EOA" },
          { name: "MATIC-AMOY", type: "SCA" },
          { name: "AVAX-FUJI", type: "EOA" },
          { name: "ARB-SEPOLIA", type: "EOA" },
        ];

        let createdWallet = null;
        let usedBlockchain = null;

        for (const blockchain of blockchainsToTry) {
          try {
            console.log(`   Trying ${blockchain.name}...`);
            
            const walletsResponse = await client.createWallets({
              idempotencyKey: `wallet-${blockchain.name}-${Date.now()}`,
              walletSetId: walletSet.id,
              blockchains: [blockchain.name],
              count: 1,
              accountType: blockchain.type,
            });

            const wallet = walletsResponse.data?.wallets?.[0];
            if (wallet) {
              createdWallet = wallet;
              usedBlockchain = blockchain.name;
              console.log(`   ✅ Success!\n`);
              break;
            }
          } catch (err) {
            console.log(`   ❌ Not available\n`);
          }
        }

        if (!createdWallet) {
          throw new Error("Could not create wallet on any supported blockchain");
        }

        console.log("💼 Wallet Created:");
        console.log("   Address:", createdWallet.address);
        console.log("   ID:", createdWallet.id);
        console.log("   Blockchain:", usedBlockchain);
        console.log("   State:", createdWallet.state, "\n");

        // Update .env
        await updateEnvFile({
          CIRCLE_WALLET_ID: createdWallet.id,
          CIRCLE_WALLET_ADDRESS: createdWallet.address,
          CIRCLE_WALLET_BLOCKCHAIN: usedBlockchain,
        });

        console.log("═══════════════════════════════════════════");
        console.log("🎉 Setup Complete!\n");
        console.log("📝 Your .env has been updated");
        console.log("💰 Wallet Address:", createdWallet.address);
        console.log(`🌐 Blockchain: ${usedBlockchain}\n`);
        console.log("Get testnet tokens:");
        console.log("   Visit: https://faucet.circle.com/");
        console.log(`   Select: ${usedBlockchain}`);
        console.log(`   Address: ${createdWallet.address}\n`);
        console.log("🚀 Next: npm run dev");
        console.log("═══════════════════════════════════════════");
        return;
      }

      // No existing wallet sets, create new one
      console.log("📝 No wallet sets found, creating new one...\n");

    } catch (listError) {
      console.log("⚠️  Could not list existing sets, will create new one\n");
    }

    // Create new wallet set
    console.log("📁 Creating new Wallet Set...");
    const walletSetResponse = await client.createWalletSet({
      idempotencyKey: `wset-${Date.now()}`,
      name: `NovaVault-${Date.now()}`,
    });

    const walletSet = walletSetResponse.data?.walletSet;
    if (!walletSet) {
      throw new Error("Failed to create wallet set");
    }

    console.log("✅ Wallet Set created");
    console.log("   ID:", walletSet.id, "\n");

    await updateEnvFile({
      CIRCLE_WALLET_SET_ID: walletSet.id,
    });

    // Create wallet
    console.log("💼 Creating Wallet...\n");
    
    const blockchainsToTry = [
      { name: "ETH-SEPOLIA", type: "EOA" },
      { name: "MATIC-AMOY", type: "SCA" },
      { name: "AVAX-FUJI", type: "EOA" },
      { name: "ARB-SEPOLIA", type: "EOA" },
    ];

    let createdWallet = null;
    let usedBlockchain = null;

    for (const blockchain of blockchainsToTry) {
      try {
        console.log(`   Trying ${blockchain.name}...`);
        
        const walletsResponse = await client.createWallets({
          idempotencyKey: `wallet-${blockchain.name}-${Date.now()}`,
          walletSetId: walletSet.id,
          blockchains: [blockchain.name],
          count: 1,
          accountType: blockchain.type,
        });

        const wallet = walletsResponse.data?.wallets?.[0];
        if (wallet) {
          createdWallet = wallet;
          usedBlockchain = blockchain.name;
          console.log(`   ✅ Success!\n`);
          break;
        }
      } catch (err) {
        console.log(`   ❌ Not available\n`);
      }
    }

    if (!createdWallet) {
      throw new Error("Could not create wallet on any supported blockchain");
    }

    console.log("💼 Wallet Created:");
    console.log("   Address:", createdWallet.address);
    console.log("   ID:", createdWallet.id);
    console.log("   Blockchain:", usedBlockchain);
    console.log("   State:", createdWallet.state, "\n");

    await updateEnvFile({
      CIRCLE_WALLET_ID: createdWallet.id,
      CIRCLE_WALLET_ADDRESS: createdWallet.address,
      CIRCLE_WALLET_BLOCKCHAIN: usedBlockchain,
    });

    console.log("═══════════════════════════════════════════");
    console.log("🎉 Setup Complete!\n");
    console.log("📝 Your .env has been updated");
    console.log("💰 Wallet Address:", createdWallet.address);
    console.log(`🌐 Blockchain: ${usedBlockchain}\n`);
    console.log("Get testnet tokens:");
    console.log("   Visit: https://faucet.circle.com/");
    console.log(`   Select: ${usedBlockchain}`);
    console.log(`   Address: ${createdWallet.address}\n`);
    console.log("🚀 Next: npm run dev");
    console.log("═══════════════════════════════════════════");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    
    if (error.response?.data) {
      console.error("\n📋 API Response:");
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.response?.status === 401) {
      console.error("\n🔑 Authentication failed:");
      console.error("   Your entity secret may not match what's registered");
      console.error("   You need to get a NEW API KEY from Circle Console");
      console.error("   Visit: https://console.circle.com/");
    } else if (error.response?.status === 400) {
      console.error("\n⚠️  Invalid request:");
      console.error("   The entity secret might be incorrect");
      console.error("   Get a fresh API key from Circle Console");
    }
    
    console.error("\n💡 SOLUTION:");
    console.error("   1. Go to: https://console.circle.com/");
    console.error("   2. Create a NEW API key");
    console.error("   3. Update CIRCLE_API_KEY in your .env");
    console.error("   4. Run: npm run circle:fresh-setup");
    
    process.exit(1);
  }
}

main();
