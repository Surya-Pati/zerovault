# ZeroVault - Frontend Specification Document

ZeroVault is a trustless blockchain escrow and partial-disclosure system for zero-day vulnerability sales. This document outlines the frontend design, layout, component architecture, and integration specifications. The design reflects a PREMIUM, DARK, and SOPHISTICATED cybersecurity-themed aesthetic, leveraging glassmorphism, deep dark backgrounds, and neon accents.

---

## 1. Color Palette

The color scheme emphasizes a stealthy, hacker-centric look with high-contrast electric accents. *Note: All exact hex codes listed below must be mapped to semantic CSS variables in `tailwind.config.ts` (e.g., `--background`, `--primary-accent`) rather than using hardcoded utility classes in the JSX.*

| Category | Description | Hex Code |
| :--- | :--- | :--- |
| **Background** | Deep dark primary background | `#0A0E1A` |
| **Background Sec** | Secondary deep dark (e.g. sidebar) | `#0F1419` |
| **Surface/Card** | Glassmorphic card backgrounds | `rgba(15, 23, 42, 0.8)` |
| **Primary Accent** | Cyan / electric blue | `#06B6D4` / `#22D3EE` |
| **Secondary Accent**| Emerald green | `#10B981` / `#34D399` |
| **Warning** | Amber for warnings / pending states | `#F59E0B` |
| **Danger/Critical** | Red for errors, critical alerts | `#EF4444` |
| **Text Primary** | White for headings and primary content | `#F8FAFC` |
| **Text Secondary** | Slate gray for secondary text/labels | `#94A3B8` |
| **Border** | Subtle cyan glow borders | `rgba(6, 182, 212, 0.2)` |

### Gradients & Severity Colors

- **Primary Gradient**: Cyan to Emerald (`linear-gradient(135deg, #06B6D4 0%, #10B981 100%)`) - Used for primary CTAs and active state highlights.
- **Critical**: `#EF4444`
- **High**: `#F97316`
- **Medium**: `#F59E0B`
- **Low**: `#22C55E`
- **Info**: `#3B82F6`

---

## 2. Typography

Clean, modern typography is essential for both readability and a technical aesthetic.

- **Font Families**:
  - **Body / General UI**: `Inter` (Google Fonts)
  - **Code / Hashes / Addresses / Logs**: `JetBrains Mono`

- **Headings (Inter, -0.025em letter spacing)**:
  - `h1`: 36px (2.25rem), Bold (700)
  - `h2`: 30px (1.875rem), Semibold (600)
  - `h3`: 24px (1.5rem), Semibold (600)
  - `h4`: 20px (1.25rem), Medium (500)

- **Body (Inter, normal letter spacing)**:
  - **Base / Regular**: 16px (1rem), Regular (400)
  - **Small / Metadata**: 14px (0.875rem), Regular (400)
  - **Tiny / Tags**: 12px (0.75rem), Medium (500)

---

## 3. Component Styles

Detailed specifications for the ZeroVault UI library components, built with Tailwind CSS.

### 3.1 Buttons
- **Primary**:
  - **Style**: Gradient background (cyan→emerald), white text (`#F8FAFC`), rounded-lg (`8px`).
  - **Hover**: Subtle drop-shadow glow (`box-shadow: 0 0 12px rgba(6, 182, 212, 0.6)`), scale up slightly.
- **Secondary**:
  - **Style**: Transparent background with 1px solid cyan border (`#06B6D4`), cyan text.
  - **Hover**: Fill with cyan (`#06B6D4`), white text.
- **Danger**:
  - **Style**: Transparent background, red border (`#EF4444`), red text.
  - **Hover**: Fill with red (`#EF4444`), white text.
- **Disabled**:
  - **Style**: Opacity 50%, grayscale filter or default gray background, `cursor-not-allowed`, no hover effects.
- **Sizes**:
  - `sm`: 32px height, 14px text, padding-x 12px.
  - `md`: 40px height, 16px text, padding-x 16px.
  - `lg`: 48px height, 16px text, padding-x 24px.
- **Loading State**: Displays a spinning cyan gradient ring; text is hidden or shifted right.

### 3.2 Cards
- **Base Style**: `backdrop-blur-xl`, background `rgba(15, 23, 42, 0.8)`, rounded-xl (`12px`), 1px solid border (`rgba(6, 182, 212, 0.2)`).
- **Hover State**: Slight lift (`translateY(-2px)`), border glow intensifies (`rgba(6, 182, 212, 0.5)`).
- **Variants**:
  - *ListingCard*: Compact, displays title, severity badge, price in ETH, and seller truncated address.
  - *StatsCard*: Features large numeric values (using `JetBrains Mono`), small labels, and an icon with a cyan tint.
  - *EscrowStatusCard*: Includes a progress stepper and transaction hash details.

