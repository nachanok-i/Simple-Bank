// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

contract Bank {
    using SafeERC20 for IERC20;
    IERC20 public token;

    struct UserDetail {
        uint256 amount;
        uint256 start;
    }

    mapping (address => UserDetail) public balanceByAddress;
    mapping (address => UserDetail) public loanByAddress;

    uint256 public depositInterest = 10000;
    uint256 public loanInterest = 1000;

    constructor(address _tokenAddress) {
        token = IERC20(_tokenAddress);
    }

    function deposit(uint256 _amount) public {
        uint256 interest;
        UserDetail storage user = balanceByAddress[msg.sender];
        if (user.start != 0) {
            interest = calculateInterest(true);
            user.amount += interest;
        }
        user.amount += _amount;
        balanceByAddress[msg.sender].start = block.number;
        token.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function withdraw(uint256 _amount) public {
        uint256 interest = calculateInterest(true);
        UserDetail storage user = balanceByAddress[msg.sender];
        user.amount += interest;
        require (_amount <= user.amount, "Withdraw amount more than deposited");
        require (_amount <= token.balanceOf(address(this)), "Bank run!");
        
        if (_amount < user.amount) {
            user.start = block.number;
        }
        else {
            user.start = 0;
        }
        
        balanceByAddress[msg.sender].amount -= _amount;
        token.safeTransfer(msg.sender, _amount);
    }

    function loanBorrow(uint256 _amount) public {
        UserDetail storage user = loanByAddress[msg.sender];
        require (_amount <= token.balanceOf(address(this))/2, "Not enough fund in the bank");
        require (user.amount == 0, "Already loaned");
        user.amount += _amount;
        user.start = block.number;
        token.safeTransfer(msg.sender, _amount);
    }

    function loanReturn() public {
        uint256 interest = calculateInterest(false);
        UserDetail storage user = loanByAddress[msg.sender];
        user.amount += interest;
        require (token.balanceOf(msg.sender) >= user.amount, "Not enough fund to return");
        token.safeTransferFrom(msg.sender, address(this), user.amount);
        user.amount = 0;
        user.start = 0;
    }

        function calculateInterest(bool _isDeposit) internal view returns (uint256) {
        UserDetail memory user;
        uint256 interestRate;
        if (_isDeposit) {
            user = balanceByAddress[msg.sender];
            interestRate = depositInterest;
        }
        else {
            user = loanByAddress[msg.sender];
            interestRate = loanInterest;
        }
        uint256 deltaTime = block.number - user.start;
        uint256 interest = user.amount * deltaTime / interestRate;
        console.log("DeltaTime:", deltaTime);
        console.log("Interest: ", interest);
        return interest; 
    }
}