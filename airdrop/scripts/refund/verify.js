// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const {ethers} = require("hardhat");

async function main() {
  const DEPLOYER = '0x5011f31d9969Fb0B31766435829Df66Afa04D6FA';

  const deployedContracts = {
    SALE: '0xAeCB7a6a454146c449c4131EE12de8Db46eeDe6E',
    REFUND: '0x8a0E39f5eFFE706F3D2ff7439eD96B9050E391a9',
  };

  await hre.run("verify:verify", {
    address: deployedContracts.REFUND,
    constructorArguments: [
      DEPLOYER,
    ],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
