require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require('@openzeppelin/hardhat-upgrades');
require("dotenv").config()

module.exports = {
    networks: {
        hardhat: {
            forking: {
                url: "https://api.avax.network/ext/bc/C/rpc",
                blockNumber: 8274976,

                // url: "https://api.avax-test.network/ext/bc/C/rpc", // testnet
                // blockNumber: 3221391,
            },
        },
        mainnet: {
            url: "https://api.avax.network/ext/bc/C/rpc",
            gasPrice: 25000000000, // 25 nAVAX
            accounts: [`0x${process.env.PRIVATE_KEY}`],
        },
        fuji: {
            url: "https://api.avax-test.network/ext/bc/C/rpc",
            accounts: [`0x${process.env.PRIVATE_KEY}`],
        },
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
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
