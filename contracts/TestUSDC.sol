// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract TestUSDC {
    string public constant name = "Lay-by Test Dollar";
    string public constant symbol = "tUSDC";
    uint8 public constant decimals = 6;
    uint256 public constant faucetAmount = 1_000 * 10 ** 6;
    uint256 public constant faucetCooldown = 1 days;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint64) public lastFaucetAt;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event TestUSDCFaucet(address indexed account, uint256 amount);

    function faucet() external {
        require(block.timestamp >= uint256(lastFaucetAt[msg.sender]) + faucetCooldown, "Faucet cooldown");
        lastFaucetAt[msg.sender] = uint64(block.timestamp);
        totalSupply += faucetAmount;
        balanceOf[msg.sender] += faucetAmount;
        emit Transfer(address(0), msg.sender, faucetAmount);
        emit TestUSDCFaucet(msg.sender, faucetAmount);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        require(spender != address(0), "Invalid spender");
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 permitted = allowance[from][msg.sender];
        require(permitted >= value, "Insufficient allowance");
        if (permitted != type(uint256).max) {
            allowance[from][msg.sender] = permitted - value;
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) private {
        require(to != address(0), "Invalid recipient");
        require(balanceOf[from] >= value, "Insufficient balance");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}
