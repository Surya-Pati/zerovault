"""
Section Data Part 2:
- Section 4: System Architecture & Design
- Section 5: Existing System vs. Proposed System
- Section 6: Implementation Details
"""

import docx
from docx.shared import Inches, Pt, RGBColor
from journal_builder import (
    COLOR_PRIMARY, COLOR_SECONDARY, COLOR_ACCENT, COLOR_TEXT, COLOR_MUTED,
    HEX_PRIMARY, HEX_LIGHT_BG, HEX_CALLOUT_BG,
    add_heading_1, add_heading_2, add_heading_3, add_paragraph,
    add_callout_box, add_figure, add_code_block, add_academic_table,
    set_cell_background, set_cell_margins
)

def build_section_4(doc):
    """Section 4: System Architecture & Design."""
    add_heading_1(doc, "4.0 SYSTEM ARCHITECTURE & DESIGN")
    
    add_heading_2(doc, "4.1 Global System Architecture Overview & Component Layering")
    add_paragraph(
        doc,
        "ZeroVault is architected as a modular, four-tier decentralized software system engineered to isolate cryptographic trust boundaries, "
        "enforce strict role-based access control, and guarantee non-custodial financial clearing. The four architectural tiers comprise:",
        bold_prefix="Architectural Tiering: "
    )
    add_paragraph(
        doc,
        "1. Blockchain Consensus Tier: Deployed on the Ethereum Sepolia public testnet and local Hardhat EVM nodes. Centered on the `ZeroVault.sol` smart contract, "
        "this tier provides immutable state storage for escrow records, enforces KYC whitelisting, evaluates Merkle root commitments, and governs atomic ether disbursements."
    )
    add_paragraph(
        doc,
        "2. Backend API Gateway & Bridge Tier: Built with Node.js, Express, and TypeScript. Responsible for managing off-chain listing metadata, serving EIP-4361 "
        "cryptographic authentication challenges (SIWE), persisting encrypted payloads to a local filesystem storage directory behind an IPFS-compatible URI interface, "
        "and running an autonomous Web3 event listener service that synchronizes on-chain state changes with the relational database."
    )
    add_paragraph(
        doc,
        "3. Relational Persistence Tier: Powered by PostgreSQL/SQLite via Prisma ORM. Stores user profiles, cryptographic nonces, parsed Merkle tree leaf traits, "
        "transaction hashes (`tx_hash_fund`, `tx_hash_settle`), and escrow status caches to enable high-performance querying without hammering blockchain RPC endpoints."
    )
    add_paragraph(
        doc,
        "4. Client Presentation & Cryptography Tier: A responsive Next.js 14 App Router application. Handles client-side Web3 wallet connectivity via Wagmi/Viem, "
        "in-browser AES-256-GCM symmetric encryption/decryption, and client-side Merkle proof verification via `merkletreejs`."
    )

    add_heading_2(doc, "4.2 End-to-End System Data Flow Architecture")
    add_paragraph(
        doc,
        "The end-to-end operational sequence of ZeroVault coordinates seven distinct phases spanning researcher onboarding, vulnerability commitment, "
        "partial disclosure, bounty locking, atomic settlement, and local decryption. The step-by-step communication pathway is formalized below:",
        bold_prefix="Operational Data Flow: "
    )
    add_paragraph(
        doc,
        "Phase 1 (Authentication): The researcher connects a Web3 wallet (MetaMask) and requests a unique cryptographic nonce from `GET /auth/nonce`. The researcher "
        "signs an EIP-4361 challenge string. The backend verifies the signature at `POST /auth/verify` and issues a single stateless 24-hour HttpOnly session JWT cookie."
    )
    add_paragraph(
        doc,
        "Phase 2 (Payload Encryption & Merkle Generation): In the browser, the researcher inputs technical vulnerability documentation and an exploit archive. "
        "The client generates a 256-bit AES key K, encrypts the payload, computes key hash H_K = keccak256(K), parses discrete vulnerability attributes into leaves, "
        "builds the Merkle tree T, and derives Merkle root R."
    )
    add_paragraph(
        doc,
        "Phase 3 (Encrypted Storage & Listing Creation): The encrypted ciphertext blob is uploaded to `POST /listings` and stored in the local encrypted filesystem "
        "behind an IPFS-compatible URI (`ipfs://...`). The listing record and all Merkle leaf objects are persisted to the database."
    )
    add_paragraph(
        doc,
        "Phase 4 (On-Chain Commitment): The researcher executes `commitVulnerability(R, H_K, vendor)` on the `ZeroVault.sol` contract. The contract records the struct, "
        "sets state to `COMMITTED`, and emits `VulnerabilityCommitted`."
    )
    add_paragraph(
        doc,
        "Phase 5 (Selective Partial Disclosure): The researcher toggles specific leaves as revealed via `PUT /listings/:id/disclosure`. The prospective buyer fetches "
        "revealed leaves and cryptographic proof arrays via `GET /listings/:id/disclosure` and verifies each proof against on-chain root R in client-side runtime."
    )
    add_paragraph(
        doc,
        "Phase 6 (Bounty Lock): Having verified the proofs, the KYC-whitelisted buyer invokes `lockBounty(merkleRoot)` with the required ETH bounty. The contract locks the "
        "funds, records `bountyLockedAt = block.timestamp`, sets state to `BOUNTY_LOCKED`, and emits `BountyLocked`."
    )
    add_paragraph(
        doc,
        "Phase 7 (Atomic Settlement & Decryption): The researcher calls `revealAndClaim(merkleRoot, K)`. The contract checks `keccak256(K) == H_K`, transfers the ETH bounty "
        "to the researcher, sets state to `SETTLED`, and emits `SettlementConfirmed(merkleRoot, H_K)`. The buyer retrieves the ciphertext, extracts key K, and decrypts "
        "the full exploit payload locally."
    )



    add_heading_2(doc, "4.3 Merkle Tree Structure & Claim Decomposition")
    add_paragraph(
        doc,
        "The partial disclosure engine structures the vulnerability specification into a balanced binary Merkle tree. Each semantic leaf represents a single "
        "verifiable vulnerability attribute formatted as a canonical JSON string before hashing:",
        bold_prefix="Leaf Formulation: "
    )
    add_paragraph(
        doc,
        "L_0 = { index: 0, trait_type: 'Target Software', value: 'OpenSSL 3.0.1', salt: '0x8f...1a' }\n"
        "L_1 = { index: 1, trait_type: 'Vulnerability Class', value: 'Heap Buffer Overflow', salt: '0x2c...4b' }\n"
        "L_2 = { index: 2, trait_type: 'Attack Vector', value: 'Remote Unauthenticated', salt: '0x9e...7d' }\n"
        "L_3 = { index: 3, trait_type: 'CVSS v3.1 Base Score', value: '9.8', salt: '0x14...5f' }\n"
        "L_4 = { index: 4, trait_type: 'Exploit Reliability', value: 'Deterministic (>95%)', salt: '0x7b...82' }\n"
        "L_5 = { index: 5, trait_type: 'Mitigation Bypass', value: 'ASLR + DEP Bypass', salt: '0x3d...11' }",
        italic=True
    )
    add_paragraph(
        doc,
        "Each leaf is hashed via h_i = keccak256(canonical_json(L_i)). Pairs of sibling leaves (h_0, h_1) are sorted lexicographically such that "
        "h_{parent} = keccak256(min(h_0, h_1) || max(h_0, h_1)), preventing second-preimage ambiguities. The tree is recursively evaluated to the single 32-byte Merkle Root R. "
        "To prove membership of leaf L_k, the seller provides an audit path comprising the sibling hashes along the path from h_k to R. The buyer reconstructs the root "
        "in log2(N) hashing steps and compares it with the immutable root stored in `escrows[merkleRoot]`."
    )



    add_heading_2(doc, "4.4 Network Topology, Node Infrastructure & Testnet Layout")
    add_paragraph(
        doc,
        "The deployment topology of ZeroVault spans local development environments and public decentralized testnets:",
        bold_prefix="Infrastructure Nodes: "
    )
    add_paragraph(
        doc,
        "• Local Hardhat Node (Chain ID 31337): A dedicated local EVM consensus node executing at `http://127.0.0.1:8545`. Utilized for rapid automated integration "
        "testing, instant block mining, and programmatic time manipulation (`evm_increaseTime`) during timeout test execution."
    )
    add_paragraph(
        doc,
        "• Public Ethereum Sepolia Testnet (Chain ID 11155111): The public multi-client proof-of-stake testnet. Interfaced via Alchemy/Infura JSON-RPC endpoints. "
        "Provides realistic transaction latency, gas estimation, and Etherscan block explorer auditability."
    )
    add_paragraph(
        doc,
        "• Backend Host Environment: An Express.js microservice running on Node.js v20+, managing database connections to Prisma and orchestrating the Web3 event listener "
        "polling loop at 5-second intervals with exponential backoff for RPC rate-limit resilience."
    )
    add_paragraph(
        doc,
        "• Client Browser Runtime: Client machines running Chromium/Firefox with Web3 provider injection (MetaMask or browser wallet) interacting with the API gateway "
        "via TLS and submitting transactions directly to EVM RPC nodes via Viem."
    )



    add_heading_2(doc, "4.5 Smart Contract Finite State Machine")
    add_paragraph(
        doc,
        "The `ZeroVault.sol` contract enforces a strict, deterministic Finite State Machine (FSM). The contract defines six explicit states:",
        bold_prefix="FSM State Definitions: "
    )
    add_paragraph(
        doc,
        "1. `NONE`: Initial uninitialized state. No escrow exists for the specified Merkle root."
    )
    add_paragraph(
        doc,
        "2. `COMMITTED`: The researcher has committed the Merkle root, key hash, and optional designated vendor address via `commitVulnerability()`. Bounty amount is 0. "
        "The Dead Man's Switch countdown timer (`COMMIT_TIMEOUT`) commences."
    )
    add_paragraph(
        doc,
        "3. `BOUNTY_LOCKED`: A KYC-whitelisted buyer has deposited the full ETH bounty via `lockBounty()`. `bountyLockedAt` is recorded. The seller has until "
        "`bountyLockedAt + RECLAIM_TIMEOUT` to reveal the decryption key."
    )
    add_paragraph(
        doc,
        "4. `SETTLED`: The researcher has called `revealAndClaim()`, providing the valid plaintext key matching `keyHash`. The bounty is paid out atomically. Terminal state."
    )
    add_paragraph(
        doc,
        "5. `EXPIRED`: The vendor failed to lock the bounty within `COMMIT_TIMEOUT`. The researcher invoked `triggerDeadMansSwitch()`, authorizing public metadata disclosure. Terminal state."
    )
    add_paragraph(
        doc,
        "6. `REFUNDED`: The researcher failed to reveal the key within `RECLAIM_TIMEOUT`. The vendor invoked `reclaimBounty()`, returning 100% of the locked ETH to the vendor. Terminal state."
    )



    add_heading_2(doc, "4.6 Relational Database Schema & Off-Chain Cache Architecture")
    add_paragraph(
        doc,
        "To ensure sub-second UI responsiveness and eliminate redundant RPC calls, ZeroVault utilizes a relational database managed via Prisma ORM. "
        "The schema isolates user accounts, vulnerability listings, and cryptographic trait disclosures:",
        bold_prefix="Database Architecture: "
    )
    add_paragraph(
        doc,
        "• `User` Model: Primary key `id` (UUID), `wallet_address` (unique string, lowercase EIP-55), `role` (`RESEARCHER`, `BUYER`, `ADMIN`), `kyc_status` (boolean), "
        "`nonce` (cryptographic challenge string for SIWE), timestamps (`created_at`, `updated_at`). Credentials and passwords are strictly omitted."
    )
    add_paragraph(
        doc,
        "• `Listing` Model: `id` (UUID), `seller_id` (foreign key to User), `title`, `description`, `target_system`, `vulnerability_type`, `price_eth` (Decimal), "
        "`merkle_root` (bytes32 hex string, unique), `key_hash` (bytes32 hex string), `encrypted_payload_uri` (filesystem storage URI), `status` "
        "(`DRAFT`, `COMMITTED`, `BOUNTY_LOCKED`, `SETTLED`, `EXPIRED`, `REFUNDED`), `tx_hash_commit`, `tx_hash_fund`, `tx_hash_settle`."
    )
    add_paragraph(
        doc,
        "• `PartialDisclosureLeaf` Model: `id` (UUID), `listing_id` (foreign key to Listing), `leaf_index` (integer), `trait_type` (string), `trait_value` (string), "
        "`salt` (string), `leaf_hash` (bytes32 hex), `proof` (JSON array of sibling hashes), `is_revealed` (boolean default false)."
    )

