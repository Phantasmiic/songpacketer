import { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  Grid,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Divider,
} from '@mui/material';

import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';

function InputStep({
  packetTitle,
  setPacketTitle,
  inputText,
  setInputText,
  existingPackets,
  onOpenExisting,
  onCreateAndMatch,
  onImportPacket,
  loading,
}) {
  const [activeView, setActiveView] = useState('menu'); // 'menu' | 'create' | 'open'
  const [searchQuery, setSearchQuery] = useState('');

  const handleFileChange = (e) => {
    onImportPacket(e);
  };

  const filteredPackets = existingPackets.filter((packet) =>
    packet.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return isoString;
    }
  };

  if (activeView === 'create') {
    return (
      <Paper elevation={2} sx={{ p: 4, maxWidth: 800, mx: 'auto', borderRadius: 3 }}>
        <Stack spacing={3}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              variant="text"
              startIcon={<ArrowBackIcon />}
              onClick={() => setActiveView('menu')}
              sx={{ textTransform: 'none' }}
            >
              Back to Menu
            </Button>
          </Stack>
          
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              Create New Song Packet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enter a title and paste your song list (one song title or lyric line per row).
            </Typography>
          </Box>

          <TextField
            label="Packet Title"
            value={packetTitle}
            onChange={(event) => setPacketTitle(event.target.value)}
            required
            fullWidth
            placeholder="e.g. Sunday Morning Worship"
          />

          <TextField
            multiline
            minRows={10}
            maxRows={15}
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            placeholder="Lord Jesus you are Lovely&#10;Be thou my vision&#10;In Christ Alone"
            fullWidth
            required
          />

          <Button
            variant="contained"
            size="large"
            onClick={onCreateAndMatch}
            disabled={loading || !packetTitle.trim() || !inputText.trim()}
            sx={{ alignSelf: 'flex-start', textTransform: 'none', px: 4 }}
          >
            Create Packet & Match Songs
          </Button>
        </Stack>
      </Paper>
    );
  }

  if (activeView === 'open') {
    return (
      <Paper elevation={2} sx={{ p: 4, maxWidth: 800, mx: 'auto', borderRadius: 3 }}>
        <Stack spacing={3}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              variant="text"
              startIcon={<ArrowBackIcon />}
              onClick={() => setActiveView('menu')}
              sx={{ textTransform: 'none' }}
            >
              Back to Menu
            </Button>
          </Stack>

          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
              Open Saved Packet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Select one of your cached song packets below to load the workspace.
            </Typography>
          </Box>

          <TextField
            placeholder="Search saved packets..."
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />

          <Paper variant="outlined" sx={{ borderRadius: 2, maxHeight: 350, overflowY: 'auto' }}>
            <List disablePadding>
              {filteredPackets.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center', fontStyle: 'italic' }}>
                  {existingPackets.length === 0 ? 'No local packets saved yet.' : 'No packets match your search.'}
                </Typography>
              ) : (
                filteredPackets.map((packet, index) => (
                  <Box key={packet.id}>
                    {index > 0 && <Divider />}
                    <ListItemButton onClick={() => onOpenExisting(packet.id)} sx={{ py: 1.5, px: 2.5 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body1" sx={{ fontWeight: 600, color: 'primary.main' }}>
                            {packet.title}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            Versions: {packet.latest_version_number || 1} • Edited: {formatTime(packet.updated_at)}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  </Box>
                ))
              )}
            </List>
          </Paper>
        </Stack>
      </Paper>
    );
  }

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', mt: 1, px: 2 }}>
      <Grid container spacing={3.5} justifyContent="center">
        <Grid item xs={12} sm={4}>
          <Paper
            elevation={2}
            sx={{
              p: 4,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              borderRadius: 3,
              cursor: 'pointer',
              border: '1px solid #e2e8f0',
              transition: 'all 0.25s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 6,
                borderColor: 'primary.main',
              },
            }}
            onClick={() => setActiveView('create')}
          >
            <AddCircleOutlineIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Create New Packet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Paste a custom list of songs and match them against the Songbase index.
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper
            elevation={2}
            sx={{
              p: 4,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              borderRadius: 3,
              cursor: 'pointer',
              border: '1px solid #e2e8f0',
              transition: 'all 0.25s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 6,
                borderColor: 'primary.main',
              },
            }}
            onClick={() => setActiveView('open')}
          >
            <FolderOpenIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Open Saved Packet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Load an existing song packet list saved in your local browser session.
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Paper
            elevation={2}
            sx={{
              p: 4,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              borderRadius: 3,
              cursor: 'pointer',
              border: '1px solid #e2e8f0',
              transition: 'all 0.25s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 6,
                borderColor: 'primary.main',
              },
            }}
            onClick={() => {
              const fileInput = document.getElementById('dashboard-json-uploader');
              if (fileInput) fileInput.click();
            }}
          >
            <CloudUploadIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Import Backup File
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upload a previously exported packet JSON file to restore it.
            </Typography>
            <input
              id="dashboard-json-uploader"
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default InputStep;
