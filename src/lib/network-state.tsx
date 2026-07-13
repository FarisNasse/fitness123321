import NetInfo, { type NetInfoStateType } from '@react-native-community/netinfo';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

export type NetworkStatus = 'unknown' | 'online' | 'offline';

export type NetworkStateValue = {
  status: NetworkStatus;
  isOnline: boolean;
  connectionType: NetInfoStateType | 'unknown';
};

const NetworkStateContext = createContext<NetworkStateValue | null>(null);

export function NetworkStateProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<NetworkStatus>('unknown');
  const [connectionType, setConnectionType] = useState<NetInfoStateType | 'unknown'>(
    'unknown'
  );

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setConnectionType(state.type);

      const isOffline =
        state.isConnected === false || state.isInternetReachable === false;
      const isOnline =
        state.isConnected === true && state.isInternetReachable !== false;

      setStatus(isOffline ? 'offline' : isOnline ? 'online' : 'unknown');
    });
  }, []);

  const value = useMemo(
    () => ({
      status,
      isOnline: status === 'online',
      connectionType,
    }),
    [connectionType, status]
  );

  return (
    <NetworkStateContext.Provider value={value}>
      {children}
    </NetworkStateContext.Provider>
  );
}

export function useNetworkState() {
  const value = useContext(NetworkStateContext);

  if (!value) {
    throw new Error('useNetworkState must be used inside NetworkStateProvider.');
  }

  return value;
}
