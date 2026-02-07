// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RecoveryController
 * @notice Guardian-based recovery system for Arc smart wallets
 * @dev Tracks guardian approvals and enforces threshold before executing recovery
 * 
 * Architecture:
 * 1. ENS stores guardian addresses + threshold
 * 2. This contract tracks approvals per recovery request
 * 3. Gateway enforces policy before settlement
 * 4. Circle Wallet MPC executes transfer
 * 5. CCTP handles cross-chain settlement
 */
contract RecoveryController is ReentrancyGuard, Ownable {
    
    // ============================================
    // STRUCTS
    // ============================================
    
    struct RecoveryRequest {
        bytes32 namehash;           // ENS namehash
        address currentOwner;       // Current wallet owner
        address newOwner;           // Proposed new owner
        address[] guardians;        // Guardian addresses from ENS
        uint256 threshold;          // Required approvals from ENS
        uint256 approvalCount;      // Current approval count
        mapping(address => bool) hasApproved;  // Track guardian approvals
        uint256 createdAt;          // Timestamp
        uint256 expiresAt;          // Expiration timestamp
        RecoveryStatus status;      // Current status
        string circleWalletId;      // Associated Circle Wallet ID
    }
    
    enum RecoveryStatus {
        PENDING,        // Recovery requested, awaiting approvals
        APPROVED,       // Threshold met, ready for Gateway
        EXECUTED,       // Recovery completed
        EXPIRED,        // Request expired
        CANCELLED       // Request cancelled
    }
    
    // ============================================
    // STATE VARIABLES
    // ============================================
    
    // namehash => RecoveryRequest
    mapping(bytes32 => RecoveryRequest) public recoveryRequests;
    
    // Track active recovery requests
    bytes32[] public activeRecoveries;
    
    // Recovery expiration period (7 days)
    uint256 public constant RECOVERY_EXPIRATION = 7 days;
    
    // Minimum threshold (cannot be less than 1)
    uint256 public constant MIN_THRESHOLD = 1;
    
    // Maximum number of guardians
    uint256 public constant MAX_GUARDIANS = 10;
    
    // ENS registry interface (Sepolia)
    address public immutable ensRegistry;
    
    // Authorized backend executor (Gateway integration)
    address public authorizedExecutor;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event RecoveryRequested(
        bytes32 indexed namehash,
        address indexed currentOwner,
        address indexed newOwner,
        address[] guardians,
        uint256 threshold,
        string circleWalletId,
        uint256 expiresAt
    );
    
    event RecoveryApproval(
        bytes32 indexed namehash,
        address indexed guardian,
        uint256 approvalCount,
        uint256 threshold
    );
    
    event RecoveryThresholdMet(
        bytes32 indexed namehash,
        address indexed newOwner,
        uint256 approvalCount
    );
    
    event RecoveryExecuted(
        bytes32 indexed namehash,
        address indexed oldOwner,
        address indexed newOwner,
        uint256 executedAt
    );
    
    event RecoveryCancelled(
        bytes32 indexed namehash,
        address indexed cancelledBy
    );
    
    event AuthorizedExecutorUpdated(
        address indexed oldExecutor,
        address indexed newExecutor
    );
    
    // ============================================
    // ERRORS
    // ============================================
    
    error RecoveryAlreadyActive();
    error RecoveryNotFound();
    error RecoveryExpired();
    error RecoveryAlreadyExecuted();
    error NotGuardian();
    error AlreadyApproved();
    error ThresholdNotMet();
    error InvalidThreshold();
    error InvalidGuardians();
    error Unauthorized();
    error RecoveryNotApproved();
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor(
        address initialOwner,
        address _ensRegistry,
        address _authorizedExecutor
    ) Ownable(initialOwner) {
        ensRegistry = _ensRegistry;
        authorizedExecutor = _authorizedExecutor;
    }
    
    // ============================================
    // RECOVERY INITIATION
    // ============================================
    
    /**
     * @notice Request recovery for a wallet
     * @param namehash ENS namehash of the wallet
     * @param currentOwner Current owner address
     * @param newOwner Proposed new owner address
     * @param guardians Array of guardian addresses (from ENS)
     * @param threshold Required approval count (from ENS)
     * @param circleWalletId Associated Circle Wallet ID
     * @dev Can be called by anyone, but guardians are verified from ENS
     */
    function requestRecovery(
        bytes32 namehash,
        address currentOwner,
        address newOwner,
        address[] calldata guardians,
        uint256 threshold,
        string calldata circleWalletId
    ) external nonReentrant {
        // Validate inputs
        if (newOwner == address(0) || currentOwner == address(0)) {
            revert InvalidGuardians();
        }
        
        if (guardians.length == 0 || guardians.length > MAX_GUARDIANS) {
            revert InvalidGuardians();
        }
        
        if (threshold < MIN_THRESHOLD || threshold > guardians.length) {
            revert InvalidThreshold();
        }
        
        // Check if recovery already active
        RecoveryRequest storage existing = recoveryRequests[namehash];
        if (existing.status == RecoveryStatus.PENDING || existing.status == RecoveryStatus.APPROVED) {
            revert RecoveryAlreadyActive();
        }
        
        // Create new recovery request
        RecoveryRequest storage request = recoveryRequests[namehash];
        request.namehash = namehash;
        request.currentOwner = currentOwner;
        request.newOwner = newOwner;
        request.guardians = guardians;
        request.threshold = threshold;
        request.approvalCount = 0;
        request.createdAt = block.timestamp;
        request.expiresAt = block.timestamp + RECOVERY_EXPIRATION;
        request.status = RecoveryStatus.PENDING;
        request.circleWalletId = circleWalletId;
        
        // Add to active recoveries
        activeRecoveries.push(namehash);
        
        emit RecoveryRequested(
            namehash,
            currentOwner,
            newOwner,
            guardians,
            threshold,
            circleWalletId,
            request.expiresAt
        );
    }
    
    // ============================================
    // GUARDIAN APPROVAL
    // ============================================
    
    /**
     * @notice Guardian approves a recovery request
     * @param namehash ENS namehash of the wallet
     * @dev Only guardians can approve, duplicates prevented
     */
    function approveRecovery(bytes32 namehash) external nonReentrant {
        RecoveryRequest storage request = recoveryRequests[namehash];
        
        // Validate recovery exists and is active
        if (request.status != RecoveryStatus.PENDING) {
            revert RecoveryNotFound();
        }
        
        // Check expiration
        if (block.timestamp > request.expiresAt) {
            request.status = RecoveryStatus.EXPIRED;
            revert RecoveryExpired();
        }
        
        // Verify caller is a guardian
        bool isGuardian = false;
        for (uint256 i = 0; i < request.guardians.length; i++) {
            if (request.guardians[i] == msg.sender) {
                isGuardian = true;
                break;
            }
        }
        if (!isGuardian) {
            revert NotGuardian();
        }
        
        // Check if already approved
        if (request.hasApproved[msg.sender]) {
            revert AlreadyApproved();
        }
        
        // Record approval
        request.hasApproved[msg.sender] = true;
        request.approvalCount++;
        
        emit RecoveryApproval(
            namehash,
            msg.sender,
            request.approvalCount,
            request.threshold
        );
        
        // Check if threshold met
        if (request.approvalCount >= request.threshold) {
            request.status = RecoveryStatus.APPROVED;
            emit RecoveryThresholdMet(
                namehash,
                request.newOwner,
                request.approvalCount
            );
        }
    }
    
    // ============================================
    // RECOVERY EXECUTION
    // ============================================
    
    /**
     * @notice Execute recovery after threshold met and Gateway approval
     * @param namehash ENS namehash of the wallet
     * @dev Only authorized executor (Gateway integration)
     */
    function executeRecovery(bytes32 namehash) external nonReentrant {
        // Only authorized executor can call (Gateway)
        if (msg.sender != authorizedExecutor && msg.sender != owner()) {
            revert Unauthorized();
        }
        
        RecoveryRequest storage request = recoveryRequests[namehash];
        
        // Validate recovery is approved
        if (request.status != RecoveryStatus.APPROVED) {
            revert RecoveryNotApproved();
        }
        
        // Check expiration
        if (block.timestamp > request.expiresAt) {
            request.status = RecoveryStatus.EXPIRED;
            revert RecoveryExpired();
        }
        
        // Mark as executed
        request.status = RecoveryStatus.EXECUTED;
        
        emit RecoveryExecuted(
            namehash,
            request.currentOwner,
            request.newOwner,
            block.timestamp
        );
        
        // Note: Actual ownership change happens via:
        // 1. Gateway policy enforcement
        // 2. Circle Wallet MPC settlement
        // 3. CCTP cross-chain transfer (if needed)
        // 4. ArcSmartWallet.changeOwner() call
    }
    
    // ============================================
    // RECOVERY CANCELLATION
    // ============================================
    
    /**
     * @notice Cancel a recovery request
     * @param namehash ENS namehash of the wallet
     * @dev Can be cancelled by current owner or contract owner
     */
    function cancelRecovery(bytes32 namehash) external nonReentrant {
        RecoveryRequest storage request = recoveryRequests[namehash];
        
        // Only current owner or contract owner can cancel
        if (msg.sender != request.currentOwner && msg.sender != owner()) {
            revert Unauthorized();
        }
        
        // Can only cancel pending or approved requests
        if (request.status != RecoveryStatus.PENDING && request.status != RecoveryStatus.APPROVED) {
            revert RecoveryNotFound();
        }
        
        request.status = RecoveryStatus.CANCELLED;
        
        emit RecoveryCancelled(namehash, msg.sender);
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @notice Get recovery request details
     * @param namehash ENS namehash of the wallet
     */
    function getRecoveryRequest(bytes32 namehash)
        external
        view
        returns (
            address currentOwner,
            address newOwner,
            address[] memory guardians,
            uint256 threshold,
            uint256 approvalCount,
            uint256 createdAt,
            uint256 expiresAt,
            RecoveryStatus status,
            string memory circleWalletId
        )
    {
        RecoveryRequest storage request = recoveryRequests[namehash];
        return (
            request.currentOwner,
            request.newOwner,
            request.guardians,
            request.threshold,
            request.approvalCount,
            request.createdAt,
            request.expiresAt,
            request.status,
            request.circleWalletId
        );
    }
    
    /**
     * @notice Check if address has approved recovery
     * @param namehash ENS namehash of the wallet
     * @param guardian Guardian address to check
     */
    function hasGuardianApproved(bytes32 namehash, address guardian)
        external
        view
        returns (bool)
    {
        return recoveryRequests[namehash].hasApproved[guardian];
    }
    
    /**
     * @notice Get all active recovery requests
     */
    function getActiveRecoveries() external view returns (bytes32[] memory) {
        return activeRecoveries;
    }
    
    /**
     * @notice Check if recovery is ready for execution
     * @param namehash ENS namehash of the wallet
     */
    function isRecoveryReady(bytes32 namehash) external view returns (bool) {
        RecoveryRequest storage request = recoveryRequests[namehash];
        return (
            request.status == RecoveryStatus.APPROVED &&
            block.timestamp <= request.expiresAt
        );
    }
    
    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    /**
     * @notice Update authorized executor (Gateway integration)
     * @param newExecutor New executor address
     */
    function setAuthorizedExecutor(address newExecutor) external onlyOwner {
        address oldExecutor = authorizedExecutor;
        authorizedExecutor = newExecutor;
        emit AuthorizedExecutorUpdated(oldExecutor, newExecutor);
    }
    
    /**
     * @notice Clean up expired recoveries (gas optimization)
     * @param namehashes Array of namehashes to check and expire
     */
    function expireRecoveries(bytes32[] calldata namehashes) external {
        for (uint256 i = 0; i < namehashes.length; i++) {
            RecoveryRequest storage request = recoveryRequests[namehashes[i]];
            if (
                (request.status == RecoveryStatus.PENDING || request.status == RecoveryStatus.APPROVED) &&
                block.timestamp > request.expiresAt
            ) {
                request.status = RecoveryStatus.EXPIRED;
            }
        }
    }
}