### 3.3 Inputs & Forms
- **Base Style**: Background `#0F1419`, 1px solid border (`#334155`), rounded-lg, text `#F8FAFC`.
- **Focus State**: Outline-none, border turns `#06B6D4`, subtle box-shadow glow.
- **Error State**: Border `#EF4444`, red error text below the input.
- **With Icon Prefix**: Input padding-left accommodates a 20x20px icon (e.g., wallet, email, search).

### 3.4 Badges & Pills
- **Style**: Rounded-full, padding-x 8px, padding-y 2px, 12px font size, uppercase.
- **Severity**:
  - *Critical*: bg-red-900/50, text-red-400, border-red-500/30
  - *High*: bg-orange-900/50, text-orange-400, border-orange-500/30
  - *Medium*: bg-amber-900/50, text-amber-400, border-amber-500/30
  - *Low*: bg-green-900/50, text-green-400, border-green-500/30
- **Status**:
  - *Draft*: bg-slate-800, text-slate-400
  - *Listed*: bg-blue-900/50, text-blue-400
  - *Committed*: bg-purple-900/50, text-purple-400
  - *Bounty Locked*: bg-amber-900/50, text-amber-400
  - *Settled*: bg-green-900/50, text-green-400
  - *Expired*: bg-orange-900/50, text-orange-400
  - *Refunded*: bg-red-900/50, text-red-400
- **Role**:
  - *Researcher*: Purple accent
  - *Buyer*: Blue accent
  - *Admin*: Gold accent

### 3.5 Navigation
- **Sidebar (Desktop)**: Fixed left, width 280px, background `#0F1419`. Menu items feature an icon + label. Active item gets a cyan left border and cyan text.
- **Top Navbar**: Sticky top, `backdrop-blur-md` background, borders bottom `rgba(6, 182, 212, 0.2)`. Displays global search, wallet address pill (truncated), role badge, and user avatar/dropdown.

### 3.6 Modals
- **Style**: Centered screen, background `rgba(0,0,0,0.7)` backdrop blur. Modal content box follows Card base style (glassmorphic).
- **Animation**: Smooth entrance (fade in + scale from 0.95 to 1.0).
- **Variants**: Confirmation modals (danger action requires typing 'CONFIRM'), Wallet connection modal, Merkle Proof details modal.

### 3.7 Tables
- **Style**: Full width, text-left. Headers use 12px uppercase slate text.
- **Rows**: Striped (alternating `rgba(255,255,255,0.02)`), hover highlight (`rgba(6, 182, 212, 0.1)`).
- **Features**: Sortable headers with chevron icons. JetBrains Mono used for IDs, TX Hashes, and Values.

### 3.8 Status Indicators & Merkle Badges
- **Status Dots**: 8x8px animated pulse dots. Green (Active/Success), Yellow (Pending), Red (Error).
- **Progress Stepper**: Horizontal steps (COMMITTED → PROOF_VERIFIED → BOUNTY_LOCKED → SETTLED). Active step gets cyan glow, completed gets green check, pending gets gray outline. Terminal states EXPIRED and REFUNDED break the stepper visually with a red or orange warning indicator.
- **Merkle Proof Badge**:
  - *Verifying*: Cyan scanning bar animation over a hash string.
  - *Valid*: Turns emerald, animated checkmark icon pops in.
  - *Invalid*: Turns red, animated 'X' icon shakes.

---

## 4. Spacing & Layout Rules

ZeroVault uses an 8pt/4px grid system.

- **Base Unit**: `4px`
- **Page Padding**: `24px` on mobile/tablet, `32px` on desktop.
- **Card Padding**: `24px` internal padding.
- **Gaps**: `16px` (mobile), `24px` (desktop) between cards and grid items.
- **Sidebar**:
  - Desktop: `280px` fixed width.
  - Tablet: Collapsed to `64px` (icons only).
  - Mobile: Hidden, accessible via hamburger menu.
- **Max Content Width**: `1280px` (centered).
- **Responsive Breakpoints**:
  - Mobile: `375px` - `767px`
  - Tablet: `768px` - `1023px`
  - Desktop: `1024px` - `1439px`
  - Wide: `1440px+`
  - Scope Note: V1 explicitly restricts scope to native ETH settlement, cryptographic proof verification without sandboxed code execution, and responsive web clients to ensure core escrow security.

---

## 5. Page Specifications

### 5.1 Landing Page
- **Layout**: Full-width scrolling page.
- **Components**:
  - Hero Section: Large h1, gradient text, animated background (matrix-style or glowing nodes), "Connect Wallet" / "Explore Zero-Days" CTA buttons.
  - Features Grid: 3-column glassmorphic cards detailing "Trustless Escrow", "Partial Disclosure", "Instant Settlement".
  - How-it-Works: Vertical timeline stepper.
