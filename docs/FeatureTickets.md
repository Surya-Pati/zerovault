# ZeroVault Feature Tickets

This document breaks down the ENTIRE ZeroVault build into granular, actionable tickets. Each ticket is designed to be specific enough to use as a direct prompt for an AI coding tool or a developer.

## Phase 0 — Foundation

### Module 0 — Initial Setup

**M0-01: Initialize pnpm monorepo with workspace config**
* **Description**: Create the root directory and initialize a pnpm workspace configuration file (`pnpm-workspace.yaml`). Define the structure with `packages/*`, `apps/*`, or specifically `frontend`, `backend`, `contracts`, and `shared`.
* **Acceptance Criteria**:
  * Root package.json created.
  * pnpm-workspace.yaml correctly configured.
  * Workspaces map correctly to expected sub-directories.
* **Dependencies**: None
* **Priority**: Must-have
* **Assignee**: Both
* **Estimated Effort**: S (< 1hr)

**M0-02: Create root tsconfig and shared TypeScript config**
* **Description**: Establish base TypeScript configurations in the root directory that other packages can extend.
* **Acceptance Criteria**:
  * `tsconfig.base.json` exists at the root.
  * Strict mode is enabled.
* **Dependencies**: M0-01
* **Priority**: Must-have
* **Assignee**: Both
* **Estimated Effort**: S (< 1hr)

**M0-03: Set up Hardhat project in /contracts**
* **Description**: Initialize a Hardhat project inside the `/contracts` workspace. Install necessary plugins like `@nomicfoundation/hardhat-toolbox`.
* **Acceptance Criteria**:
  * `hardhat.config.ts` exists.
  * Sample contract and test can run successfully.
* **Dependencies**: M0-01
* **Priority**: Must-have
* **Assignee**: Both
* **Estimated Effort**: S (< 1hr)

**M0-04: Set up Express + TypeScript project in /backend**
* **Description**: Scaffold the backend service using Node.js, Express, and TypeScript. Set up basic start scripts.
* **Acceptance Criteria**:
  * Express server can start on a specified port.
  * TypeScript compiles cleanly.
  * Health check route `/ping` returns 200 OK.
* **Dependencies**: M0-01, M0-02
* **Priority**: Must-have
* **Assignee**: Both
* **Estimated Effort**: S (< 1hr)

**M0-05: Set up Next.js 14 project in /frontend**
* **Description**: Create the Next.js 14 frontend using App Router, TypeScript, and Tailwind CSS.
* **Acceptance Criteria**:
  * Next.js dev server starts successfully.
  * Tailwind CSS is configured and working on the index page.
* **Dependencies**: M0-01, M0-02
* **Priority**: Must-have
* **Assignee**: Both
* **Estimated Effort**: S (< 1hr)

**M0-06: Create /shared package with type definitions**
* **Description**: Setup a `shared` workspace package to store common DTOs, Enums, and TypeScript interfaces used by both backend and frontend.
* **Acceptance Criteria**:
  * `shared/package.json` created.
  * Can be imported by `frontend` and `backend` workspaces.
* **Dependencies**: M0-01, M0-02
* **Priority**: Must-have
* **Assignee**: Both
* **Estimated Effort**: S (< 1hr)

**M0-07: Create Prisma schema with all 4 tables**
* **Description**: Initialize Prisma in the `/backend` workspace. Define the schema for Users, VulnerabilityListings, EscrowTransactions, and DisclosureProofs.
* **Acceptance Criteria**:
  * `schema.prisma` contains all 4 models with correct relations.
  * Prisma client generates successfully.
* **Dependencies**: M0-04
* **Priority**: Must-have
* **Assignee**: Both
* **Estimated Effort**: M (1-3hr)

**M0-08: Create .env.example with all environment variables**
* **Description**: Create a template environment variable file at the root or within each app detailing all required keys (DB URL, RPC endpoints, JWT secret, etc.).
* **Acceptance Criteria**:
  * `.env.example` is comprehensive and documented.
* **Dependencies**: None
* **Priority**: Must-have
* **Assignee**: Both
* **Estimated Effort**: S (< 1hr)

**M0-09: Create .gitignore**
* **Description**: Define ignore rules for node_modules, .env, build outputs, hardhat cache, etc.
* **Acceptance Criteria**:
  * Standard ignores applied.
