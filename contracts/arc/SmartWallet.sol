// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SmartWallet
 * @notice A basic smart wallet contract on Arc Network supporting USDC (native gas) and ERC-20 tokens
 * @dev Phase 1: Standard wallet operations (deposit, withdraw, send) with ownership controls
 * 
 * VERIFIED ADDRESSES (Arc Testnet):
 * - USDC: 0x3600000000000000000000000000000000000000 (native gas token, 6 decimals via ERC-20 interface)
 */
contract SmartWallet is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Arc Network USDC address (verified from docs.arc.network/arc/references/contract-addresses)
    address public constant USDC = 0x3600000000000000000000000000000000000000;
    
    address private _owner;
    
    // Track ERC-20 token balances (token address => balance)
    mapping(address => uint256) private _tokenBalances;
    
    // Events
    event Deposit(address indexed from, uint256 amount, uint256 timestamp);
    event Withdrawal(address indexed to, uint256 amount, uint256 timestamp);
    event Transfer(address indexed to, uint256 amount, uint256 timestamp);
    event TokenDeposit(address indexed token, address indexed from, uint256 amount, uint256 timestamp);
    event TokenWithdrawal(address indexed token, address indexed to, uint256 amount, uint256 timestamp);
    event TokenTransfer(address indexed token, address indexed to, uint256 amount, uint256 timestamp);
    event OwnershipChanged(address indexed previousOwner, address indexed newOwner, uint256 timestamp);
    
    // Errors
    error NotOwner();
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientBalance();
    error TransferFailed();
    
    modifier onlyOwner() {
        if (msg.sender != _owner) revert NotOwner();
        _;
    }
    
    /**
     * @notice Initialize the wallet with the deployer as owner
     */
    constructor() {
        _owner = msg.sender;
        emit OwnershipChanged(address(0), msg.sender, block.timestamp);
    }
    
    /**
     * @notice Receive native USDC directly (Arc uses USDC as native gas token)
     * @dev Native balance uses 18 decimals internally, ERC-20 interface uses 6 decimals
     */
    receive() external payable {
        emit Deposit(msg.sender, msg.value, block.timestamp);
    }
    
    // ========== USDC FUNCTIONS (Native Gas Token) ==========
    
    /**
     * @notice Deposit USDC into the wallet (native balance)
     * @dev Can send USDC directly to contract address or call this function
     */
    function depositUSDC() external payable {
        if (msg.value == 0) revert ZeroAmount();
        emit Deposit(msg.sender, msg.value, block.timestamp);
    }
    
    /**
     * @notice Withdraw USDC from wallet to owner
     * @param amount Amount to withdraw (in wei, 18 decimals)
     */
    function withdrawUSDC(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (address(this).balance < amount) revert InsufficientBalance();
        
        (bool success, ) = payable(_owner).call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit Withdrawal(_owner, amount, block.timestamp);
    }
    
    /**
     * @notice Send USDC to another address
     * @param to Recipient address
     * @param amount Amount to send (in wei, 18 decimals)
     */
    function sendUSDC(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (address(this).balance < amount) revert InsufficientBalance();
        
        (bool success, ) = payable(to).call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit Transfer(to, amount, block.timestamp);
    }
    
    /**
     * @notice Get USDC balance (native balance)
     * @return balance Current USDC balance in wei (18 decimals)
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // ========== ERC-20 TOKEN FUNCTIONS ==========
    
    /**
     * @notice Deposit ERC-20 tokens into wallet
     * @dev Requires prior approval of this contract to spend tokens
     * @param token Token contract address
     * @param amount Amount to deposit (use token's decimals)
     */
    function depositERC20(address token, uint256 amount) external {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        _tokenBalances[token] += amount;
        
        emit TokenDeposit(token, msg.sender, amount, block.timestamp);
    }
    
    /**
     * @notice Withdraw ERC-20 tokens to owner
     * @param token Token contract address
     * @param amount Amount to withdraw
     */
    function withdrawERC20(address token, uint256 amount) external onlyOwner nonReentrant {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (_tokenBalances[token] < amount) revert InsufficientBalance();
        
        _tokenBalances[token] -= amount;
        IERC20(token).safeTransfer(_owner, amount);
        
        emit TokenWithdrawal(token, _owner, amount, block.timestamp);
    }
    
    /**
     * @notice Send ERC-20 tokens to another address
     * @param token Token contract address
     * @param to Recipient address
     * @param amount Amount to send
     */
    function sendERC20(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (token == address(0)) revert ZeroAddress();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (_tokenBalances[token] < amount) revert InsufficientBalance();
        
        _tokenBalances[token] -= amount;
        IERC20(token).safeTransfer(to, amount);
        
        emit TokenTransfer(token, to, amount, block.timestamp);
    }
    
    /**
     * @notice Get ERC-20 token balance
     * @param token Token contract address
     * @return balance Current token balance
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return _tokenBalances[token];
    }
    
    // ========== OWNERSHIP FUNCTIONS ==========
    
    /**
     * @notice Get current owner address
     * @return Current owner
     */
    function owner() external view returns (address) {
        return _owner;
    }
    
    /**
     * @notice Change wallet ownership
     * @param newOwner New owner address
     */
    function changeOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        
        address previousOwner = _owner;
        _owner = newOwner;
        
        emit OwnershipChanged(previousOwner, newOwner, block.timestamp);
    }
}
