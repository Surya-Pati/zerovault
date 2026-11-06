# ZeroVault - Technical Architecture Document

This document provides a comprehensive overview of the technical architecture for **ZeroVault**, a trustless blockchain escrow and partial-disclosure system for zero-day vulnerability sales.

---

## 1. Tech Stack

ZeroVault leverages a modern, robust, and type-safe technology stack across its frontend, backend, and smart contracts.

| Technology | Version | Reasoning & Purpose |
|---|---|---|
| **Next.js** | 14 (App Router) | Chosen for server components, file-based routing, and React 18 features. Provides a scalable foundation for the complex buyer/seller dashboards. |
| **TypeScript** | 5.x | Enforces strict type safety across the entire monorepo, minimizing runtime errors and enabling shared types between frontend, backend, and contracts. |
| **Tailwind CSS** | 3.x | Utility-first CSS framework enabling rapid UI development and consistent design language across the application. |
| **Node.js + Express** | 20 LTS + 4.x | Mature backend ecosystem with the middleware pattern. Ideal for building robust API gateways and handling complex crypto/auth logic. |
| **Solidity** | ^0.8.24 | The latest stable version featuring built-in overflow protection, custom errors (gas efficient), and modern security features. |
| **Hardhat** | ^2.22.x | TypeScript-native development environment for Ethereum. Chosen for its seamless integration with typechain, automated testing, and Sepolia deployment support. |
| **PostgreSQL + Prisma ORM** | 15 + ^5.x | Relational database to ensure ACID compliance for off-chain state. Prisma provides type-safe queries that directly sync with our TypeScript types. |
| **ethers.js** | v6 | Modern ESM-first library for interacting with the Ethereum blockchain. Strong TypeScript support and robust cryptographic primitives. |
| **wagmi** | v2 | A collection of React hooks for Ethereum. Simplifies wallet connections, contract reads/writes, and state management in the Next.js frontend. |
| **merkletreejs + keccak256** | latest | Generates Merkle trees and proofs on the client/backend that are cryptographically compatible with Solidity's `keccak256` hashing on-chain. |
| **siwe** | latest | Implements Sign-In with Ethereum (EIP-4361), standardizing wallet-based authentication via verifiable signatures. Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope. |
| **express-rate-limit** | ^7.x | In-memory sliding-window rate limiting middleware for Express to prevent abuse and brute force. Scope Note: V1 implements in-memory rate limiting to minimize external infrastructure dependencies during MVP phase, with Redis drop-in planned for distributed multi-instance deployment. |
| **zod** | latest | Schema declaration and runtime validation library. Used for validating API requests, form inputs, and environment variables. |
| **pnpm** | 8.x/9.x | Fast, disk-efficient package manager with built-in workspace support. Crucial for managing dependencies across our monorepo seamlessly. |

---

## 2. Monorepo File & Folder Structure

The project uses `pnpm workspaces` to manage multiple packages within a single repository, promoting code sharing and dependency deduplication.

```
ZeroVault/
├── contracts/                  # Blockchain Smart Contracts Workspace
│   ├── contracts/Escrow.sol    # Core escrow smart contract logic
│   ├── test/                   # Hardhat tests (TypeScript)
│   ├── scripts/                # Deployment and interaction scripts
│   ├── hardhat.config.ts       # Hardhat configuration (networks, compilers)
│   └── package.json            # Workspace dependencies
├── backend/                    # Node.js API Gateway Workspace
│   ├── prisma/schema.prisma    # Database schema and migrations
│   ├── src/
│   │   ├── auth/               # Authentication logic (SIWE-only, 24h session JWT)
│   │   ├── middleware/         # Express middlewares (auth guards, validation)
│   │   ├── routes/             # API route definitions
│   │   ├── services/           # Business logic (merkle proofs, db access)
│   │   └── index.ts            # Entry point for Express server
│   └── package.json
├── frontend/                   # Next.js Application Workspace
│   ├── app/                    # App Router directory
│   │   ├── (auth)/             # Login, Registration pages
│   │   ├── dashboard/          # Common user dashboard
│   │   ├── listings/           # Vulnerability marketplace UI
│   │   ├── admin/              # Admin interface for verifying buyers
│   │   └── layout.tsx          # Root layout structure
│   ├── components/             # Reusable UI components
│   ├── lib/                    # Frontend utilities (wagmi config, api clients)
│   └── package.json
├── shared/                     # Shared Types and Utilities Workspace
│   ├── src/types/              # Shared TypeScript interfaces (User, Listing)
│   ├── src/merkle/             # Common Merkle tree generation logic
│   ├── abi/                    # Compiled smart contract ABIs for frontend/backend
│   └── package.json
├── qa/                         # Automated QA scripts and Postman collections
├── docs/                       # Project documentation (Architecture, API specs)
├── pnpm-workspace.yaml         # Defines the monorepo workspace boundaries
├── tsconfig.base.json          # Base TypeScript config extended by workspaces
├── .env.example                # Example environment variables
└── package.json                # Root package.json (dev tooling, linting)
```

