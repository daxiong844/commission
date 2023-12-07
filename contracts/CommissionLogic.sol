// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract CommissionLogic {
    address public constant ETH = address(0);

    address public cs;

    struct Receiver {
        address holder;
        address token;
        uint256 value;
    }

    constructor(address _cs) {
        cs = _cs;
    }

    function execute(bytes memory data, address to, Receiver[] memory _receiver) public payable {
        // 参数验证
        require(to != address(0), 'CL : Unvalid to address');

        uint256 _msgValue = msg.value;
        uint256 _sendValue = 0;

        for (uint256 i = 0; i < _receiver.length; i++) {
            if (_receiver[i].token == ETH) {
                require(_msgValue >= _receiver[i].value, 'CL : Insufficient eth balance of sender');
                _msgValue = _msgValue - _receiver[i].value;
                _sendValue = _receiver[i].value;
            } else {
                IERC20 tokenObj = IERC20(_receiver[i].token);
                require(tokenObj.balanceOf(msg.sender) >= _receiver[i].value, 'CL : Insufficient token balance of sender');
                require(tokenObj.allowance(msg.sender, address(this)) >= _receiver[i].value, 'CL : Insufficient token allowance balance of this');
                tokenObj.transferFrom(msg.sender, address(this), _receiver[i].value);
                tokenObj.approve(cs, _receiver[i].value);
            }

            cs.call{value: _sendValue}(abi.encodeWithSignature('updateBalance(address,address,uint256)', _receiver[i].holder, _receiver[i].token, _receiver[i].value));
        }
        to.call{value: _msgValue}(data);
    }
}
