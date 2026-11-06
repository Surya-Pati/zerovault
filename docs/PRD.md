# Product Requirements Document (PRD) – ZeroVault

## Document Information
| Field | Description |
|---|---|
| **Product Name** | ZeroVault |
| **Document Owner** | Product Architecture Team |
| **Status** | Draft |
| **Date** | 2026-08-23 |

---

## 1. Problem Statement

The current zero-day vulnerability market is fundamentally broken, characterized by opacity, trust dependencies, and significant risks for all parties involved.

*   **Seller Risks:** Security researchers (sellers) must often disclose critical details of their vulnerability to prove its legitimacy to potential buyers or brokers. Once the information is disclosed, the researcher has no leverage to ensure they are compensated. This leads to rampant intellectual property theft, "ghosting" by vendors, and unfair compensation.
*   **Buyer Risks:** Institutional security teams (buyers) are hesitant to pay large sums for a vulnerability sight-unseen. Buying a "black box" exploit without verification risks purchasing a duplicate, low-impact, or fraudulent vulnerability.
*   **The Trust Gap:** The market currently relies heavily on centralized brokers who take massive cuts (often 20-50%), operate opaquely, and act as trusted third parties. There is no existing mechanism that allows for trustless partial disclosure, secure escrow, and verifiable settlement.

**Why Blockchain Solves This:**
Blockchain technology, specifically smart contracts combined with cryptographic commitments (Merkle trees), provides an elegant solution to this trust gap.
1.  **Immutable Escrow:** Smart contracts provide a programmable, transparent, and immutable escrow mechanism. Funds are locked mathematically and can only be released when predefined conditions (settlement) are met.
2.  **Cryptographic Commitment:** Using Merkle trees allows the researcher to cryptographically commit to the entire vulnerability payload without revealing it. They can selectively reveal specific "leaves" (e.g., affected component, stack trace snippet, impact summary) to prove legitimacy.
3.  **On-Chain Settlement:** The settlement process is an on-chain commit/reveal. The seller commits the vulnerability and a key hash. The buyer locks the bounty. The seller then reveals the decryption key on-chain to claim the funds. This ensures that the key is publicly emitted to the buyer precisely when the seller gets paid, with no backend gatekeeper.

---

## 2. Target Users

ZeroVault is designed for three distinct user personas, each with specific needs and pain points.

### Persona 1: The Security Researcher (Seller)
*   **Profile:** Independent security researcher, technically sophisticated, often specializing in specific ecosystems (e.g., iOS, Linux kernel, enterprise software).
*   **Motivations:** Wants fair, immediate compensation for their work. Desires to cut out the middlemen/brokers to maximize profits. Seeks a secure way to advertise vulnerabilities without giving away the exploit.
*   **Pain Points:** Frustrated by vendor bug bounty programs that underpay or silently patch vulnerabilities without credit. Distrusts brokers who operate in the shadows.
*   **Use Case:** Uses ZeroVault to securely list a zero-day, provide verifiable cryptographic proof of its existence and impact, and receive guaranteed payout upon buyer verification.

### Persona 2: The Institutional Buyer
*   **Profile:** Member of a PSIRT (Product Security Incident Response Team), a corporate bug-bounty team at a major tech company, a CERT/CSIRT coordination body, or an authorized security broker.
*   **Motivations:** Needs to acquire critical vulnerabilities to patch systems before malicious actors exploit them. Must ensure the vulnerability is legitimate before committing company funds.
*   **Pain Points:** Cannot legally or financially justify purchasing unverified exploits. Struggles with the time-consuming process of verifying claims from unknown researchers. Must comply with strict internal procurement and compliance policies.
*   **Use Case:** Uses ZeroVault to browse listings, mathematically verify the partial disclosure proofs provided by the researcher, securely fund an escrow contract, and safely acquire the full payload for patching.

### Persona 3: The Platform Admin
*   **Profile:** Internal operator managing the ZeroVault platform infrastructure and user trust.
*   **Motivations:** Wants to maintain platform integrity, ensure only vetted buyers can participate (preventing bad actors from acquiring exploits).
*   **Pain Points:** Managing KYC/verification manually is tedious. 
*   **Use Case:** Logs into the admin dashboard to review and approve/reject buyer verification requests, monitor platform health, and oversee escrow statuses.

