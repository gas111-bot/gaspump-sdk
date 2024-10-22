import { WalletContractV4, TonClient } from '@ton/ton';
import { Address, toNano, fromNano } from '@ton/core';
import { mnemonicToPrivateKey } from "@ton/crypto";

import { GaspumpJetton } from '../src/contracts/GaspumpJetton';
import { JettonWallet } from '../src/contracts/JettonWallet';
import { calcBuyTonAmount, waitUntilContractIsDeployed, waitUntilWalletSeqnoChanges } from '../src/utils/utils';


const tonClient = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
    // apiKey: '',
})

async function main() {
    // Read command-line arguments
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
        slippage: 0.1,  // 10% slippage
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