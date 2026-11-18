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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const connect_web_1 = __importDefault(require("@trezor/connect-web"));
// Connect 10 is a thin client: the core, device selection and its events live
// in Trezor Suite, so there is no DEVICE_EVENT to track the model or connected
// devices from here.
class TrezorBridge {
    constructor() {
        this.isDeviceConnected = false;
        this.model = '';
        this.connectDevices = new Set();
        this.event = new events_1.default();
        this.init = (config) => __awaiter(this, void 0, void 0, function* () {
            if (!this.initialization) {
                const attempt = connect_web_1.default.init(config);
                this.initialization = attempt;
                attempt.catch(() => {
                    if (this.initialization === attempt) {
                        this.initialization = undefined;
                        this.isDeviceConnected = false;
                    }
                });
            }
            yield this.initialization;
            this.isDeviceConnected = true;
        });
        this.dispose = () => __awaiter(this, void 0, void 0, function* () {
            this.initialization = undefined;
            this.isDeviceConnected = false;
            yield connect_web_1.default.dispose();
        });
        // factoryPublic installs these as arrow functions on the instance, so they
        // stay bound when copied off it.
        this.ethereumGetPublicKey = connect_web_1.default.ethereumGetPublicKey;
        this.ethereumSignTransaction = connect_web_1.default.ethereumSignTransaction;
        this.ethereumSignMessage = connect_web_1.default.ethereumSignMessage;
        this.ethereumSignTypedData = connect_web_1.default.ethereumSignTypedData;
    }
}
exports.default = TrezorBridge;
