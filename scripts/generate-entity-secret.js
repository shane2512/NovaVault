/**
 * Generate Entity Secret for Circle Wallets
 * Creates a secure 32-byte hex string
 */

const crypto = require("crypto");

console.log("🔐 Circle Wallets Entity Secret Generator");
console.log("═══════════════════════════════════════════\n");

// Generate 32 bytes of randomness
const entitySecret = crypto.randomBytes(32).toString("hex");

console.log("✅ Entity Secret Generated:\n");
console.log(`   ${entitySecret}\n`);
console.log("⚠️  SECURITY WARNINGS:");
console.log("   - Store this securely (password manager)");
console.log("   - Never commit to Git");
console.log("   - Never share via email/Slack");
console.log("   - Keep recovery file offline\n");
console.log("📝 Add to .env:");
console.log(`   CIRCLE_ENTITY_SECRET=${entitySecret}\n`);
console.log("═══════════════════════════════════════════");
