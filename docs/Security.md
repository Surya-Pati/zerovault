# ZeroVault Security & Access Document

This document outlines the security architecture, access control mechanisms, cryptographic protocols, and edge case handling for ZeroVault — a trustless blockchain escrow and partial-disclosure system for zero-day vulnerability sales.

---

## 1. Authentication Methods

ZeroVault implements SIWE (Sign-In with Ethereum, EIP-4361) wallet authentication as the sole authentication mechanism. Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope.

### SIWE (Sign-In with Ethereum)
The primary authentication method follows the EIP-4361 standard, allowing users to authenticate using their Ethereum wallets.

**Authentication Flow:**
1. **Nonce Generation:** The frontend requests a cryptographic nonce from the backend. The backend generates a secure, random string and stores it temporarily (tied to the user's session or IP).
2. **Message Construction:** The frontend constructs an EIP-4361 compliant message containing the domain, wallet address, requested statement, URI, version, chain ID, nonce, and issuance timestamp.
3. **Signature:** The user signs the message using their Web3 wallet (e.g., MetaMask).
4. **Verification:** The signature and message are sent to the backend. The backend verifies the signature against the provided wallet address and ensures the nonce matches the stored value and hasn't expired.
5. **Account Binding:** If the wallet address matches an existing user, they are authenticated. If it's a new address, a new user account is provisioned and bound to this address.

### Email/Password (Omitted from V1 Scope)
Email/password registration and argon2 password hashing are excluded from V1. Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope.

### Session Management
ZeroVault relies on JSON Web Tokens (JWT) for stateless session management.

- **Storage:** JWTs are stored in `httpOnly`, `Secure`, `SameSite=Strict` cookies to prevent Cross-Site Scripting (XSS).
- **CSRF Protection:** Because `SameSite=Strict` is not a bulletproof defense against Cross-Site Request Forgery (CSRF) on older browsers or complex subdomains, all non-Web3 session-cookie endpoints (e.g., listing edits, admin `verify-buyer`) are additionally hardened using a double-submit-cookie approach (`csrf-csrf` package) or custom headers. Note: on-chain payable functions (`lockBounty`, `revealAndClaim`) are inherently immune to CSRF because they require an explicit wallet signature prompt.
- **Payload Structure:** 
  ```json
  {
    "userId": "uuid-v4",
    "role": "researcher" | "buyer" | "admin",
    "walletAddress": "0x...",
    "iat": 1690000000,
    "exp": 1690086400
  }
  ```
- **Expiry & Session Strategy:** ZeroVault employs a single stateless 24-hour HttpOnly session JWT cookie. Scope Note: V1 employs a single 24-hour HttpOnly session cookie to avoid refresh token rotation state overhead while maintaining strict XSS-resistant session security.
- **Account Binding:** Each user account is strictly bound 1-to-1 to their verified Ethereum wallet address. Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope.

---

## 2. User Roles & Permissions

ZeroVault uses Role-Based Access Control (RBAC) to ensure strict data isolation and functional constraints.

### Complete RBAC Matrix

| Action | Researcher | Buyer (unverified) | Buyer (verified) | Admin |
|---|---|---|---|---|
| Create listing | ✅ | ❌ | ❌ | ❌ |
| Edit draft listing | ✅ own | ❌ | ❌ | ❌ |
| View listing metadata | ✅ | ✅ | ✅ | ✅ |
| View partial disclosure | ✅ own | ✅ | ✅ | ✅ |
| Request verification | ❌ | ✅ | ❌ | ❌ |
| Verify buyer | ❌ | ❌ | ❌ | ✅ |
| Fund escrow (Lock Bounty) | ❌ | ❌ | ✅ | ❌ |
| Reveal & Claim (Settlement) | ✅ own | ❌ | ❌ | ❌ |
| View decryption key | ✅ public on-chain | ✅ public on-chain | ✅ public on-chain | ✅ public on-chain |
| Manage users | ❌ | ❌ | ❌ | ✅ |

### Middleware Implementation

**Express.js Backend:**
Role-gating is handled via custom Express middleware. The `requireRole` middleware inspects the verified JWT payload.
```typescript
export const requireRole = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
    
    // Additional check for verified buyers
    if (userRole === 'buyer' && allowedRoles.includes('verified_buyer') && !req.user.verified_buyer) {
      return res.status(403).json({ error: 'Forbidden: Buyer verification required' });
    }
    next();
  };
};
```

**Frontend (Next.js):**
The UI dynamically adapts based on the JWT payload decoded on the client or verified via server-side rendering (SSR). UI components meant for specific roles are simply not rendered for unauthorized users, preventing UI clutter and accidental interaction attempts. Route protection is enforced via Next.js middleware, redirecting unauthorized users to the login/dashboard page.

---

## 3. Smart Contract Security

The ZeroVault escrow contract is the backbone of the trustless exchange. It is designed with rigorous security standards to handle high-value transactions safely.

- **ReentrancyGuard:** All payable/state-changing functions (`lockBounty`, `reclaimBounty`, `revealAndClaim`) utilize OpenZeppelin's `ReentrancyGuard` (`nonReentrant` modifier) to prevent reentrancy attacks where external calls could re-enter the contract before state changes are finalized.
- **Checks-Effects-Interactions Pattern:** All contract functions strictly adhere to this pattern. State variables are updated *before* any external calls or ether transfers occur.
- **Access Control & Governance:** 
  - Only the registered seller of a specific listing can create the escrow terms.
  - Only a buyer can fund the escrow (`lockBounty`).
  - Only the seller can trigger settlement via `revealAndClaim(key)`. The contract checks `keccak256(key) == keyHash` before paying the seller and emitting the key atomically on-chain with no dispute window. Scope Note: V1 uses atomic single-transaction key revelation and payout verification (`revealAndClaim`), eliminating subjective dispute mediation and counterparty escrow lockup risks.
  - Administrative actions (buyer KYC whitelisting and emergency pause circuit breaker) are governed by a single administrative key using OpenZeppelin AccessControl. Scope Note: V1 uses a single administrative key for KYC whitelisting and emergency pause to simplify testnet operations ahead of multi-sig (Gnosis Safe) governance transition.
- **Timeout-Based Escrow Resolution:** 
  - **Stalled Vendor (Commit Timeout):** If no bounty is locked within the commit timeout (7 days in production, 5 minutes in demo), anyone can call `triggerDeadMansSwitch`. The vault flags `EXPIRED` and the researcher is authorized to disclose metadata publicly. Scope Note: V1 implements parameterized constructor timeouts allowing dual testnet/demo deployments (5m/10m for evaluation alongside production 7d/14d) without hardcoding.
  - **Stalled Seller (Reclaim Timeout):** If the bounty is locked but the seller goes offline and fails to reveal the key, the vendor can call `reclaimBounty(merkleRoot)` after `bountyLockedAt + RECLAIM_TIMEOUT` (14 days in production, 10 minutes in demo). This refunds the vendor and sets the state to `REFUNDED` (distinct from `EXPIRED`). Scope Note: V1 implements parameterized constructor timeouts allowing dual testnet/demo deployments (5m/10m for evaluation alongside production 7d/14d) without hardcoding.
- **Event Emission:** Every state change (`VulnerabilityCommitted`, `BountyLocked`, `SettlementConfirmed`, `VaultExpired`, `BountyReclaimed`) emits detailed logs for an immutable audit trail and to trigger off-chain backend listeners.
- **No `delegatecall` / No `selfdestruct`:** The contract explicitly avoids `delegatecall` to untrusted contracts and does not implement `selfdestruct`, neutralizing two major attack vectors.
- **Integer Overflow Protection:** Native to Solidity ^0.8.0, protecting against arithmetic underflows and overflows without the need for SafeMath.

---

## 4. Cryptographic Security

Cryptographic guarantees are central to ZeroVault's partial-disclosure and safe delivery mechanisms.

### Merkle Tree Proofs
- **Leaf Hashing:** Every vulnerability detail is hashed using `keccak256`.
- **Proof Verification:** When a buyer requests a partial disclosure, the server provides a specific leaf (revealed value) and its corresponding Merkle proof.
- **Root Commitment:** The seller commits the `merkle_root` of the vulnerability data to the smart contract during listing creation. Buyers can independently verify the proof against this on-chain root to guarantee the partial disclosure belongs to the full payload.

### AES-256-GCM Encryption
- The full vulnerability payload is encrypted client-side or server-side (before storage) using AES-256-GCM.
- **IV/Nonce Management:** A unique, cryptographically secure Initialization Vector (IV) is generated for every encryption operation.
- **Key Wrapping:** The symmetric AES key is itself securely managed and wrapped.

### Decryption Key Release Strategy
- **On-Chain Commit/Reveal:** The seller commits to a `keyHash` when creating the vulnerability listing (`commitVulnerability(merkleRoot, keyHash)`). To claim the funds after a buyer locks the bounty, the seller must call `revealAndClaim(key)`. The contract verifies `keccak256(key) == keyHash`. If valid, the contract pays the seller and emits the key publicly on-chain with atomic instant settlement. Scope Note: V1 uses atomic single-transaction key revelation and payout verification (`revealAndClaim`), eliminating subjective dispute mediation and counterparty escrow lockup risks.
- **Post-Reveal Confidentiality:** After the decryption key is revealed on-chain and the escrow is settled, the ciphertext is moved out of shared storage into a buyer-only private storage bucket (or the shared copy is securely deleted) within 5 minutes of settlement. This ensures that the public cannot access the encrypted payload despite the key being public.

---

## 5. Data Protection

Protecting highly sensitive zero-day vulnerability data is paramount.

- **No Passwords Stored:** Password storage is completely eliminated; authentication is exclusively cryptographically signed via SIWE. Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope.
- **No Private Keys in Code:** Smart contract deployment keys, JWT secrets, and DB credentials are strictly managed via environment variables and external secret managers. None are committed to version control.
- **Encrypted Payload Storage:** The full vulnerability payload is encrypted *before* leaving the application layer and stored in local encrypted filesystem storage behind an IPFS-compatible interface. Scope Note: V1 uses local encrypted filesystem storage behind an IPFS-compatible interface, designed for a drop-in swap to pinning services post-MVP.
- **Zero-Knowledge Partial Disclosure:** Merkle proofs mathematically guarantee that revealing one node (partial disclosure) leaks zero information about the rest of the tree (the full payload).
- **Row-Level Security (RLS):** Implemented at the database level (PostgreSQL) and application layer to ensure users can only query their own listings, transactions, and proofs.
- **API Input Validation & In-Memory Rate Limiting:** All incoming API requests are strictly validated using **Zod** schemas, with sliding-window rate limiting enforced in-memory via `express-rate-limit`. Scope Note: V1 implements in-memory rate limiting to minimize external infrastructure dependencies during MVP phase, with Redis drop-in planned for distributed multi-instance deployment.

---

## 6. Error Handling Guide

A robust API requires predictable and secure error responses.

### Auth Errors
```json
// 401 Unauthorized - Expired JWT
{ "error": "auth_token_expired", "message": "Your session has expired. Please log in again." }

// 403 Forbidden - Wrong Role
{ "error": "forbidden_role", "message": "You do not have permission to perform this action." }
```

### Escrow Errors
```json
// 400 Bad Request - Insufficient Funds
{ "error": "escrow_insufficient_funds", "message": "Transaction value is less than the required listing price." }

// 409 Conflict - Wrong Listing State
{ "error": "escrow_invalid_state", "message": "This listing is already funded or settled." }
```

### Merkle Errors
```json
// 422 Unprocessable Entity - Invalid Proof
{ "error": "merkle_invalid_proof", "message": "The provided cryptographic proof is invalid or tampered." }
```

### API & Web3 Errors
```json
// 429 Too Many Requests
{ "error": "rate_limit_exceeded", "message": "Too many requests. Please try again in 15 minutes." }

// 502 Bad Gateway - Web3 RPC Timeout
{ "error": "web3_rpc_timeout", "message": "Failed to communicate with the blockchain network." }
```
Scope Note: V1 implements in-memory rate limiting to minimize external infrastructure dependencies during MVP phase, with Redis drop-in planned for distributed multi-instance deployment.

---

## 7. Edge Cases

The system is designed to gracefully handle various edge cases and malicious attempts:

- **User submits empty form fields:** Zod validation catches this immediately at the API gateway, returning a `400 Bad Request` with specific field errors.
- **User tries to access another user's listing:** RLS and controller-level ownership checks return a `403 Forbidden` or `404 Not Found` (to obscure existence).
- **Buyer tries to fund before admin verification:** The backend API and the smart contract (via signed authorization) reject the transaction. The UI disables the "Fund" button.
- **Seller tries to modify listing after escrow is funded:** The state machine locks the listing once status is `escrowed`. Any update API calls will return a `409 Conflict`.
- **Network drops during transaction:** The frontend relies on Web3 providers (wagmi/ethers) to track pending transactions. If the RPC fails, the user is prompted to check their wallet or block explorer. The backend strictly relies on confirmed on-chain events, ignoring pending states.
- **Double-funding attempt:** The smart contract strictly enforces state transitions. Once `status == BOUNTY_LOCKED`, the `lockBounty` function will revert.
- **Delayed payload moving:** If the backend fails to move the ciphertext within 5 minutes of settlement (due to downtime), the buyer's private storage bucket might be delayed, but the public cannot access the payload without the storage URI.
- **Stalled vendor (Dead Man's Switch):** If the vendor does not lock the bounty within the parameterized commit timeout (7 days in production, 5 minutes in demo), `triggerDeadMansSwitch` will mark the vault as `EXPIRED`. The researcher is then authorized to publicly disclose the vulnerability metadata. Scope Note: V1 implements parameterized constructor timeouts allowing dual testnet/demo deployments (5m/10m for evaluation alongside production 7d/14d) without hardcoding.
- **Stalled seller (Reclaim Bounty):** If the seller fails to call `revealAndClaim(key)` after the bounty is locked, the vendor can call `reclaimBounty(merkleRoot)` after `bountyLockedAt + RECLAIM_TIMEOUT` (14 days in production, 10 minutes in demo) to securely refund their locked funds. Scope Note: V1 implements parameterized constructor timeouts allowing dual testnet/demo deployments (5m/10m for evaluation alongside production 7d/14d) without hardcoding.
- **Multiple listings from same seller:** Handled seamlessly by unique `listing_id` and isolated Merkle roots per listing.
- **Admin tries to verify themselves as buyer:** Admins are prohibited from holding buyer roles or acting as buyers to prevent conflict of interest. RLS and middleware enforce role mutually exclusive constraints.

---

## 8. Threat Model

### Mitigated Attacks
- **Front-running (MEV):** Escrow funding does not reveal payload details; MEV bots cannot steal the zero-day by front-running the funding transaction.
- **Data Exfiltration:** Full payloads are encrypted at rest and in transit. DB dumps do not yield plaintext vulnerabilities.
- **Replay Attacks:** SIWE uses nonces to prevent replay of authentication signatures.
- **Sybil Attacks (Buyers):** Strict manual admin verification of institutional buyers prevents malicious actors from spamming escrow contracts.

### Out of Scope for v1
- **Key Forward Secrecy:** Since the decryption key is emitted publicly on-chain via the `revealAndClaim` transaction event, anyone monitoring the blockchain will have permanent access to the key. While the ciphertext is moved to private storage, any malicious actor who intercepted the ciphertext while it was in shared storage could retroactively decrypt it once the key is public.
- **Subjective Value Dispute & Arbitration:** The platform enforces atomic instant settlement (`revealAndClaim`) with zero dispute window, counterparty lockup, or third-party arbitrator intervention. Scope Note: V1 uses atomic single-transaction key revelation and payout verification (`revealAndClaim`), eliminating subjective dispute mediation and counterparty escrow lockup risks.
- **Advanced Side-Channel Attacks:** Browser-based side-channel attacks on the client-side memory during decryption are acknowledged but considered beyond the v1 threat model.
- **Mainnet Capital & Token Scope:** Deployments are strictly confined to Ethereum Sepolia testnet and local Hardhat environments, excluding ERC-20 tokens, dynamic exploit sandbox execution, and native mobile apps. Scope Note: V1 targets Ethereum Sepolia testnet and local Hardhat environments for risk-free zero-day escrow validation prior to mainnet capital deployment. Scope Note: V1 explicitly restricts scope to native ETH settlement, cryptographic proof verification without sandboxed code execution, and responsive web clients to ensure core escrow security.
