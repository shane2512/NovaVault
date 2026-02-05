"""
Use Existing Entity Secret with Python SDK
"""
import os
from pathlib import Path
from dotenv import load_dotenv, set_key
from circle.web3.developer_controlled_wallets import (
    Configuration,
    WalletSetsApi,
    WalletsApi,
    CreateWalletSetRequest,
    CreateWalletRequest,
    ApiClient
)

# Load environment variables
load_dotenv()

def update_env(key, value):
    env_path = Path('.env')
    set_key(env_path, key, value)

def main():
    print("🔷 Circle Wallets Setup (Python - Using Registered Secret)")
    print("═══════════════════════════════════════════\n")

    # Get credentials
    api_key = os.getenv('CIRCLE_API_KEY')
    entity_secret = os.getenv('CIRCLE_ENTITY_SECRET')

    if not api_key or not entity_secret:
        print("❌ Missing credentials in .env")
        return

    print("✅ Credentials found")
    print(f"🔑 API Key: {api_key[:30]}...")
    print(f"🔐 Entity Secret: {entity_secret[:20]}...\n")

    try:
        # Initialize API client
        print("🔧 Initializing Circle SDK...")
        config = Configuration()
        # Set API key in header format
        config.api_key['Authorization'] = f'Bearer {api_key}'
        config.host = 'https://api.circle.com'
        
        api_client = ApiClient(configuration=config)
        api_client.configuration.entity_secret = entity_secret
        
        wallet_sets_api = WalletSetsApi(api_client)
        wallets_api = WalletsApi(api_client)
        print("✅ SDK initialized\n")

        # Create Wallet Set
        print("📁 Creating Wallet Set...")
        wallet_set_request = CreateWalletSetRequest.from_dict({
            "name": f"NovaVault-{os.urandom(4).hex()}"
        })
        wallet_set_response = wallet_sets_api.create_wallet_set(wallet_set_request)
        
        wallet_set = wallet_set_response.data.wallet_set
        print(f"✅ Wallet Set created!")
        print(f"   ID: {wallet_set.id}\n")
        
        update_env('CIRCLE_WALLET_SET_ID', wallet_set.id)

        # Create Wallets
        print("💼 Creating Wallets...")
        
        blockchains = [
            ('MATIC-AMOY', 'SCA'),
            ('ETH-SEPOLIA', 'EOA'),
            ('AVAX-FUJI', 'EOA'),
        ]
        
        wallet = None
        
        for blockchain, account_type in blockchains:
            try:
                print(f"   Trying {blockchain}...")
                
                wallet_request = CreateWalletRequest.from_dict({
                    "walletSetId": wallet_set.id,
                    "blockchains": [blockchain],
                    "count": 1,
                    "accountType": account_type
                })
                wallet_response = wallets_api.create_wallet(wallet_request)
                
                if wallet_response.data and wallet_response.data.wallets:
                    wallet = wallet_response.data.wallets[0]
                    print(f"   ✅ Success!\n")
                    break
            except Exception as e:
                print(f"   ❌ Failed\n")
        
        if not wallet:
            print("❌ Could not create wallet")
            return
        
        print("💼 Wallet Created:")
        print(f"   Address: {wallet.address}")
        print(f"   ID: {wallet.id}")
        print(f"   Blockchain: {wallet.blockchain}\n")
        
        update_env('CIRCLE_WALLET_ID', wallet.id)
        update_env('CIRCLE_WALLET_ADDRESS', wallet.address)
        update_env('CIRCLE_WALLET_BLOCKCHAIN', wallet.blockchain)
        
        print("═══════════════════════════════════════════")
        print("🎉 Setup Complete!\n")
        print(f"💰 Get testnet tokens at: https://faucet.circle.com/")
        print(f"   Address: {wallet.address}")
        print(f"   Blockchain: {wallet.blockchain}\n")
        print("🚀 Next: npm run dev")
        print("═══════════════════════════════════════════")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}\n")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