---

## 3. Product Vision

**North Star Statement:**
To become the standard, trustless infrastructure for the equitable and secure exchange of critical vulnerability intelligence.

**Expanded Vision:**
ZeroVault envisions a future where security researchers are fairly compensated for their discoveries without relying on opaque brokers, and where organizations can rapidly acquire and patch vulnerabilities with absolute cryptographic certainty. By abstracting the complexities of Web3 and cryptography behind a seamless Next.js interface, ZeroVault will democratize the zero-day market, transitioning it from a dark-alley exchange to a transparent, math-backed, and highly professional marketplace.

---

## 4. Core Features

The features are categorized across the 7 development modules, classified as Must-Have (MVP) or Nice-to-Have (Future).

| Module | Feature | Type | Description |
| :--- | :--- | :--- | :--- |
| **1. Auth & Roles** | SIWE Wallet Auth | Must-Have | Sign-In with Ethereum (SIWE, EIP-4361) cryptographic wallet authentication. Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope. |
| **1. Auth & Roles** | Role-Based Access Control | Must-Have | Segregated access for Researcher, Buyer, and Admin roles. |
| **1. Auth & Roles** | Admin Buyer Verification | Must-Have | Workflow for admins to vet and approve `verified_buyer` status. |
| **2. Cryptography** | Merkle Tree Generation | Must-Have | Client-side generation of Merkle trees from vulnerability payload chunks. |
| **2. Cryptography** | Payload Encryption | Must-Have | AES-256-GCM encryption of the full vulnerability payload before upload. |
| **3. Smart Contract** | On-Chain Escrow | Must-Have | Solidity contracts to handle fund locking, release, and refunds. |
| **3. Smart Contract** | Emergency Circuit Breaker | Must-Have | Single administrative key mechanism to pause/unpause contract operations via OpenZeppelin Pausable. Scope Note: V1 uses a single administrative key for KYC whitelisting and emergency pause to simplify testnet operations ahead of multi-sig (Gnosis Safe) governance transition. |
| **4. API & Web3 Bridge** | Real-time Web3 Syncing | Must-Have | Backend listeners to sync on-chain escrow events (tx hashes) to the PostgreSQL DB. |
| **4. API & Web3 Bridge** | Secure Payload Storage | Must-Have | API endpoints to handle encrypted payload upload to local encrypted filesystem storage behind an IPFS-compatible interface. Scope Note: V1 uses local encrypted filesystem storage behind an IPFS-compatible interface, designed for a drop-in swap to pinning services post-MVP. |
| **5. Partial Disclosure** | Leaf Selection UI | Must-Have | Interface for sellers to select which Merkle leaves to reveal publicly. |
| **5. Partial Disclosure** | Client-Side Verification | Must-Have | Buyer UI to mathematically verify the provided proofs against the Merkle root. |
| **6. Settlement** | Atomic Instant Settlement | Must-Have | Seller reveals decryption key on-chain via `revealAndClaim` to atomically receive bounty and emit key with no dispute window. Scope Note: V1 uses atomic single-transaction key revelation and payout verification (`revealAndClaim`), eliminating subjective dispute mediation and counterparty escrow lockup risks. |
| **6. Settlement** | Confidentiality Post-Reveal | Must-Have | Move ciphertext to buyer-only private storage (or delete shared copy) within 5 mins of settlement. |
| **3. Smart Contract** | Dead Man's Switch | Must-Have | Parameterized commit timeout (7d prod / 5m demo constructor args) after which vault flags EXPIRED and researcher can disclose metadata publicly. Scope Note: V1 implements parameterized constructor timeouts allowing dual testnet/demo deployments (5m/10m for evaluation alongside production 7d/14d) without hardcoding. |
| **3. Smart Contract** | Reclaim Bounty | Must-Have | Parameterized reclaim timeout (14d prod / 10m demo constructor args) after bounty locked allowing vendor to reclaim funds and set state to REFUNDED. Scope Note: V1 implements parameterized constructor timeouts allowing dual testnet/demo deployments (5m/10m for evaluation alongside production 7d/14d) without hardcoding. |
| **6. Settlement** | Vulnerability Listing CRUD | Must-Have | Create, Read, Update, Delete functionality for listings (severity, category, price). |
| **6. Settlement** | Dashboard Views | Must-Have | Customized dashboards for each role tracking listings, escrows, and verifications. |
| **7. QA & Testing** | Postman API Collection | Must-Have | Comprehensive Postman collection for all API endpoints. |
| **7. QA & Testing** | CI/CD Pipeline | Nice-to-Have | Automated testing and deployment workflows. |

