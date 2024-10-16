import { EventEmitter } from 'events';
import * as ethUtil from 'ethereumjs-util';
import { TransactionFactory } from '@ethereumjs/tx';
import HDKey from 'hdkey';
import transformTypedData from '@trezor/connect-plugin-ethereum';
import { TrezorBridgeInterface } from './trezor-bridge-interface';

const SLIP0044TestnetPath = `m/44'/1'/0'/0`;

const keyringType = 'Trezor Hardware';
const pathBase = 'm';
const MAX_INDEX = 1000;
const DELAY_BETWEEN_POPUPS = 1000;
const TREZOR_CONNECT_MANIFEST = {
  email: 'support@debank.com/',
  appUrl: 'https://debank.com/',
};

const isSameAddress = (a: string, b: string) => {
  return a.toLowerCase() === b.toLowerCase();
};
interface Account {
  address: string;
  index: number;
}

export enum LedgerHDPathType {
  LedgerLive = 'LedgerLive',
  Legacy = 'Legacy',
  BIP44 = 'BIP44',
}

type HDPathType = LedgerHDPathType;

const HD_PATH_BASE = {
  [LedgerHDPathType.BIP44]: "m/44'/60'/0'/0",
  [LedgerHDPathType.Legacy]: "m/44'/60'/0'",
  [LedgerHDPathType.LedgerLive]: "m/44'/60'/0'/0/0",
};

const HD_PATH_TYPE = {
  [HD_PATH_BASE['Legacy']]: LedgerHDPathType.Legacy,
  [HD_PATH_BASE['BIP44']]: LedgerHDPathType.BIP44,
  [HD_PATH_BASE['LedgerLive']]: LedgerHDPathType.LedgerLive,
};

const ALLOWED_HD_PATHS = {
  [HD_PATH_BASE.BIP44]: true,
  [HD_PATH_BASE.Legacy]: true,
  [HD_PATH_BASE.LedgerLive]: true,
  [SLIP0044TestnetPath]: true,
};

interface AccountDetail {
  hdPathBasePublicKey?: string;
  hdPath: string;
  hdPathType: HDPathType;
  index: number;
}

/**
 * @typedef {import('@ethereumjs/tx').TypedTransaction} TypedTransaction
 * @typedef {InstanceType<import("ethereumjs-tx")>} OldEthJsTransaction
 */

/**
 * Check if the given transaction is made with ethereumjs-tx or @ethereumjs/tx
 *
 * Transactions built with older versions of ethereumjs-tx have a
 * getChainId method that newer versions do not.
 * Older versions are mutable
 * while newer versions default to being immutable.
 * Expected shape and type
 * of data for v, r and s differ (Buffer (old) vs BN (new)).
 *
 * @param {TypedTransaction | OldEthJsTransaction} tx
 * @returns {tx is OldEthJsTransaction} Returns `true` if tx is an old-style ethereumjs-tx transaction.
 */
function isOldStyleEthereumjsTx(tx) {
  return typeof tx.getChainId === 'function';
}

class TrezorKeyring extends EventEmitter {
  static type = keyringType;
  type = keyringType;
  accounts: string[] = [];
  hdkMap: Map<string, HDKey> = new Map();
  page = 0;
  perPage = 5;
  unlockedAccount = 0;
  paths = {};
  hdPath = '';
  accountDetails: Record<string, AccountDetail>;
  bridge!: TrezorBridgeInterface;

  constructor(
    opts: any & {
      bridge: TrezorBridgeInterface;
    } = {},
  ) {
    super();
    if (!opts.bridge) {
      throw new Error('Bridge is required');
    }
    this.bridge = opts.bridge;
    this.type = keyringType;
    this.accounts = [];
    this.hdkMap = new Map();
    this.page = 0;
    this.perPage = 5;
    this.unlockedAccount = 0;
    this.paths = {};
    this.deserialize(opts);
    this.accountDetails = {};

    this.init();
  }

  init() {
    this.bridge.init({
      manifest: TREZOR_CONNECT_MANIFEST,
      lazyLoad: true,
    });
    this.bridge.event.on('cleanUp', this.cleanUp);
  }

  /**
   * Gets the model, if known.
   * This may be `undefined` if the model hasn't been loaded yet.
   *
   * @returns {"T" | "1" | undefined}
   */
  getModel() {
    return this.bridge.model;
  }

