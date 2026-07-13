import { reloadAppAsync } from 'expo';
import type { ErrorInfo, PropsWithChildren } from 'react';
import { Component } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  Text,
  View,
} from 'react-native';

import { reportError } from '@/src/lib/error-reporting';

// React Native's Metro bundler resolves static assets through require().
// eslint-disable-next-line @typescript-eslint/no-require-imports
const brandIcon = require('../../assets/icon.png');

type AppErrorBoundaryState = {
  error: Error | null;
  isRestarting: boolean;
};

export class AppErrorBoundary extends Component<
  PropsWithChildren,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null,
    isRestarting: false,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error, isRestarting: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, {
      source: 'root-error-boundary',
      operation: 'render',
      extra: {
        componentStack: info.componentStack,
      },
    });
  }

  private restartApp = async () => {
    this.setState({ isRestarting: true });

    try {
      await reloadAppAsync('root-error-boundary-recovery');
    } catch (error) {
      reportError(error, {
        source: 'root-error-boundary',
        operation: 'reload-app',
      });

      // Web and unusual development runtimes can reject a native reload. Resetting
      // the boundary still gives the user a recovery path without a blank screen.
      this.setState({ error: null, isRestarting: false });
    }
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0d1117' }}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            paddingHorizontal: 28,
            gap: 22,
          }}
        >
          <Image
            source={brandIcon}
            accessibilityIgnoresInvertColors
            style={{ width: 72, height: 72, borderRadius: 18 }}
          />

          <View style={{ gap: 10 }}>
            <Text
              style={{
                color: '#a3e635',
                fontSize: 13,
                fontWeight: '800',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}
            >
              All-in-one fitness
            </Text>
            <Text
              accessibilityRole="header"
              style={{ color: '#e6edf3', fontSize: 32, fontWeight: '900' }}
            >
              Let’s get you back in
            </Text>
            <Text style={{ color: '#8b949e', fontSize: 16, lineHeight: 24 }}>
              The app hit an unexpected problem. Your saved on-device records are
              still available. Restart the app to recover.
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={this.state.isRestarting}
            onPress={this.restartApp}
            style={({ pressed }) => ({
              minHeight: 52,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#a3e635',
              opacity: this.state.isRestarting ? 0.55 : pressed ? 0.78 : 1,
            })}
          >
            {this.state.isRestarting ? (
              <ActivityIndicator color="#1a2e05" />
            ) : (
              <Text style={{ color: '#1a2e05', fontSize: 16, fontWeight: '900' }}>
                Restart app
              </Text>
            )}
          </Pressable>

          <Text style={{ color: '#6e7681', fontSize: 12, lineHeight: 18 }}>
            Diagnostic details were recorded without displaying provider or
            configuration data on this screen.
          </Text>
        </View>
      </SafeAreaView>
    );
  }
}