**Rationale:**
- Isolation of concerns: Contracts, backend, and frontend operate independently but share types via the `shared` workspace.
- The `shared` workspace ensures that if a database model or smart contract interface changes, TypeScript will flag the error across both frontend and backend instantly.

---

## 3. Database Schema

The PostgreSQL database acts as an off-chain index and metadata store. Real value and final state are secured on-chain, but the DB provides fast querying and stores encrypted payloads.

### ER Diagram

```mermaid
erDiagram
    Users ||--o{ VulnerabilityListings : creates
    Users ||--o{ EscrowTransactions : buys
    VulnerabilityListings ||--o{ DisclosureProofs : contains
    VulnerabilityListings ||--o{ EscrowTransactions : has
    
    Users {
        uuid id PK
        string wallet_address UK
        string email UK
        string password_hash
        enum role "researcher|buyer|admin"
        boolean verified_buyer
        datetime created_at
    }

    VulnerabilityListings {
        uuid id PK
        uuid seller_id FK
        string title
        string category
        enum severity
        string merkle_root
        bigint price_wei
        enum status "COMMITTED|BOUNTY_LOCKED|SETTLED|EXPIRED|REFUNDED"
        string encrypted_payload_uri
        datetime created_at
    }

    EscrowTransactions {
        uuid id PK
        uuid listing_id FK
        uuid buyer_id FK
        string contract_address
        string tx_hash_fund
        string tx_hash_settle
        enum status "COMMITTED|BOUNTY_LOCKED|SETTLED|EXPIRED|REFUNDED"
        datetime bountyLockedAt
    }

    DisclosureProofs {
        uuid id PK
        uuid listing_id FK
        int leaf_index
        string revealed_value
        json merkle_proof
        boolean verified
    }
```

### Table Definitions

1.  **Users**
    *   `id` (UUID): Primary key.
    *   `wallet_address` (String): Ethereum address, unique (used for SIWE).
    *   `email` (String): Optional email for notification preferences. Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope.
    *   `password_hash` (String): Deprecated / unused in V1. Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope.
    *   `role` (Enum): `researcher` (seller), `buyer`, or `admin`.
    *   `verified_buyer` (Boolean): Admins must set this to true before a buyer can fund an escrow.
    *   `created_at` (Timestamp): Record creation time.

2.  **VulnerabilityListings**
    *   `id` (UUID): Primary key.
    *   `seller_id` (UUID): Foreign key to Users.
    *   `title`, `category` (String): Metadata describing the vulnerability.
    *   `severity` (Enum): e.g., low, medium, high, critical.
    *   `merkle_root` (String): `bytes32` hex string representing the root of the vulnerability details.
    *   `price_wei` (BigInt): Asking price in Wei.
    *   `status` (Enum): Tracks lifecycle (COMMITTED -> BOUNTY_LOCKED -> SETTLED -> EXPIRED/REFUNDED).
    *   `encrypted_payload_uri` (String): URI to the AES-encrypted full payload stored in local encrypted filesystem storage behind an IPFS-compatible interface. Scope Note: V1 uses local encrypted filesystem storage behind an IPFS-compatible interface, designed for a drop-in swap to pinning services post-MVP.
    *   `created_at` (Timestamp): Record creation time.

3.  **EscrowTransactions**
    *   `id` (UUID): Primary key.
    *   `listing_id` (UUID): Foreign key to VulnerabilityListings.
    *   `buyer_id` (UUID): Foreign key to Users.
    *   `contract_address` (String): Deployed escrow contract instance (if factory pattern) or central contract address.
    *   `tx_hash_fund` (String): Transaction hash where the buyer funded the escrow.
    *   `tx_hash_settle` (String): Transaction hash where the buyer settled/finalized the purchase.
    *   `status` (Enum): Transaction state tracking.
    *   `bountyLockedAt` (Timestamp): Timestamp when bounty was locked.