  dispose() {
    // This removes the Trezor Connect iframe from the DOM
    // This method is not well documented, but the code it calls can be seen
    // here: https://github.com/trezor/connect/blob/dec4a56af8a65a6059fb5f63fa3c6690d2c37e00/src/js/iframe/builder.js#L181
    this.bridge.dispose();
  }

  cleanUp(force = false) {
    if (!this.hdkMap.size) {
      return;
    }
    if (force || this.bridge.connectDevices.size > 1) {
      this.hdkMap = new Map();
    }
  }

  serialize() {
    return Promise.resolve({
      hdPath: this.hdPath,
      accounts: this.accounts,
      page: this.page,
      paths: this.paths,
      perPage: this.perPage,
      unlockedAccount: this.unlockedAccount,
      accountDetails: this.accountDetails,
    });
  }

  deserialize(opts: any = {}) {
    this.hdPath = opts.hdPath || HD_PATH_BASE.BIP44;
    this.accounts = opts.accounts || [];
    this.page = opts.page || 0;
    this.perPage = opts.perPage || 5;
    this.accountDetails = opts.accountDetails || {};

    return Promise.resolve();
  }

  isUnlocked(start?: number, len = 1) {
    if (!this.hdkMap) {
      return false;
    }

    if (this.hdPath !== HD_PATH_BASE.LedgerLive) {
      return !!this.hdkMap.get(this.hdPath);
    }

    if (start === null || start === undefined) {
      return !!this.hdkMap.size;
    }

    for (let i = start; i < start + len; i++) {
      const path = this._getPathForIndex(i);
      if (!this.hdkMap.get(path)?.publicKey) {
        return false;
      }
    }

    return true;
  }

  unlock(start?: number, len?: number) {
    if (this.isUnlocked(start, len)) {
      return Promise.resolve('already unlocked');
    }
    return new Promise((resolve, reject) => {
      const hdPaths: string[] = [];
      hdPaths.push(this.hdPath);

      if (
        typeof start === 'number' &&
        typeof len === 'number' &&
        this.hdPath === HD_PATH_BASE.LedgerLive
      ) {
        for (let i = start; i < start + len; i++) {
          hdPaths.push(this._getPathForIndex(i));
        }
      }
      const bundle = hdPaths.map((path) => ({ path, coin: 'ETH' }));

      this.bridge
        .getPublicKey({
          bundle,
        })
        .then((response) => {
          if (response.success) {
            response.payload.forEach((item) => {
              const hdk = new HDKey();
              hdk.publicKey = Buffer.from(item.publicKey, 'hex');
              hdk.chainCode = Buffer.from(item.chainCode, 'hex');
              this.hdkMap.set(item.serializedPath, hdk);
            });
            resolve('just unlocked');
          } else {
            reject(
              new Error(
                (response.payload && response.payload.error) || 'Unknown error',
              ),
            );
          }
        })
        .catch((e) => {
          reject(new Error((e && e.toString()) || 'Unknown error'));
        });
    });
  }

  setAccountToUnlock(index) {
    this.unlockedAccount = parseInt(index, 10);
  }

  _isLedgerLiveHdPath() {
    return this.hdPath === "m/44'/60'/0'/0/0";
  }
  _getPathForIndex(index: number) {
    if (index === undefined || index === null) {
      return '';
    }
    // Check if the path is BIP 44 (Ledger Live)
    return this._isLedgerLiveHdPath()
      ? `m/44'/60'/${index}'/0/0`
      : `${this.hdPath}/${index}`;
  }

  addAccounts(n = 1) {
    return new Promise((resolve, reject) => {
      this.unlock(this.unlockedAccount, n)
        .then((_) => {
          const from = this.unlockedAccount;
          const to = from + n;

          for (let i = from; i < to; i++) {
            const address = this._addressFromIndex(pathBase, i);
            if (!this.accounts.includes(address)) {
              this.accounts.push(address);
              this.accountDetails[ethUtil.toChecksumAddress(address)] = {
                hdPath: this._getPathForIndex(i),
                hdPathType: this.getCurrentUsedHDPathType(),
                hdPathBasePublicKey: this.getPathBasePublicKey(),
                index: i,
              };
            }
            this.page = 0;
          }
          resolve(this.accounts);
        })
        .catch((e) => {
          reject(e);
        });
    });
  }

  getFirstPage() {
    this.page = 0;
    return this.__getPage(1);
  }