def build_section_5(doc):
    """Section 5: Existing System vs. Proposed System."""
    add_heading_1(doc, "5.0 EXISTING SYSTEM VS. PROPOSED SYSTEM")
    
    add_heading_2(doc, "5.1 Analysis of Contemporary Vulnerability Acquisition Paradigms")
    add_paragraph(
        doc,
        "To rigorously evaluate the architectural necessity of ZeroVault, it is essential to benchmark the proposed system against the three dominant contemporary "
        "vulnerability acquisition paradigms: commercial bug bounty platforms, private defense brokerages, and illicit darknet markets."
    )

    add_heading_2(doc, "5.2 Traditional Bug Bounty Platforms (HackerOne, Bugcrowd)")
    add_paragraph(
        doc,
        "Commercial bug bounty platforms represent the industry standard for coordinated disclosure. However, their operational model is structurally skewed in favor of "
        "enterprise vendors. Researchers are forced to surrender complete vulnerability disclosures upfront into a centralized ticketing system. Platform triage analysts "
        "and vendor security teams evaluate the report asynchronously, with review cycles frequently exceeding 60 to 90 days. During this period, the researcher holds "
        "zero economic guarantees; the vendor can unilaterally downgrade the severity, claim internal duplication, or award nominal bounties without binding arbitration. "
        "Furthermore, these platforms charge enterprise program fees and retain a substantial percentage of researcher payouts."
    )

    add_heading_2(doc, "5.3 Specialized Private Defense Brokers (Zerodium, Crowdfense)")
    add_paragraph(
        doc,
        "Private vulnerability brokers operate high-value acquisition pipelines servicing government defense and intelligence agencies. While offering premium pricing, "
        "their acquisition process involves extreme counterparty opacity. Researchers must submit detailed technical summaries and enter into legally binding, "
        "restrictive contracts under foreign jurisdictions. Payouts are staged over weeks or months, conditional on proprietary laboratory validation. The researcher "
        "retains zero visibility into how the exploit is tested, verified, or deployed, and possesses no technical recourse if a broker rejects an exploit after extracting "
        "technical intelligence."
    )

    add_heading_2(doc, "5.4 Underground Darknet Forums & Over-The-Counter Channels")
    add_paragraph(
        doc,
        "Illicit darknet forums provide pseudonymous, cryptocurrency-denominated exploit transactions. However, these environments lack cryptographic verification mechanisms. "
        "Transactions rely on forum administrators acting as manual escrow agents who charge 10% to 20% fees. Forum administrators routinely engage in 'exit scams' (absconding "
        "with escrow balances) or are seized by law enforcement. Buyers frequently receive non-functional or malware-laden payloads, while sellers risk retaliatory law enforcement "
        "action or theft by unscrupulous buyers."
    )

    add_heading_2(doc, "5.5 Multi-Dimensional Comprehensive Comparative Evaluation Table")
    add_paragraph(
        doc,
        "The following multi-dimensional comparative matrix evaluates the structural, economic, and technical dimensions of existing vulnerability procurement systems "
        "against the ZeroVault decentralized protocol:",
        bold_prefix="Comparative Analysis: "
    )

    comp_headers = ["Evaluation Metric", "Bug Bounty Platforms (HackerOne)", "Private Defense Brokers (Zerodium)", "Darknet Forums / OTC Telegram", "ZeroVault Protocol (Proposed)"]
    comp_rows = [
        ("Trust & Custody Model", "Centralized platform holds fiat funds & arbitrates unilaterally", "Private corporate entity controls escrow and legal contract", "Centralized forum admin acts as manual escrow custodian", "Trustless, non-custodial smart contract on Ethereum Sepolia"),
        ("Pre-Purchase Verification", "Full plaintext exploit disclosed before bounty decision", "Detailed technical summary disclosed before contract offer", "Unverified claims, high counterfeit/scam probability", "Cryptographic partial disclosure via client-verified Merkle proofs"),
        ("Dispute Resolution", "Subjective vendor/platform review; zero appeal rights for seller", "Private laboratory evaluation; take-it-or-leave-it determination", "Informal forum admin arbitration; high bias and exit scam risk", "Atomic single-transaction settlement; dispute window eliminated"),
        ("Identity & Privacy", "Mandatory real-name KYC, tax ID, government passport", "Extensive legal vetting, identity checks, strict NDAs", "Pseudonymous (PGP/Tor), vulnerable to operational security leaks", "Pseudonymous Web3 wallet (SIWE) + on-chain admin KYC whitelist"),
        ("Intermediary Commission", "20% – 33% platform fee deducted from transaction", "Undisclosed markup; substantial broker margin retained", "10% – 20% forum escrow fee", "0% protocol fee; strictly native network gas cost"),
        ("Settlement Latency", "30 to 90 days from initial report submission", "14 to 60 days pending laboratory validation cycles", "Hours to days, subject to manual admin availability", "Instantaneous (< 15 seconds, single Ethereum block confirmation)"),
        ("Vulnerability Leak Risk", "High central honeypot risk (cloud database storing PoCs)", "High insider threat and state-sponsored espionage risk", "Extremely high risk of malware infection and immediate leak", "Zero central honeypot: client-side AES-256-GCM encrypted blobs"),
        ("Inactivity Protection", "None: vendor can delay triage indefinitely without penalty", "None: seller is bound by non-disclosure agreements", "Informal forum admin discretion", "Deterministic: Dead Man's Switch (seller) & Reclaim Timeout (buyer)")
    ]
    add_academic_table(doc, comp_headers, comp_rows, col_widths=[1.2, 1.3, 1.3, 1.3, 1.4])

