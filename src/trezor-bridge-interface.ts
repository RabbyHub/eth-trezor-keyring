import type { TrezorConnect } from '@trezor/connect-web';
import EventEmitter from 'events';

export interface TrezorBridgeInterface {
  event: EventEmitter;
  model: string;
  isDeviceConnected: boolean;
  connectDevices: Set<string>;
  init: TrezorConnect['init'];
  dispose: () => Promise<void>;
  getPublicKey: TrezorConnect['getPublicKey'];
  ethereumSignTransaction: TrezorConnect['ethereumSignTransaction'];
  ethereumSignMessage: TrezorConnect['ethereumSignMessage'];
  ethereumSignTypedData: TrezorConnect['ethereumSignTypedData'];
}
