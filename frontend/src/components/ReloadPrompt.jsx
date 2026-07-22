import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Box, Button, Typography, Paper } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';

export default function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Register logic if needed
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <Paper 
      elevation={6}
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        p: 2,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        borderRadius: 2,
        maxWidth: 320
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SyncIcon fontSize="small" />
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {offlineReady 
            ? 'App ready to work offline' 
            : 'New content available, click on reload button to update.'}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button 
          size="small" 
          variant="outlined" 
          color="inherit" 
          onClick={close}
          sx={{ borderColor: 'rgba(255,255,255,0.5)' }}
        >
          Close
        </Button>
        {needRefresh && (
          <Button 
            size="small" 
            variant="contained" 
            color="secondary" 
            onClick={() => updateServiceWorker(true)}
          >
            Reload
          </Button>
        )}
      </Box>
    </Paper>
  );
}
