import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import { App } from './App';
import { startOffline } from './core/offline/index';

startOffline();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