* **Dependencies**: None
* **Priority**: Must-have
* **Assignee**: Both
* **Estimated Effort**: S (< 1hr)

**M0-10: Verify `pnpm install && pnpm dev` boots cleanly**
* **Description**: Create a root dev script that concurrently starts the frontend, backend, and a local hardhat node.
* **Acceptance Criteria**:
  * Running `pnpm dev` starts all necessary local services without errors.
* **Dependencies**: M0-03, M0-04, M0-05, M0-06
* **Priority**: Must-have
* **Assignee**: Both
* **Estimated Effort**: S (< 1hr)

---

## Phase 1 — Auth & Merkle (Parallel)

### Module 1 — Auth (Person A)

**M1-01: Set up argon2 password hashing utility**
* **Description**: Password authentication utility (Omitted from V1 scope in favor of SIWE-only).
* **Acceptance Criteria**:
  * Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope.
* **Dependencies**: M0-04
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

**M1-02: Create user registration endpoint (email/password)**
* **Description**: User registration flow (Unified under SIWE-only cryptographic wallet onboarding).
* **Acceptance Criteria**:
  * Registers user by wallet address and role.
  * Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope.
* **Dependencies**: M1-01, M0-07
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: M (1-3hr)

**M1-03: Create user login endpoint with JWT cookie**
* **Description**: User session issuance with single 24-hour HttpOnly session JWT cookie.
* **Acceptance Criteria**:
  * Issues single 24-hour HttpOnly session JWT cookie.
  * Scope Note: V1 employs a single 24-hour HttpOnly session cookie to avoid refresh token rotation state overhead while maintaining strict XSS-resistant session security.
* **Dependencies**: M1-02
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: M (1-3hr)

**M1-04: Implement SIWE wallet authentication**
* **Description**: Add Sign-In with Ethereum routes (`/auth/nonce` and `/auth/verify`) to authenticate users via their Web3 wallet.
* **Acceptance Criteria**:
  * Generates unique nonces.
  * Verifies EIP-4361 signature.
  * Issues single 24h JWT cookie upon successful verification.
  * Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope.
* **Dependencies**: M0-04
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: M (1-3hr)

**M1-05: Create auth middleware (JWT verification)**
* **Description**: Create an Express middleware to protect routes by verifying the JWT cookie and attaching the user to the request object.
* **Acceptance Criteria**:
  * Rejects missing or invalid tokens with 401.
  * Attaches decoded user payload to `req.user`.
* **Dependencies**: M1-03
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

**M1-06: Create role-gating middleware**
* **Description**: Create an Express middleware to restrict access based on user role (e.g., admin, buyer, researcher).
* **Acceptance Criteria**:
  * Accepts an array of allowed roles.
  * Rejects unauthorized access with 403.
* **Dependencies**: M1-05
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

**M1-07: Create POST /admin/verify-buyer endpoint**
* **Description**: Create an admin-only endpoint to toggle the `verified_buyer` flag for a specific user ID.
* **Acceptance Criteria**:
  * Route is protected by auth and admin role middlewares.
  * Updates the user's `verified_buyer` status in the DB.
* **Dependencies**: M1-06, M0-07
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

**M1-08: Build frontend login page with wallet connect + email tabs**
* **Description**: Build the UI in Next.js to support SIWE wallet login flows using wagmi/viem.
* **Acceptance Criteria**:
  * SIWE wallet connection flow works.
  * Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope.
* **Dependencies**: M0-05
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: L (3-6hr)

**M1-09: Build frontend registration page with role selection**
* **Description**: Build the user sign-up UI allowing the wallet-connected user to select whether they are a researcher or buyer.
* **Acceptance Criteria**:
  * Role selection toggles.
  * Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope.
* **Dependencies**: M0-05
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: M (1-3hr)

**M1-10: Connect frontend auth to backend API**
* **Description**: Wire the frontend forms to call the backend `/auth` routes and handle session state.
* **Acceptance Criteria**:
  * Successful login redirects to dashboard.
  * Error messages displayed on failure.
* **Dependencies**: M1-08, M1-09, M1-03, M1-04
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: M (1-3hr)

**M1-11: Test auth flow end-to-end**
* **Description**: Verify complete registration, login, and protected route access across both email and SIWE methods.
* **Acceptance Criteria**:
  * All authentication paths function correctly.
