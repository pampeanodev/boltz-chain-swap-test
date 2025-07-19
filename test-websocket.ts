import { ChainToChainSwapService } from "./chain-to-chain-swap.service";

// Environment variables - replace these with your actual regtest values
const BOLTZ_WEBSOCKET_URL = "ws://localhost:9001/v2/ws"; // Replace with your regtest WebSocket URL
const BOLTZ_API_URL = "http://localhost:9001";
const NETWORK = "regtest";
const USER_BTC_ADDRESS = "bcrt1qz2npm9j8uap52v8usgt08maqvtu7yumh0rfydq";
const AMOUNT = 25_000;

async function testWebSocketListeners() {
  console.log("=== Boltz Chain Swap WebSocket Listener Debug Test ===");
  console.log("Configuration:");
  console.log("- Boltz API URL:", BOLTZ_API_URL);
  console.log("- Boltz WebSocket URL:", BOLTZ_WEBSOCKET_URL);
  console.log("- Network:", NETWORK);
  console.log("- User BTC Address:", USER_BTC_ADDRESS);
  console.log("- Amount:", AMOUNT);
  console.log("");

  const service = new ChainToChainSwapService(
    BOLTZ_API_URL,
    BOLTZ_WEBSOCKET_URL,
    NETWORK
  );

  try {
    console.log("Initializing service with WebSocket connection...");
    await service.initialize();
    console.log("✅ Service initialized successfully");

    if (!service.isWebSocketConnected()) {
      throw new Error("WebSocket failed to connect");
    }
    console.log("✅ WebSocket connection verified");
    console.log("");

    console.log("Creating chain swap with WebSocket listeners...");
    const { chainSwap, mockSwapEntity } =
      await service.startBoltzChainSwapWithListeners(USER_BTC_ADDRESS, AMOUNT);

    console.log("✅ Chain swap created with listeners:", {
      swapId: chainSwap.id,
      lockupAddress: chainSwap.lockupDetails.lockupAddress,
      lockupAmount: chainSwap.lockupDetails.amount,
      claimAmount: chainSwap.claimDetails.amount,
    });
    console.log("");

    console.log(
      "🔄 WebSocket listener is now active and waiting for updates..."
    );
    console.log("");
    console.log("=== Next Steps for Testing ===");
    console.log(
      "1. Send",
      chainSwap.lockupDetails.amount,
      "satoshis of L-BTC to:"
    );
    console.log("   Address:", chainSwap.lockupDetails.lockupAddress);
    console.log("   BIP21:", chainSwap.lockupDetails.bip21);
    console.log("");
    console.log(
      "2. Watch the console for WebSocket messages as the swap progresses"
    );
    console.log("3. The service will automatically handle:");
    console.log("   - swap.created event");
    console.log("   - transaction.lockup event");
    console.log(
      "   - transaction.server.mempool event (where detectSwap is called)"
    );
    console.log("   - transaction.claimed event");
    console.log("");
    console.log("Expected flow:");
    console.log(
      "  swap.created → transaction.lockup → transaction.server.mempool → transaction.claimed"
    );
    console.log("");
    console.log(
      '⚠️  The detectSwap issue should occur during the "transaction.server.mempool" event'
    );
    console.log("");

    // Keep the process alive to listen for WebSocket messages
    console.log("Keeping process alive to listen for WebSocket messages...");
    console.log("Press Ctrl+C to stop");

    // Set up graceful shutdown
    process.on("SIGINT", () => {
      console.log("\n\n=== Shutting down ===");
      service.disconnect();
      process.exit(0);
    });

    // Keep alive
    setInterval(() => {
      if (!service.isWebSocketConnected()) {
        console.log("❌ WebSocket connection lost");
        process.exit(1);
      }
    }, 5000);

    // Prevent the process from exiting
    await new Promise(() => {});
  } catch (error) {
    console.error("❌ Error during WebSocket test:", error);
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Response status:", error.response.status);
    }
    service.disconnect();
    process.exit(1);
  }
}

// Function to simulate WebSocket messages for testing listeners without actual swap
async function testWebSocketListenersWithMockData() {
  console.log("=== Testing WebSocket Listeners with Mock Data ===");

  // This would require modifying the WebSocket client to accept mock messages
  // For now, we'll just test the connection
  const service = new ChainToChainSwapService(
    BOLTZ_API_URL,
    BOLTZ_WEBSOCKET_URL,
    NETWORK
  );

  try {
    await service.initialize();

    if (service.isWebSocketConnected()) {
      console.log("✅ WebSocket connected successfully");
      console.log("✅ Ready to receive real messages");
    } else {
      console.log("❌ WebSocket connection failed");
    }

    service.disconnect();
  } catch (error) {
    console.error("❌ Error testing WebSocket connection:", error);
  }
}

// Main execution
async function main() {
  const testMode = process.env.TEST_MODE || "websocket";

  switch (testMode) {
    case "websocket":
      await testWebSocketListeners();
      break;
      break;
    case "connection":
      await testWebSocketListenersWithMockData();
      break;
    default:
      console.log("Available test modes:");
      console.log("- websocket: Full WebSocket listener test (default)");
      console.log("- detectswap: Test only detectSwap functionality");
      console.log("- connection: Test only WebSocket connection");
      console.log("");
      console.log("Usage: TEST_MODE=websocket npm run test:websocket");
      break;
  }
}

main().catch(console.error);
