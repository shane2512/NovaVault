/**
 * Recover Entity Secret from Recovery File
 */

const fs = require("fs");
const path = require("path");

function updateEnvFile(updates) {
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

function main() {
  console.log("🔐 Entity Secret Recovery");
  console.log("═══════════════════════════════════════════\n");

  const recoveryDir = path.join(process.cwd(), "recovery");
  
  if (!fs.existsSync(recoveryDir)) {
    console.error("❌ No recovery directory found");
    process.exit(1);
  }

  const recoveryFiles = fs.readdirSync(recoveryDir).filter(f => f.endsWith(".dat"));
  
  if (recoveryFiles.length === 0) {
    console.error("❌ No recovery files found");
    process.exit(1);
  }

  console.log(`✅ Found ${recoveryFiles.length} recovery file(s)\n`);
  
  // Read the most recent recovery file
  const recoveryFile = path.join(recoveryDir, recoveryFiles[recoveryFiles.length - 1]);
  console.log("📄 Reading:", recoveryFile);
  
  const recoveryData = fs.readFileSync(recoveryFile, "utf8");
  
  try {
    const data = JSON.parse(recoveryData);
    
    if (data.entitySecret) {
      console.log("\n✅ Entity Secret found in recovery file!");
      console.log("🔐 Entity Secret:", data.entitySecret.substring(0, 20) + "...\n");
      
      // Update .env
      updateEnvFile({
        CIRCLE_ENTITY_SECRET: data.entitySecret,
      });
      
      console.log("✅ Updated .env with recovered entity secret\n");
      console.log("═══════════════════════════════════════════");
      console.log("🎉 Recovery Complete!\n");
      console.log("🚀 Next step: npm run circle:use-existing");
      console.log("═══════════════════════════════════════════");
    } else {
      console.error("\n❌ No entity secret found in recovery file");
      console.log("\nRecovery file contents:");
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("\n❌ Could not parse recovery file as JSON");
    console.log("\nRecovery file contents (first 500 chars):");
    console.log(recoveryData.substring(0, 500));
    
    // Try to extract entity secret with regex
    const match = recoveryData.match(/[a-f0-9]{64}/i);
    if (match) {
      console.log("\n✅ Found potential entity secret!");
      console.log("🔐", match[0].substring(0, 20) + "...");
      
      updateEnvFile({
        CIRCLE_ENTITY_SECRET: match[0],
      });
      
      console.log("\n✅ Updated .env with recovered entity secret\n");
      console.log("═══════════════════════════════════════════");
      console.log("🎉 Recovery Complete!\n");
      console.log("🚀 Next step: npm run circle:use-existing");
      console.log("═══════════════════════════════════════════");
    }
  }
}

main();
