// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DAOToken is ERC20 {
    uint8 decimal;

    constructor(string memory name, string memory ticker, uint8 _decimal) ERC20(name, ticker) {
        decimal = _decimal;
    }

    function decimals() public view override returns (uint8) {
        return decimal;
    }

    function mint(uint amount) external {
        require(amount < 10001 * 10 ** decimals(), "Over minted, please check your mint amount");
        _mint(msg.sender, amount);
    }
}