---

## 5. App Flow

### 5.1 Researcher (Seller) Flow
1.  **Registration & Auth:** Researcher registers via SIWE (Sign-In with Ethereum, EIP-4361) wallet signature and selects the "Researcher" role. Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope.
2.  **Listing Creation:** Navigates to "Create Listing". Enters title, category, severity, and asking price (in Wei/ETH).
3.  **Cryptographic Commitment:**
    *   Uploads the full vulnerability payload (PDF, code, POC).
    *   The frontend chunks the document and builds a Merkle tree client-side.
    *   The Merkle root is generated and securely stored.
4.  **Partial Disclosure Selection:** The researcher selects specific chunks (leaves) to reveal (e.g., a non-exploitable crash dump, a specific memory address).
5.  **Encryption & Upload:** The full payload is encrypted client-side using AES-256-GCM. The encrypted file is uploaded to local encrypted filesystem storage behind an IPFS-compatible interface, and the URI is returned. Scope Note: V1 uses local encrypted filesystem storage behind an IPFS-compatible interface, designed for a drop-in swap to pinning services post-MVP.
6.  **Finalize Listing:** The listing is published to the marketplace, containing the Merkle root, the selected revealed leaves, and the encrypted payload URI.
7.  **Escrow Monitoring:** The researcher monitors the dashboard. Once a buyer locks the bounty in the escrow, the status updates to "Bounty Locked".
8.  **Settlement & Payment:** The researcher calls `revealAndClaim` on-chain, revealing the decryption key. The contract verifies the key matches the committed hash, pays the researcher atomically in a single transaction, and emits the key to the buyer with no dispute window. Scope Note: V1 uses atomic single-transaction key revelation and payout verification (`revealAndClaim`), eliminating subjective dispute mediation and counterparty escrow lockup risks.

### 5.2 Buyer Flow
1.  **Registration & Auth:** Buyer registers via SIWE wallet authentication and selects the "Buyer" role. Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope.
2.  **Verification Request:** Submits institutional details (company email, PGP key, organization details) for admin review. Cannot participate in escrows until the `verified_buyer` flag is true on-chain and in DB.
3.  **Browse Listings:** Once verified, browses available vulnerability listings filtering by category/severity.
4.  **Verification of Partial Disclosure:** Selects a listing. The frontend automatically fetches the revealed leaves and verifies them against the published Merkle root using client-side cryptography.
5.  **Fund Escrow:** If satisfied with the proof, the buyer clicks "Fund Escrow". A Web3 wallet prompt (e.g., MetaMask) appears to sign the transaction and lock the specified ETH in the ZeroVault smart contract.
6.  **Decryption & Full Review:** The platform detects the successful funding event. The buyer waits for the seller to execute the on-chain key reveal.
7.  **Settlement Confirmation:** The seller calls `revealAndClaim`, revealing the decryption key on-chain to atomically claim their funds. The smart contract emits the key to the buyer, and the platform moves the ciphertext to buyer-only private storage within 5 minutes. Scope Note: V1 uses atomic single-transaction key revelation and payout verification (`revealAndClaim`), eliminating subjective dispute mediation and counterparty escrow lockup risks.
8.  **Access:** Buyer decrypts the full payload client-side and acquires the exploit details.

### 5.3 Admin Flow
1.  **Login:** Admin logs in using secure credentials.
2.  **Buyer Verification Management:** Navigates to the Verification Queue. Reviews incoming buyer requests.
3.  **Approval/Rejection:** Approves valid institutional buyers (setting `verified_buyer = true` on-chain and in DB) or rejects suspicious accounts.
4.  **Platform Monitoring:** Views global dashboards tracking total value locked (TVL) in escrow, active listings, and platform health.

---

## 6. MVP Scope

