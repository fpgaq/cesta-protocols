require("@nomiclabs/hardhat-waffle")
require('@openzeppelin/hardhat-upgrades');
require("dotenv").config()

module.exports = {
    networks: {
        hardhat: {
            forking: {
                url: "https://api.avax.network/ext/bc/C/rpc",
                blockNumber: 6474469,
            },
        },
        mainnet: {
            url: "https://api.avax.network/ext/bc/C/rpc",
            accounts: [`0x${process.env.PRIVATE_KEY}`],
        },
        fuji: {
            url: "https://api.avax-test.network/ext/bc/C/rpc",
            accounts: [`0x${process.env.PRIVATE_KEY}`],
        },
    },
    solidity: {
        compilers: [
            {
                version: "0.8.9",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                }
            },
        ]
    },
    mocha: {
        timeout: 300000
    }
};
