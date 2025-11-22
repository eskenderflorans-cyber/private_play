// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title TestMinimal
 * @notice Minimal contract to test FHEVM ACL behavior
 */
contract TestMinimal is ZamaEthereumConfig {
    euint64 public storedValue;

    constructor() {
        // This should work - constructor can do trivial encrypt + allowThis
        storedValue = FHE.asEuint64(0);
        FHE.allowThis(storedValue);
    }

    // Test 1: Just trivial encrypt
    function test1_trivialEncrypt() external returns (bytes32) {
        euint64 val = FHE.asEuint64(100);
        FHE.allowThis(val);
        return euint64.unwrap(val);
    }

    // Test 2: Trivial encrypt + comparison (this is what fails in FortuneWheel)
    function test2_trivialCompare() external returns (bytes32) {
        euint64 val1 = FHE.asEuint64(100);
        FHE.allowThis(val1);
        euint64 val2 = FHE.asEuint64(50);
        FHE.allowThis(val2);
        ebool result = FHE.lt(val1, val2);
        return ebool.unwrap(result);
    }

    // Test 3: FromExternal + trivial encrypt comparison
    function test3_externalVsTrivial(
        externalEuint64 encryptedVal,
        bytes calldata inputProof
    ) external returns (bytes32) {
        euint64 val1 = FHE.fromExternal(encryptedVal, inputProof);
        euint64 val2 = FHE.asEuint64(50);
        FHE.allowThis(val2);
        ebool result = FHE.lt(val1, val2);
        return ebool.unwrap(result);
    }

    // Test 4: Add with stored value (like WheelToken.buyTokens)
    function test4_addToStored() external returns (bytes32) {
        euint64 newVal = FHE.asEuint64(100);
        // Note: NOT calling allowThis on newVal
        storedValue = FHE.add(storedValue, newVal);
        FHE.allowThis(storedValue);
        return euint64.unwrap(storedValue);
    }

    // Test 5: Just fromExternal (to verify this works)
    function test5_justFromExternal(
        externalEuint64 encryptedVal,
        bytes calldata inputProof
    ) external returns (bytes32) {
        euint64 val = FHE.fromExternal(encryptedVal, inputProof);
        FHE.allowThis(val);
        return euint64.unwrap(val);
    }
}
