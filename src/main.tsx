import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'sonner';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="edugestao-theme">
      <App />
      <Toaster position="top-center" richColors duration={1800} />
    </ThemeProvider>
  </StrictMode>,
);
