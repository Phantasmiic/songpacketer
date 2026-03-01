import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';

function GenerateStep({
  maintainOriginalOrder,
  setMaintainOriginalOrder,
  error,
  manualOrderCards,
  onMoveManualCard,
  onToggleForceNewPage,
  onRegenerateFromManualOrder,
  loading,
  packetStats,
  packetVersions,
  activePacketVersionNumber,
  onActivateVersion,
  onGenerateFromVersion,
  packetHistory,
}) {
  const [draggedCardId, setDraggedCardId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '55% 45%' }, gap: 2 }}>
      <Paper elevation={2} sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Generate Packet</Typography>
          <Typography variant="body2" color="text.secondary">
            Generate the final packet PDF with your current tune/capo selections.
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}

          <FormControlLabel
            control={
              <Checkbox
                checked={maintainOriginalOrder}
                onChange={(event) => setMaintainOriginalOrder(event.target.checked)}
              />
            }
            label="Maintain original order"
          />

          {packetStats && (
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip label={`Pages: ${packetStats.pages}`} color="primary" />
              <Chip label={`Song spills: ${packetStats.songSpills}`} color="secondary" />
            </Stack>
          )}

          {manualOrderCards.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1">Manual Song Order</Typography>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={onRegenerateFromManualOrder}
                    disabled={loading}
                  >
                    Re-generate PDF
                  </Button>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Drag cards to reorder songs. Toggle force new page per song.
                </Typography>

                {manualOrderCards.map((card, index) => (
                  <Paper
                    key={card.id}
                    variant="outlined"
                    draggable
                    onDragStart={() => setDraggedCardId(card.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      onMoveManualCard(draggedCardId, card.id);
                      setDraggedCardId('');
                    }}
                    onDragEnd={() => setDraggedCardId('')}
                    sx={{ p: 1.25, cursor: 'grab' }}
                  >
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {index + 1}. {card.title}
                        </Typography>
                        <Chip size="small" label={`Original ${card.originalOrder}`} />
                      </Stack>
                      <Button
                        size="small"
                        variant={card.forceNewPage ? 'contained' : 'outlined'}
                        onClick={() => onToggleForceNewPage(card.id)}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        Force new page
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>
      </Paper>

      <Paper elevation={2} sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle1">Packet Versions</Typography>
          <TextField
            select
            label="Switch editing version"
            value={selectedVersionId}
            onChange={(event) => setSelectedVersionId(Number(event.target.value))}
            disabled={!packetVersions.length}
          >
            {packetVersions.map((version) => (
              <MenuItem key={version.id} value={version.id}>
                v{version.version_number} {version.description ? `- ${version.description}` : ''}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              onClick={() => selectedVersionId && onActivateVersion(selectedVersionId)}
              disabled={loading || !selectedVersionId}
            >
              Edit Selected Version
            </Button>
            <Button
              variant="outlined"
              onClick={() => selectedVersionId && onGenerateFromVersion(selectedVersionId)}
              disabled={loading || !selectedVersionId}
            >
              Generate Selected PDF
            </Button>
          </Stack>

          {activePacketVersionNumber ? (
            <Chip label={`Editing version: v${activePacketVersionNumber}`} color="info" />
          ) : null}

          <Typography variant="subtitle2">Edit History</Typography>
          <Box sx={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}>
            {packetHistory.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                No edit events yet.
              </Typography>
            )}
            {packetHistory.map((event) => (
              <Box key={event.id} sx={{ p: 1, borderBottom: '1px solid #f0f0f0' }}>
                <Typography variant="caption" color="text.secondary">
                  {new Date(event.created_at).toLocaleString()}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {event.summary || event.event_type}
                </Typography>
              </Box>
            ))}
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}

export default GenerateStep;
