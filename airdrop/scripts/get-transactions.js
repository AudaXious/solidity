// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const {ethers} = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const deployedContracts = {
    SALE: '0xAeCB7a6a454146c449c4131EE12de8Db46eeDe6E',
  };
  let jsonPath = path.join(__dirname, "../tx.json");

  const Sale = await ethers.getContractFactory("Sale");
  const saleContract = await Sale.attach(deployedContracts.SALE);
  const filter = saleContract.filters.Purchase();
  for (let i = 1734; i <= 1754; i ++) {
    const logs = await saleContract.queryFilter(filter, i * 10000, (i + 1) * 10000);
    for (const log of logs) {
      fs.appendFileSync(jsonPath, `${log.args.userAddress}\t${ethers.utils.formatUnits(log.args.amount)}\n`);
    }
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
