/**
 * Complete Circle Wallet Setup - Create Wallets
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');

function updateEnv(updates) {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  const updatedLines = lines.map(line => {
    for (const [key, value] of Object.entries(updates)) {
      if (line.startsWith(`${key}=`)) {
        return `${key}=${value}`;
      }
    }
    return line;
  });
  
  fs.writeFileSync(envPath, updatedLines.join('\n'));
}

async function main() {
  console.log('🔷 Complete Circle Wallet Setup\n');

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  const walletSetId = '5b80727f-4df9-5427-a1cc-4650a4201b78'; // From previous creation

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  console.log(`Wallet Set ID: ${walletSetId}\n`);

  // Create wallets for different blockchains
  const walletsToCreate = [
    { blockchain: 'ETH-SEPOLIA', count: 1, name: 'NovaVault-Sepolia' },
    { blockchain: 'MATIC-AMOY', count: 1, name: 'NovaVault-Polygon' },
  ];

  const createdWallets = {};

  for (const config of walletsToCreate) {
    console.log(`\n💼 Creating ${config.name} wallet on ${config.blockchain}...`);
    
    try {
      const response = await client.createWallets({
        accountType: 'SCA',
        blockchains: [config.blockchain],
        count: config.count,
        walletSetId: walletSetId,
      });

      if (response.data?.wallets && response.data.wallets.length > 0) {
        const wallet = response.data.wallets[0];
        console.log(`✅ Wallet created!`);
        console.log(`   ID: ${wallet.id}`);
        console.log(`   Address: ${wallet.address}`);
        console.log(`   Blockchain: ${wallet.blockchain}`);
        
        createdWallets[config.blockchain] = {
          id: wallet.id,
          address: wallet.address,
        };
      }
    } catch (error) {
      console.log(`❌ Error creating ${config.blockchain} wallet:`, error.message);
      console.log('   Status:', error.status);
      console.log('   Code:', error.code);
    }
  }

  // Update .env file
  console.log('\n📝 Updating .env file...');
  const envUpdates = {
    CIRCLE_WALLET_SET_ID: walletSetId,
  };

  if (createdWallets['ETH-SEPOLIA']) {
    envUpdates.CIRCLE_WALLET_ID_ETH = createdWallets['ETH-SEPOLIA'].id;
    envUpdates.CIRCLE_WALLET_ADDRESS_ETH = createdWallets['ETH-SEPOLIA'].address;
  }

  if (createdWallets['MATIC-AMOY']) {
    envUpdates.CIRCLE_WALLET_ID_POLYGON = createdWallets['MATIC-AMOY'].id;
    envUpdates.CIRCLE_WALLET_ADDRESS_POLYGON = createdWallets['MATIC-AMOY'].address;
  }

  updateEnv(envUpdates);

  console.log('\n✅ Setup complete!');
  console.log('\n📋 Summary:');
  console.log(`   Wallet Set ID: ${walletSetId}`);
  for (const [chain, wallet] of Object.entries(createdWallets)) {
    console.log(`   ${chain}:`);
    console.log(`     - ID: ${wallet.id}`);
    console.log(`     - Address: ${wallet.address}`);
  }
}

main().catch(console.error);
