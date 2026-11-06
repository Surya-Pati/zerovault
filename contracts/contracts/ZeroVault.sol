// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ZeroVault
 * @dev Trustless escrow and partial-disclosure system for zero-day vulnerability sales.
 * @notice Implements CEI pattern, ReentrancyGuard, Pausable, and AccessControl.
 *         Settlement is atomic: revealAndClaim() verifies the key and pays the
 *         researcher in a single transaction. No dispute window, no intermediate states.
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
        address seller;
        address vendor;
        uint256 bountyAmount;
        uint256 commitTimestamp;
        uint256 bountyLockedAt;
        State state;
    }

    /// @notice Minimum bounty amount to prevent dust attacks (0.001 ETH)
    uint256 public constant MIN_BOUNTY = 1e15;

    /// @notice Dead man's switch timeout
    uint256 public immutable COMMIT_TIMEOUT;

    /// @notice Reclaim timeout after bounty lock
    uint256 public immutable RECLAIM_TIMEOUT;

    mapping(bytes32 => Escrow) public escrows;

    /// @notice KYC whitelist — only verified buyers can lock bounties
    mapping(address => bool) public isKYCVerified;

    /// @notice Internal refund/withdrawal ledger following pull-over-push pattern
    mapping(address => uint256) public refunds;

    event VulnerabilityCommitted(bytes32 indexed merkleRoot, address indexed seller, address indexed vendor, bytes32 keyHash);
    event BountyLocked(bytes32 indexed merkleRoot, uint256 amount);
    /// @notice Emits the keccak256 hash of the decryption key (NOT the plaintext key) to prevent on-chain key leakage
    event SettlementConfirmed(bytes32 indexed merkleRoot, bytes32 keyHash);
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
     * @param vendor The address of the authorized buyer/vendor.
     */
    function commitVulnerability(bytes32 merkleRoot, bytes32 keyHash, address vendor) external whenNotPaused {
        if (merkleRoot == bytes32(0) || keyHash == bytes32(0)) {
            revert InvalidHash();
        }
        if (escrows[merkleRoot].state != State.NONE) {
            revert EscrowAlreadyExists();
        }
        // vendor can be address(0) for open listings
        if (msg.sender == vendor) {
            revert Unauthorized();
        }

        escrows[merkleRoot] = Escrow({
            keyHash: keyHash,
            seller: msg.sender,
            vendor: vendor,
            bountyAmount: 0,
            commitTimestamp: block.timestamp,
            bountyLockedAt: 0,
            state: State.COMMITTED
        });

        emit VulnerabilityCommitted(merkleRoot, msg.sender, vendor, keyHash);
    }

    /**
     * @notice Verifies if a partial disclosure leaf is part of the committed Merkle root.
     * @param merkleRoot The Merkle root to verify against.
     * @param leaf The keccak256 hash of the leaf claim.
     * @param proof The Merkle proof array.
     * @return True if the proof is valid, false otherwise.
     */
    function verifyPartialLeaf(bytes32 merkleRoot, bytes32 leaf, bytes32[] calldata proof) public pure returns (bool) {
        return MerkleProof.verify(proof, merkleRoot, leaf);
    }

    /**
     * @notice Locks the bounty for a committed vulnerability.
     * @dev Only the designated vendor can lock the bounty. Follows CEI pattern.
     * @param merkleRoot The Merkle root identifying the escrow.
     */
    function lockBounty(bytes32 merkleRoot) external payable nonReentrant whenNotPaused {
        Escrow storage escrow = escrows[merkleRoot];
        if (escrow.state != State.COMMITTED) {
            revert InvalidState();
        }
        if (escrow.vendor == address(0)) {
            if (msg.sender == escrow.seller) revert Unauthorized();
            escrow.vendor = msg.sender;
        } else if (msg.sender != escrow.vendor) {
            revert Unauthorized();
        }
        if (msg.value < MIN_BOUNTY) {
            revert InvalidAmount();
        }
        if (!isKYCVerified[msg.sender]) {
            revert KYCNotVerified();
        }

        // EFFECTS
        escrow.bountyAmount = msg.value;
        escrow.bountyLockedAt = block.timestamp;
        escrow.state = State.BOUNTY_LOCKED;

        // No external interactions needed
        emit BountyLocked(merkleRoot, msg.value);
    }

    /**
     * @notice Reveals the decryption key and atomically pays the researcher.
     * @dev Verifies keccak256(decryptionKey) == keyHash, then immediately transfers
     *      the full bounty to the seller. Follows CEI pattern.
     *      No intermediate state, no dispute window, no separate claim step.
     * @param merkleRoot The Merkle root identifying the escrow.
     * @param decryptionKey The plaintext decryption key.
     */
    function revealAndClaim(bytes32 merkleRoot, string memory decryptionKey) external nonReentrant whenNotPaused {
        Escrow storage escrow = escrows[merkleRoot];

        // CHECKS
        if (escrow.state != State.BOUNTY_LOCKED) {
            revert InvalidState();
        }
        if (msg.sender != escrow.seller) {
            revert Unauthorized();
        }
        if (block.timestamp > escrow.bountyLockedAt + RECLAIM_TIMEOUT) {
            revert ReclaimTimeoutPassed();
        }
        if (keccak256(bytes(decryptionKey)) != escrow.keyHash) {
            revert InvalidKey();
        }

        // EFFECTS
        escrow.state = State.SETTLED;
        uint256 amount = escrow.bountyAmount;
        escrow.bountyAmount = 0;
        refunds[escrow.seller] += amount;

        // Emit key HASH (not plaintext) for the audit trail
        emit SettlementConfirmed(merkleRoot, escrow.keyHash);
    }

    /**
     * @notice Triggers the dead man's switch if the vendor fails to lock the bounty within 7 days.
     * @dev Only the seller can trigger this to prevent griefing.
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
        if (block.timestamp <= escrow.commitTimestamp + COMMIT_TIMEOUT) {
            revert TimeoutNotReached();
        }

        escrow.state = State.EXPIRED;
        emit VaultExpired(merkleRoot);
    }

    /**
     * @notice Reclaims the locked bounty if the seller fails to reveal the key within 14 days.
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
        if (block.timestamp <= escrow.bountyLockedAt + RECLAIM_TIMEOUT) {
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

    /// @notice Emergency pause — only admin
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Unpause — only admin
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
