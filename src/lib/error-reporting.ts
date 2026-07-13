import * as Sentry from '@sentry/react-native';

import {
  APP_DISTRIBUTION,
  APP_ENVIRONMENT,
  APP_RELEASE,
  RUNTIME_METADATA,
} from '@/src/lib/runtime-metadata';

export type ErrorReportContext = {
  source: string;
  operation?: string;
  domain?: string;
  tags?: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, unknown>;
};

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
let initialized = false;

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  try {
    return new Error(`Non-Error thrown: ${JSON.stringify(error)}`);
  } catch {
    return new Error('Non-Error value was thrown.');
  }
}

function cleanTags(tags: ErrorReportContext['tags']) {
  return Object.fromEntries(
    Object.entries(tags ?? {}).filter((entry): entry is [string, string | number | boolean] => {
      const value = entry[1];
      return value !== null && value !== undefined;
    })
  );
}

export function initializeErrorReporting() {
  if (initialized) return;
  initialized = true;

  Sentry.init({
    dsn: sentryDsn,
    enabled: Boolean(sentryDsn) && !__DEV__,
    environment: APP_ENVIRONMENT,
    release: APP_RELEASE,
    dist: APP_DISTRIBUTION,
    sendDefaultPii: false,
    attachStacktrace: true,
    enableNative: true,
    tracesSampleRate: 0,
  });
}

export function reportError(error: unknown, context: ErrorReportContext) {
  initializeErrorReporting();

  const normalized = normalizeError(error);
  const structuredContext = {
    ...RUNTIME_METADATA,
    source: context.source,
    operation: context.operation,
    domain: context.domain,
    ...context.extra,
  };

  console.error('[runtime-error]', {
    message: normalized.message,
    stack: normalized.stack,
    tags: cleanTags(context.tags),
    context: structuredContext,
  });

  Sentry.withScope((scope) => {
    scope.setTag('source', context.source);
    scope.setTag('app_environment', APP_ENVIRONMENT);
    scope.setTag('app_release', APP_RELEASE);
    scope.setTag('app_distribution', APP_DISTRIBUTION);

    if (context.operation) scope.setTag('operation', context.operation);
    if (context.domain) scope.setTag('domain', context.domain);

    for (const [key, value] of Object.entries(cleanTags(context.tags))) {
      scope.setTag(key, value);
    }

    scope.setContext('runtime', structuredContext);
    Sentry.captureException(normalized);
  });
}


export function reportProviderError(
  error: unknown,
  context: ErrorReportContext,
  options?: {
    offline?: boolean;
    offlineMessage?: string;
    fallback?: string;
  }
) {
  reportError(error, context);
  return getUserSafeProviderMessage(options);
}

export function reportConfigurationIssue(message: string, source: string) {
  reportError(new Error(message), {
    source,
    operation: 'configuration',
    tags: { configuration_issue: true },
  });
}

export function getUserSafeProviderMessage(options?: {
  offline?: boolean;
  offlineMessage?: string;
  fallback?: string;
}) {
  if (options?.offline) {
    return options.offlineMessage ?? 'You appear to be offline. Your on-device data is still available.';
  }

  return options?.fallback ?? 'Something went wrong. Please try again.';
}

initializeErrorReporting();
