# NovaVault - Recoverable DeFi Smart Wallet

**Phase 1: Basic Smart Wallet** ✅ COMPLETE

A cross-chain, recoverable smart wallet built on Arc Network with USDC-native transactions.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file (or copy from `.env.example`):

```env
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002
PRIVATE_KEY=your_private_key_without_0x_prefix
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

**Get testnet USDC**: https://faucet.circle.com/

### 3. Compile Contracts

```bash
npm run compile
```

✅ **Result**: 8 Solidity files compiled successfully

### 4. Run Tests

```bash
npm test
```

✅ **Result**: 27 tests passing

### 5. Deploy to Arc Testnet

```bash
npm run deploy
```

### 6. Run Frontend

```bash
npm run dev
```

Visit http://localhost:3000

---

## Test Results

**All 27 Tests Passing** ✅

- ✅ Deployment (3 tests)
- ✅ USDC Deposits (4 tests)
- ✅ USDC Withdrawals (5 tests)
- ✅ USDC Transfers (6 tests)
- ✅ Ownership Management (5 tests)
- ✅ Balance Queries (1 test)
- ✅ Edge Cases (3 tests)

---

## Architecture

### Smart Contract
- **File**: `contracts/arc/SmartWallet.sol`
- **Network**: Arc Testnet (Chain ID: 5042002)
- **USDC Address**: `0x3600000000000000000000000000000000000000` (✅ verified)
- **Compiler**: Solidity 0.8.24
- **Security**: OpenZeppelin libraries, ReentrancyGuard

### Features
✅ Deposit USDC (native gas token)  
✅ Withdraw USDC to owner  
✅ Send USDC to any address  
✅ ERC-20 token support  
✅ Ownership management  
✅ Balance queries  
✅ Reentrancy protection  

### Frontend Pages
- `/` - Landing page
- `/setup` - Deploy wallet (RainbowKit + wagmi)
- `/dashboard` - Manage wallet (deposit/send/withdraw)

---

## Verified Information

**Arc Network Testnet** (from https://docs.arc.network/):
- Chain ID: 5042002
- RPC: https://rpc.testnet.arc.network
- Explorer: https://testnet.arcscan.app
- Native Gas: USDC (18 decimals native, 6 decimals ERC-20 interface)

**Contract Addresses** (✅ verified from docs.arc.network/arc/references/contract-addresses):
- USDC: `0x3600000000000000000000000000000000000000`
- EURC: `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`

---

## Contract Functions

```solidity
// Deposits
depositUSDC() payable
depositERC20(address token, uint256 amount)

// Withdrawals  
withdrawUSDC(uint256 amount) onlyOwner
withdrawERC20(address token, uint256 amount) onlyOwner

// Transfers
sendUSDC(address to, uint256 amount) onlyOwner
sendERC20(address token, address to, uint256 amount) onlyOwner

// Queries
getBalance() view returns (uint256)
getTokenBalance(address token) view returns (uint256)
owner() view returns (address)

// Ownership
changeOwner(address newOwner) onlyOwner
```

---

## Project Structure

```
novavault/
├── contracts/
│   └── arc/
│       └── SmartWallet.sol          # Main wallet contract
├── test/
│   └── SmartWallet.test.ts          # 27 passing tests
├── scripts/
│   └── deploy.ts                    # Deployment script
├── app/
│   ├── page.tsx                     # Landing page
│   ├── setup/page.tsx               # Wallet creation
│   └── dashboard/page.tsx           # Wallet management
├── lib/
│   ├── providers.tsx                # Web3 providers
│   └── services/
│       └── arcService.ts            # Arc Network integration
├── hardhat.config.ts                # Hardhat configuration
└── package.json                     # Dependencies
```

---

## Next Steps

**Phase 1 Complete!** 🎉

Ready for Phase 2:
- [ ] Uniswap v4 integration on Unichain
- [ ] Cross-chain USDC routing (Circle Gateway)
- [ ] swapViaUnichain() function

See [PHASE_1_PLAN.md](./PHASE_1_PLAN.md) for detailed specifications.

---

## Documentation

- [Arc Network Docs](https://docs.arc.network/)
- [Circle Faucet](https://faucet.circle.com/)
- [Hardhat Docs](https://hardhat.org/)
- [RainbowKit](https://www.rainbowkit.com/)

---

## Troubleshooting

### Contract compilation fails
```bash
npm run compile
# Should show: "Compiled 8 Solidity files successfully"
```

### Tests fail
```bash
npm test
# Should show: "27 passing"
```

### Deployment fails
- Check `.env` has valid `PRIVATE_KEY` (without 0x)
- Ensure account has USDC for gas: https://faucet.circle.com/

### Frontend issues
- Check `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in `.env`
- Run `npm run dev` and visit http://localhost:3000

---

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
