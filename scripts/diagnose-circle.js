/**
 * Diagnose Circle Wallets Configuration
 * Tests API key and entity secret validity
 */

require("dotenv").config();

console.log("🔍 Circle Wallets Configuration Diagnostic");
console.log("═══════════════════════════════════════════\n");

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

console.log("📋 Checking Environment Variables...\n");

// Check API Key
if (!apiKey) {
  console.error("❌ CIRCLE_API_KEY is not set");
} else {
  console.log("✅ CIRCLE_API_KEY found");
  console.log(`   Length: ${apiKey.length} characters`);
  console.log(`   Starts with: ${apiKey.substring(0, 20)}...`);
  
  if (apiKey.startsWith("TEST_API_KEY:")) {
    console.log("   ✅ Format: Testnet key (correct)");
  } else if (apiKey.startsWith("LIVE_API_KEY:")) {
    console.log("   ✅ Format: Mainnet key (correct)");
  } else {
    console.log("   ❌ Format: Invalid (must start with TEST_API_KEY: or LIVE_API_KEY:)");
  }
}

console.log("");

// Check Entity Secret
if (!entitySecret) {
  console.error("❌ CIRCLE_ENTITY_SECRET is not set");
} else {
  console.log("✅ CIRCLE_ENTITY_SECRET found");
  console.log(`   Length: ${entitySecret.length} characters`);
  console.log(`   Preview: ${entitySecret.substring(0, 16)}...`);
  
  if (/^[a-f0-9]{64}$/i.test(entitySecret)) {
    console.log("   ✅ Format: Valid (64 hex characters)");
  } else {
    console.log("   ❌ Format: Invalid (expected 64 hex characters)");
  }
}

console.log("\n═══════════════════════════════════════════");
console.log("🔑 Next Steps:\n");

if (!apiKey || !apiKey.startsWith("TEST_API_KEY:") && !apiKey.startsWith("LIVE_API_KEY:")) {
  console.log("1. Get Real API Key:");
  console.log("   → Visit https://console.circle.com/");
  console.log("   → Sign up and verify email");
  console.log("   → Go to Keys section");
  console.log("   → Create new API key");
  console.log("   → Copy to .env as CIRCLE_API_KEY\n");
}

if (!entitySecret || !/^[a-f0-9]{64}$/i.test(entitySecret)) {
  console.log("2. Generate Entity Secret:");
  console.log("   → Run: npm run circle:generate-secret");
  console.log("   → Copy output to .env as CIRCLE_ENTITY_SECRET\n");
}

console.log("3. Register Entity Secret:");
console.log("   → Visit https://console.circle.com/");
console.log("   → Go to Configurator section");
console.log("   → Encrypt and register your entity secret");
console.log("   → Save recovery file securely\n");

console.log("4. Try Setup Again:");
console.log("   → Run: npm run circle:setup\n");

console.log("═══════════════════════════════════════════");

console.log("\n⚠️  IMPORTANT: The API key you have appears to be a placeholder.");
console.log("   Real Circle API keys must be obtained from:");
console.log("   https://console.circle.com/");
