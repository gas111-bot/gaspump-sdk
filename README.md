# ⛽️ [GasPump](https://t.me/gaspump_bot) SDK

## High-level overview of trading on GasPump
When a token is deployed, it immediately becomes tradable using a bonding curve. When it collects the hardcap (currently 1000 TON), liquidity is automatically deposited to DeDust.

There are 2 phases of the token lifecycle:
1. Bonding Curve
    - During this phase, the token is tradable using the bonding curve formula.
    - Users can buy and sell tokens.
    - Users trade wrapped tokens ($gasXXX).

2. DEX (DeDust)
    - Before trading on DeDust, users need to unwrap their $gasXXX and get $XXX tokens.
    - Unwrapping is performed 1:1.
    - Unwrapping is required so that nobody can create (and break) a liquidity pool before the hardcap is reached.

## Features
- SDK for GasPump smart contract interactions
- (soon) SDK for GasPump API

## Installation
```bash
npm install @gaspump/sdk
```

## Example usage (buy and sell)
```typescript
import { WalletContractV4, TonClient } from '@ton/ton';
import { Address, toNano, fromNano } from '@ton/core';
import { mnemonicToPrivateKey } from "@ton/crypto";

import { GaspumpJetton, JettonWallet, calcBuyTonAmount, waitUntilContractIsDeployed, waitUntilWalletSeqnoChanges } from '@gaspump/sdk';


const tonClient = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: 'API_KEY',  // from @tonapibot
})

async function main() {
    // example: ts-node buy_and_sell.ts <jetton_address> <wallet_mnemonics>

    // parse args
    const args = process.argv.slice(2);
    const jettonAddress = Address.parse(args[0]);
    const walletMnemonics = args[1];

    // setup wallet
    const walletMnemonicList = walletMnemonics.split(" ");
    let keyPair = await mnemonicToPrivateKey(walletMnemonicList);
    let wallet = tonClient.open(WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey }));
    let sender = wallet.sender(keyPair.secretKey)

    // setup contracts
    let gaspumpJetton = tonClient.open(GaspumpJetton.createFromAddress(jettonAddress));

    const jettonWalletAddress = await gaspumpJetton.getJettonWalletAddress(wallet.address);
    let jettonWallet = tonClient.open(JettonWallet.createFromAddress(jettonWalletAddress));

    // buy some jettons
    const tonAmount = toNano("1.0");
    const buyTonAmount = calcBuyTonAmount(tonAmount);

    const estimatedJettonAmount = await gaspumpJetton.getEstimateBuyJettonAmount(buyTonAmount);

    console.log(`Buying for 1.0 TON...`);
    let seqno = await wallet.getSeqno()
    await gaspumpJetton.sendBuy(sender, {
        tonAmount: buyTonAmount,
        doCheckTradeState: true,
    });
    await waitUntilWalletSeqnoChanges(wallet, seqno)

    // check the balance
    await waitUntilContractIsDeployed(jettonWallet.address, tonClient);

    let balance = await jettonWallet.getBalance();
    console.log(`✅ Successfully bought ${fromNano(balance)} jettons (estimated: ${fromNano(estimatedJettonAmount)})`);

    // sell all the jettons
    console.log(`Selling all ${fromNano(balance)} jettons...`);

    seqno = await wallet.getSeqno()
    await gaspumpJetton.sendSell(sender, {
        jettonAmount: balance,
        jettonWallet: jettonWallet,
        doCheckTradeState: true,
    });
    await waitUntilWalletSeqnoChanges(wallet, seqno)

    console.log(`✅ Successfully sold ${fromNano(balance)} jettons`);
}

main().catch(console.error);
```

## Contributing
Contributions are welcome! Please fork the repository and submit a pull request.