  getNextPage() {
    return this.__getPage(1);
  }

  getPreviousPage() {
    return this.__getPage(-1);
  }

  getAddresses(start: number, end: number): Promise<any> {
    return new Promise((resolve, reject) => {
      this.unlock(start, end - start + 1)
        .then((_) => {
          const from = start;
          const to = end;

          const accounts: any[] = [];

          for (let i = from; i < to; i++) {
            const address = this._addressFromIndex(pathBase, i);
            accounts.push({
              address,
              balance: null,
              index: i + 1,
            });
            this.paths[ethUtil.toChecksumAddress(address)] = i;
          }
          resolve(accounts);
        })
        .catch((e) => {
          reject(e);
        });
    });
  }

  __getPage(increment: number): Promise<any> {
    this.page += increment;

    if (this.page <= 0) {
      this.page = 1;
    }

    return new Promise((resolve, reject) => {
      this.unlock()
        .then((_) => {
          const from = (this.page - 1) * this.perPage;
          const to = from + this.perPage;

          const accounts: any[] = [];

          for (let i = from; i < to; i++) {
            const address = this._addressFromIndex(pathBase, i);
            accounts.push({
              address,
              balance: null,
              index: i + 1,
            });
            this.paths[ethUtil.toChecksumAddress(address)] = i;
          }
          resolve(accounts);
        })
        .catch((e) => {
          reject(e);
        });
    });
  }

  getAccounts() {
    return Promise.resolve(this.accounts.slice());
  }

  removeAccount(address) {
    if (
      !this.accounts.map((a) => a.toLowerCase()).includes(address.toLowerCase())
    ) {
      throw new Error(`Address ${address} not found in this keyring`);
    }

    this.accounts = this.accounts.filter(
      (a) => a.toLowerCase() !== address.toLowerCase(),
    );
    const checksummedAddress = ethUtil.toChecksumAddress(address);
    delete this.accountDetails[checksummedAddress];
    delete this.paths[checksummedAddress];
  }

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
  signTransaction(address, tx) {
    if (isOldStyleEthereumjsTx(tx)) {
      // In this version of ethereumjs-tx we must add the chainId in hex format
      // to the initial v value. The chainId must be included in the serialized
      // transaction which is only communicated to ethereumjs-tx in this
      // value. In newer versions the chainId is communicated via the 'Common'
      // object.
      return this._signTransaction(address, tx.getChainId(), tx, (payload) => {
        tx.v = Buffer.from(payload.v, 'hex');
        tx.r = Buffer.from(payload.r, 'hex');
        tx.s = Buffer.from(payload.s, 'hex');
        return tx;
      });
    }
    return this._signTransaction(
      address,
      Number(tx.common.chainId()),
      tx,
      (payload) => {
        // Because tx will be immutable, first get a plain javascript object that
        // represents the transaction. Using txData here as it aligns with the
        // nomenclature of ethereumjs/tx.
        const txData = tx.toJSON();
        // The fromTxData utility expects a type to support transactions with a type other than 0
        txData.type = tx.type;
        // The fromTxData utility expects v,r and s to be hex prefixed
        txData.v = ethUtil.addHexPrefix(payload.v);
        txData.r = ethUtil.addHexPrefix(payload.r);
        txData.s = ethUtil.addHexPrefix(payload.s);
        // Adopt the 'common' option from the original transaction and set the
        // returned object to be frozen if the original is frozen.
        return TransactionFactory.fromTxData(txData, {
          common: tx.common,
          freeze: Object.isFrozen(tx),
        });
      },
    );
  }

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
  async _signTransaction(address, chainId, tx, handleSigning) {
    let transaction;
    if (isOldStyleEthereumjsTx(tx)) {
      // legacy transaction from ethereumjs-tx package has no .toJSON() function,
      // so we need to convert to hex-strings manually manually
      transaction = {
        to: this._normalize(tx.to),
        value: this._normalize(tx.value),
        data: this._normalize(tx.data),
        chainId,
        nonce: this._normalize(tx.nonce),
        gasLimit: this._normalize(tx.gasLimit),
        gasPrice: this._normalize(tx.gasPrice),
      };
    } else {
      // new-style transaction from @ethereumjs/tx package
      // we can just copy tx.toJSON() for everything except chainId, which must be a number
      transaction = {
        ...tx.toJSON(),
        chainId,
        to: this._normalize(tx.to),
      };
    }

    try {
      const response = await this.bridge.ethereumSignTransaction({
        path: await this.getHdPath(address),
        transaction,
      });
      if (response.success) {
        const newOrMutatedTx = handleSigning(response.payload);

        const addressSignedWith = ethUtil.toChecksumAddress(
          ethUtil.addHexPrefix(
            newOrMutatedTx.getSenderAddress().toString('hex'),
          ),
        );
        const correctAddress = ethUtil.toChecksumAddress(address);
        if (addressSignedWith !== correctAddress) {
          throw new Error("signature doesn't match the right address");
        }

        return newOrMutatedTx;
      }
      throw new Error(
        (response.payload && response.payload.error) || 'Unknown error',
      );
    } catch (e: any) {
      throw new Error((e && e.toString()) || 'Unknown error');
    }
  }

