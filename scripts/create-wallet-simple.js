/**
 * Simple Circle Wallet Creation Test
 */
require('dotenv').config();
const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');

async function main() {
  console.log('🔷 Simple Circle Wallet Creation\n');

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  console.log(`API Key: ${apiKey.substring(0, 30)}...`);
  console.log(`Entity Secret: ${entitySecret.substring(0, 20)}...\n`);

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  // Try creating wallet set with minimal parameters
  console.log('Creating wallet set...');
  try {
    const response = await client.createWalletSet({
      name: 'NovaVault-Test',
    });
    console.log('✅ Success!');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log('Status:', error.status);
    console.log('Code:', error.code);
    if (error.response?.data) {
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }

  // Try getting existing wallet sets
  console.log('\n📋 Fetching existing wallet sets...');
  try {
    const walletsResponse = await client.listWalletSets();
    console.log('✅ Success!');
    console.log(JSON.stringify(walletsResponse.data, null, 2));
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

main().catch(console.error);
