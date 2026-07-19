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
  showSectionHeadersInBody,
  setShowSectionHeadersInBody,
  showSectionHeadersInIndex,
  setShowSectionHeadersInIndex,
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
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: manualOrderCards.length > 0 ? '45% 55%' : '1fr' }, gap: 2 }}>
      <Paper elevation={2} sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          <Typography variant="h6">Generate Packet</Typography>
          <Typography variant="body2" color="text.secondary">
            Generate the final packet PDF with your current tune/capo selections.
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}

          <Stack spacing={1.5}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>PDF SETTINGS</Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={maintainOriginalOrder}
                  onChange={(event) => setMaintainOriginalOrder(event.target.checked)}
                />
              }
              label="Maintain original order"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showSectionHeadersInIndex}
                  onChange={(event) => setShowSectionHeadersInIndex(event.target.checked)}
                />
              }
              label="Show section headers in index"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showSectionHeadersInBody}
                  onChange={(event) => setShowSectionHeadersInBody(event.target.checked)}
                />
              }
              label="Show section headers in PDF body"
            />
          </Stack>

          {packetStats && (
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>STATS</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Chip label={`Pages: ${packetStats.pages}`} color="primary" />
                <Chip label={`Song spills: ${packetStats.songSpills}`} color="secondary" />
              </Stack>
            </Stack>
          )}
        </Stack>
      </Paper>

      {manualOrderCards.length > 0 && (
        <Paper elevation={2} sx={{ p: 3 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Manual Song Order</Typography>
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

            <Box sx={{ maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.25, pr: 0.5 }}>
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
                  sx={{ p: 1.5, cursor: 'grab', bgcolor: '#fff', '&:hover': { bgcolor: '#fafafa' } }}
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
                      sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
                    >
                      Force new page
                    </Button>
                  </Stack>
                </Paper>
              ))}
            </Box>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}

export default GenerateStep;
