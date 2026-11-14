import { jest } from '@jest/globals';

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }: { name: string }) => React.createElement(Text, { accessibilityLabel: `ícone ${name}` }, '');
  return { Ionicons: Icon, MaterialCommunityIcons: Icon, FontAwesome: Icon };
});

jest.mock('react-native-ble-plx', () => ({
  BleManager: class {
    onStateChange(callback: (state: string) => void, emitCurrentState: boolean) {
      if (emitCurrentState) callback('PoweredOn');
      return { remove() {} };
    }
    async connectedDevices() { return []; }
    destroy() {}
  },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
