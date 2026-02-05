"""
Circle Wallets Setup - Following Official Documentation
"""
import os
from pathlib import Path
from dotenv import load_dotenv, set_key
import circle.web3.developer_controlled_wallets as developer_controlled_wallets

# Load environment variables
load_dotenv()

def update_env(key, value):
    env_path = Path('.env')
    set_key(env_path, key, value)

def main():
    print("🔷 Circle Wallets Setup (Official SDK Method)")
    print("═══════════════════════════════════════════\n")

    # Get credentials
    api_key = os.getenv('CIRCLE_API_KEY')
    entity_secret = os.getenv('CIRCLE_ENTITY_SECRET')

    if not api_key or not entity_secret:
        print("❌ Missing credentials in .env")
        print("   CIRCLE_API_KEY")
        print("   CIRCLE_ENTITY_SECRET")
        return 1

    print("✅ Credentials loaded")
    print(f"🔑 API Key: {api_key[:30]}...")
    print(f"🔐 Entity Secret: {entity_secret[:20]}...\n")

    try:
        # Initialize client following Circle's documentation
        print("🔧 Initializing Circle SDK client...")
        
        # Properly configure the SDK according to Circle docs
        configuration = developer_controlled_wallets.Configuration()
        configuration.api_key['Authorization'] = f'Bearer {api_key}'
        
        client = developer_controlled_wallets.ApiClient(configuration)
        client.configuration.entity_secret = entity_secret
        
        print("✅ Client initialized\n")

        # Step 1: Create Wallet Set
        print("📁 Step 1: Creating Wallet Set...")
        wallet_sets_api = developer_controlled_wallets.WalletSetsApi(client)
        
        wallet_set_request = developer_controlled_wallets.CreateWalletSetRequest.from_dict({
            "name": f"NovaVault-{os.urandom(4).hex()}"
        })
        
        wallet_set_response = wallet_sets_api.create_wallet_set(wallet_set_request)
        wallet_set = wallet_set_response.data.wallet_set
        
        print(f"✅ Wallet Set created!")
        print(f"   ID: {wallet_set.id}")
        print(f"   Custody Type: {wallet_set.custody_type}\n")
        
        update_env('CIRCLE_WALLET_SET_ID', wallet_set.id)

        # Step 2: Create Wallets
        print("💼 Step 2: Creating Wallets...")
        wallets_api = developer_controlled_wallets.WalletsApi(client)
        
        # Try different blockchains
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
                
                wallet_request = developer_controlled_wallets.CreateWalletRequest.from_dict({
                    "accountType": account_type,
                    "blockchains": [blockchain],
                    "count": 1,
                    "walletSetId": wallet_set.id
                })
                
                wallet_response = wallets_api.create_wallet(wallet_request)
                
                if wallet_response.data and wallet_response.data.wallets:
                    wallet = wallet_response.data.wallets[0]
                    used_blockchain = blockchain
                    print(f"   ✅ Success!\n")
                    break
                    
            except developer_controlled_wallets.ApiException as e:
                print(f"   ❌ Not available\n")
                continue
        
        if not wallet:
            print("❌ Could not create wallet on any blockchain")
            return 1
        
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
        print(f"📝 .env updated with wallet details\n")
        print("💰 Get Testnet Tokens:")
        print(f"   Visit: https://faucet.circle.com/")
        print(f"   Select: {wallet.blockchain}")
        print(f"   Address: {wallet.address}\n")
        print("🚀 Next: npm run dev")
        print("═══════════════════════════════════════════")
        
        return 0
        
    except developer_controlled_wallets.ApiException as e:
        print(f"\n❌ API Exception: {e}\n")
        print(f"Status: {e.status}")
        print(f"Reason: {e.reason}")
        if e.body:
            print(f"Body: {e.body}")
        return 1
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}\n")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit(main())
