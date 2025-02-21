"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerHDPathType = void 0;
const events_1 = require("events");
const tx_1 = require("@ethereumjs/tx");
const util_1 = require("@ethereumjs/util");
const hdkey_1 = __importDefault(require("hdkey"));
const connect_plugin_ethereum_1 = __importDefault(require("@trezor/connect-plugin-ethereum"));
const SLIP0044TestnetPath = `m/44'/1'/0'/0`;
const keyringType = 'Trezor Hardware';
const pathBase = 'm';
const MAX_INDEX = 1000;
const DELAY_BETWEEN_POPUPS = 1000;
const TREZOR_CONNECT_MANIFEST = {
    email: 'support@debank.com/',
    appUrl: 'https://debank.com/',
};
const isSameAddress = (a, b) => {
    return a.toLowerCase() === b.toLowerCase();
};
var LedgerHDPathType;
(function (LedgerHDPathType) {
    LedgerHDPathType["LedgerLive"] = "LedgerLive";
    LedgerHDPathType["Legacy"] = "Legacy";
    LedgerHDPathType["BIP44"] = "BIP44";
})(LedgerHDPathType || (exports.LedgerHDPathType = LedgerHDPathType = {}));
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
class TrezorKeyring extends events_1.EventEmitter {
    constructor(opts = {}) {
        super();
        this.type = keyringType;
        this.accounts = [];
        this.hdkMap = new Map();
        this.page = 0;
        this.perPage = 5;
        this.unlockedAccount = 0;
        this.paths = {};
        this.hdPath = '';
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
    deserialize(opts = {}) {
        this.hdPath = opts.hdPath || HD_PATH_BASE.BIP44;
        this.accounts = opts.accounts || [];
        this.page = opts.page || 0;
        this.perPage = opts.perPage || 5;
        this.accountDetails = opts.accountDetails || {};
        return Promise.resolve();
    }
    isUnlocked(start, len = 1) {
        var _a;
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
            if (!((_a = this.hdkMap.get(path)) === null || _a === void 0 ? void 0 : _a.publicKey)) {
                return false;
            }
        }
        return true;
    }
    unlock(start, len) {
        if (this.isUnlocked(start, len)) {
            return Promise.resolve('already unlocked');
        }
        return new Promise((resolve, reject) => {
            const hdPaths = [];
            hdPaths.push(this.hdPath);
            if (typeof start === 'number' &&
                typeof len === 'number' &&
                this.hdPath === HD_PATH_BASE.LedgerLive) {
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
                        const hdk = new hdkey_1.default();
                        hdk.publicKey = Buffer.from(item.publicKey, 'hex');
                        hdk.chainCode = Buffer.from(item.chainCode, 'hex');
                        this.hdkMap.set(item.serializedPath, hdk);
                    });
                    resolve('just unlocked');
                }
                else {
                    reject(new Error((response.payload && response.payload.error) || 'Unknown error'));
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
    _getPathForIndex(index) {
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
                        this.accountDetails[(0, util_1.toChecksumAddress)(address)] = {
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
    getAddresses(start, end) {
        return new Promise((resolve, reject) => {
            this.unlock(start, end - start + 1)
                .then((_) => {
                const from = start;
                const to = end;
                const accounts = [];
                for (let i = from; i < to; i++) {
                    const address = this._addressFromIndex(pathBase, i);
                    accounts.push({
                        address,
                        balance: null,
                        index: i + 1,
                    });
                    this.paths[(0, util_1.toChecksumAddress)(address)] = i;
                }
                resolve(accounts);
            })
                .catch((e) => {
                reject(e);
            });
        });
    }
    __getPage(increment) {
        this.page += increment;
        if (this.page <= 0) {
            this.page = 1;
        }
        return new Promise((resolve, reject) => {
            this.unlock()
                .then((_) => {
                const from = (this.page - 1) * this.perPage;
                const to = from + this.perPage;
                const accounts = [];
                for (let i = from; i < to; i++) {
                    const address = this._addressFromIndex(pathBase, i);
                    accounts.push({
                        address,
                        balance: null,
                        index: i + 1,
                    });
                    this.paths[(0, util_1.toChecksumAddress)(address)] = i;
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
        if (!this.accounts.map((a) => a.toLowerCase()).includes(address.toLowerCase())) {
            throw new Error(`Address ${address} not found in this keyring`);
        }
        this.accounts = this.accounts.filter((a) => a.toLowerCase() !== address.toLowerCase());
        const checksummedAddress = (0, util_1.toChecksumAddress)(address);
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
        return this._signTransaction(address, Number(tx.common.chainId()), tx, (payload) => {
            // Because tx will be immutable, first get a plain javascript object that
            // represents the transaction. Using txData here as it aligns with the
            // nomenclature of ethereumjs/tx.
            const txData = tx.toJSON();
            // The fromTxData utility expects a type to support transactions with a type other than 0
            txData.type = `0x${tx.type.toString(16)}`;
            // The fromTxData utility expects v,r and s to be hex prefixed
            txData.v = (0, util_1.addHexPrefix)(payload.v);
            txData.r = (0, util_1.addHexPrefix)(payload.r);
            txData.s = (0, util_1.addHexPrefix)(payload.s);
            // Adopt the 'common' option from the original transaction and set the
            // returned object to be frozen if the original is frozen.
            return tx_1.TransactionFactory.fromTxData(txData, {
                common: tx.common,
                freeze: Object.isFrozen(tx),
            });
        });
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
    _signTransaction(address, chainId, tx, handleSigning) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            // new-style transaction from @ethereumjs/tx package
            // we can just copy tx.toJSON() for everything except chainId, which must be a number
            const transaction = Object.assign(Object.assign({}, tx.toJSON()), { chainId, to: (_a = tx.to) === null || _a === void 0 ? void 0 : _a.toString() });
            try {
                const response = yield this.bridge.ethereumSignTransaction({
                    path: yield this.getHdPath(address),
                    transaction: transaction,
                });
                if (response.success) {
                    const newOrMutatedTx = handleSigning(response.payload);
                    const addressSignedWith = (0, util_1.toChecksumAddress)((0, util_1.addHexPrefix)(newOrMutatedTx.getSenderAddress().toString()));
                    const correctAddress = (0, util_1.toChecksumAddress)(address);
                    if (addressSignedWith !== correctAddress) {
                        throw new Error("signature doesn't match the right address");
                    }
                    return newOrMutatedTx;
                }
                throw new Error((response.payload && response.payload.error) || 'Unknown error');
            }
            catch (e) {
                throw new Error((e && e.toString()) || 'Unknown error');
            }
        });
    }
    signMessage(withAccount, data) {
        return this.signPersonalMessage(withAccount, data);
    }
    // For personal_sign, we need to prefix the message:
    signPersonalMessage(withAccount, message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.bridge.ethereumSignMessage({
                    path: yield this.getHdPath(withAccount),
                    message: (0, util_1.stripHexPrefix)(message),
                    hex: true,
                });
                if (response.success) {
                    if (response.payload.address !== (0, util_1.toChecksumAddress)(withAccount)) {
                        throw new Error('signature doesnt match the right address');
                    }
                    const signature = `0x${response.payload.signature}`;
                    return signature;
                }
                else {
                    throw new Error((response.payload && response.payload.error) || 'Unknown error');
                }
            }
            catch (e) {
                throw new Error((e && e.toString()) || 'Unknown error');
            }
        });
    }
    /**
     * EIP-712 Sign Typed Data
     */
    signTypedData(address, data, { version }) {
        return __awaiter(this, void 0, void 0, function* () {
            const dataWithHashes = (0, connect_plugin_ethereum_1.default)(data, version === 'V4');
            // set default values for signTypedData
            // Trezor is stricter than @metamask/eth-sig-util in what it accepts
            const _a = dataWithHashes.types, _b = _a === void 0 ? {} : _a, { EIP712Domain = [] } = _b, otherTypes = __rest(_b, ["EIP712Domain"]), { message = {}, domain = {}, primaryType, 
            // snake_case since Trezor uses Protobuf naming conventions here
            domain_separator_hash, // eslint-disable-line camelcase
            message_hash } = dataWithHashes;
            // This is necessary to avoid popup collision
            // between the unlock & sign trezor popups
            const response = yield this.bridge.ethereumSignTypedData({
                path: yield this.getHdPath(address),
                data: {
                    types: Object.assign({ EIP712Domain }, otherTypes),
                    message,
                    domain,
                    primaryType,
                },
                metamask_v4_compat: true,
                // Trezor 1 only supports blindly signing hashes
                domain_separator_hash,
                message_hash,
            });
            if (response.success) {
                if ((0, util_1.toChecksumAddress)(address) !== response.payload.address) {
                    throw new Error('signature doesnt match the right address');
                }
                return response.payload.signature;
            }
            throw new Error((response.payload && response.payload.error) || 'Unknown error');
        });
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
            throw new Error(`The setHdPath method does not support setting HD Path to ${hdPath}`);
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
        return (0, util_1.bufferToHex)(buf);
    }
    // eslint-disable-next-line no-shadow
    _addressFromIndex(pathBase, i) {
        let dkey;
        if (this.hdPath === HD_PATH_BASE.LedgerLive) {
            const path = this._getPathForIndex(i);
            dkey = this.hdkMap.get(path);
        }
        else {
            const hdk = this.hdkMap.get(this.hdPath);
            dkey = hdk.derive(`${pathBase}/${i}`);
        }
        const address = (0, util_1.publicToAddress)(dkey.publicKey, true).toString('hex');
        return (0, util_1.toChecksumAddress)(`0x${address}`);
    }
    indexFromAddress(address) {
        var _a;
        const checksummedAddress = (0, util_1.toChecksumAddress)(address);
        let index = this.paths[checksummedAddress] ||
            ((_a = this.accountDetails[checksummedAddress]) === null || _a === void 0 ? void 0 : _a.index);
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
    getCurrentAccounts() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.unlock(0, 51);
            const addresses = yield this.getAccounts();
            const currentPublicKey = this.getPathBasePublicKey();
            const accounts = [];
            for (let i = 0; i < addresses.length; i++) {
                const address = addresses[i];
                yield this._fixAccountDetail(address);
                const detail = this.accountDetails[(0, util_1.toChecksumAddress)(address)];
                if ((detail === null || detail === void 0 ? void 0 : detail.hdPathBasePublicKey) === currentPublicKey) {
                    try {
                        const account = {
                            address,
                            index: this.indexFromAddress(address) + 1,
                        };
                        accounts.push(account);
                    }
                    catch (e) {
                        console.log('address not found', address);
                    }
                    continue;
                }
                // Live and BIP44 first account is the same
                // we need to check the first account when the path type is LedgerLive or BIP44
                const hdPathType = this.getCurrentUsedHDPathType();
                if (hdPathType !== LedgerHDPathType.Legacy &&
                    (detail.hdPathType === LedgerHDPathType.LedgerLive ||
                        detail.hdPathType === LedgerHDPathType.BIP44)) {
                    const info = this.getAccountInfo(address);
                    if ((info === null || info === void 0 ? void 0 : info.index) === 1) {
                        const firstAddress = this._addressFromIndex(pathBase, 0);
                        if (isSameAddress(firstAddress, address)) {
                            accounts.push(info);
                        }
                    }
                }
            }
            return accounts;
        });
    }
    getPathBasePublicKey() {
        let hdk;
        if (this.hdPath === HD_PATH_BASE.LedgerLive) {
            const path = this._getPathForIndex(0);
            hdk = this.hdkMap.get(path);
        }
        else {
            hdk = this.hdkMap.get(this.hdPath);
        }
        return hdk.publicKey.toString('hex');
    }
    _fixAccountDetail(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const checksummedAddress = (0, util_1.toChecksumAddress)(address);
            const detail = this.accountDetails[checksummedAddress];
            // The detail is already fixed
            if ((detail === null || detail === void 0 ? void 0 : detail.hdPathBasePublicKey) && detail.hdPath) {
                return;
            }
            let addressInDevice;
            let index;
            try {
                index = this.indexFromAddress(address);
                addressInDevice = this._addressFromIndex(pathBase, index);
            }
            catch (e) {
                console.log('address not found', address);
            }
            if (!addressInDevice || !isSameAddress(address, addressInDevice)) {
                return;
            }
            this.accountDetails[checksummedAddress] = Object.assign(Object.assign({}, detail), { index, hdPath: this._getPathForIndex(index), hdPathType: LedgerHDPathType.BIP44, hdPathBasePublicKey: this.getPathBasePublicKey() });
        });
    }
    getHDPathBase(hdPathType) {
        return HD_PATH_BASE[hdPathType];
    }
    setHDPathType(hdPathType) {
        return __awaiter(this, void 0, void 0, function* () {
            const hdPath = this.getHDPathBase(hdPathType);
            this.setHdPath(hdPath);
        });
    }
    getCurrentUsedHDPathType() {
        return HD_PATH_TYPE[this.hdPath];
    }
    getAccountInfo(address) {
        const detail = this.accountDetails[(0, util_1.toChecksumAddress)(address)];
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
    getHdPath(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const detail = this.accountDetails[(0, util_1.toChecksumAddress)(address)];
            if (detail) {
                return detail.hdPath;
            }
            const path = this._getPathForIndex(this.paths[address]);
            if (path) {
                return path;
            }
            // old accounts not stored in paths and only support bip44
            this.setHdPath(HD_PATH_BASE.BIP44);
            yield this.unlock();
            return `${this.hdPath}/${this.indexFromAddress(address)}`;
        });
    }
}
TrezorKeyring.type = keyringType;
exports.default = TrezorKeyring;
