// Context
export { AuthProvider, useAuth } from './context/AuthContext';

// Screens
export { default as LoginScreen } from './screens/LoginScreen';
export { default as RegisterScreen } from './screens/RegisterScreen';

// Services (exporta tudo exceto UserRole para evitar conflito com roles.ts)
export {
  signIn,
  register,
  signOutUser,
  getCurrentUser,
  subscribeAuth,
} from './services/auth.service';
export type { RegisterInput, AuthResult, UserRole } from './services/auth.service';

// State
export { useMeStore, type MeDoc } from './state/me.store';

// Utils
export { isOwner, isCustomer } from './utils/roles';
