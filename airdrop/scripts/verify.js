// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const {ethers} = require("hardhat");

async function main() {
  const DEPLOYER = '0x5011f31d9969Fb0B31766435829Df66Afa04D6FA';
  const OWNER = '0x2086446a8dcD1272ef4216Baf426f02BC420BEa2';
  const ASSETS_RECEIVER = '0x7976cb551f826d1E1C1E54a9d49ad5cD64D3D467';
  const BUSD = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
  const STAKING = '0x3A0EC93393775F4429909fB4e079d42AfABEeA02';
  const TOKEN = '0x1BD8cA161F0b311162365248b39B38F85e238345';

  // const ERC20 = await ethers.getContractFactory("OxPAD");
  // const tokenContract = await ERC20.deploy(
  //   OWNER,
  //   'TEST_2',
  //   'TEST_2',
  //   ethers.utils.parseUnits('10000000')
  // );
  // console.log(`Token contract address: ${tokenContract.address}`);

  // sale deployment data
  const startTime = 1651165200;
  const whitelistEndTime = 1651770000;
  const endTime = 1651770000;
  const tokenUsdRate = 0.016;
  const salePoolSize = 28000000;
  const maxTokenAmount = 625000; // 10000 BUSD
  const tokenThreshold = 25000;
  // const SALE = '0x0AE8F455cc709e62300ee146Fb04063E241D41d1';
  const SALE = '0xAeCB7a6a454146c449c4131EE12de8Db46eeDe6E';

  await hre.run("verify:verify", {
    address: SALE,
    constructorArguments: [
      DEPLOYER,
      ASSETS_RECEIVER,
      TOKEN,
      STAKING,
      startTime,
      whitelistEndTime,
      endTime,
      ethers.utils.parseUnits(tokenUsdRate.toString()),
      ethers.utils.parseUnits(salePoolSize.toString()),
      ethers.utils.parseUnits(maxTokenAmount.toString()),
      ethers.utils.parseUnits(tokenThreshold.toString())
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
