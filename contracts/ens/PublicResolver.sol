// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Public Resolver
 * @dev Deployed on Arc Network for NovaVault recovery system
 * Simplified ENS resolver for storing wallet recovery data
 */

interface ENS {
    function owner(bytes32 node) external view returns (address);
}

contract PublicResolver {
    ENS public immutable ens;

    mapping(bytes32 => mapping(string => string)) private texts;
    mapping(bytes32 => address) private addresses;

    event TextChanged(bytes32 indexed node, string indexed key, string value);
    event AddressChanged(bytes32 indexed node, address a);

    modifier authorised(bytes32 node) {
        require(ens.owner(node) == msg.sender, "Not authorized");
        _;
    }

    constructor(ENS _ens) {
        ens = _ens;
    }

    /**
     * @dev Sets the text data associated with an ENS node and key
     * @param node The node to update
     * @param key The key to set
     * @param value The text data value to set
     */
    function setText(
        bytes32 node,
        string calldata key,
        string calldata value
    ) external authorised(node) {
        texts[node][key] = value;
        emit TextChanged(node, key, value);
    }

    /**
     * @dev Returns the text data associated with an ENS node and key
     * @param node The ENS node to query
     * @param key The text data key to query
     * @return The associated text data
     */
    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return texts[node][key];
    }

    /**
     * @dev Sets the address associated with an ENS node
     * @param node The node to update
     * @param a The address to set
     */
    function setAddr(bytes32 node, address a) external authorised(node) {
        addresses[node] = a;
        emit AddressChanged(node, a);
    }

    /**
     * @dev Returns the address associated with an ENS node
     * @param node The ENS node to query
     * @return The associated address
     */
    function addr(bytes32 node) external view returns (address) {
        return addresses[node];
    }

    /**
     * @dev Batch set multiple text records (gas optimization)
     */
    function setTexts(
        bytes32 node,
        string[] calldata keys,
        string[] calldata values
    ) external authorised(node) {
        require(keys.length == values.length, "Array length mismatch");
        
        for (uint256 i = 0; i < keys.length; i++) {
            texts[node][keys[i]] = values[i];
            emit TextChanged(node, keys[i], values[i]);
        }
    }

    /**
     * @dev Get multiple text records at once
     */
    function getTexts(bytes32 node, string[] calldata keys) 
        external 
        view 
        returns (string[] memory values) 
    {
        values = new string[](keys.length);
        for (uint256 i = 0; i < keys.length; i++) {
            values[i] = texts[node][keys[i]];
        }
    }
}