4.  **DisclosureProofs**
    *   `id` (UUID): Primary key.
    *   `listing_id` (UUID): Foreign key.
    *   `leaf_index` (Integer): Position of the revealed data in the Merkle tree.
    *   `revealed_value` (String): The plaintext snippet revealed to the buyer.
    *   `merkle_proof` (JSON): Array of sibling hashes to prove inclusion.
    *   `verified` (Boolean): Whether the system has verified this proof against the root.

---

## 4. Smart Contract Architecture

The core on-chain component is `ZeroVault.sol`. It is responsible for holding buyer funds securely and releasing them to the seller only when specific cryptographic conditions are met, or returning them if a timeout occurs.

### Security Patterns Applied
- **Checks-Effects-Interactions:** Strictly enforced to prevent reentrancy. State is updated before external calls (ether transfers).
- **ReentrancyGuard:** OpenZeppelin's `nonReentrant` modifier applied to all state-changing functions that handle funds.
- **Custom Errors:** `error Unauthorized(); error InvalidState();` used instead of require strings to save gas.
- **Pull over Push:** Funds withdrawal is preferred, though direct transfers are used with strict bounds.
- **Access Control & Governance:** OpenZeppelin `AccessControl` manages admin roles (`DEFAULT_ADMIN_ROLE` and `ADMIN_ROLE`) for KYC verification and circuit-breaking. Scope Note: V1 uses a single administrative key for KYC whitelisting and emergency pause to simplify testnet operations ahead of multi-sig (Gnosis Safe) governance transition.

### State Transition Diagram

```mermaid
stateDiagram-v2
    [*] --> COMMITTED: Seller calls commitVulnerability()
    COMMITTED --> BOUNTY_LOCKED: Buyer calls lockBounty()
    COMMITTED --> EXPIRED: Timeout passes, Researcher calls triggerDeadMansSwitch()
    BOUNTY_LOCKED --> SETTLED: Seller calls revealAndClaim(key)
    BOUNTY_LOCKED --> REFUNDED: Timeout passes, Vendor calls reclaimBounty()
    SETTLED --> [*]: Funds transferred to Seller, key emitted
    EXPIRED --> [*]: Vault flagged EXPIRED, metadata disclosed
    REFUNDED --> [*]: Funds returned to Vendor
```

### Core Functions (`Escrow.sol`)

- `commitVulnerability(bytes32 merkleRoot, bytes32 keyHash)`: Called by the researcher to commit a vulnerability and the hash of the decryption key. Emits state `COMMITTED`.
- `lockBounty(bytes32 _listingId)`: `payable` function called by a `verified_buyer`. Locks ETH equal to the listing price. Emits `BOUNTY_LOCKED` and sets `bountyLockedAt`.
- `revealAndClaim(bytes32 _listingId, string memory key)`: Called by the seller to reveal the key. Checks `keccak256(key) == keyHash`. If successful, releases funds to the seller and emits the key atomically with no dispute window. Emits `SETTLED`. Scope Note: V1 uses atomic single-transaction key revelation and payout verification (`revealAndClaim`), eliminating subjective dispute mediation and counterparty escrow lockup risks.
- `triggerDeadMansSwitch(bytes32 _listingId)`: Called by researcher if no bounty locked within parameterized commit timeout (7 days prod / 5 mins demo). Vault flags `EXPIRED`, authorizes public metadata disclosure. Scope Note: V1 implements parameterized constructor timeouts allowing dual testnet/demo deployments (5m/10m for evaluation alongside production 7d/14d) without hardcoding.
- `reclaimBounty(bytes32 merkleRoot)`: Callable only by vendor if state == `BOUNTY_LOCKED` and `block.timestamp > bountyLockedAt + RECLAIM_TIMEOUT` (14 days prod / 10 mins demo). Refunds vendor and sets state `REFUNDED`. Scope Note: V1 implements parameterized constructor timeouts allowing dual testnet/demo deployments (5m/10m for evaluation alongside production 7d/14d) without hardcoding.

---

## 5. API Architecture

