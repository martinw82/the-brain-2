/**
 * UserContext — Centralized user state management
 *
 * Provides: user, userSettings, setUserSettings, currentMode
 * Eliminates prop drilling for user-related state throughout the app.
 */

import { createContext, useContext, useState, useMemo } from 'react';
import { getMode } from '../modeHelper.js';

const UserContext = createContext(null);

export function UserProvider({ children, user }) {
  const [userSettings, setUserSettings] = useState({
    font: 'JetBrains Mono',
    fontSize: 11,
    assistance_mode: 'coach',
  });

  // Derive current mode from settings
  const currentMode = useMemo(() => getMode(userSettings), [userSettings]);

  const value = useMemo(
    () => ({
      user,
      userSettings,
      setUserSettings,
      currentMode,
    }),
    [user, userSettings, currentMode]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/**
 * Hook to access user context
 * @throws {Error} If used outside of UserProvider
 */
export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

export default UserContext;