- **Data**: Static marketing copy, live network stats (Total Escrowed Volume, Active Listings).

### 5.2 Login / Register
- **Layout**: Centered card on a deep dark background.
- **Components**: SIWE (Sign-In with Ethereum, EIP-4361) wallet authentication card. Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope.
- **Interactions**: Clicking "Connect Wallet" triggers SIWE flow via MetaMask.

### 5.3 Researcher Dashboard
- **Layout**: Sidebar navigation + Main content area.
- **Components**:
  - Stats Cards (Total Earned, Active Listings, Success Rate).
  - "My Listings" Table (Sortable by date, status, severity).
  - Quick Action button: "Submit New Vulnerability".
- **Responsive**: Stats cards stack on mobile. Table becomes horizontally scrollable.

### 5.4 Buyer Dashboard
- **Layout**: Sidebar navigation + Main content area.
- **Components**:
  - Banner warning if `verified_buyer` flag is false (Requires KYC/Admin approval).
  - Stats Cards (Total Spent, Active Escrows, Verified Zero-Days).
  - "Browse Top Listings" horizontal scroll or grid.
  - "My Escrows" Table.

### 5.5 Admin Dashboard
- **Layout**: Sidebar navigation + Main content area.
- **Components**:
  - User Verification Queue Table (Approve/Reject buttons).
  - System Stats (Platform fees generated, Total Users).
  - Global Escrow Override tools (Emergency stop / pause via single administrative key). Scope Note: V1 uses a single administrative key for KYC whitelisting and emergency pause to simplify testnet operations ahead of multi-sig (Gnosis Safe) governance transition.

### 5.6 Listings Browse
- **Layout**: 1/4 width filter sidebar, 3/4 width results grid.
- **Components**:
  - Filters: Severity checkboxes, Price range slider, Category dropdown.
  - View Toggle: Grid vs. List view icons.
  - Search Bar: Search by title, CVE (if applicable), or listing ID.
  - ListingCards: Click to navigate to details.

### 5.7 Listing Detail - Buyer View
- **Layout**: 2-column on desktop (Left: Details & Partial Disclosure, Right: Action Card / Escrow).
- **Components**:
  - Header: Title, Severity Badge, Price.
  - Partial Disclosure Section: Tree UI or list of hashed leaves, with one or two revealed leaves.
  - Merkle Proof Badge: Verifies the revealed leaves against the on-chain Merkle Root.
  - Action Card: Displays contract address, current state. CTA: "Lock Bounty" (disabled if not verified buyer). After settlement, reflects fetching the decryption key from the contract event and downloading the encrypted payload from private storage (as it moves out of shared storage within 5 min). Adds "Reclaim Bounty" CTA if reclaim timeout has passed since BOUNTY_LOCKED without a reveal (14 days prod / 10 mins demo). Scope Note: V1 implements parameterized constructor timeouts allowing dual testnet/demo deployments (5m/10m for evaluation alongside production 7d/14d) without hardcoding.

### 5.8 Listing Detail - Seller View
- **Layout**: Similar to Buyer View, but with management controls.
- **Components**:
  - Status Timeline: Draft -> Listed -> COMMITTED -> BOUNTY_LOCKED -> SETTLED.
  - Action Card: If BOUNTY_LOCKED, button to "Reveal Decryption Key" (triggers `revealAndClaim` on-chain, which checks `keccak256(key) == keyHash` and atomically claims funds with no dispute window). Scope Note: V1 uses atomic single-transaction key revelation and payout verification (`revealAndClaim`), eliminating subjective dispute mediation and counterparty escrow lockup risks. Add "Trigger Dead Man's Switch" action if unfunded for commit timeout (7 days prod / 5 mins demo, sets EXPIRED). Scope Note: V1 implements parameterized constructor timeouts allowing dual testnet/demo deployments (5m/10m for evaluation alongside production 7d/14d) without hardcoding.

### 5.9 Create Listing (Wizard)
- **Layout**: Centered narrow container (`max-w-3xl`), Stepper at top.
- **Steps**:
  1. *Details*: Title, Category, Severity, Price.
  2. *Payload*: Upload/paste full exploit details. Frontend encrypts this locally using AES-256-GCM.
  3. *Merkle Tree*: Define structure, select which nodes to partially reveal. Frontend generates the Merkle Tree, Root, and Proofs.
  4. *Review*: Final check of unencrypted vs encrypted data, Root Hash verification.
  5. *Submit*: Signs tx to list on-chain, uploads encrypted payload to local encrypted filesystem storage behind an IPFS-compatible interface and proofs to backend. Scope Note: V1 uses local encrypted filesystem storage behind an IPFS-compatible interface, designed for a drop-in swap to pinning services post-MVP.

