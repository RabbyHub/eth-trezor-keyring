/// <reference types="node" />
import { EventEmitter } from 'events';
import { TrezorBridgeInterface } from './trezor-bridge-interface';
interface Account {
    address: string;
    index: number;
}
export declare enum LedgerHDPathType {
    LedgerLive = "LedgerLive",
    Legacy = "Legacy",
    BIP44 = "BIP44"
}
type HDPathType = LedgerHDPathType;
interface AccountDetail {
    hdPathBasePublicKey?: string;
    hdPath: string;
    hdPathType: HDPathType;
    index: number;
}
declare class TrezorKeyring extends EventEmitter {
    static type: string;
    type: string;
    accounts: string[];
    hdk: any;
    page: number;
    perPage: number;
    unlockedAccount: number;
    paths: {};
    hdPath: string;
    accountDetails: Record<string, AccountDetail>;
    bridge: TrezorBridgeInterface;
    constructor(opts?: any & {
        bridge: TrezorBridgeInterface;
    });
    init(): void;
    /**
     * Gets the model, if known.
     * This may be `undefined` if the model hasn't been loaded yet.
     *
     * @returns {"T" | "1" | undefined}
     */
    getModel(): string;
    dispose(): void;
    cleanUp(force?: boolean): void;
    serialize(): Promise<{
        hdPath: string;
        accounts: string[];
        page: number;
        paths: {};
        perPage: number;
        unlockedAccount: number;
        accountDetails: Record<string, AccountDetail>;
    }>;
    deserialize(opts?: any): Promise<void>;
    isUnlocked(): boolean;
    unlock(): Promise<unknown>;
    setAccountToUnlock(index: any): void;
    addAccounts(n?: number): Promise<unknown>;
    getFirstPage(): Promise<any>;
    getNextPage(): Promise<any>;
    getPreviousPage(): Promise<any>;
    getAddresses(start: number, end: number): Promise<any>;
    __getPage(increment: number): Promise<any>;
    getAccounts(): Promise<string[]>;
    removeAccount(address: any): void;
    /**
     * Signs a transaction using Trezor.
     *
     * Accepts either an ethereumjs-tx or @ethereumjs/tx transaction, and returns
     * the same type.
     *
     * @template {TypedTransaction | OldEthJsTransaction} Transaction
     * @param {string} address - Hex string address.
     * @param {Transaction} tx - Instance of either new-style or old-style ethereumjs transaction.
     * @returns {Promise<Transaction>} The signed transaction, an instance of either new-style or old-style
     * ethereumjs transaction.
     */
    signTransaction(address: any, tx: any): Promise<any>;
    /**
     *
     * @template {TypedTransaction | OldEthJsTransaction} Transaction
     * @param {string} address - Hex string address.
     * @param {number} chainId - Chain ID
     * @param {Transaction} tx - Instance of either new-style or old-style ethereumjs transaction.
     * @param {(import('trezor-connect').EthereumSignedTx) => Transaction} handleSigning - Converts signed transaction
     * to the same new-style or old-style ethereumjs-tx.
     * @returns {Promise<Transaction>} The signed transaction, an instance of either new-style or old-style
     * ethereumjs transaction.
     */
    _signTransaction(address: any, chainId: any, tx: any, handleSigning: any): Promise<any>;
    signMessage(withAccount: any, data: any): Promise<unknown>;
    signPersonalMessage(withAccount: any, message: any): Promise<unknown>;
    /**
     * EIP-712 Sign Typed Data
     */
    signTypedData(address: any, data: any, { version }: {
        version: any;
    }): Promise<string>;
    exportAccount(): Promise<never>;
    forgetDevice(): void;
    /**
     * Set the HD path to be used by the keyring. Only known supported HD paths are allowed.
     *
     * If the given HD path is already the current HD path, nothing happens. Otherwise the new HD
     * path is set, and the wallet state is completely reset.
     *
     * @throws {Error] Throws if the HD path is not supported.
     *
     * @param {string} hdPath - The HD path to set.
     */
    setHdPath(hdPath: any): void;
    _normalize(buf: any): string;
    _addressFromIndex(pathBase: any, i: any): string;
    _pathFromAddress(address: string): string;
    indexFromAddress(address: string): any;
    getCurrentAccounts(): Promise<Account[]>;
    private getPathBasePublicKey;
    private _fixAccountDetail;
}
export default TrezorKeyring;
