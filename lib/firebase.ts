import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

import aiStudioConfig from '../firebase-applet-config.json';

// Lê as variáveis de ambiente (se existirem, como no Netlify)
const envConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY,
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID,
};

// Se a apiKey existir nas variáveis de ambiente, usa a configuração manual.
// Caso contrário, usa a configuração automática do AI Studio (para o preview continuar a funcionar aqui).
const isManualSetup = !!envConfig.apiKey;
const firebaseConfig = isManualSetup ? envConfig : aiStudioConfig;

const app = initializeApp(firebaseConfig);

// O AI Studio usa um ID de base de dados específico. Projetos manuais geralmente usam o default (undefined).
const dbId = isManualSetup ? undefined : (aiStudioConfig as any).firestoreDatabaseId;
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true
}, dbId);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

// Cache the access token in localStorage with expiration to handle page refreshes
export const setCachedAccessToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('google_drive_token', token);
    // Google OAuth access tokens typically expire in 3600 seconds (1 hour). 
    // We set a conservative expiration of 50 minutes (3,000,000 ms) in the cache.
    const expiresAt = Date.now() + 50 * 60 * 1000;
    localStorage.setItem('google_drive_token_expires', expiresAt.toString());
  } else {
    localStorage.removeItem('google_drive_token');
    localStorage.removeItem('google_drive_token_expires');
  }
};

export const getCachedAccessToken = () => {
  const token = localStorage.getItem('google_drive_token');
  const expiresStr = localStorage.getItem('google_drive_token_expires');
  if (!token || !expiresStr) return null;
  
  const expiresAt = parseInt(expiresStr, 10);
  if (Date.now() > expiresAt) {
    setCachedAccessToken(null);
    return null;
  }
  return token;
};

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setCachedAccessToken(credential.accessToken);
    }
    return result;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
    setCachedAccessToken(null);
  } catch (error) {
    console.error("Error signing out", error);
  }
};