### 5.10 Admin Buyer Verification
- **Layout**: Detail view of a specific user.
- **Data**: Wallet address, Email, KYC details (simulated).
- **Interactions**: "Approve Buyer" (updates DB `verified_buyer` flag), "Reject Buyer".

---

## 6. Animations & Micro-interactions

- **Page Transitions**: Next.js Framer Motion implementation; slight fade in (`opacity 0 -> 1`) and slide up (`translateY 10px -> 0`) over 300ms.
- **Card Hover**: `transition-transform duration-300 hover:-translate-y-1 hover:shadow-cyan-glow`.
- **Button Hover**: Continuous soft pulse on gradient backgrounds using CSS `@keyframes`.
- **Loading States**: Skeleton screens with a shimmering gradient effect `linear-gradient(-45deg, #0F1419, #1E293B, #0F1419)`.
- **Toast Notifications**: Slide in from top-right, auto-dismiss after 4 seconds. Progress bar at bottom of toast.
- **Merkle Verification**:
  - Scanning: A bright cyan horizontal line moves down the hash string.
  - Success: Hash text turns green, checkmark scales in `scale(0 -> 1)`.
  - **Numbers**: Count-up animation on dashboard stats on mount (e.g., 0 to 14.5 ETH over 1.5s).

---

## 7. API & Integration Spec

The frontend will use **React Server Components (RSC)** for initial data fetching and **Server Actions** for mutations (like creating listings or verifying buyers). Client-side fetching (e.g., using SWR or React Query) will be reserved strictly as a fallback for highly dynamic real-time data.
Headers will rely on a single secure, 24-hour `HttpOnly` session cookie accessed directly on the server to ensure session tokens never touch the client bundle. Scope Note: V1 employs a single 24-hour HttpOnly session cookie to avoid refresh token rotation state overhead while maintaining strict XSS-resistant session security.
The backend API enforces in-memory rate limiting. Scope Note: V1 implements in-memory rate limiting to minimize external infrastructure dependencies during MVP phase, with Redis drop-in planned for distributed multi-instance deployment.

| Endpoint | Method | Auth Req | Payload | Response | Error | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/auth/wallet-connect` | `POST` | No | `{ message, signature }` | `{ user, token }` | `401 Bad Sig` | Login / Auth Page (SIWE). Scope Note: V1 relies strictly on SIWE-only wallet authentication to preserve pseudonymity and eliminate credential/password database attack surfaces in MVP scope. |
| `/auth/logout` | `POST` | Yes | `{}` | `{ success }` | - | Navbar |
| `/listings` | `GET` | Yes | Query params: `page, severity, search` | `{ data: Listing[], count }` | `500 Server Error` | Browse Page |
| `/listings` | `POST` | Yes (Seller) | `{ title, root, price, encrypted_uri, ... }` | `{ listing }` | `400 Bad Request` | Create Listing |
| `/listings/:id` | `GET` | Yes | - | `{ listing }` | `404 Not Found` | Listing Detail |
| `/listings/:id` | `PUT` | Yes (Seller) | `{ status, ... }` | `{ listing }` | `403 Forbidden` | Edit Listing |
| `/disclosure/:id/reveal` | `POST` | Yes (Seller) | `{ leaves, proofs }` | `{ success }` | `400 Invalid Proof` | Listing Wizard |
| `/disclosure/:id/proofs` | `GET` | Yes | - | `{ proofs: DisclosureProof[] }` | `404 Not Found` | Buyer Detail View |
| `/escrow/fund` | `POST` | Yes (Buyer) | `{ listingId, txHash }` | `{ escrow }` | `400 Unverified Buyer` | Buyer Lock Bounty Action |
| `/escrow/reveal` | `POST` | Yes (Seller) | `{ listingId, txHash }` | `{ escrow }` | `400 Invalid TX` | Seller Reveal Action |
| `/listings/:id/payload` | `GET` | Yes (Buyer) | - | `{ payload_uri }` | `403 Not Settled` | Post-Settle Payload Download from local storage. Scope Note: V1 uses local encrypted filesystem storage behind an IPFS-compatible interface, designed for a drop-in swap to pinning services post-MVP. |
| `/admin/verify-buyer` | `POST` | Yes (Admin) | `{ buyerId, status }` | `{ success }` | `403 Forbidden` | Admin Verification |

### Web3 (wagmi hooks)
- `useConnect`: Trigger wallet modal (MetaMask).
- `useAccount`: Display active wallet and role in Navbar.
- `useContractWrite`: Used for `lockBounty` (Buyer) and `revealAndClaim` (Seller) on the ZeroVault Smart Contract.
- `useContractRead`: Check current on-chain status of a specific listing's escrow.
- `useWaitForTransaction`: Show pending status, trigger backend API updates (like `/escrow/fund`) only after successful block confirmation.
