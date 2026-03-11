import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: '#1a2d1a',
          color: '#e8f5e1',
          border: '1px solid #2a3d2a',
          borderRadius: '10px',
          fontSize: '13px',
          fontFamily: 'DM Sans, sans-serif',
        },
        success: {
          iconTheme: { primary: '#74c69d', secondary: '#1a2d1a' },
        },
        error: {
          iconTheme: { primary: '#f87171', secondary: '#1a2d1a' },
          duration: 5000,
        },
      }}
    />
  </StrictMode>
);
