const { ethers } = require("hardhat")

const daoUSDTAddr = "0xE01A4D7de190f60F86b683661F67f79F134E0582"
const daoUSDCAddr = "0xA6cFCa9EB181728082D35419B58Ba7eE4c9c8d38"
const daoDAIAddr = "0x3bc22AA42FF61fC2D01E87c2Fa4268D0334b1a4c"

const receiverAddr = "0xEb4d86A2A5dDf433Da5976110Eb27C2f7C659cA2"

const main = async () => {
    const [deployer] = await ethers.getSigners()
    // console.log(ethers.utils.formatEther(await deployer.getBalance()))

    // const daoTokenFac = await ethers.getContractFactory("DAOToken", deployer)

    // const daoUSDT = await daoTokenFac.deploy("DAO USDT", "daoUSDT", 6)
    // await daoUSDT.deployTransaction.wait()
    // console.log("DAO USDT contract address:", daoUSDT.address)

    // const daoUSDC = await daoTokenFac.deploy("DAO USDC", "daoUSDC", 6)
    // await daoUSDC.deployTransaction.wait()
    // console.log("DAO USDC contract address:", daoUSDC.address)

    // const daoDAI = await daoTokenFac.deploy("DAO DAI", "daoDAI", 18)
    // await daoDAI.deployTransaction.wait()
    // console.log("DAO DAI contract address:", daoDAI.address)

    let tx
    const daoUSDT = await ethers.getContractAt("DAOToken", daoUSDTAddr, deployer)
    tx = await daoUSDT.mint(ethers.utils.parseUnits("10000", 6))
    await tx.wait()
    const daoUSDTAmt = await daoUSDT.balanceOf(deployer.address)
    console.log(`Success mint ${ethers.utils.formatUnits(daoUSDTAmt, 6)} to deployer account`)

    const daoUSDC = await ethers.getContractAt("DAOToken", daoUSDCAddr, deployer)
    tx = await daoUSDC.mint(ethers.utils.parseUnits("10000", 6))
    await tx.wait()
    const daoUSDCAmt = await daoUSDC.balanceOf(deployer.address)
    console.log(`Success mint ${ethers.utils.formatUnits(daoUSDCAmt, 6)} to deployer account`)

    const daoDAI = await ethers.getContractAt("DAOToken", daoDAIAddr, deployer)
    tx = await daoDAI.mint(ethers.utils.parseEther("10000"))
    await tx.wait()
    const daoDAIAmt = await daoDAI.balanceOf(deployer.address)
    console.log(`Success mint ${ethers.utils.formatEther(daoDAIAmt)} to deployer account`)


    tx = await daoUSDT.transfer(receiverAddr, daoUSDT.balanceOf(deployer.address))
    await tx.wait()
    console.log(ethers.utils.formatUnits(await daoUSDT.balanceOf(receiverAddr), 6))

    tx = await daoUSDC.transfer(receiverAddr, daoUSDC.balanceOf(deployer.address))
    await tx.wait()
    console.log(ethers.utils.formatUnits(await daoUSDC.balanceOf(receiverAddr), 6))

    tx = await daoDAI.transfer(receiverAddr, daoDAI.balanceOf(deployer.address))
    await tx.wait()
    console.log(ethers.utils.formatEther(await daoDAI.balanceOf(receiverAddr)))
}
main()