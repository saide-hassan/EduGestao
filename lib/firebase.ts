import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
export const db = getFirestore(app, dbId);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Error signing in with Google", error);
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};
