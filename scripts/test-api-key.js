/**
 * Test Circle API Key validity
 */
require('dotenv').config();
const axios = require('axios');

async function testAPIKey() {
  const apiKey = process.env.CIRCLE_API_KEY;
  
  console.log('🧪 Testing Circle API Key...\n');
  console.log(`API Key: ${apiKey?.substring(0, 30)}...\n`);

  try {
    // Test 1: Get entity public key (requires valid API key)
    console.log('📍 Test 1: Fetching entity public key...');
    const response = await axios.get(
      'https://api.circle.com/v1/w3s/config/entity/publicKey',
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ API Key is valid!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ API Key test failed');
    console.log(`Status: ${error.response?.status}`);
    console.log(`Message: ${error.response?.data?.message || error.message}`);
    
    if (error.response?.status === 401) {
      console.log('\n⚠️  Possible issues:');
      console.log('   1. API key is invalid or revoked');
      console.log('   2. API key is not for Developer-Controlled Wallets');
      console.log('   3. API key format is incorrect\n');
      console.log('📖 Please verify:');
      console.log('   • Visit: https://console.circle.com');
      console.log('   • Go to: Developer Controlled Wallets → API Keys');
      console.log('   • Create a NEW API key');
      console.log('   • Format should be: TEST_API_KEY:xxxxx:yyyyy or LIVE_API_KEY:xxxxx:yyyyy');
    }
    
    console.log('\nFull error:',error.response?.data || error.message);
  }
}

testAPIKey();
