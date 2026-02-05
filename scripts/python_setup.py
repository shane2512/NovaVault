"""
Fresh Circle Wallets Setup using Python SDK
"""
import os
from pathlib import Path
from dotenv import load_dotenv, set_key
from circle.web3 import utils
from circle.web3.developer_controlled_wallets import (
    Configuration,
    WalletSetsApi,
    WalletsApi,
    CreateWalletSetRequest,
    CreateWalletRequest
)

# Load environment variables
load_dotenv()

def update_env(key, value):
    env_path = Path('.env')
    set_key(env_path, key, value)

def main():
    print("🔷 Fresh Circle Wallets Setup (Python SDK)")
    print("═══════════════════════════════════════════\n")

    # Get API key
    api_key = os.getenv('CIRCLE_API_KEY')
    if not api_key:
        print("❌ Missing CIRCLE_API_KEY in .env")
        return

    print("✅ API Key found")
    print(f"🔑 {api_key[:30]}...\n")

    try:
        # Step 1: Generate Entity Secret
        print("📝 Step 1: Generating new Entity Secret...")
        import secrets
        entity_secret = secrets.token_hex(32)  # 32 bytes = 64 hex characters
        print(f"✅ Entity Secret generated")
        print(f"🔐 {entity_secret[:20]}...\n")

        # Step 2: Register Entity Secret
        print("🔒 Step 2: Registering Entity Secret with Circle...")
        
        recovery_dir = Path('recovery')
        recovery_dir.mkdir(exist_ok=True)
        
        result = utils.register_entity_secret_ciphertext(
            api_key=api_key,
            entity_secret=entity_secret,
            recoveryFileDownloadPath=str(recovery_dir)
        )
        
        print("✅ Entity Secret registered!")
        print(f"💾 Recovery file saved in: {recovery_dir}\n")
        
        # Update .env
        update_env('CIRCLE_ENTITY_SECRET', entity_secret)
        print("✅ Updated .env with CIRCLE_ENTITY_SECRET\n")

        # Step 3: Initialize Client
        print("🔧 Step 3: Initializing Circle SDK...")
        config = Configuration(api_key=api_key, entity_secret=entity_secret)
        wallet_sets_api = WalletSetsApi(config)
        wallets_api = WalletsApi(config)
        print("✅ SDK initialized\n")

        # Step 4: Create Wallet Set
        print("📁 Step 4: Creating Wallet Set...")
        wallet_set_request = CreateWalletSetRequest.from_dict({
            "name": f"NovaVault-{os.urandom(4).hex()}"
        })
        wallet_set_response = wallet_sets_api.create_wallet_set(wallet_set_request)
        
        wallet_set = wallet_set_response.data.wallet_set
        print(f"✅ Wallet Set created")
        print(f"   ID: {wallet_set.id}")
        print(f"   Name: {wallet_set.name if hasattr(wallet_set, 'name') else 'Unnamed'}")
        print(f"   Created: {wallet_set.create_date}\n")
        
        update_env('CIRCLE_WALLET_SET_ID', wallet_set.id)
        print("✅ Updated .env with CIRCLE_WALLET_SET_ID\n")

        # Step 5: Create Wallets
        print("💼 Step 5: Creating Wallets...")
        print("   Testing blockchains...\n")
        
        blockchains = [
            ('MATIC-AMOY', 'SCA'),
            ('ETH-SEPOLIA', 'EOA'),
            ('AVAX-FUJI', 'EOA'),
            ('ARB-SEPOLIA', 'EOA'),
        ]
        
        wallet = None
        used_blockchain = None
        
        for blockchain, account_type in blockchains:
            try:
                print(f"   Trying {blockchain} ({account_type})...")
                
                wallet_request = CreateWalletRequest.from_dict({
                    "walletSetId": wallet_set.id,
                    "blockchains": [blockchain],
                    "count": 1,
                    "accountType": account_type
                })
                wallet_response = wallets_api.create_wallet(wallet_request)
                
                if wallet_response.data and wallet_response.data.wallets:
                    wallet = wallet_response.data.wallets[0]
                    used_blockchain = blockchain
                    print(f"   ✅ Success!\n")
                    break
            except Exception as e:
                print(f"   ❌ Not available\n")
        
        if not wallet:
            print("❌ Could not create wallet on any blockchain")
            return
        
        print("💼 Wallet Created:")
        print(f"   Address: {wallet.address}")
        print(f"   ID: {wallet.id}")
        print(f"   Blockchain: {wallet.blockchain}")
        print(f"   Type: {wallet.account_type}")
        print(f"   State: {wallet.state}\n")
        
        # Update .env
        update_env('CIRCLE_WALLET_ID', wallet.id)
        update_env('CIRCLE_WALLET_ADDRESS', wallet.address)
        update_env('CIRCLE_WALLET_BLOCKCHAIN', wallet.blockchain)
        
        print("═══════════════════════════════════════════")
        print("🎉 Setup Complete!\n")
        print("📝 Your .env has been updated with:")
        print(f"   CIRCLE_ENTITY_SECRET={entity_secret[:20]}...")
        print(f"   CIRCLE_WALLET_SET_ID={wallet_set.id}")
        print(f"   CIRCLE_WALLET_ID={wallet.id}")
        print(f"   CIRCLE_WALLET_ADDRESS={wallet.address}")
        print(f"   CIRCLE_WALLET_BLOCKCHAIN={wallet.blockchain}\n")
        
        print("💰 Get Testnet Tokens:")
        print("   Visit: https://faucet.circle.com/")
        print(f"   Select: {wallet.blockchain}")
        print(f"   Address: {wallet.address}\n")
        
        print("🚀 Next: npm run dev")
        print("═══════════════════════════════════════════")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}\n")
        
        error_str = str(e).lower()
        
        if 'already been set' in error_str:
            print("⚠️  Entity secret already registered for this account")
            print("   Your Circle account already has an entity secret.")
            print("\n💡 SOLUTION:")
            print("   Contact Circle Support to reset your entity secret")
            print("   OR create a new Circle developer account")
        elif '401' in error_str or 'unauthorized' in error_str:
            print("🔑 Authentication failed")
            print("   - Verify API key is correct")
            print("   - Check API key has Developer Wallets permissions")
        elif '400' in error_str or 'invalid' in error_str:
            print("⚠️  Invalid request")
            print("   - Check API key format")
            print("   - Verify API key permissions in Console")
        
        print("\n📞 Need help? Contact Circle Support:")
        print("   https://circle.com/support")
        return 1

if __name__ == "__main__":
    main()
