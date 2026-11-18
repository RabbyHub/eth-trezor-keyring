import type {
  ConnectDynamicSettings,
  TrezorConnectPublicAPI,
} from '@trezor/connect-web';
import EventEmitter from 'events';

type TrezorConnect = TrezorConnectPublicAPI<ConnectDynamicSettings>;

export interface TrezorBridgeInterface {
  event: EventEmitter;
  model: string;
  isDeviceConnected: boolean;
  connectDevices: Set<string>;
  init: TrezorConnect['init'];
  dispose: () => Promise<void>;
  ethereumGetPublicKey: TrezorConnect['ethereumGetPublicKey'];
  ethereumSignTransaction: TrezorConnect['ethereumSignTransaction'];
  ethereumSignMessage: TrezorConnect['ethereumSignMessage'];
  ethereumSignTypedData: TrezorConnect['ethereumSignTypedData'];
}
