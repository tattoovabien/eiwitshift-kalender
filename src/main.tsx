import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { StoreProvider } from './store';
import { LiveStoreProvider } from './liveStore';
import { ToastProvider } from './components/ui';

// __LIVE__ is a build-time constant, so the prototype build does not include the Supabase code.
const Provider = __LIVE__ ? LiveStoreProvider : StoreProvider;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <Provider>
        <App />
      </Provider>
    </ToastProvider>
  </StrictMode>,
);
