/**
 * Register Entity Secret with Circle
 * Uses Circle SDK's registerEntitySecretCiphertext method
 */

require("dotenv").config();
const { registerEntitySecretCiphertext } = require("@circle-fin/developer-controlled-wallets");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔐 Circle Entity Secret Registration");
  console.log("═══════════════════════════════════════════\n");

  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.error("❌ Missing required environment variables:");
    console.error("   - CIRCLE_API_KEY");
    console.error("   - CIRCLE_ENTITY_SECRET");
    process.exit(1);
  }

  console.log("✅ Environment variables found");
  console.log("🔑 API Key:", apiKey.substring(0, 30) + "...");
  console.log("🔐 Entity Secret:", entitySecret.substring(0, 20) + "...\n");

  try {
    // Create recovery file directory
    const recoveryDir = path.join(process.cwd(), "recovery");
    if (!fs.existsSync(recoveryDir)) {
      fs.mkdirSync(recoveryDir, { recursive: true });
    }

    console.log("🔒 Registering entity secret with Circle...");
    console.log("   This will encrypt and register your entity secret\n");

    const response = await registerEntitySecretCiphertext({
      apiKey: apiKey,
      entitySecret: entitySecret,
      recoveryFileDownloadPath: recoveryDir, // SDK expects directory, not file path
    });

    console.log("✅ Entity Secret Successfully Registered!\n");
    
    if (response.data?.recoveryFile) {
      console.log("💾 Recovery File Saved in:");
      console.log(`   ${recoveryDir}\n`);
      console.log("⚠️  CRITICAL: Store this recovery file securely!");
      console.log("   - Save it to a USB drive or encrypted backup");
      console.log("   - Never commit it to version control");
      console.log("   - It's the ONLY way to reset your Entity Secret\n");
    }

    console.log("═══════════════════════════════════════════");
    console.log("🎉 Registration Complete!\n");
    console.log("📝 Your entity secret is now registered with Circle");
    console.log("🚀 Next step: npm run circle:setup");
    console.log("═══════════════════════════════════════════");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    
    if (error.message.includes("401")) {
      console.error("\n🔑 Authentication failed:");
      console.error("   - Verify API key is correct");
      console.error("   - Check API key is active in Circle Console");
    } else if (error.message.includes("409")) {
      console.error("\n⚠️  Entity secret already registered!");
      console.error("   This entity secret is already in use.");
      console.error("   You can proceed with: npm run circle:setup");
    } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      console.error("\n🌐 Network error:");
      console.error("   - Check internet connection");
      console.error("   - Verify Circle API is accessible");
    } else if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
      console.error("\n🔑 Authentication failed:");
      console.error("   - Verify API key is correct");
      console.error("   - Check API key is active in Circle Console");
      console.error("   - API Key format: TEST_API_KEY:uuid:secret");
    } else {
      console.error("\n⚠️  Unexpected error occurred");
      console.error("   Please try manual registration in Circle Console");
    }
    
    console.error("\n💡 Need help? See CIRCLE_WALLETS_SETUP.md");
    process.exit(1);
  }
}

main();