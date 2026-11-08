// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ZeroVault
 * @dev Trustless escrow and partial-disclosure system for zero-day vulnerability sales.
 * @notice v2 introduces:
 *         - Mandatory askingPrice enforcement at commit to defeat 0.001 ETH griefing locks.
 *         - On-chain IPFS payload CID hash storage for verifiable decentralized ciphertext availability.
 *         - Buyer public key registration (secp256k1) at bounty lock for asymmetric ECIES encryption.
 *         - Atomic keyHash verification + ECIES ciphertext delivery in revealAndClaim() preventing
 *           both MEV theft and fake-ciphertext bounty theft.
 *         - Pause clock freeze & time dilation accumulator across commit and lock phases.
 *         - CEI pattern, ReentrancyGuard, AccessControl, and pull-over-push internal refund ledger.
 */
contract ZeroVault is ReentrancyGuard, AccessControl, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum State {
        NONE,
        COMMITTED,
        BOUNTY_LOCKED,
        SETTLED,
        EXPIRED,
        REFUNDED
    }

    struct Escrow {
        bytes32 keyHash;
        bytes32 ipfsHash;
        address seller;
        address vendor;
        uint256 askingPrice;
        uint256 bountyAmount;
        uint256 commitTimestamp;
        uint256 bountyLockedAt;
        uint256 pauseOffset;
        bytes buyerPublicKey;
        bytes encryptedKey;
        State state;
    }

    /// @notice Minimum bounty amount to prevent dust attacks (0.001 ETH)
    uint256 public constant MIN_BOUNTY = 1e15;

    /// @notice Dead man's switch timeout
    uint256 public immutable COMMIT_TIMEOUT;

    /// @notice Reclaim timeout after bounty lock
    uint256 public immutable RECLAIM_TIMEOUT;

    /// @notice Timestamp when contract was paused (0 if not currently paused)
    uint256 public pausedAt;

    /// @notice Cumulative paused duration across all pause periods to dilate escrow deadlines
    uint256 public totalPausedTime;

    mapping(bytes32 => Escrow) public escrows;

    /// @notice KYC whitelist — only verified buyers can lock bounties
    mapping(address => bool) public isKYCVerified;

    /// @notice Internal refund/withdrawal ledger following pull-over-push pattern
    mapping(address => uint256) public refunds;

    event VulnerabilityCommitted(
        bytes32 indexed merkleRoot,
        address indexed seller,
        address indexed vendor,
        bytes32 keyHash,
        uint256 askingPrice,
        bytes32 ipfsHash
    );
    event BountyLocked(
        bytes32 indexed merkleRoot,
        address indexed buyer,
        uint256 amount,
        bytes buyerPublicKey
    );
    event SettlementConfirmed(
        bytes32 indexed merkleRoot,
        bytes32 keyHash,
        bytes encryptedKey
    );
    event VaultExpired(bytes32 indexed merkleRoot);
    event BountyReclaimed(bytes32 indexed merkleRoot);
    event KYCStatusUpdated(address indexed user, bool status);
    event RefundWithdrawn(address indexed recipient, uint256 amount);

    error InvalidState();
    error Unauthorized();
    error InvalidKey();
    error TimeoutNotReached();
    error InvalidAmount();
    error EscrowAlreadyExists();
    error ZeroAddress();
    error KYCNotVerified();
    error TransferFailed();
    error InvalidHash();
    error ReclaimTimeoutPassed();

    constructor(uint256 deadManSwitchWindow, uint256 reclaimWindow) {
        COMMIT_TIMEOUT = deadManSwitchWindow;
        RECLAIM_TIMEOUT = reclaimWindow;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Commits a new vulnerability to the vault.
     * @param merkleRoot The Merkle root of the vulnerability payload leaves.
     * @param keyHash The keccak256 hash of the AES decryption key.
     * @param vendor The address of the authorized buyer/vendor (address(0) for open listing).
     * @param askingPrice The minimum bounty in Wei required to lock this listing.
     * @param ipfsHash The keccak256 digest of the IPFS CID containing the encrypted payload.
     */
    function commitVulnerability(
        bytes32 merkleRoot,
        bytes32 keyHash,
        address vendor,
        uint256 askingPrice,
        bytes32 ipfsHash
    ) external whenNotPaused {
        if (merkleRoot == bytes32(0) || keyHash == bytes32(0) || ipfsHash == bytes32(0)) {
            revert InvalidHash();
        }
        if (askingPrice < MIN_BOUNTY) {
            revert InvalidAmount();
        }
        if (escrows[merkleRoot].state != State.NONE) {
            revert EscrowAlreadyExists();
        }
        if (msg.sender == vendor) {
            revert Unauthorized();
        }

        escrows[merkleRoot] = Escrow({
            keyHash: keyHash,
            ipfsHash: ipfsHash,
            seller: msg.sender,
            vendor: vendor,
            askingPrice: askingPrice,
            bountyAmount: 0,
            commitTimestamp: block.timestamp,
            bountyLockedAt: 0,
            pauseOffset: totalPausedTime,
            buyerPublicKey: "",
            encryptedKey: "",
            state: State.COMMITTED
        });

        emit VulnerabilityCommitted(merkleRoot, msg.sender, vendor, keyHash, askingPrice, ipfsHash);
    }

    /**
     * @notice Verifies if a partial disclosure leaf is part of the committed Merkle root.
     * @param merkleRoot The Merkle root to verify against.
     * @param leaf The keccak256 hash of the leaf claim.
     * @param proof The Merkle proof array.
     * @return True if the proof is valid, false otherwise.
     */
    function verifyPartialLeaf(
        bytes32 merkleRoot,
        bytes32 leaf,
        bytes32[] calldata proof
    ) public pure returns (bool) {
        return MerkleProof.verify(proof, merkleRoot, leaf);
    }

    /**
     * @notice Locks the bounty for a committed vulnerability.
     * @dev Only the designated vendor (or any KYC buyer if open listing) can lock the bounty.
     *      Requires msg.value >= escrow.askingPrice and a valid secp256k1 public key.
     * @param merkleRoot The Merkle root identifying the escrow.
     * @param buyerPublicKey The secp256k1 public key of the buyer (33 bytes compressed or 65 bytes uncompressed).
     */
    function lockBounty(
        bytes32 merkleRoot,
        bytes calldata buyerPublicKey
    ) external payable nonReentrant whenNotPaused {
        Escrow storage escrow = escrows[merkleRoot];
        if (escrow.state != State.COMMITTED) {
            revert InvalidState();
        }
        if (!isKYCVerified[msg.sender]) {
            revert KYCNotVerified();
        }

        // Validate public key formatting (compressed 33B or uncompressed 65B)
        bool isValidKey = (buyerPublicKey.length == 33 && (buyerPublicKey[0] == 0x02 || buyerPublicKey[0] == 0x03)) ||
                          (buyerPublicKey.length == 65 && buyerPublicKey[0] == 0x04);
        if (!isValidKey) {
            revert InvalidKey();
        }

        if (escrow.vendor == address(0)) {
            if (msg.sender == escrow.seller) revert Unauthorized();
            escrow.vendor = msg.sender;
        } else if (msg.sender != escrow.vendor) {
            revert Unauthorized();
        }

        if (msg.value < escrow.askingPrice) {
            revert InvalidAmount();
        }

        // EFFECTS
        escrow.bountyAmount = msg.value;
        escrow.bountyLockedAt = block.timestamp;
        escrow.pauseOffset = totalPausedTime;
        escrow.buyerPublicKey = buyerPublicKey;
        escrow.state = State.BOUNTY_LOCKED;

        emit BountyLocked(merkleRoot, msg.sender, msg.value, buyerPublicKey);
    }

    /**
     * @notice Atomically verifies keyHash and reveals the ECIES-encrypted key for the buyer.
     * @dev Guarantees both:
     *      1. The seller proves knowledge of the true key: keccak256(decryptionKey) == escrow.keyHash.
     *      2. The delivered encryptedKeyForBuyer is emitted on-chain for the buyer.
     * @param merkleRoot The Merkle root identifying the escrow.
     * @param decryptionKey The pre-image key bytes satisfying keccak256(decryptionKey) == escrow.keyHash.
     * @param encryptedKeyForBuyer The ECIES ciphertext payload encrypted with buyerPublicKey (>= 65 bytes).
     */
    function revealAndClaim(
        bytes32 merkleRoot,
        bytes calldata decryptionKey,
        bytes calldata encryptedKeyForBuyer
    ) external nonReentrant whenNotPaused {
        Escrow storage escrow = escrows[merkleRoot];

        // CHECKS
        if (escrow.state != State.BOUNTY_LOCKED) {
            revert InvalidState();
        }
        if (msg.sender != escrow.seller) {
            revert Unauthorized();
        }
        if (encryptedKeyForBuyer.length < 65) {
            revert InvalidKey();
        }
        if (keccak256(decryptionKey) != escrow.keyHash) {
            revert InvalidKey();
        }

        // Calculate paused duration during this active lock period
        uint256 pausedDuration = totalPausedTime - escrow.pauseOffset;
        if (block.timestamp > escrow.bountyLockedAt + RECLAIM_TIMEOUT + pausedDuration) {
            revert ReclaimTimeoutPassed();
        }

        // EFFECTS
        escrow.state = State.SETTLED;
        escrow.encryptedKey = encryptedKeyForBuyer;
        uint256 amount = escrow.bountyAmount;
        escrow.bountyAmount = 0;
        refunds[escrow.seller] += amount;

        emit SettlementConfirmed(merkleRoot, escrow.keyHash, encryptedKeyForBuyer);
    }

    /**
     * @notice Triggers the dead man's switch if the vendor fails to lock the bounty within the commit window.
     * @dev Only the seller can trigger this. Dilates timeout by totalPausedTime during commit phase.
     * @param merkleRoot The Merkle root identifying the escrow.
     */
    function triggerDeadMansSwitch(bytes32 merkleRoot) external whenNotPaused {
        Escrow storage escrow = escrows[merkleRoot];
        if (escrow.state != State.COMMITTED) {
            revert InvalidState();
        }
        if (msg.sender != escrow.seller) {
            revert Unauthorized();
        }
        
        uint256 pausedDuration = totalPausedTime - escrow.pauseOffset;
        if (block.timestamp <= escrow.commitTimestamp + COMMIT_TIMEOUT + pausedDuration) {
            revert TimeoutNotReached();
        }

        escrow.state = State.EXPIRED;
        emit VaultExpired(merkleRoot);
    }

    /**
     * @notice Reclaims the locked bounty if the seller fails to reveal within the reclaim timeout.
     * @dev Dilates timeout by totalPausedTime to prevent griefing seller during emergency pauses.
     * @param merkleRoot The Merkle root identifying the escrow.
     */
    function reclaimBounty(bytes32 merkleRoot) external nonReentrant whenNotPaused {
        Escrow storage escrow = escrows[merkleRoot];
        if (escrow.state != State.BOUNTY_LOCKED) {
            revert InvalidState();
        }
        if (msg.sender != escrow.vendor) {
            revert Unauthorized();
        }

        uint256 pausedDuration = totalPausedTime - escrow.pauseOffset;
        if (block.timestamp <= escrow.bountyLockedAt + RECLAIM_TIMEOUT + pausedDuration) {
            revert TimeoutNotReached();
        }

        // EFFECTS
        escrow.state = State.REFUNDED;
        uint256 amount = escrow.bountyAmount;
        escrow.bountyAmount = 0;
        refunds[escrow.vendor] += amount;

        emit BountyReclaimed(merkleRoot);
    }

    /**
     * @notice Withdraws available funds from the internal refunds/payout ledger.
     * @dev Follows CEI pattern and pull-over-push design to eliminate push-payment DoS vectors.
     */
    function withdrawRefund() external nonReentrant whenNotPaused {
        uint256 amount = refunds[msg.sender];
        if (amount == 0) {
            revert InvalidAmount();
        }

        // EFFECTS
        refunds[msg.sender] = 0;

        // INTERACTIONS
        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit RefundWithdrawn(msg.sender, amount);
    }

    /**
     * @notice Sets the KYC verification status for a buyer address.
     * @dev Only ADMIN_ROLE can call this.
     * @param user The address to verify/unverify.
     * @param status True to verify, false to revoke.
     */
    function setKYCStatus(address user, bool status) external onlyRole(ADMIN_ROLE) {
        isKYCVerified[user] = status;
        emit KYCStatusUpdated(user, status);
    }

    /// @notice Emergency pause — only admin. Captures timestamp to dilate active escrow clocks.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        pausedAt = block.timestamp;
    }

    /// @notice Unpause — only admin. Accumulates paused time into totalPausedTime.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        totalPausedTime += (block.timestamp - pausedAt);
        pausedAt = 0;
    }

    /**
     * @notice Helper to compute effective elapsed active lock time for an escrow.
     * @dev Returns 0 if escrow is not in BOUNTY_LOCKED state.
     */
    function getActiveLockElapsed(bytes32 merkleRoot) external view returns (uint256) {
        Escrow storage escrow = escrows[merkleRoot];
        if (escrow.state != State.BOUNTY_LOCKED || escrow.bountyLockedAt == 0) return 0;
        uint256 pausedTime = totalPausedTime - escrow.pauseOffset;
        if (paused()) {
            pausedTime += (block.timestamp - pausedAt);
        }
        uint256 totalElapsed = block.timestamp - escrow.bountyLockedAt;
        return totalElapsed > pausedTime ? totalElapsed - pausedTime : 0;
    }
}
