import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import App from './App';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0d47a1',
    },
    secondary: {
      main: '#ef6c00',
    },
    background: {
      default: '#f5f7fb',
      paper: '#ffffff',
    },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
