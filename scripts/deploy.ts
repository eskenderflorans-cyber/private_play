import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy WheelToken
  console.log("\n1. Deploying WheelToken...");
  const WheelToken = await ethers.getContractFactory("WheelToken");
  const wheelToken = await WheelToken.deploy();
  await wheelToken.waitForDeployment();
  const wheelTokenAddress = await wheelToken.getAddress();
  console.log("WheelToken deployed to:", wheelTokenAddress);

  // Deploy FortuneWheel
  console.log("\n2. Deploying FortuneWheel...");
  const FortuneWheel = await ethers.getContractFactory("FortuneWheel");
  const fortuneWheel = await FortuneWheel.deploy(wheelTokenAddress, deployer.address);
  await fortuneWheel.waitForDeployment();
  const fortuneWheelAddress = await fortuneWheel.getAddress();
  console.log("FortuneWheel deployed to:", fortuneWheelAddress);

  // Set FortuneWheel as operator for house wallet
  console.log("\n3. Setting up operator permissions...");
  await wheelToken.setOperator(fortuneWheelAddress, true);
  console.log("FortuneWheel set as operator for deployer (house wallet)");

  // Mint initial tokens to house wallet for payouts
  console.log("\n4. Minting initial tokens to house wallet...");
  const initialSupply = BigInt(10) * BigInt(10 ** 18);
  await wheelToken.mintPlain(deployer.address, initialSupply);
  console.log("Minted 10 WHEEL tokens to house wallet");

  // Summary
  console.log("\n========================================");
  console.log("Deployment Complete!");
  console.log("========================================");
  console.log("WheelToken:", wheelTokenAddress);
  console.log("FortuneWheel:", fortuneWheelAddress);
  console.log("House Wallet:", deployer.address);
  console.log("\nUpdate your frontend .env with:");
  console.log("VITE_WHEEL_TOKEN_ADDRESS=" + wheelTokenAddress);
  console.log("VITE_FORTUNE_WHEEL_ADDRESS=" + fortuneWheelAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