* **Dependencies**: M1-10, M1-07
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

### Module 2 — Merkle Tree (Person B)

**M2-01: Create hashLeaf function (keccak256)**
* **Description**: Write a utility to predictably hash a vulnerability attribute (e.g., component, exploit type) into a bytes32 leaf.
* **Acceptance Criteria**:
  * Uses keccak256.
  * Deterministic output matching Solidity's keccak256 behavior.
* **Dependencies**: M0-04
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: S (< 1hr)

**M2-02: Create buildTree function (merkletreejs)**
* **Description**: Write a utility to construct a Merkle Tree from an array of pre-hashed leaves.
* **Acceptance Criteria**:
  * Uses `merkletreejs`.
  * Configured with `keccak256` and `sortPairs: true`.
  * Returns the Merkle tree instance and root hash.
* **Dependencies**: M2-01
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: S (< 1hr)

**M2-03: Create getProof function**
* **Description**: Write a utility to extract a Merkle proof for a specific leaf from the generated tree.
* **Acceptance Criteria**:
  * Returns array of proof hashes.
* **Dependencies**: M2-02
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: S (< 1hr)

**M2-04: Create verifyProof function**
* **Description**: Write a utility to verify a proof against a known root and leaf.
* **Acceptance Criteria**:
  * Returns boolean true if valid, false otherwise.
* **Dependencies**: M2-03
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: S (< 1hr)

**M2-05: Define leaf schema for vulnerability payloads**
* **Description**: Standardize the structure of what gets put into the Merkle tree (e.g., `["target=Windows", "vuln=RCE", "cve=none"]`).
* **Acceptance Criteria**:
  * Shared TypeScript types/Zod schemas created in `/shared`.
* **Dependencies**: M0-06
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: S (< 1hr)

**M2-06: Create backend merkle service wrapper**
* **Description**: Build a service class/module that orchestrates hashing raw data, building the tree, storing leaves to the DB, and returning the root.
* **Acceptance Criteria**:
  * Integrates with Prisma `DisclosureProofs` table.
* **Dependencies**: M2-02, M0-07
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: M (1-3hr)

**M2-07: Write Jest tests: valid proof, tampered leaf, tampered proof, single-leaf**
* **Description**: Write comprehensive unit tests for the cryptographic functions.
* **Acceptance Criteria**:
  * Test suite covers edge cases and typical malicious inputs.
* **Dependencies**: M2-04, M2-06
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: M (1-3hr)

**M2-08: Verify all tests pass with `pnpm test`**
* **Description**: Configure jest in the `/backend` workspace and ensure all module 2 tests run and pass.
* **Acceptance Criteria**:
  * `pnpm test` executes tests successfully.
* **Dependencies**: M2-07
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: S (< 1hr)

---

## Phase 2 — Contract & Disclosure (Parallel)

### Module 3 — Smart Contract (Person A)

**M3-01: Write Escrow.sol with state enum and structs**
* **Description**: Define the base contract, struct for `Listing`, and enum for `EscrowState` (Draft, Listed, BountyLocked, Settled, Refunded, Expired).
* **Acceptance Criteria**:
  * Contract compiles in Hardhat.
* **Dependencies**: M0-03
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

**M3-02: Implement commitVulnerability function**
* **Description**: Allow a researcher to register a vulnerability listing with its `merkleRoot` and a `keyHash`.
* **Acceptance Criteria**:
  * Emits `VulnerabilityCommitted` event.
  * Stores data accurately mapping listing ID to struct.
* **Dependencies**: M3-01
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

**M3-03: Implement lockBounty function with value check**
* **Description**: Allow a buyer to send ETH to lock the bounty for an active listing.
* **Acceptance Criteria**:
  * Checks `msg.value == listing.price`.
  * Captures `bountyLockedAt` timestamp.
  * Transitions state to `BountyLocked`.
  * Emits `BountyLocked` event.
* **Dependencies**: M3-02
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

**M3-04: Implement revealAndClaim function**
* **Description**: Allow the seller to reveal the AES key and claim the bounty.
* **Acceptance Criteria**:
  * Callable only by the seller.
  * Checks `keccak256(key) == keyHash`.
  * Sends ETH to seller, emits `SettlementConfirmed` event with the key.
  * Transitions state to `Settled`.
  * Scope Note: V1 uses atomic single-transaction key revelation and payout verification (`revealAndClaim`), eliminating subjective dispute mediation and counterparty escrow lockup risks.
