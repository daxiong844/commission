// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

interface ICommissionStorag {
    struct TokenValue {
        address token;
        uint256 value;
    }

    event updateBalanceEvent(address indexed holder, address indexed token, uint256 value);
    event withdrawEvent(address indexed holder, address indexed token, uint256 value);

    // 增加或更新余额
    function updateBalance(address holder, address token, uint256 _balance) external payable;

    // 返回token地址和余额的元组数组
    function getTokenBalances(address holder) external view returns (TokenValue[] memory);

    // 检查地址是否持有某个token
    function hasToken(address holder, address token) external view returns (bool);

    // 提现eth
    function withdrawEth(uint256 amount) external;

    // 提现Token
    function withdrawToken(address token, uint256 amount) external;
}