**Included in V1 (MVP):**
*   Full end-to-end flow from listing creation to escrow settlement.
*   Client-side Merkle tree generation and verification.
*   Smart contract deployment on the Sepolia Testnet and local Hardhat network. Scope Note: V1 targets Ethereum Sepolia testnet and local Hardhat environments for risk-free zero-day escrow validation prior to mainnet capital deployment.
*   SIWE wallet-only authentication. Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope.
*   Admin verification workflow for buyers.
*   PostgreSQL database with Prisma ORM for off-chain metadata (listings, user profiles).
*   AES encryption of payloads.

**Explicitly Excluded from V1:**
*   Mainnet deployment (Ethereum, Arbitrum, etc.). Scope Note: V1 targets Ethereum Sepolia testnet and local Hardhat environments for risk-free zero-day escrow validation prior to mainnet capital deployment.
*   Integration with decentralized storage (IPFS/Arweave) - MVP uses local encrypted filesystem storage behind an IPFS-compatible interface. Scope Note: V1 uses local encrypted filesystem storage behind an IPFS-compatible interface, designed for a drop-in swap to pinning services post-MVP.
*   Multi-signature wallets and DAO governance for admin functions - MVP uses a single administrative key with OpenZeppelin AccessControl. Scope Note: V1 uses a single administrative key for KYC whitelisting and emergency pause to simplify testnet operations ahead of multi-sig (Gnosis Safe) governance transition.
*   Mobile application (desktop web only). Scope Note: V1 explicitly restricts scope to native ETH settlement, cryptographic proof verification without sandboxed code execution, and responsive web clients to ensure core escrow security.
*   Fiat on/off ramps.

---

## 7. Success Metrics

To evaluate the success of the MVP, the following Key Performance Indicators (KPIs) will be tracked:

1.  **System Reliability:** > 99% success rate of Merkle proof verifications on the client side.
2.  **Web3 Synchronization:** < 5 seconds average latency between on-chain escrow events (Sepolia) and backend database synchronization.
3.  **User Onboarding:** Time taken for a researcher to create a fully encrypted and Merkle-committed listing is under 3 minutes.
4.  **Security Audit:** 0 critical or high vulnerabilities found in the core Escrow smart contract during internal review.
5.  **QA Coverage:** 100% pass rate on the Postman API testing collection for all core workflows.

---

## 8. Out of Scope for V1

*   Support for tokens other than native ETH (no ERC-20 stablecoin support for escrow). Scope Note: V1 explicitly restricts scope to native ETH settlement, cryptographic proof verification without sandboxed code execution, and responsive web clients to ensure core escrow security.
*   Reputation scoring system for researchers or buyers.
*   Automated vulnerability scanning or validation of the actual exploit payload (the platform is agnostic to the content, it only guarantees the cryptographic commitment). Scope Note: V1 explicitly restricts scope to native ETH settlement, cryptographic proof verification without sandboxed code execution, and responsive web clients to ensure core escrow security.
*   Integration with external bug bounty platforms (HackerOne, Bugcrowd).
*   Advanced analytics and reporting dashboards for users.

---

## 9. Assumptions & Constraints

1.  **Network Environment:** All blockchain interactions and testing will be strictly confined to the Sepolia Ethereum Testnet and local Hardhat node. No real funds will be used. Scope Note: V1 targets Ethereum Sepolia testnet and local Hardhat environments for risk-free zero-day escrow validation prior to mainnet capital deployment.
2.  **Team Size & Timeline:** Developed by a 2-person team (Person A: Identity/Infra; Person B: Crypto/Verification) under an academic project timeline constraint.
3.  **Browser Support:** Optimized for modern desktop browsers with Web3 wallet extensions (Chrome/Brave + MetaMask). Scope Note: V1 explicitly restricts scope to native ETH settlement, cryptographic proof verification without sandboxed code execution, and responsive web clients to ensure core escrow security.
4.  **Cryptography Standards:** Relies on standard libraries (`merkletreejs`, `ethers.js`, native Web Crypto API) assuming their underlying mathematical security is sound.
5.  **Legal & Compliance:** As an academic/proof-of-concept project, comprehensive legal compliance regarding the sale of vulnerabilities (e.g., export controls, Wassenaar Arrangement) is not actively enforced in the software layer, though the admin verification step simulates this requirement.

---
*End of Document*
