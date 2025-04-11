const { ethers } = require("ethers");
require("dotenv").config();

const provider = new ethers.WebSocketProvider(
  process.env.ALCHEMY_RPC_URL /*`wss://sepolia.infura.io/ws/v3/${process.env.INFURA_ID}`*/
);

const depositWallet = new ethers.Wallet(
  process.env.DEPOSIT_WALLET_PRIVATE_KEY,
  provider
);

const main = async () => {
  const depositWalletAddress = depositWallet.address;
  console.log(`Watching for incoming tx to ${depositWalletAddress}...`);

  provider.on("pending", async (txHash) => {
    try {
      const tx = await provider.getTransaction(txHash);
      if (!tx) return;

      const { from, to, value } = tx;

      if (to === depositWalletAddress) {
        console.log(
          `Receiving ${ethers.formatEther(value)} ETH from ${from}...`
        );
        console.log(
          `Waiting for ${process.env.CONFIRMATIONS_BEFORE_WITHDRAWAL} confirmation(s)...`
        );

        const receipt = await provider.waitForTransaction(
          txHash,
          Number(process.env.CONFIRMATIONS_BEFORE_WITHDRAWAL),
          60000 // Timeout after 60 seconds
        );

        if (receipt) {
          const currentBalance = await provider.getBalance(
            depositWalletAddress
          );
          const feeData = await provider.getFeeData(); // Updated method to get gas price
          const gasPrice = feeData.gasPrice; // Extract gas price
          const gasLimit = 21000n;
          const maxGasFee = gasLimit * gasPrice;

          const txData = {
            to: process.env.VAULT_WALLET_ADDRESS,
            value: currentBalance - maxGasFee,
            gasLimit,
            gasPrice,
          };

          try {
            const withdrawalTx = await depositWallet.sendTransaction(txData);
            await withdrawalTx.wait(1);
            console.log(
              `Withdrew ${ethers.formatEther(
                currentBalance - maxGasFee
              )} ETH to VAULT ${process.env.VAULT_WALLET_ADDRESS} ✅`
            );
          } catch (error) {
            console.error("Withdrawal failed", error);
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  });
};

if (require.main === module) {
  main();
}

exports.handler = main;