* **Dependencies**: M3-03
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

**M3-05: Implement triggerDeadMansSwitch function**
* **Description**: Allow researcher to handle a stalled vendor if no bounty is locked within COMMIT_TIMEOUT (7 days in production, 5 minutes in demo) of commit.
* **Acceptance Criteria**:
  * Checks `block.timestamp > committedAt + commitTimeout` and state is still `Listed`.
  * Sets state to `Expired` (authorizing metadata disclosure).
  * Emits `VaultExpired` event.
  * Scope Note: V1 implements parameterized constructor timeouts allowing dual testnet/demo deployments (5m/10m for evaluation alongside production 7d/14d) without hardcoding.
* **Dependencies**: M3-02
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

**M3-06: Implement reclaimBounty function**
* **Description**: Allow a vendor to reclaim funds if a seller stalls after bounty is locked (RECLAIM_TIMEOUT: 14 days in production, 10 minutes in demo).
* **Acceptance Criteria**:
  * Callable only by vendor if state == `BountyLocked`.
  * Checks `block.timestamp > bountyLockedAt + reclaimTimeout`.
  * Refunds vendor and sets state to `Refunded`.
  * Emits `BountyReclaimed` event.
  * Scope Note: V1 implements parameterized constructor timeouts allowing dual testnet/demo deployments (5m/10m for evaluation alongside production 7d/14d) without hardcoding.
* **Dependencies**: M3-03
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

**M3-08: Add ReentrancyGuard and NatSpec comments**
* **Description**: Secure functions handling ETH transfers and fully document the contract using NatSpec.
* **Acceptance Criteria**:
  * Inherits and uses `nonReentrant`.
  * NatSpec comments exist for all public/external methods.
* **Dependencies**: M3-06
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

**M3-09: Write Hardhat tests: happy path**
* **Description**: Write a test covering commitVulnerability -> lockBounty -> revealAndClaim flow.
* **Acceptance Criteria**:
  * Balances checked before and after.
  * Test passes.
* **Dependencies**: M3-08
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: M (1-3hr)

**M3-10: Write Hardhat tests: timeout cases**
* **Description**: Write tests utilizing Hardhat time manipulation for stalled-vendor (7-day expired) and stalled-seller (14-day refund timeout).
* **Acceptance Criteria**:
  * triggerDeadMansSwitch fails if too early, succeeds after timeout duration.
  * reclaimBounty fails if too early, succeeds and refunds vendor after timeout duration.
  * Scope Note: V1 implements parameterized constructor timeouts allowing dual testnet/demo deployments (5m/10m for evaluation alongside production 7d/14d) without hardcoding.
* **Dependencies**: M3-08
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

**M3-11: Write Hardhat tests: reentrancy attack simulation**
* **Description**: Create a malicious contract to attempt reentrancy on `refundIfExpired` to prove protection works.
* **Acceptance Criteria**:
  * Transaction reverts with ReentrancyGuard error.
* **Dependencies**: M3-08
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: M (1-3hr)

**M3-12: Create Sepolia deploy script**
* **Description**: Write a Hardhat ignition or standard deploy script for the Sepolia testnet and local Hardhat environments with configurable constructor timeouts.
* **Acceptance Criteria**:
  * Script correctly handles constructor args (timeouts) and gas parameters.
  * Scope Note: V1 targets Ethereum Sepolia testnet and local Hardhat environments for risk-free zero-day escrow validation prior to mainnet capital deployment.
  * Scope Note: V1 implements parameterized constructor timeouts allowing dual testnet/demo deployments (5m/10m for evaluation alongside production 7d/14d) without hardcoding.
* **Dependencies**: M3-11
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

**M3-13: Export ABI to /shared/abi**
* **Description**: Ensure the compiled contract ABI and typing is generated and copied to the `/shared` workspace for frontend/backend use.
* **Acceptance Criteria**:
  * ABI available in `shared` package index.
* **Dependencies**: M3-12
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

### Module 5 — Partial Disclosure UI (Person B)