def build_section_6(doc):
    """Section 6: Implementation Details."""
    add_heading_1(doc, "6.0 IMPLEMENTATION DETAILS")
    
    add_heading_2(doc, "6.1 Smart Contract Implementation (ZeroVault.sol)")
    add_paragraph(
        doc,
        "The core clearing engine of the protocol is encapsulated within `ZeroVault.sol`, a production-grade Solidity smart contract compiling under `^0.8.24`. "
        "The contract integrates OpenZeppelin's standard cryptographic and security libraries:",
        bold_prefix="Contract Architecture: "
    )
    add_paragraph(
        doc,
        "• `ReentrancyGuard`: Implements the `nonReentrant` modifier on all external mutating methods handling ether transfers (`lockBounty`, `revealAndClaim`, `reclaimBounty`). "
        "This strictly guards against recursive call hijacking by malicious smart contracts."
    )
    add_paragraph(
        doc,
        "• `AccessControl`: Manages granular administrative privileges through `DEFAULT_ADMIN_ROLE` and `ADMIN_ROLE`. The administrative key is restricted to updating "
        "buyer KYC status (`setKYCStatus`) and triggering emergency circuit-breaker pauses. The admin possesses zero ability to seize escrowed ether or modify listing parameters."
    )
    add_paragraph(
        doc,
        "• `Pausable`: Provides emergency circuit-breaker controls (`pause()`, `unpause()`) callable exclusively by `DEFAULT_ADMIN_ROLE` to freeze state transitions "
        "in the event of anomalous network conditions without risking locked funds."
    )
    add_paragraph(
        doc,
        "• Parameterized Constructor Timeouts: The contract constructor accepts two explicit duration arguments: `constructor(uint256 deadManSwitchWindow, uint256 reclaimWindow)`. "
        "This architectural choice allows seamless deployment of production instances (7-day commit timeout, 14-day reclaim timeout) alongside automated evaluation instances "
        "(5-minute commit timeout, 10-minute reclaim timeout) without hardcoding values."
    )

    add_heading_2(doc, "6.2 Consensus, Verification & Economic Incentive Game Dynamics")
    add_paragraph(
        doc,
        "The settlement mechanism of ZeroVault is engineered to establish a game-theoretic Nash equilibrium where honest adherence is the strictly dominant strategy for both players:",
        bold_prefix="Game-Theoretic Incentive Matrix: "
    )
    add_paragraph(
        doc,
        "1. Buyer Funding Incentive: The buyer inspects client-verified Merkle proof claims. Because the Merkle root R is fixed on-chain, the buyer knows the seller cannot "
        "alter the vulnerability attributes after funding. Furthermore, if the seller refuses to reveal the key, the buyer is guaranteed a 100% refund after `RECLAIM_TIMEOUT`."
    )
    add_paragraph(
        doc,
        "2. Seller Settlement Incentive: The seller observes that the buyer's bounty is locked in the contract. The seller cannot withdraw funds without supplying K "
        "such that `keccak256(K) == keyHash`. If the seller reveals a valid key, the payout is transferred atomically. If the seller stalls, the buyer reclaims funds, "
        "leaving the seller with zero profit. Therefore, the seller's optimal strategy is to reveal K immediately."
    )
    add_paragraph(
        doc,
        "3. Dead Man's Switch Protection: If a researcher commits an exploit and the designated vendor refuses to engage or attempts to stall, the researcher triggers "
        "`triggerDeadMansSwitch()` after `COMMIT_TIMEOUT`. The state transitions to `EXPIRED`, officially authorizing the researcher to disclose the vulnerability "
        "publicly or re-list it for other vendors, mitigating buyer hold-up strategies."
    )

    add_heading_2(doc, "6.3 Cryptographic Subsystems: AES-256-GCM & Keccak-256 Merkle Engine")
    add_paragraph(
        doc,
        "The cryptographic operations are divided between client-side browser execution and smart contract EVM verification:",
        bold_prefix="Cryptographic Pipeline: "
    )
    add_paragraph(
        doc,
        "• Symmetric Payload Encryption: Executed in the browser prior to network transmission using AES-256-GCM with a 256-bit key and 96-bit initialization vector. "
        "Authenticated encryption guarantees both confidentiality and ciphertext integrity; any tampering with the stored ciphertext causes GCM decryption to fail immediately."
    )
    add_paragraph(
        doc,
        "• Merkle Tree Generation: Constructed using `merkletreejs` with Keccak-256 and `sortPairs: true`. Sorting sibling pairs lexicographically eliminates the vulnerability "
        "where an attacker re-orders proof siblings to produce ambiguous intermediate nodes."
    )
    add_paragraph(
        doc,
        "• Client-Side Proof Verification: When a buyer inspects a listing, the Next.js client executes OpenZeppelin-compatible Merkle verification in JavaScript, "
        "recomputing the root from the leaf hash and proof path to validate against the smart contract's state."
    )

    add_heading_2(doc, "6.4 Full-Stack Software Architecture: Express Gateway, Next.js 14, Viem")
    add_paragraph(
        doc,
        "The full-stack implementation links blockchain primitives with enterprise web engineering:",
        bold_prefix="Stack Architecture: "
    )
    add_paragraph(
        doc,
        "• Express.js API Gateway: Structured around modular domain controllers (`auth.controller.ts`, `listings.controller.ts`, `admin.controller.ts`). Request payloads "
        "are strictly validated using Zod schemas. Route-level middleware enforces role permissions and in-memory sliding-window rate limiting (`express-rate-limit`)."
    )
    add_paragraph(
        doc,
        "• Sign-In with Ethereum (SIWE): Eliminates traditional passwords. The server generates a cryptographically random nonce stored in the user's session record. "
        "The client signs an EIP-4361 standard message using their Ethereum private key. The backend validates the signature via `viem/siwe`, confirms account binding, "
        "and sets a secure 24-hour HttpOnly cookie."
    )
    add_paragraph(
        doc,
        "• Next.js 14 Web3 Frontend: Features an intuitive dark-themed user interface styled with Tailwind CSS. Integrates Wagmi and Viem hooks (`useAccount`, `useContractWrite`, "
        "`useWaitForTransactionReceipt`) to provide real-time transaction lifecycle feedback, progress steppers, and reactive badge state updates."
    )

print("Section data 2 built successfully.")
