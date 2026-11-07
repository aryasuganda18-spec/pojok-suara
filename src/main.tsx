import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import { SiteProvider, ThemeProvider, ToastProvider } from './hooks/contexts';
import './styles/index.css';

// Data router dipakai agar editor dapat memperingatkan pengguna sebelum meninggalkan halaman (useBlocker).
const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <ThemeProvider>
        <ToastProvider>
          <SiteProvider>
            <App />
          </SiteProvider>
        </ToastProvider>
      </ThemeProvider>
    ),
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