**M5-01: Create backend disclosure routes (reveal leaves, get proofs)**
* **Description**: Build endpoints allowing a seller to flag a leaf as 'revealed', and a buyer to fetch revealed leaves and their proofs.
* **Acceptance Criteria**:
  * PUT `/listings/:id/disclosure` updates DB.
  * GET `/listings/:id/disclosure` returns data and JSON proof array.
* **Dependencies**: M2-06
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: M (1-3hr)

**M5-02: Build seller disclosure management UI (select which leaves to reveal)**
* **Description**: Build frontend component for the researcher to toggle visibility of their parsed vulnerability traits.
* **Acceptance Criteria**:
  * Checkboxes per trait.
  * Submits selection to backend.
* **Dependencies**: M5-01, M0-05
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: M (1-3hr)

**M5-03: Build buyer partial disclosure view**
* **Description**: Build frontend component showing the buyer the revealed traits of a listing prior to funding.
* **Acceptance Criteria**:
  * Displays traits clearly.
  * Masks unrevealed traits.
* **Dependencies**: M5-01, M0-05
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: M (1-3hr)

**M5-04: Implement client-side Merkle proof verification with visual badge**
* **Description**: In the frontend, verify the provided proofs against the on-chain (or backend-provided) Merkle root and show a "Cryptographically Verified" badge.
* **Acceptance Criteria**:
  * Uses `merkletreejs` client-side.
  * UI shows green check badge if verified, red warning if tampered.
* **Dependencies**: M5-03, M2-04
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: M (1-3hr)

**M5-05: Gate Fund Escrow CTA on verified_buyer + proof check**
* **Description**: The "Fund Escrow" button should be disabled unless the user is a `verified_buyer` AND the client-side proof verification passes.
* **Acceptance Criteria**:
  * Proper tooltips explain why button is disabled.
* **Dependencies**: M5-04, M1-07
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: S (< 1hr)

**M5-06: Test tampered proof shows failure in UI**
* **Description**: Manually corrupt the proof data in state and verify the UI updates to show verification failure.
* **Acceptance Criteria**:
  * Badge turns red.
  * Fund CTA disabled.
* **Dependencies**: M5-05
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: S (< 1hr)

**M5-07: Test valid proof shows pass in UI**
* **Description**: Ensure happy path works flawlessly.
* **Acceptance Criteria**:
  * Badge is green.
* **Dependencies**: M5-06
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: S (< 1hr)

**M5-08: Verify responsive at 375px and 1440px**
* **Description**: CSS QA for mobile and desktop views of the disclosure interfaces.
* **Acceptance Criteria**:
  * No horizontal scrolling on mobile.
  * Modals and badges display correctly.
* **Dependencies**: M5-07
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: S (< 1hr)

---

## Phase 3 — API Bridge & Settlement (Parallel)

### Module 4 — API Gateway (Person A)

**M4-01: Create /listings CRUD routes with Zod validation**
* **Description**: Build backend endpoints to create, read, update, and list vulnerability listings.
* **Acceptance Criteria**:
  * Zod schemas validate request bodies.
  * Connects to Prisma DB.
* **Dependencies**: M0-07
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: M (1-3hr)

**M4-02: Create /escrow/fund route**
* **Description**: Backend endpoint to record that a buyer has initiated the funding transaction (wrapping `lockBounty`), storing the `tx_hash_fund`.
* **Acceptance Criteria**:
  * Updates EscrowTransactions table.
* **Dependencies**: M4-01
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

**M4-03: Create /escrow/reveal route**
* **Description**: Backend endpoint to record that a seller has initiated settlement (wrapping `revealAndClaim`), storing `tx_hash_settle`.
* **Acceptance Criteria**:
  * Updates EscrowTransactions table.
* **Dependencies**: M4-02
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

**M4-04: Build Web3 bridge event listener service**
* **Description**: Create a backend worker/listener using ethers.js to listen for `BountyLocked`, `SettlementConfirmed`, `VaultExpired`, and `BountyReclaimed` events from the smart contract.
* **Acceptance Criteria**:
  * Automatically updates database status when events are emitted.
* **Dependencies**: M3-13, M0-04
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: L (3-6hr)

