/// <reference types="node" />
import EventEmitter from 'events';
import { TrezorBridgeInterface } from './trezor-bridge-interface';
export default class TrezorBridge implements TrezorBridgeInterface {
    isDeviceConnected: boolean;
    model: string;
    connectDevices: Set<string>;
    event: EventEmitter;
    init: TrezorBridgeInterface['init'];
    dispose: typeof import("@trezor/connect/lib/types/api/dispose").dispose;
    getPublicKey: typeof import("@trezor/connect/lib/types/api/getPublicKey").getPublicKey;
    ethereumSignTransaction: typeof import("@trezor/connect/lib/types/api/ethereumSignTransaction").ethereumSignTransaction;
    ethereumSignMessage: typeof import("@trezor/connect/lib/types/api/ethereumSignMessage").ethereumSignMessage;
    ethereumSignTypedData: typeof import("@trezor/connect/lib/types/api/ethereumSignTypedData").ethereumSignTypedData;
}
