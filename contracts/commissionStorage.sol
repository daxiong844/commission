// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract CommissionStorage {
    address public constant ETH = address(0);

    // 存储地址在每个token上的余额
    mapping(address => mapping(address => uint256)) public balances;

    // 存储每个地址持有的所有token的列表
    mapping(address => address[]) public tokenList;

    struct TokenValue {
        address token;
        uint256 value;
    }

    event updateBalanceEvent(address indexed holder, address indexed token, uint256 value);
    event withdrawEvent(address indexed holder, address indexed token, uint256 value);

    // 增加或更新余额
    function updateBalance(address holder, address token, uint256 _balance) public payable {
        uint256 balance = 0;
        require(_balance > 0, 'CS : Unvalid balance');

        // 验证余额是否充足
        if (token == ETH) {
            require(_balance <= msg.value, 'CS : Insufficient eth balance of sender');
        } else {
            IERC20 tokenObj = IERC20(token);
            require(_balance <= tokenObj.balanceOf(msg.sender), 'CS : Insufficient token balance of sender');
            tokenObj.transferFrom(msg.sender, address(this), _balance);
        }

        // 如果地址还没有持有这个token，将其添加到token列表中
        if (!hasToken(holder, token)) {
            tokenList[holder].push(token);
        } else {
            balance = balances[holder][token];
        }

        balances[holder][token] = balance + _balance;

        emit updateBalanceEvent(holder, token, _balance);
    }

    // 返回token地址和余额的元组数组
    function getTokenBalances(address holder) public view returns (TokenValue[] memory) {
        address[] memory tokens = tokenList[holder];
        TokenValue[] memory balancesArray = new TokenValue[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            balancesArray[i] = TokenValue(token, balances[holder][token]);
        }

        return balancesArray;
    }

    // 检查地址是否持有某个token
    function hasToken(address holder, address token) internal view returns (bool) {
        address[] memory tokens = tokenList[holder];
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == token) {
                return true;
            }
        }
        return false;
    }

    // 提现eth
    function withdrawEth(uint256 amount) public {
        require(amount > 0, 'CS : Unvalid amount');
        // 验证msg.sender的佣金余额必须小于提现的金额
        uint256 balance = balances[msg.sender][ETH];
        require(amount <= balance, 'CS : Insufficient balance of sender');

        // 验证佣金存储合约的eth数量充足
        require(amount <= address(this).balance, 'CS : Insufficient balance of storage');

        balances[msg.sender][ETH] = balance - amount;
        payable(msg.sender).transfer(amount);

        emit withdrawEvent(msg.sender, ETH, amount);
    }

    // 提现Token
    function withdrawToken(address token, uint256 amount) public {
        require(amount > 0, 'CS : Unvalid amount');
        require(hasToken(msg.sender, token), 'CS : No token');

        // 验证msg.sender的佣金余额必须小于提现的金额
        uint256 balance = balances[msg.sender][token];
        require(amount <= balance, 'CS : Insufficient balance of sender');

        IERC20 tokenObj = IERC20(token);
        // 验证佣金存储合约的token数量充足
        require(amount <= tokenObj.balanceOf(address(this)), 'CS : Insufficient balance of storage');

        balances[msg.sender][token] = balance - amount;
        tokenObj.transfer(msg.sender, amount);

        emit withdrawEvent(msg.sender, token, amount);
    }
}