The Node.js backend serves as a REST API gateway with in-memory sliding-window rate limiting (`express-rate-limit`). Scope Note: V1 implements in-memory rate limiting to minimize external infrastructure dependencies during MVP phase, with Redis drop-in planned for distributed multi-instance deployment. All endpoints prefixed with `/api/v1`.

### Authentication (`/auth`)
- `GET /nonce`: Generate SIWE nonce.
- `POST /verify`: Verify SIWE signature and issue single 24-hour JWT (`httpOnly` cookie). Scope Note: V1 employs a single 24-hour HttpOnly session cookie to avoid refresh token rotation state overhead while maintaining strict XSS-resistant session security.
- `POST /login`: Deprecated fallback. Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope.
- `POST /logout`: Clear session cookie.

### Users (`/users`)
- `GET /me`: Get current authenticated user profile. (Auth: Required)
- `GET /buyers`: List buyers for admin verification. (Auth: Admin)
- `PATCH /:id/verify`: Approve a buyer. (Auth: Admin)

### Listings (`/listings`)
- `POST /`: Create a new vulnerability listing. (Auth: Researcher)
  - Body: `{ title, category, severity, price_wei, merkle_root, encrypted_payload_uri }`
- `GET /`: List all available vulnerabilities.
- `GET /:id`: Get specific listing details.
- `PATCH /:id/status`: Update listing status (e.g., mark as escrowed). (Auth: System/Admin)
- `GET /:id/private-payload`: Access the private payload storage for decrypted/unlocked vulnerabilities. (Auth: Buyer only)

### Proofs & Disclosure (`/proofs`)
- `POST /`: Upload a partial disclosure proof. (Auth: Researcher)
  - Body: `{ listing_id, leaf_index, revealed_value, merkle_proof }`
- `GET /:listing_id`: Retrieve verified partial disclosures for a listing. (Auth: Verified Buyer)

---

## 6. Data Flow Diagrams

### Overall System Data Flow

```mermaid
graph TD
    UI[Frontend Client]
    API[Backend API Gateway]
    DB[(PostgreSQL)]
    BC[Blockchain - Sepolia / Local Hardhat]
    Storage[Local Filesystem / IPFS Interface - Encrypted Payloads]

    UI <-->|REST / JSON| API
    UI <-->|RPC / Web3| BC
    API <-->|Prisma ORM| DB
    API <-->|ethers.js| BC
    UI -->|Upload| Storage
    UI <--|Download| Storage
```

### Merkle Tree Commitment Flow

```mermaid
sequenceDiagram
    participant R as Researcher
    participant UI as Frontend
    participant API as Backend
    participant DB as Database

    R->>UI: Input full vulnerability details (N sections)
    UI->>UI: Hash each section (Leaves)
    UI->>UI: Generate Merkle Tree & Root
    UI->>UI: Encrypt full details with AES
    UI->>API: POST /listings (root, encrypted_uri)
    API->>DB: Save listing with Merkle Root
    API-->>UI: Success
    R->>UI: Select partial section to reveal
    UI->>UI: Generate Merkle Proof for section
    UI->>API: POST /proofs (section, proof)
    API->>API: Verify proof against DB root
    API->>DB: Save verified proof
```

### Escrow Lifecycle Flow

```mermaid
sequenceDiagram
    participant B as Buyer
    participant UI as Frontend
    participant SC as Smart Contract
    participant API as Backend

    B->>UI: Click "Lock Bounty"
    UI->>SC: lockBounty(listingId) [Value: ETH]
    SC-->>UI: Transaction Hash
    UI->>API: Notify Bounty Locked (TxHash)
    API->>API: Monitor mempool/RPC for confirmation
    API->>API: Update DB listing status -> 'BOUNTY_LOCKED'
```

### Decryption Key Release Flow

```mermaid
sequenceDiagram
    participant R as Researcher
    participant B as Buyer
    participant SC as Smart Contract
    participant API as Backend

    R->>SC: revealAndClaim(listingId, key)
    SC->>SC: Check keccak256(key) == keyHash
    SC->>SC: Transfer ETH to Researcher (Atomic Instant Settlement)
    SC-->>SC: Emit key event
    API->>SC: Listen for Key Revealed & Settled Event
    API->>API: Move ciphertext to buyer-only private storage
    API->>API: Delete shared storage copy (within 5 min)
    API->>API: Update DB status -> 'SETTLED'
    B->>API: Request private payload
    API-->>B: Return private payload
    B->>B: Decrypt full payload with emitted key
```