**M4-05: Implement confirmation-block threshold**
* **Description**: Enhance the event listener to wait for X block confirmations before marking a transaction as fully finalized in the DB.
* **Acceptance Criteria**:
  * DB state transitions from `PENDING` to `CONFIRMED` only after threshold.
* **Dependencies**: M4-04
* **Priority**: Should-have
* **Assignee**: Person A
* **Estimated Effort**: M (1-3hr)

**M4-06: Implement retry with backoff for RPC failures**
* **Description**: Add resilience to the web3 listener to handle Alchemy/Infura rate limits or downtime.
* **Acceptance Criteria**:
  * Uses exponential backoff.
  * In-memory sliding-window rate limiting applied across backend API endpoints.
  * Scope Note: V1 implements in-memory rate limiting to minimize external infrastructure dependencies during MVP phase, with Redis drop-in planned for distributed multi-instance deployment.
* **Dependencies**: M4-04
* **Priority**: Should-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

**M4-07: Wire auth + role middleware to all routes**
* **Description**: Apply the authentication and authorization middlewares to all Phase 3 routes.
* **Acceptance Criteria**:
  * Escrow endpoints require buyer role.
  * Listing creation requires researcher role.
* **Dependencies**: M1-06, M4-01
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: S (< 1hr)

**M4-08: Write integration tests against local Hardhat node**
* **Description**: Write tests that spin up the express server and hardhat node, emitting an event and checking the DB updates.
* **Acceptance Criteria**:
  * Supertest + ethers tests pass.
* **Dependencies**: M4-07, M4-04
* **Priority**: Must-have
* **Assignee**: Person A
* **Estimated Effort**: L (3-6hr)

### Module 6 — Settlement & Decryption (Person B)

**M6-01: Implement AES-256-GCM client-side encryption utility**
* **Description**: Write frontend utility to symmetrically encrypt the full vulnerability payload before uploading.
* **Acceptance Criteria**:
  * Outputs ciphertext, iv, and auth tag.
  * Does not expose unencrypted payload over network.
* **Dependencies**: M0-05
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: M (1-3hr)

**M6-02: Create encrypted payload upload endpoint**
* **Description**: Backend endpoint to receive and store the encrypted payload blob using local encrypted filesystem storage behind an IPFS-compatible interface and save URI to DB.
* **Acceptance Criteria**:
  * Returns URI of stored blob.
  * Scope Note: V1 uses local encrypted filesystem storage behind an IPFS-compatible interface, designed for a drop-in swap to pinning services post-MVP.
* **Dependencies**: M4-01
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: M (1-3hr)

**M6-03: Build settlement event listener for payload handling**
* **Description**: Listen for `SettlementConfirmed` events (which include the key) from the smart contract.
* **Acceptance Criteria**:
  * Successfully detects the event and extracts the on-chain key.
* **Dependencies**: M6-02, M4-04
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: M (1-3hr)

**M6-04: Implement post-settlement payload transfer**
* **Description**: Within 5 minutes of a `SettlementConfirmed` event, move the encrypted ciphertext out of shared storage into buyer-only private storage.
* **Acceptance Criteria**:
  * Ciphertext is transferred successfully to private storage.
  * Shared copy is deleted.
* **Dependencies**: M6-03
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: M (1-3hr)

**M6-05: Create GET /listings/:id/payload endpoint**
* **Description**: Endpoint for the buyer to retrieve the encrypted payload from local encrypted filesystem storage after settlement.
* **Acceptance Criteria**:
  * Verifies buyer authorization and settled status.
  * Returns the encrypted payload URI or blob.
  * Scope Note: V1 uses local encrypted filesystem storage behind an IPFS-compatible interface, designed for a drop-in swap to pinning services post-MVP.
* **Dependencies**: M6-04
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: M (1-3hr)

**M6-06: Implement local decryption using on-chain key**
* **Description**: In the frontend, use the key emitted in the `SettlementConfirmed` event to decrypt the payload fetched from the buyer's private storage.
* **Acceptance Criteria**:
  * No backend API call needed to fetch the key.
  * Decrypts locally on the buyer's machine.
* **Dependencies**: M6-05
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: M (1-3hr)

**M6-07: Test payload confidentiality logic**
* **Description**: Verify the encrypted payload cannot be accessed in shared storage post-settlement.
* **Acceptance Criteria**:
  * Assert shared storage returns 404/forbidden after 5 mins of settlement.
