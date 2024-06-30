import { Address, Builder, beginCell, Cell, toNano, Contract, ContractProvider, TupleBuilder, TupleReader, Sender, SendMode, OpenedContract } from '@ton/core';
import { JettonWallet } from './JettonWallet';
import { TradeState } from './TradeState';


function loadTupleBondingCurveParams(source: TupleReader) {
    let _mathScale = source.readBigNumber();
    let _coinScale = source.readBigNumber();
    let _alpha = source.readBigNumber();
    let _beta = source.readBigNumber();
    let _maxSupply = source.readBigNumber();
    let _bondingCurveMaxSupply = source.readBigNumber();
    let _maxTonAmount = source.readBigNumber();
    let _dexFeeAmount = source.readBigNumber();
    return { $$type: 'BondingCurveParams' as const, mathScale: _mathScale, coinScale: _coinScale, alpha: _alpha, beta: _beta, maxSupply: _maxSupply, bondingCurveMaxSupply: _bondingCurveMaxSupply, maxTonAmount: _maxTonAmount, dexFeeAmount: _dexFeeAmount };
}


function loadTupleFullJettonData(source: TupleReader) {
    let _totalSupply = source.readBigNumber();
    let _mintable = source.readBoolean();
    let _owner = source.readAddress();
    let _content = source.readCell();
    let _walletCode = source.readCell();
    let _tradeState = source.readBigNumber();
    let _bondingCurveBalance = source.readBigNumber();
    let _commissionBalance = source.readBigNumber();
    let _version = source.readBigNumber();
    const _bondingCurveParams = loadTupleBondingCurveParams(source.readTuple());
    let _commissionPromille = source.readBigNumber();
    let _tonBalance = source.readBigNumber();
    let _priceNanotons = source.readBigNumber();
    let _supplyLeft = source.readBigNumber();
    let _maxSupply = source.readBigNumber();

    // convert trade state to TradeState enum
    let tradeState: TradeState;
    switch (_tradeState) {
        case BigInt(0): tradeState = TradeState.BONDING_CURVE; break;
        case BigInt(1): tradeState = TradeState.DEPOSITING_TO_DEX; break;
        case BigInt(2): tradeState = TradeState.DEX; break;
        default: throw new Error('Invalid trade state');
    }

    return { $$type: 'FullJettonData' as const, totalSupply: _totalSupply, mintable: _mintable, owner: _owner, content: _content, walletCode: _walletCode, tradeState: tradeState, bondingCurveBalance: _bondingCurveBalance, commissionBalance: _commissionBalance, version: _version, bondingCurveParams: _bondingCurveParams, commissionPromille: _commissionPromille, tonBalance: _tonBalance, priceNanotons: _priceNanotons, supplyLeft: _supplyLeft, maxSupply: _maxSupply };
}


export type BondingCurveBuy = {
    $$type: 'BondingCurveBuy';
    doBuy: boolean;
}


export function storeBondingCurveBuy(src: BondingCurveBuy) {
    return (builder: Builder) => {
        let b_0 = builder;
        b_0.storeUint(1825825968, 32);
        b_0.storeBit(src.doBuy);
    };
}


export class GaspumpJetton implements Contract {
    readonly address: Address;

    private constructor(address: Address) {
        this.address = address;
    }

    static createFromAddress(address: Address) {
        return new GaspumpJetton(address);
    }

    // send-functions
    async sendBuy(
        provider: ContractProvider,
        via: Sender,
        { tonAmount, doCheckTradeState = true }: { tonAmount: bigint, doCheckTradeState?: boolean }
    ) {
        if (tonAmount < toNano('0.3')) {
            throw new Error(`Minimum amount is 0.3 TON`);
        }

        if (doCheckTradeState) {
            const fullJettonData = await this.getFullJettonData(provider);
            if (fullJettonData.tradeState !== TradeState.BONDING_CURVE) {
                throw new Error('Trade state is not BONDING_CURVE');
            }
        }

        // send
        const body = beginCell().store(
            storeBondingCurveBuy({
                $$type: 'BondingCurveBuy',
                doBuy: true,
        })).endCell();

        await provider.internal(via, {
            value: tonAmount,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: body,
        });
    }

    async sendSell(
        provider: ContractProvider,
        via: Sender,
        { jettonAmount, jettonWallet, doCheckTradeState = true, }: { jettonAmount: bigint, jettonWallet: OpenedContract<JettonWallet>, doCheckTradeState?: boolean, }
    ) {
        if (doCheckTradeState) {
            const fullJettonData = await this.getFullJettonData(provider);
            if (fullJettonData.tradeState !== TradeState.BONDING_CURVE) {
                throw new Error('Trade state is not BONDING_CURVE');
            }
        }

        // send
        const gasAmount = toNano('0.3');  // most of it will be refunded
        await jettonWallet.sendBurn(
            via,
            gasAmount,
            {
                queryId: 0n,
                amount: jettonAmount,
                ownerAddress: via.address!,
                responseAddress: via.address!,
            }
        );
    }

    async sendUnwrap(
        provider: ContractProvider,
        via: Sender,
        { jettonAmount, jettonWallet, doCheckTradeState = true, }: { jettonAmount: bigint, jettonWallet: OpenedContract<JettonWallet>, doCheckTradeState?: boolean, }
    ) {
        if (doCheckTradeState) {
            const fullJettonData = await this.getFullJettonData(provider);
            if (fullJettonData.tradeState !== TradeState.DEX) {
                throw new Error('Trade state is not DEX');
            }
        }

        // send
        const gasAmount = toNano('0.3');  // most of it will be refunded
        await jettonWallet.sendBurn(
            via,
            gasAmount,
            {
                queryId: 0n,
                amount: jettonAmount,
                ownerAddress: via.address!,
                responseAddress: via.address!,
            }
        );
    }

    // get-functions
    async getFullJettonData(provider: ContractProvider) {
        let builder = new TupleBuilder();
        let source = (await provider.get('get_full_jetton_data', builder.build())).stack;
        const result = loadTupleFullJettonData(source);
        return result;
    }

    async getUnwrappedJettonAddress(provider: ContractProvider) {
        let builder = new TupleBuilder();
        let source = (await provider.get('anotherMinterAddress', builder.build())).stack;
        let result = source.readAddress();
        return result;
    }

    async getJettonWalletAddress(provider: ContractProvider, owner: Address) {
        let builder = new TupleBuilder();
        builder.writeAddress(owner);
        let source = (await provider.get('get_wallet_address', builder.build())).stack;
        let result = source.readAddress();
        return result;
    }

    async estimateBuyJettonAmount(provider: ContractProvider, tonAmount: bigint) {
        let builder = new TupleBuilder();
        builder.writeNumber(tonAmount);
        let source = (await provider.get('getBuyAmount', builder.build())).stack;
        let result = source.readBigNumber();
        return result;
    }

    async estimateSellTonAmount(provider: ContractProvider, jettonAmount: bigint) {
        let builder = new TupleBuilder();
        builder.writeNumber(jettonAmount);
        let source = (await provider.get('getSellAmount', builder.build())).stack;
        let result = source.readBigNumber();
        return result;
    }
}