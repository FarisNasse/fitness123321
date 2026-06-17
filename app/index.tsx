import { Redirect } from 'expo-router';

import { AuthLoadingState, routeForAuthStatus, useAuthSession } from '@/src/features/auth/auth-session-context';

export default function IndexScreen() {
  const { status } = useAuthSession();
  const route = routeForAuthStatus(status);

  if (!route) {
    return <AuthLoadingState />;
  }

  return <Redirect href={route} />;
}