  signMessage(withAccount, data) {
    return this.signPersonalMessage(withAccount, data);
  }

  // For personal_sign, we need to prefix the message:
  async signPersonalMessage(withAccount, message) {
    try {
      const response = await this.bridge.ethereumSignMessage({
        path: await this.getHdPath(withAccount),
        message: ethUtil.stripHexPrefix(message),
        hex: true,
      });

      if (response.success) {
        if (
          response.payload.address !== ethUtil.toChecksumAddress(withAccount)
        ) {
          throw new Error('signature doesnt match the right address');
        }
        const signature = `0x${response.payload.signature}`;
        return signature;
      } else {
        throw new Error(
          (response.payload && response.payload.error) || 'Unknown error',
        );
      }
    } catch (e: any) {
      throw new Error((e && e.toString()) || 'Unknown error');
    }
  }

  /**
   * EIP-712 Sign Typed Data
   */
  async signTypedData(address, data, { version }) {
    const dataWithHashes = transformTypedData(data, version === 'V4');

    // set default values for signTypedData
    // Trezor is stricter than @metamask/eth-sig-util in what it accepts
    const {
      types: { EIP712Domain = [], ...otherTypes } = {},
      message = {},
      domain = {},
      primaryType,
      // snake_case since Trezor uses Protobuf naming conventions here
      domain_separator_hash, // eslint-disable-line camelcase
      message_hash, // eslint-disable-line camelcase
    } = dataWithHashes;

    // This is necessary to avoid popup collision
    // between the unlock & sign trezor popups
    const response = await this.bridge.ethereumSignTypedData({
      path: await this.getHdPath(address),
      data: {
        types: { EIP712Domain, ...otherTypes },
        message,
        domain,
        primaryType,
      },
      metamask_v4_compat: true,
      // Trezor 1 only supports blindly signing hashes
      domain_separator_hash,
      message_hash,
    } as any);

    if (response.success) {
      if (ethUtil.toChecksumAddress(address) !== response.payload.address) {
        throw new Error('signature doesnt match the right address');
      }
      return response.payload.signature;
    }

    throw new Error(
      (response.payload && response.payload.error) || 'Unknown error',
    );
  }

  exportAccount() {
    return Promise.reject(new Error('Not supported on this device'));
  }

  forgetDevice() {
    this.accounts = [];
    this.hdkMap = new Map();
    this.page = 0;
    this.unlockedAccount = 0;
    this.paths = {};
  }

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
  setHdPath(hdPath) {
    if (!ALLOWED_HD_PATHS[hdPath]) {
      throw new Error(
        `The setHdPath method does not support setting HD Path to ${hdPath}`,
      );
    }

    // Reset HDKey if the path changes
    if (this.hdPath !== hdPath) {
      this.hdkMap = new Map();
      this.page = 0;
      this.perPage = 5;
      this.unlockedAccount = 0;
    }
    this.hdPath = hdPath;
  }

  /* PRIVATE METHODS */

  _normalize(buf) {
    return ethUtil.bufferToHex(buf).toString();
  }

  // eslint-disable-next-line no-shadow
  _addressFromIndex(pathBase, i) {
    let dkey: HDKey;
    if (this.hdPath === HD_PATH_BASE.LedgerLive) {
      const path = this._getPathForIndex(i);
      dkey = this.hdkMap.get(path);
    } else {
      const hdk = this.hdkMap.get(this.hdPath);
      dkey = hdk.derive(`${pathBase}/${i}`);
    }
    const address = ethUtil
      .publicToAddress(dkey.publicKey, true)
      .toString('hex');
    return ethUtil.toChecksumAddress(`0x${address}`);
  }

