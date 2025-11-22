import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  // Initialize FHEVM
  console.log("Initializing FHEVM plugin...");
  await hre.fhevm.initializeCLIApi();
  console.log("FHEVM plugin initialized\n");

  // Deploy fresh WheelToken (ERC7984)
  console.log("Deploying fresh WheelToken (ERC7984)...");
  const WheelToken = await ethers.getContractFactory("WheelToken");
  const wheelToken = await WheelToken.deploy();
  await wheelToken.waitForDeployment();
  const wheelTokenAddress = await wheelToken.getAddress();
  console.log("WheelToken deployed to:", wheelTokenAddress);

  // Deploy fresh FortuneWheel
  console.log("\nDeploying fresh FortuneWheel...");
  const FortuneWheel = await ethers.getContractFactory("FortuneWheel");
  const fortuneWheel = await FortuneWheel.deploy(wheelTokenAddress, signer.address);
  await fortuneWheel.waitForDeployment();
  const fortuneWheelAddress = await fortuneWheel.getAddress();
  console.log("FortuneWheel deployed to:", fortuneWheelAddress);

  // Set operator for house wallet (with far future expiration)
  // ERC7984 uses uint48 timestamp for expiration
  const farFuture = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year
  console.log("\nSetting FortuneWheel as operator for house (expiration:", farFuture, ")...");
  let tx = await wheelToken.setOperator(fortuneWheelAddress, farFuture);
  await tx.wait();
  console.log("House operator set");

  // Mint tokens to user (house wallet is also user in this test)
  console.log("\nMinting tokens to user...");
  const mintAmount = BigInt(1000000) * BigInt(10 ** 6); // 1M tokens
  tx = await wheelToken.mintPlain(signer.address, mintAmount);
  await tx.wait();
  console.log("Minted tokens to user");

  // Verify balance handle exists
  const balanceHandle = await wheelToken.confidentialBalanceOf(signer.address);
  console.log("Balance handle:", balanceHandle);

  // Verify operator status
  const isOp = await wheelToken.isOperator(signer.address, fortuneWheelAddress);
  console.log("Is FortuneWheel operator for user:", isOp);

  // Now test spin
  console.log("\n=== Testing Spin ===");

  // Use plaintext bet amount (10 tokens = 10 * 1e6)
  const betAmount = 10000000n; // 10 tokens
  console.log("Bet amount:", betAmount.toString());

  try {
    console.log("Sending spin transaction...");
    tx = await fortuneWheel.spin(betAmount, {
      gasLimit: 5000000n
    });
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✓ Spin SUCCESS! Gas used:", receipt?.gasUsed.toString());

    // Check pending spin
    const hasPending = await fortuneWheel.hasPendingSpin(signer.address);
    console.log("Has pending spin:", hasPending);

    // Get spin result
    const spinResult = await fortuneWheel.getSpinResult(signer.address);
    console.log("Spin result - Bet:", spinResult[0].toString());
    console.log("Spin result - Segment handle:", spinResult[1]);
    console.log("Spin result - Has pending:", spinResult[2]);
    console.log("Spin result - Is revealed:", spinResult[3]);
  } catch (error: any) {
    console.error("✗ Spin FAILED:", error.message);
    const parsed = await hre.fhevm.tryParseFhevmError(error);
    if (parsed) {
      console.error("Parsed error:", JSON.stringify(parsed, null, 2));
    }
  }
}

main().catch(console.error);
