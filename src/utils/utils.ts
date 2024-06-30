import { Address } from "@ton/core";


export function calcBuyTonAmount(desiredTonAmount: bigint): bigint {
    return BigInt(Math.round(Number(desiredTonAmount)/0.99 + 0.12))
}


export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


export async function waitUntilContractIsDeployed(address: Address, tonClient: any, delay: number = 5000) {
    let currentIsDeployed = await tonClient.isContractDeployed(address)
    while (!currentIsDeployed) {
        console.log('Waiting for contract to be deployed...')
        await sleep(delay)
        currentIsDeployed = await tonClient.isContractDeployed(address)
    }
}


export async function waitUntilWalletSeqnoChanges(wallet: any, initialSeqno: number, delay: number = 5000) {
    let currentSeqno = initialSeqno
    while (currentSeqno == initialSeqno) {
        console.log('Waiting for wallet seqno to be changed...')
        await sleep(delay)
        currentSeqno = await wallet.getSeqno()
    }
}