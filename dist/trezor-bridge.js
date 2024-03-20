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
class TrezorBridge {
    constructor() {
        this.isDeviceConnected = false;
        this.model = '';
        this.connectDevices = new Set();
        this.event = new events_1.default();
        this.init = (config) => __awaiter(this, void 0, void 0, function* () {
            connect_web_1.default.on('DEVICE_EVENT', (event) => {
                var _a;
                if (event && event.payload && event.payload.features) {
                    this.model = event.payload.features.model;
                }
                const currentDeviceId = (_a = event.payload) === null || _a === void 0 ? void 0 : _a.id;
                if (event.type === 'device-connect') {
                    this.connectDevices.add(currentDeviceId);
                    this.event.emit('cleanUp', true);
                }
                if (event.type === 'device-disconnect') {
                    this.connectDevices.delete(currentDeviceId);
                    this.event.emit('cleanUp', true);
                }
            });
            if (!this.isDeviceConnected) {
                connect_web_1.default.init(config);
                this.isDeviceConnected = true;
            }
        });
        this.dispose = connect_web_1.default.dispose;
        this.getPublicKey = connect_web_1.default.getPublicKey;
        this.ethereumSignTransaction = connect_web_1.default.ethereumSignTransaction;
        this.ethereumSignMessage = connect_web_1.default.ethereumSignMessage;
        this.ethereumSignTypedData = connect_web_1.default.ethereumSignTypedData;
    }
}
exports.default = TrezorBridge;
