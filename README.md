
# ⚡ Handur | Trenches. Analyze. Grow.

> **Real-time EVM log parser for ERC-20 transfers and Uniswap V3 swaps**

Handur is a lightweight JavaScript module (Ethers.js v6) that decodes raw on-chain logs into clean, ready-to-use objects: token transfers, swap amounts, spot prices, and trade direction. It is the data layer for the upcoming Handur trench-analytics web app.

---

## 🚀 Features

- **⚡ Log Parser:** Decodes ERC-20 `Transfer` and Uniswap V3 `Swap` events. ERC-721 transfers (same topic, different shape) are skipped instead of mis-parsed.
- **📊 Spot Price from `sqrtPriceX96`:** Converts the pool's Q96 price into a human-readable price, adjusted for each token's decimals.
- **🌊 Trade Direction:** Labels each swap as `BUY <token0>` or `BUY <token1>` from the sign of the pool's token amounts.
- **🔢 Per-token Decimals:** Pass token and pool metadata so USDC (6 decimals), WBTC (8), etc. are formatted correctly.
- **📡 Live or Batch:** Subscribe to a pool over WebSocket, or batch-parse historical logs from `provider.getLogs()`.

---

## 🛠️ Tech Stack

- **Runtime:** Node.js 18+ or any modern browser bundler (ES modules)
- **Blockchain Integration:** [Ethers.js v6](https://docs.ethers.org/v6/)
- **Standards:** ERC-20, Uniswap V3 Pool

---

## 💡 Quick Start

### Installation

```bash
git clone https://github.com/Hanandaniyar/Handur-Trenches.git
cd Handur-Trenches
npm install
```

### Live swaps

```javascript
import { HandurLogParser } from "./handur_log_parser.js";
import { ethers } from "ethers";

// WebSocket provider recommended for live streams
const provider = new ethers.WebSocketProvider("wss://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY");

// USDC / WETH 0.05% pool
const USDC_WETH_POOL = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";

const parser = new HandurLogParser(provider, {
  [USDC_WETH_POOL]: { decimals0: 6, decimals1: 18, symbol0: "USDC", symbol1: "WETH" }
});

const stopListening = parser.subscribeToPoolSwaps(USDC_WETH_POOL, (err, swap) => {
  if (err) return console.error("Swap Parsing Error:", err);

  console.log(`[SWAP DETECTED] ${swap.direction}`);
  console.log(`Price: ${swap.priceToken0InToken1} WETH per USDC`);
  console.log(`Tx Hash: ${swap.transactionHash}`);
});
```

### Batch-parse historical logs

```javascript
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

const parser = new HandurLogParser(
  provider,
  { [USDC_WETH_POOL]: { decimals0: 6, decimals1: 18, symbol0: "USDC", symbol1: "WETH" } },
  { [USDC]: { decimals: 6, symbol: "USDC" } } // token metadata for Transfer amounts
);

const logs = await provider.getLogs({ address: [USDC, USDC_WETH_POOL], fromBlock: -100 });
const { transfers, swaps, unknown } = parser.parseLogs(logs);
```

Addresses in the config can be checksummed or lower-case. Tokens or pools missing from the config fall back to 18 decimals and generic symbols (`TOKEN`, `TOKEN0`, `TOKEN1`).

---

## 🧪 Tests

```bash
npm test
```

---

## 📜 License

[MIT](LICENSE)
