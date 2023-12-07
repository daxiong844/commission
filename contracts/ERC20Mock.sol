// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract ERC20Mock is ERC20 {
    constructor(uint256 _totalSupply) ERC20('mock', 'MOCK') {
        _mint(msg.sender, _totalSupply);
    }
}
