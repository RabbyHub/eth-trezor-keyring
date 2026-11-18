import EventEmitter from 'events';
import { TrezorBridgeInterface } from './trezor-bridge-interface';
import TrezorConnect from '@trezor/connect-web';

// Connect 10 is a thin client: the core, device selection and its events live
// in Trezor Suite, so there is no DEVICE_EVENT to track the model or connected
// devices from here.
export default class TrezorBridge implements TrezorBridgeInterface {
  isDeviceConnected = false;
  model = '';
  connectDevices = new Set<string>();
  event = new EventEmitter();

  private initialization?: Promise<void>;

  init: TrezorBridgeInterface['init'] = async (config) => {
    if (!this.initialization) {
      const attempt = TrezorConnect.init(config);
      this.initialization = attempt;
      attempt.catch(() => {
        if (this.initialization === attempt) {
          this.initialization = undefined;
          this.isDeviceConnected = false;
        }
      });
    }
    await this.initialization;
    this.isDeviceConnected = true;
  };

  dispose = async () => {
    this.initialization = undefined;
    this.isDeviceConnected = false;
    await TrezorConnect.dispose();
  };

  // factoryPublic installs these as arrow functions on the instance, so they
  // stay bound when copied off it.
  ethereumGetPublicKey = TrezorConnect.ethereumGetPublicKey;

  ethereumSignTransaction = TrezorConnect.ethereumSignTransaction;

  ethereumSignMessage = TrezorConnect.ethereumSignMessage;

  ethereumSignTypedData = TrezorConnect.ethereumSignTypedData;
}
