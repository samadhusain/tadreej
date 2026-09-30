import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import TadreejPlayer from './tadreej/TadreejPlayer';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TadreejPlayer />
  </StrictMode>,
);
