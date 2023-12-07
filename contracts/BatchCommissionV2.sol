// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import './ICommissionStorag.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/proxy/utils/Initializable.sol';

contract BatchCommissionV2 is Initializable {
    address public constant ETH = address(0);

    ICommissionStorag public commissionStorage;

    // 结构体用于存储用户的佣金信息
    struct CommissionInfo {
        address user;
        address token;
        uint256 balance;
    }

    // 存储msg.sender与不同的key与信息结构体的映射关系
    mapping(address => mapping(bytes => CommissionInfo[])) public userCommissionInfo;

    // 定义事件
    event CommissionDeposited(address indexed user, bytes indexed key, CommissionInfo[] CommissionInfos);
    event CommissionDistributed(address indexed user, bytes indexed key, CommissionInfo[] CommissionInfos);
    event CommissionReturned(address indexed user, bytes indexed key, CommissionInfo[] CommissionInfos);

    // constructor(address _commissionStorage) {
    //     commissionStorage = ICommissionStorag(_commissionStorage);
    // }

    function initialize(address _commissionStorage) public initializer {
        commissionStorage = ICommissionStorag(_commissionStorage);
    }

    // 存入佣金信息
    function depositCommission(bytes memory key, CommissionInfo[] memory commissionInfos) external payable returns (bool) {
        // 确保传入的数组不为空
        require(commissionInfos.length > 0, 'Commission array should not be empty');

        // 用于存储总佣金
        uint256 totalCommission = 0;

        // 如果之前已经存在相同的key，覆盖掉之前的CommissionInfo数组并返回佣金
        if (userCommissionInfo[msg.sender][key].length > 0) {
            destroyAndReturnCommission(key);
        }

        // 遍历 CommissionInfo 数组，进行存储和计算总佣金
        for (uint256 i = 0; i < commissionInfos.length; i++) {
            CommissionInfo memory commission = commissionInfos[i];
            // 考虑不同代币单位的情况
            if (commission.token == ETH) {
                totalCommission += commission.balance;

                // 如果是ETH，判断msg.value是否足够
                require(msg.value >= totalCommission, 'Insufficient Ether sent for commission');
            } else {
                // （如果是其他代币）
                // 获取调用者所持有的本代币的余额
                uint256 tokenBalance = IERC20(commission.token).balanceOf(msg.sender);
                // 判断代币余额是否足够
                require(tokenBalance >= commission.balance, 'Insufficient token balance');
                // 判断代币地址允许转账的数额是否足够（address(this)被授权从msg.sender账户中转移的代币数量）
                require(IERC20(commission.token).allowance(msg.sender, address(this)) >= commission.balance, 'The number of tokens that the caller is allowed to transfer to this address is not enough.');

                // 调用 transferFrom 进行转账
                IERC20(commission.token).transferFrom(msg.sender, address(this), commission.balance);
                // 由于ERC20的approve函数期望第二个参数是一个address类型，但传的CommissionStorage是合约的实例，所以将commissionStorage转换为address类型，可以得到合约的实际地址
            }
        }

        // 等所有条件都判断完成之后，再存储CommissionInfo到映射中，
        for (uint256 i = 0; i < commissionInfos.length; i++) {
            CommissionInfo memory commission = commissionInfos[i];
            userCommissionInfo[msg.sender][key].push(commission);
        }

        emit CommissionDeposited(msg.sender, key, commissionInfos);
        // 返回成功
        return true;
    }

    // 批量下发佣金
    function distributeCommission(address targetUser, bytes memory key) public returns (bool) {
        // 获取用户佣金信息
        CommissionInfo[] memory commissionInfos = userCommissionInfo[targetUser][key];

        // 验证是否获取到了用户佣金信息，如果没有则提前结束执行
        require(commissionInfos.length > 0, 'Commission array should not be empty');

        // 清空状态变量中的数据
        delete userCommissionInfo[targetUser][key];

        // 遍历CommissionInfo数组，进行批量下发
        for (uint256 i = 0; i < commissionInfos.length; i++) {
            CommissionInfo memory commission = commissionInfos[i];

            // 计算需要传入的ETH的数量
            uint256 totalCommission = 0;

            // 考虑不同代币单位的情况
            if (commission.token == ETH) {
                totalCommission = commission.balance;
            } else {
                // 指定被授权的commissionStorage合约可以转入的数量，因为在批量下发调用updateBalance函数时，updateBalance内会遇到transferFrom函数
                IERC20(commission.token).approve(address(commissionStorage), commission.balance);
            }

            // 调用CommissionStorage合约的updateBalance方法，将佣金下发
            // 在这里不要用这种方法，因为没有办法传入msg.value,所以在调用updateBalance的时候会报错eth不足
            // commissionStorage.updateBalance(commission.user, commission.token, commission.balance);

            // 调用CommissionStorage合约的updateBalance方法，将佣金下发
            (bool success, ) = address(commissionStorage).call{value: totalCommission}(abi.encodeWithSignature('updateBalance(address,address,uint256)', commission.user, commission.token, commission.balance));

            // 检查调用是否成功
            require(success, 'CommissionStorage updateBalance call failed');
        }

        emit CommissionDistributed(targetUser, key, commissionInfos);

        // 返回成功
        return true;
    }

    // 销毁并返回佣金
    function destroyAndReturnCommission(bytes memory key) public returns (bool) {
        // 获取用户佣金信息
        CommissionInfo[] memory commissionInfos = userCommissionInfo[msg.sender][key];

        // 判断佣金数组是否为空
        if (commissionInfos.length == 0) {
            emit CommissionReturned(msg.sender, key, commissionInfos);

            return true;
        }

        // 清空状态变量中的数据
        delete userCommissionInfo[msg.sender][key];

        // 遍历CommissionInfo数组，返回佣金
        for (uint256 i = 0; i < commissionInfos.length; i++) {
            CommissionInfo memory commission = commissionInfos[i];

            // 将佣金返回给用户
            if (commission.token == ETH) {
                // 转账以太币
                payable(msg.sender).transfer(commission.balance);
            } else {
                // 转账其他代币
                IERC20 tokenObj = IERC20(commission.token);
                tokenObj.transfer(msg.sender, commission.balance);
            }
        }

        emit CommissionReturned(msg.sender, key, commissionInfos);

        // 返回成功
        return true;
    }
}
