import EventEmitter from 'events';
import { TrezorBridgeInterface } from './trezor-bridge-interface';
import TrezorConnect from '@trezor/connect-web';

export default class TrezorBridge implements TrezorBridgeInterface {
  isDeviceConnected = false;
  model = '';
  connectDevices = new Set<string>();
  event = new EventEmitter();

  init: TrezorBridgeInterface['init'] = async (config) => {
    TrezorConnect.on('DEVICE_EVENT', (event: any) => {
      if (event && event.payload && event.payload.features) {
        this.model = event.payload.features.model;
      }
      const currentDeviceId = event.payload?.id;
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
      TrezorConnect.init(config);
      this.isDeviceConnected = true;
    }
  };

  dispose = TrezorConnect.dispose;

  getPublicKey = TrezorConnect.getPublicKey;

  ethereumSignTransaction = TrezorConnect.ethereumSignTransaction;

  ethereumSignMessage = TrezorConnect.ethereumSignMessage;

  ethereumSignTypedData = TrezorConnect.ethereumSignTypedData;
}
