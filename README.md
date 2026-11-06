# 🛡️ ZeroVault

> **Trustless Blockchain Escrow & Selective Disclosure Marketplace for Zero-Day Vulnerability Intelligence**

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-^0.8.24-363636.svg?logo=solidity)](https://soliditylang.org/)
[![Ethereum Sepolia](https://img.shields.io/badge/Network-Ethereum%20Sepolia-627EEA.svg?logo=ethereum)](https://sepolia.etherscan.io/address/0xd99501e8a7CE41fFb1DdEF4ca288B57Cf9966091)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black.svg?logo=next.js)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%20LTS-339933.svg?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED.svg?logo=docker)](docker-compose.yml)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue.svg?logo=github-actions)](.github/workflows/ci.yml)

---

## 📖 Executive Summary

The zero-day vulnerability market is historically plagued by the **"Seller-Buyer Dilemma"**:
- **Sellers (Security Researchers)** risk intellectual property theft, underpayment, or silent patching if they disclose vulnerability details before compensation.
- **Buyers (Institutional PSIRTs / Security Teams)** risk paying for fake, duplicate, or trivial findings if forced to pay blindly upfront.
- **Brokers** exploit this trust vacuum by taking 20% to 50% mediator cuts while operating opaque backchannel exchanges.

**ZeroVault eliminates the middleman** by combining **Ethereum smart contract escrows**, **Merkle tree selective disclosure**, and **client-side encryption**. Researchers cryptographically commit to their exploit and disclose verifiable claims (affected binary, impact scope, sanitized call-trace snippet) without revealing the exploit itself. Funds are locked on-chain and atomically released only when the decryption key is published to the blockchain.

---

## 🏛️ System Architecture

```text
    SECURITY RESEARCHER                               SMART CONTRACT                               INSTITUTIONAL BUYER
  ┌───────────────────────┐                        ┌──────────────────┐                         ┌───────────────────────┐
  │ 1. Encrypt Payload    │                        │  ZeroVault.sol   │                         │                       │
  │    (AES-256-GCM)      │                        │ (Ethereum/Sepolia│                         │                       │
  │                       │                        │                  │                         │                       │
  │ 2. Compute Merkle     │                        │                  │                         │                       │
  │    Root & Key Hash    │                        │                  │                         │                       │
  │                       │   commitVulnerability  │                  │                         │                       │
  │ 3. Submit On-Chain ───┼───────────────────────>│  Status:         │                         │                       │
  │                       │   (merkleRoot, keyHash)│  COMMITTED       │                         │                       │
  │                       │                        │                  │   Inspect Listing &     │                       │
  │                       │                        │                  │<────────────────────────┼─ 4. Verify Merkle     │
  │                       │                        │                  │   Cryptographic Proofs  │     Disclosed Leaves  │
  │                       │                        │  Status:         │                         │                       │
  │                       │                        │  BOUNTY_LOCKED   │   lockBounty{value: ETH}│                       │
  │                       │                        │                  │<────────────────────────┼─ 5. Deposit Escrow    │
  │                       │                        │                  │                         │     Funds On-Chain    │
  │                       │   revealAndClaim       │                  │                         │                       │
  │ 6. Reveal Decryption ─┼───────────────────────>│  Status:         │                         │                       │
  │    Key to Claim ETH   │   (key, merkleRoot)    │  SETTLED         │                         │                       │
  │                       │                        │                  │                         │                       │
  │                       │<───────────────────────│  Transfers ETH   │                         │                       │
  │ 7. Receive Payout     │  (Bounty Payment)      │                  │   Emits Event with Key  │                       │
  │                       │                        │                  ├────────────────────────>│ 8. Fetch Key from     │
  │                       │                        │                  │                         │    Chain & Decrypt    │
  └───────────────────────┘                        └──────────────────┘                         └───────────────────────┘
```

---

## ⚡ Core Technical Features

### 1. Atomic Commit-Reveal Escrow (`ZeroVault.sol`)
- **Single-Transaction Payout & Key Release**: When the seller submits `revealAndClaim(merkleRoot, key)`, the contract verifies that `keccak256(key) == keyHash`. If valid, the locked bounty is transferred immediately to the researcher and the decryption key is broadcast in an immutable on-chain event (`SettlementConfirmed`).
- **Cryptographic Merkle Proof Verification**: Built-in verification via `verifyPartialLeaf(merkleRoot, leaf, proof)` enables on-chain proof validation against the committed root.
- **Reentrancy Protection**: Uses OpenZeppelin's `ReentrancyGuard` across all state-mutating functions.
- **Reclaim & Dead Man's Switch**:
  - `reclaimBounty`: If the seller fails to reveal the key within `reclaimTimeout` seconds, the buyer can safely reclaim 100% of their deposited ETH.
  - `triggerDeadMansSwitch`: If a buyer locks funds but stalls or abandons the process, the seller can trigger emergency disclosure after timeout.

### 2. Client-Side Cryptographic Privacy
- **End-to-End Encryption**: Vulnerability payloads (proof-of-concept, exploitation notes, raw binaries) are encrypted in the browser using standard Web Crypto API / AES-256-GCM before transmission.
- **Zero-Knowledge Server Principle**: The backend API never sees unencrypted payloads or raw private keys. It only serves as a content-addressed storage relay for ciphertext.

### 3. Merkle Selective Disclosure Protocol
- The researcher breaks the vulnerability disclosure into isolated semantic claims (e.g., target architecture, vulnerability primitive, severity CVSS, sanitized proof of impact).
- Leaves are hashed via `keccak256` into a standard binary Merkle tree.
- Buyers can verify mathematical inclusion of each disclosed claim against the on-chain committed Merkle root prior to committing any financial bounty.

### 4. Enterprise Identity & Vetted Access Control
- **Sign-In with Ethereum (SIWE / EIP-4361)**: Passwordless, cryptographic authentication verifying wallet ownership using ERC-191 personal signatures.
- **Role-Based Access Control**:
  - `RESEARCHER`: Can commit vulnerabilities, reveal keys, and claim bounties.
  - `BUYER`: Can inspect partial disclosures, deposit bounties, and decrypt settled payloads.
  - `ADMIN`: Vets institutional buyers through automated/manual KYC workflows.
- **Dual-Layer Anti-CSRF Protection**: Uses `csrf-csrf` signed cookie double-submit tokens with per-session salt rotation.

### 5. Automated Web3 Event Bridge & Background Daemon
- Real-time WebSocket provider connects to Ethereum Sepolia.
- Background worker tracks smart contract events (`VulnerabilityCommitted`, `BountyLocked`, `SettlementConfirmed`, `VaultExpired`, `BountyReclaimed`).
- Upon settlement, the payload migration daemon moves the encrypted file from public access staging to buyer-specific secure isolation.

---

## 🗂️ Monorepo Structure

```text
zerovault/
├── contracts/                  # Hardhat Ethereum Smart Contracts
│   ├── contracts/
│   │   └── ZeroVault.sol       # Primary Escrow & Selective Disclosure Contract
│   ├── scripts/
│   │   ├── deploy-sepolia.ts   # Automated Sepolia deployment & verification
│   │   ├── switch-network.js   # Fast network config switcher (Sepolia <-> Localhost)
│   │   └── dev-node.js         # Local blockchain node runner
│   ├── test/
│   │   └── ZeroVault.test.ts   # 22 automated unit & integration test suites
│   └── hardhat.config.ts       # Solidity 0.8.24 configuration & compiler settings
│
├── backend/                    # Express.js REST API & Web3 Bridge
│   ├── prisma/
│   │   └── schema.prisma       # PostgreSQL schema (Users, Listings, Escrows, Proofs)
│   ├── src/
│   │   ├── auth/               # SIWE EIP-4361 login, JWT session, CSRF middleware
│   │   ├── controllers/        # Escrow, listing, and admin business logic
│   │   ├── services/
│   │   │   ├── bridge.ts       # Web3 WebSocket event listener & sync engine
│   │   │   └── payloadWorker.ts# Background storage lifecycle migration daemon
│   │   └── app.ts              # Express configuration, rate limiting, and helmet guards
│   └── Dockerfile              # Multi-stage production container build
│
├── frontend/                   # Next.js 14 App Router UI
│   ├── src/
│   │   ├── app/                # App router pages (/listings, /submit, /admin, /login)
│   │   ├── components/         # Stepper, decryptor, Merkle proof viewer, UI primitives
│   │   ├── lib/                # Ethers contracts integration, crypto utils, session
│   │   └── middleware.ts       # Route protection & authentication guards
│   └── Dockerfile              # Standalone Alpine Next.js container build
│
├── .github/
│   └── workflows/
│       └── ci.yml              # Automated GitHub Actions test & build workflow
├── docker-compose.yml          # Unified multi-service orchestration
└── package.json                # Root concurrent scripts & workspace runner
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or `v24.x`
- **npm** or **pnpm**
- **Git**
- A Web3 wallet (e.g. **MetaMask**, **Rabby**) connected to Sepolia Testnet

### 1. Clone the Repository
```bash
git clone https://github.com/Surya-Pati/zerovault.git
cd zerovault
```

### 2. Configure Environment Variables
Copy the provided `.env.example` templates:

```bash
# Root & Contracts
cp .env.example .env

# Backend API
cp backend/.env.example backend/.env

# Frontend Web Application
cp frontend/.env.example frontend/.env.local
```

Fill in your database URL (Supabase or local PostgreSQL) and RPC endpoint (Alchemy / Infura).

### 3. Install Dependencies
```bash
npm install
cd backend && npm install
cd ../frontend && npm install
cd ../contracts && npm install
cd ..
```

### 4. Database Setup
Sync the database schema with Prisma:
```bash
cd backend
npx prisma db push
cd ..
```

---

## 💻 Running the Application

### Option A: Development Mode (One Command)
Run both the Backend API and Frontend concurrently:
```bash
npm run dev
```
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:3001](http://localhost:3001)

### Option B: Individual Services
```bash
# Start Backend API & Web3 Event Bridge
npm run dev:backend

# Start Frontend UI
npm run dev:frontend

# Start Local Hardhat Blockchain Node (optional, if not using Sepolia)
npm run dev:contracts
```

---

## 🌐 Network Switching (Sepolia vs. Localhost)

ZeroVault includes an automated network switcher that updates root, backend, and frontend environment targets in one command:

- **Switch to Ethereum Sepolia Testnet**:
  ```bash
  npm run switch:sepolia
  ```
- **Switch to Local Hardhat Node**:
  ```bash
  npm run switch:local
  ```

---

## 🧪 Testing Suite

ZeroVault features automated testing across smart contracts, API routes, and cryptographic workers:

```bash
# Run contract unit tests (Solidity / Hardhat - 22/22 passing)
cd contracts && npx hardhat test

# Run backend API integration tests (Jest / Supertest - 27/27 passing)
cd backend && npm test
```

---

## 🐳 Production Deployment (Docker)

Launch the full stack (Frontend, Backend, and optional PostgreSQL) via Docker Compose:

```bash
docker compose up -d --build
```

---

## 🔒 Security & Audit Hardening

ZeroVault has undergone security review and remediation addressing critical attack vectors:
- **`C-1` Reclaim Timeout Vulnerability**: Patched in `ZeroVault.sol` with `ReclaimTimeoutPassed` revert check preventing post-timeout claim exploits.
- **`C-2` Client Credential Leakage**: Eliminated hardcoded RPC API keys from client bundles; all Web3 providers now resolve securely via environment variables.
- **`H-1` Unauthorized Escrow Mutation**: Added database ownership checks and strict role enforcement (`BUYER` / `RESEARCHER`) across all API endpoints.
- **`H-2` Hex Key Normalization**: Standardized 0x-prefixed 32-byte hexadecimal representation across client encryption, API requests, and contract parameters.
- **`M-1` CSRF Endpoint Hardening**: Enforced Double Submit Cookie verification (`doubleCsrfProtection`) across all administrative and settlement routes.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🤝 Acknowledgments & References

- **EIP-4361**: Sign-In with Ethereum (SIWE)
- **OpenZeppelin Contracts**: ReentrancyGuard & Ownable patterns
- **MerkleTreeJS**: Cryptographic Merkle tree generation compatible with Solidity `keccak256`
- **Ethereum Sepolia**: Decentralized testnet execution environment