Scope Note: V1 uses atomic single-transaction key revelation and payout verification (`revealAndClaim`), eliminating subjective dispute mediation and counterparty escrow lockup risks.

---

## 7. Environment Variables

Below is the structure of the `.env.example` file required for local development.

```env
# ==========================================
# ZeroVault Environment Variables (.env.example)
# ==========================================

# --- Database (Secret) ---
# PostgreSQL connection string
DATABASE_URL="postgresql://user:password@localhost:5432/zerovault?schema=public"

# --- Backend API (Secret) ---
# JWT signing secret (min 32 chars)
JWT_SECRET="super_secret_jwt_key_replace_me_in_prod"
# Port for the Express server
PORT=3001
# Frontend URL for CORS
FRONTEND_URL="http://localhost:3000"

# --- Web3 & Blockchain (Config / Secret) ---
# RPC URL for Sepolia (e.g., Infura, Alchemy)
NEXT_PUBLIC_RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_KEY"
# Private key for contract deployment (DO NOT COMMIT)
DEPLOYER_PRIVATE_KEY="0x..."
# The deployed Escrow contract address
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS="0x..."

# --- Storage (Config) ---
# Local storage gateway with IPFS-compatible interface
NEXT_PUBLIC_STORAGE_GATEWAY="http://localhost:3001/api/v1/listings/payload/"
```

*Note: Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Keys like `JWT_SECRET` and `DEPLOYER_PRIVATE_KEY` must never be exposed.* Scope Note: V1 uses local encrypted filesystem storage behind an IPFS-compatible interface, designed for a drop-in swap to pinning services post-MVP.

---

## 8. Deployment Architecture

### Local Development Setup
- **Database:** Spun up via Docker Compose (`docker-compose up -d db`).
- **Blockchain Node:** Hardhat local node runs on `http://127.0.0.1:8545`. Accounts are pre-funded with 10,000 fake ETH.
- **Services:** `pnpm dev` utilizes Turborepo or concurrent scripts to boot the Next.js frontend and Express backend simultaneously.

### Testnet (Sepolia) & Local Deployment

ZeroVault targets Ethereum Sepolia testnet and local Hardhat environments. Scope Note: V1 targets Ethereum Sepolia testnet and local Hardhat environments for risk-free zero-day escrow validation prior to mainnet capital deployment.

We maintain two distinct deployments on the Sepolia testnet to serve different testing purposes without requiring code changes:

**1. Production Config**
- **Address:** `0xFf6a5C442077775Bb271BE0c3f4bF54D550a7460`
- **Configuration:** 7 days (`COMMIT_TIMEOUT`), 14 days (`RECLAIM_TIMEOUT`)
- **Purpose:** Represents the actual intended design and limits for real-world usage. Verified on Etherscan for auditing. Scope Note: V1 implements parameterized constructor timeouts allowing dual testnet/demo deployments (5m/10m for evaluation alongside production 7d/14d) without hardcoding.

**2. Demo Config**
- **Address:** `0x61ad747B010A51D56c967605c672B44e5c67FF9E`
- **Configuration:** 5 minutes (`COMMIT_TIMEOUT`), 10 minutes (`RECLAIM_TIMEOUT`)
- **Purpose:** Used strictly for live-demoing and E2E testing of the timeout and dead-man's switch flows without waiting multiple days. Scope Note: V1 implements parameterized constructor timeouts allowing dual testnet/demo deployments (5m/10m for evaluation alongside production 7d/14d) without hardcoding.

#### Deployment Process
1. Contracts are compiled and deployed to Sepolia using Hardhat: `npx hardhat run scripts/deploy.ts --network sepolia`. This script automatically deploys both instances and verifies them using an Etherscan API key.
2. The resulting ABI and contract addresses are linked to the frontend and backend environment variables.
3. The Backend is deployed to a PaaS (e.g., Render, Railway) connected to a managed PostgreSQL database (e.g., Supabase, RDS).
4. The Frontend is deployed to Vercel, utilizing environment variables pointing to the Sepolia contract and the production Backend API.

This architecture ensures a clean separation of concerns, high security for funds via smart contracts, and a performant, type-safe web layer for users.
