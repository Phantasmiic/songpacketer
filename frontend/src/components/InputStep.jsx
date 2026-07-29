import { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';

import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import SlideshowIcon from '@mui/icons-material/Slideshow';

function InputStep({
  packetTitle,
  setPacketTitle,
  inputText,
  setInputText,
  existingPackets,
  onOpenExisting,
  onCreateAndMatch,
  onImportPacket,
  onDeletePacket,
  onPresentSongs,
  loading,
}) {
  const [activeView, setActiveView] = useState('menu'); // 'menu' | 'create' | 'open'
  const [searchQuery, setSearchQuery] = useState('');
  const [packetToDelete, setPacketToDelete] = useState(null);

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
            placeholder="From my spirit within&#10;I come to His presence afresh&#10;Above the waste and emptiness"
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
                    <ListItemButton 
                      onClick={() => onOpenExisting(packet.id)} 
                      sx={{ py: 1.5, px: 2.5 }}
                      secondaryAction={
                        <IconButton 
                          edge="end" 
                          aria-label="delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPacketToDelete(packet);
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={
                          <Typography variant="body1" sx={{ fontWeight: 600, color: 'primary.main', pr: 4 }}>
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

        <Dialog
          open={Boolean(packetToDelete)}
          onClose={() => setPacketToDelete(null)}
        >
          <DialogTitle>Delete Packet?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete the packet "{packetToDelete?.title}"? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPacketToDelete(null)} color="primary">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (packetToDelete) {
                  onDeletePacket(packetToDelete.id);
                  setPacketToDelete(null);
                }
              }} 
              color="error" 
              autoFocus
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', mt: 2, px: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} justifyContent="center">
        <Box sx={{ flex: 1 }}>
          <Paper
            data-testid="create-packet-card"
            elevation={2}
            sx={{
              p: 2.25,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              borderRadius: 2.5,
              cursor: 'pointer',
              border: '1px solid #e2e8f0',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 4,
                borderColor: 'primary.main',
              },
            }}
            onClick={() => { setPacketTitle(''); setInputText(''); setActiveView('create'); }}
          >
            <AddCircleOutlineIcon color="primary" sx={{ fontSize: 32, flexShrink: 0 }} />
            <Box sx={{ textAlign: 'left', minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Create New Packet
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                Match a list of song titles
              </Typography>
            </Box>
          </Paper>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Paper
            elevation={2}
            sx={{
              p: 2.25,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              borderRadius: 2.5,
              cursor: 'pointer',
              border: '1px solid #e2e8f0',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 4,
                borderColor: 'primary.main',
              },
            }}
            onClick={() => setActiveView('open')}
          >
            <FolderOpenIcon color="primary" sx={{ fontSize: 32, flexShrink: 0 }} />
            <Box sx={{ textAlign: 'left', minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Open Saved Packet
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                Load from your local browser
              </Typography>
            </Box>
          </Paper>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Paper
            elevation={2}
            sx={{
              p: 2.25,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              borderRadius: 2.5,
              cursor: 'pointer',
              border: '1px solid #e2e8f0',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 4,
                borderColor: 'primary.main',
              },
            }}
            onClick={() => {
              const fileInput = document.getElementById('dashboard-json-uploader');
              if (fileInput) fileInput.click();
            }}
          >
            <CloudUploadIcon color="primary" sx={{ fontSize: 32, flexShrink: 0 }} />
            <Box sx={{ textAlign: 'left', minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Import Backup File
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                Restore from a JSON file
              </Typography>
            </Box>
            <input
              id="dashboard-json-uploader"
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </Paper>
        </Box>
      </Stack>

      <Divider sx={{ my: 3.5 }} />

      <Box sx={{ maxWidth: 460, mx: 'auto' }}>
        <Paper
          data-testid="present-songs-card"
          component="button"
          elevation={2}
          onClick={onPresentSongs}
          sx={{
            width: '100%',
            p: 2.25,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            borderRadius: 2.5,
            cursor: 'pointer',
            border: '1px solid #e2e8f0',
            background: 'inherit',
            font: 'inherit',
            textAlign: 'left',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: 4,
              borderColor: 'primary.main',
            },
          }}
        >
          <SlideshowIcon color="primary" sx={{ fontSize: 32, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
              Present Songs from Songbase
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              Search & present directly without creating a packet
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

export default InputStep;
