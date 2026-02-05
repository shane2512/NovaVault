// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ENS Registry
 * @dev Deployed on Arc Network for NovaVault recovery system
 * Based on ENS Registry specification
 */
contract ENSRegistry {
    struct Record {
        address owner;
        address resolver;
        uint64 ttl;
    }

    mapping(bytes32 => Record) records;
    mapping(address => mapping(address => bool)) operators;

    event NewOwner(bytes32 indexed node, bytes32 indexed label, address owner);
    event Transfer(bytes32 indexed node, address owner);
    event NewResolver(bytes32 indexed node, address resolver);
    event NewTTL(bytes32 indexed node, uint64 ttl);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    modifier authorised(bytes32 node) {
        address owner = records[node].owner;
        require(owner == msg.sender || operators[owner][msg.sender], "Not authorized");
        _;
    }

    /**
     * @dev Constructor sets the root node owner
     */
    constructor() {
        records[0x0].owner = msg.sender;
    }

    /**
     * @dev Sets the record for a node
     */
    function setRecord(
        bytes32 node,
        address owner,
        address resolver,
        uint64 ttl
    ) external authorised(node) {
        setOwner(node, owner);
        _setResolverAndTTL(node, resolver, ttl);
    }

    /**
     * @dev Sets the record for a subnode
     */
    function setSubnodeRecord(
        bytes32 node,
        bytes32 label,
        address owner,
        address resolver,
        uint64 ttl
    ) external authorised(node) {
        bytes32 subnode = keccak256(abi.encodePacked(node, label));
        setOwner(subnode, owner);
        _setResolverAndTTL(subnode, resolver, ttl);
    }

    /**
     * @dev Transfers ownership of a node to a new address
     */
    function setOwner(bytes32 node, address owner) public authorised(node) {
        records[node].owner = owner;
        emit Transfer(node, owner);
    }

    /**
     * @dev Transfers ownership of a subnode
     */
    function setSubnodeOwner(
        bytes32 node,
        bytes32 label,
        address owner
    ) external authorised(node) returns (bytes32) {
        bytes32 subnode = keccak256(abi.encodePacked(node, label));
        records[subnode].owner = owner;
        emit NewOwner(node, label, owner);
        return subnode;
    }

    /**
     * @dev Sets the resolver address for a node
     */
    function setResolver(bytes32 node, address resolver) external authorised(node) {
        emit NewResolver(node, resolver);
        records[node].resolver = resolver;
    }

    /**
     * @dev Sets the TTL for a node
     */
    function setTTL(bytes32 node, uint64 ttl) external authorised(node) {
        emit NewTTL(node, ttl);
        records[node].ttl = ttl;
    }

    /**
     * @dev Enable or disable approval for a third party to manage all of msg.sender's ENS records
     */
    function setApprovalForAll(address operator, bool approved) external {
        operators[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    /**
     * @dev Returns the address that owns the specified node
     */
    function owner(bytes32 node) external view returns (address) {
        address addr = records[node].owner;
        if (addr == address(this)) {
            return address(0x0);
        }
        return addr;
    }

    /**
     * @dev Returns the address of the resolver for the specified node
     */
    function resolver(bytes32 node) external view returns (address) {
        return records[node].resolver;
    }

    /**
     * @dev Returns the TTL of a node
     */
    function ttl(bytes32 node) external view returns (uint64) {
        return records[node].ttl;
    }

    /**
     * @dev Returns whether a record exists
     */
    function recordExists(bytes32 node) external view returns (bool) {
        return records[node].owner != address(0x0);
    }

    /**
     * @dev Query if an address is an authorized operator for another address
     */
    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return operators[owner][operator];
    }

    function _setResolverAndTTL(bytes32 node, address resolver, uint64 ttl) internal {
        if (resolver != records[node].resolver) {
            records[node].resolver = resolver;
            emit NewResolver(node, resolver);
        }

        if (ttl != records[node].ttl) {
            records[node].ttl = ttl;
            emit NewTTL(node, ttl);
        }
    }
}
