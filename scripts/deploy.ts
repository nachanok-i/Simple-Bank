import { ethers } from "hardhat";

async function main() {
  const inititalSupply = "1000000000000000000000";

  const Token = await ethers.getContractFactory("STToken");
  const token = await Token.deploy(inititalSupply);

  await token.deployed();

  console.log(`STToken deployed with ${inititalSupply} initial supply with address ${token.address}`);

  const tokenAddress = "0x1d533D57fa56146A9F689716F4791217a5Ba6355"

  const Bank = await ethers.getContractFactory("Bank");
  const bank = await Bank.deploy(tokenAddress);

  await bank.deployed();

  console.log(`Simple Bank deployed with ${tokenAddress} token address with address ${bank.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
