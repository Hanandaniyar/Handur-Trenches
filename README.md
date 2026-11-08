
# ⚡ Handur | Trenches. Analyze. Grow.

> **High-Performance Web3 Trench Analytics & Real-Time On-Chain Intelligence**

Handur is a lightweight, dark-mode crypto analytics web application engineered for token tracking, liquidity pool monitoring, and parsing real-time EVM logs directly from Uniswap V3 and ERC-20 smart contracts.

---

## 🚀 Features

- **⚡ Real-Time Log Parser:** Fast decoding of `Transfer` and Uniswap V3 `Swap` events using Ethers.js v6.
- **📊 Precise Price Calculations:** Exact spot price derivation from $Q96$ (`sqrtPriceX96`) accounting for multi-decimal token pairs.
- **🌊 Trade Direction Sensing:** Automatic identification of swap directions (`BUY` vs `SELL`) relative to pool token balances.
- **📡 WebSocket & Polling Support:** Subscribe to live liquidity pool feeds or batch-parse historical transaction logs.
- **🎨 Sleek Cyberpunk UI:** Custom glassmorphism design with keyframe visual animations and dark-mode aesthetic.

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla HTML5, CSS3 (Custom Variables & Animations)
- **Blockchain Integration:** [Ethers.js v6](https://docs.ethers.org/v6/)
- **DEX Standard:** Uniswap V3 Pool Protocol & ERC-20 Standard

---

## 💡 Quick Start

### Installation

Import `HandurLogParser` into your Web3 application:

```javascript
import { HandurLogParser, calculateUniswapV3Price } from "./handur_log_parser.js";
import { ethers } from "ethers";

// Initialize Provider (WebSocket recommended for live streams)
const provider = new ethers.WebSocketProvider("wss://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY");

// Create Parser Instance
const parser = new HandurLogParser(provider);

// Subscribe to Live Uniswap V3 Swaps (e.g. USDC / WETH 0.05% Pool)
const USDC_WETH_POOL = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";

const stopListening = parser.subscribeToPoolSwaps(
  USDC_WETH_POOL,
  (err, swap) => {
    if (err) return console.error("Swap Parsing Error:", err);

    console.log(`[SWAP DETECTED] ${swap.direction}`);
    console.log(`Price: ${swap.priceToken0InToken1.toFixed(4)} WETH per USDC`);
    console.log(`Tx Hash: ${swap.transactionHash}`);
  },
  { decimals0: 6, decimals1: 18, symbol0: "USDC", symbol1: "WETH" }
);
```

---

## 📜 License

MIT License