  indexFromAddress(address: string) {
    const checksummedAddress = ethUtil.toChecksumAddress(address);
    let index =
      this.paths[checksummedAddress] ||
      this.accountDetails[checksummedAddress]?.index;

    if (typeof index === 'undefined') {
      for (let i = 0; i < MAX_INDEX; i++) {
        if (checksummedAddress === this._addressFromIndex(pathBase, i)) {
          index = i;
          break;
        }
      }
    }

    if (typeof index === 'undefined') {
      throw new Error('Unknown address');
    }
    return index;
  }

  async getCurrentAccounts() {
    await this.unlock(0, 51);
    const addresses = await this.getAccounts();
    const currentPublicKey = this.getPathBasePublicKey();

    const accounts: Account[] = [];

    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      await this._fixAccountDetail(address);

      const detail = this.accountDetails[ethUtil.toChecksumAddress(address)];

      if (detail?.hdPathBasePublicKey === currentPublicKey) {
        try {
          const account = {
            address,
            index: this.indexFromAddress(address) + 1,
          };
          accounts.push(account);
        } catch (e) {
          console.log('address not found', address);
        }
        continue;
      }

      // Live and BIP44 first account is the same
      // we need to check the first account when the path type is LedgerLive or BIP44
      const hdPathType = this.getCurrentUsedHDPathType();
      if (
        hdPathType !== LedgerHDPathType.Legacy &&
        (detail.hdPathType === LedgerHDPathType.LedgerLive ||
          detail.hdPathType === LedgerHDPathType.BIP44)
      ) {
        const info = this.getAccountInfo(address);
        if (info?.index === 1) {
          const firstAddress = this._addressFromIndex(pathBase, 0);

          if (isSameAddress(firstAddress, address)) {
            accounts.push(info);
          }
        }
      }
    }

    return accounts;
  }

  private getPathBasePublicKey() {
    let hdk: HDKey;
    if (this.hdPath === HD_PATH_BASE.LedgerLive) {
      const path = this._getPathForIndex(0);
      hdk = this.hdkMap.get(path);
    } else {
      hdk = this.hdkMap.get(this.hdPath);
    }
    return hdk.publicKey.toString('hex');
  }

  private async _fixAccountDetail(address: string) {
    const checksummedAddress = ethUtil.toChecksumAddress(address);
    const detail = this.accountDetails[checksummedAddress];

    // The detail is already fixed
    if (detail?.hdPathBasePublicKey && detail.hdPath) {
      return;
    }

    let addressInDevice;
    let index;
    try {
      index = this.indexFromAddress(address);
      addressInDevice = this._addressFromIndex(pathBase, index);
    } catch (e) {
      console.log('address not found', address);
    }

    if (!addressInDevice || !isSameAddress(address, addressInDevice)) {
      return;
    }

    this.accountDetails[checksummedAddress] = {
      ...detail,
      index,
      hdPath: this._getPathForIndex(index),
      hdPathType: LedgerHDPathType.BIP44,
      hdPathBasePublicKey: this.getPathBasePublicKey(),
    };
  }

  private getHDPathBase(hdPathType: HDPathType) {
    return HD_PATH_BASE[hdPathType];
  }

  async setHDPathType(hdPathType: HDPathType) {
    const hdPath = this.getHDPathBase(hdPathType);
    this.setHdPath(hdPath);
  }

  getCurrentUsedHDPathType() {
    return HD_PATH_TYPE[this.hdPath];
  }

  getAccountInfo(address: string) {
    const detail = this.accountDetails[ethUtil.toChecksumAddress(address)];
    if (detail) {
      const { hdPath, hdPathType, hdPathBasePublicKey } = detail;
      return {
        address,
        index: this.indexFromAddress(address) + 1,
        balance: null,
        hdPathType,
        hdPathBasePublicKey,
      };
    }
  }

  async getHdPath(address: string) {
    const detail = this.accountDetails[ethUtil.toChecksumAddress(address)];
    if (detail) {
      return detail.hdPath;
    }

    const path = this._getPathForIndex(this.paths[address]);

    if (path) {
      return path;
    }

    // old accounts not stored in paths and only support bip44
    this.setHdPath(HD_PATH_BASE.BIP44);
    await this.unlock();
    return `${this.hdPath}/${this.indexFromAddress(address)}`;
  }
}

export default TrezorKeyring;