* **Dependencies**: M6-04
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: S (< 1hr)

**M6-08: Test successful payload retrieval and decryption**
* **Description**: Verify the buyer can retrieve the payload from private storage and decrypt it locally using the on-chain key.
* **Acceptance Criteria**:
  * Test asserts 200 on private storage.
  * Decrypted text matches original text exactly.
* **Dependencies**: M6-06
* **Priority**: Must-have
* **Assignee**: Person B
* **Estimated Effort**: S (< 1hr)

**M6-09: Add code comments regarding on-chain key public exposure**
* **Description**: Document that `SettlementConfirmed` exposes the key on-chain, but the payload has been moved to buyer-private storage, making it useless to observers.
* **Acceptance Criteria**:
  * Thorough comment block in the settlement listener service.
* **Dependencies**: M6-04
* **Priority**: Nice-to-have
* **Assignee**: Person B
* **Estimated Effort**: S (< 1hr)

---

## Phase 4 — QA (Both)

### Module 7 — QA

**M7-01: Create Postman collection with all API endpoints**
* **Description**: Document all backend routes, expected payloads, and authentication headers in Postman.
* **Acceptance Criteria**:
  * Collection export JSON available in repository.
* **Dependencies**: Phase 3 complete
* **Priority**: Must-have
* **Assignee**: Both
* **Estimated Effort**: M (1-3hr)

**M7-02: Create Postman environments (local + Sepolia)**
* **Description**: Set up variables for local testing (localhost) and Sepolia deployed URLs.
* **Acceptance Criteria**:
  * Variables for `baseUrl`, `jwt_token`, `listing_id`, etc., work cleanly.
* **Dependencies**: M7-01
* **Priority**: Must-have
* **Assignee**: Both
* **Estimated Effort**: S (< 1hr)

**M7-03: Script end-to-end scenario in Postman**
* **Description**: Chain requests together (Register -> Login -> Create Listing -> Fund -> Settle -> Get Key) passing variables automatically.
* **Acceptance Criteria**:
  * Collection runner can execute scenario end-to-end without manual intervention.
* **Dependencies**: M7-02
* **Priority**: Should-have
* **Assignee**: Both
* **Estimated Effort**: L (3-6hr)

**M7-04: Create GitHub Actions CI workflow**
* **Description**: Setup `.github/workflows/ci.yml` to run linter, typecheck, and unit/integration tests on pull request.
* **Acceptance Criteria**:
  * Workflow triggers on PR to main.
  * Fails if tests fail.
* **Dependencies**: All tests written
* **Priority**: Must-have
* **Assignee**: Both
* **Estimated Effort**: M (1-3hr)

**M7-05: Run full scenario green locally**
* **Description**: QA the entire application manually locally to ensure everything works visually and functionally.
* **Acceptance Criteria**:
  * No visual bugs, no console errors.
* **Dependencies**: Phase 3 complete
* **Priority**: Must-have
* **Assignee**: Both
* **Estimated Effort**: L (3-6hr)

**M7-06: Verify CI passes on clean checkout**
* **Description**: Final check of the CI pipeline on a fresh commit.
* **Acceptance Criteria**:
  * Green checkmark on GitHub.
* **Dependencies**: M7-04
* **Priority**: Must-have
* **Assignee**: Both
* **Estimated Effort**: S (< 1hr)

---

## Summary Table

| Phase | Module | Tickets | Person | Total Effort |
|-------|--------|---------|--------|--------------|
| 0 | Foundation | M0-01 to M0-10 | Both | ~6-9 hrs |
| 1 | Auth | M1-01 to M1-11 | Person A | ~12-20 hrs |
| 1 | Merkle Tree | M2-01 to M2-08 | Person B | ~6-10 hrs |
| 2 | Contract | M3-01 to M3-13 | Person A | ~9-15 hrs |
| 2 | UI/Disclosure | M5-01 to M5-08 | Person B | ~8-14 hrs |
| 3 | API Gateway | M4-01 to M4-08 | Person A | ~9-16 hrs |
| 3 | Settlement | M6-01 to M6-09 | Person B | ~9-15 hrs |
| 4 | QA | M7-01 to M7-06 | Both | ~10-18 hrs |
| **Total**| | **46 Tickets** | | **~69-117 hrs** |
