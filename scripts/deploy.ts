import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy FundraiserFactory contract
  const Administration = await ethers.getContractFactory("Administration");
  const administration = await Administration.deploy();
  const administrationAddress = await administration.getAddress();
  const FundraiserFactory = await ethers.getContractFactory("FundraiserFactory");
  const factory = await FundraiserFactory.deploy(administrationAddress);

  console.log("Administration deployed to:", await administration.getAddress());
  console.log("FundraiserFactory deployed to:", await factory.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
