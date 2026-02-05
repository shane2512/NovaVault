/**
 * Circle Wallets Setup - Node.js SDK (Official Documentation)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');

function updateEnv(key, value) {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  let updated = false;
  const newLines = lines.map(line => {
    if (line.startsWith(`${key}=`)) {
      updated = true;
      return `${key}=${value}`;
    }
    return line;
  });
  
  if (!updated) {
    newLines.push(`${key}=${value}`);
  }
  
  fs.writeFileSync(envPath, newLines.join('\n'));
}

async function main() {
  console.log('🔷 Circle Wallets Setup (Node.js SDK)');
  console.log('═══════════════════════════════════════════\n');

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.log('❌ Missing credentials in .env');
    console.log('   CIRCLE_API_KEY');
    console.log('   CIRCLE_ENTITY_SECRET');
    return 1;
  }

  console.log('✅ Credentials loaded');
  console.log(`🔑 API Key: ${apiKey.substring(0, 30)}...`);
  console.log(`🔐 Entity Secret: ${entitySecret.substring(0, 20)}...\n`);

  try {
    // Initialize client following Circle's documentation
    console.log('🔧 Initializing Circle SDK client...');
    const circleClient = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });
    console.log('✅ Client initialized\n');

    // Step 1: Create Wallet Set
    console.log('📁 Step 1: Creating Wallet Set...');
    const walletSetResponse = await circleClient.createWalletSet({
      name: `NovaVault-${Date.now()}`,
    });

    const walletSet = walletSetResponse.data?.walletSet;
    if (!walletSet) {
      console.log('❌ Failed to create wallet set');
      console.log(JSON.stringify(walletSetResponse, null, 2));
      return 1;
    }

    console.log('✅ Wallet Set created!');
    console.log(`   ID: ${walletSet.id}`);
    console.log(`   Custody Type: ${walletSet.custodyType}\n`);

    updateEnv('CIRCLE_WALLET_SET_ID', walletSet.id);

    // Step 2: Create Wallets
    console.log('💼 Step 2: Creating Wallets...');

    const blockchains = [
      { chain: 'MATIC-AMOY', type: 'SCA' },
      { chain: 'ETH-SEPOLIA', type: 'EOA' },
      { chain: 'AVAX-FUJI', type: 'EOA' },
      { chain: 'ARB-SEPOLIA', type: 'EOA' },
    ];

    let wallet = null;

    for (const { chain, type } of blockchains) {
      try {
        console.log(`   Trying ${chain} (${type})...`);

        const walletResponse = await circleClient.createWallets({
          accountType: type,
          blockchains: [chain],
          count: 1,
          walletSetId: walletSet.id,
        });

        if (walletResponse.data?.wallets?.[0]) {
          wallet = walletResponse.data.wallets[0];
          console.log(`   ✅ Success!\n`);
          break;
        }
      } catch (error) {
        console.log(`   ❌ Not available\n`);
        continue;
      }
    }

    if (!wallet) {
      console.log('❌ Could not create wallet on any blockchain');
      return 1;
    }

    console.log('💼 Wallet Created:');
    console.log(`   Address: ${wallet.address}`);
    console.log(`   ID: ${wallet.id}`);
    console.log(`   Blockchain: ${wallet.blockchain}`);
    console.log(`   Type: ${wallet.accountType}`);
    console.log(`   State: ${wallet.state}\n`);

    // Update .env
    updateEnv('CIRCLE_WALLET_ID', wallet.id);
    updateEnv('CIRCLE_WALLET_ADDRESS', wallet.address);
    updateEnv('CIRCLE_WALLET_BLOCKCHAIN', wallet.blockchain);

    console.log('═══════════════════════════════════════════');
    console.log('🎉 Setup Complete!\n');
    console.log('📝 .env updated with wallet details\n');
    console.log('💰 Get Testnet Tokens:');
    console.log(`   Visit: https://faucet.circle.com/`);
    console.log(`   Select: ${wallet.blockchain}`);
    console.log(`   Address: ${wallet.address}\n`);
    console.log('🚀 Next: npm run dev');
    console.log('═══════════════════════════════════════════');

    return 0;
  } catch (error) {
    console.log('\n❌ Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error(error);
    return 1;
  }
}

main().then(process.exit);
