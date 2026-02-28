import {
  Alert,
  Button,
  Chip,
  Checkbox,
  FormControlLabel,
  Paper,
  Stack,
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
}) {
  const [draggedCardId, setDraggedCardId] = useState('');

  return (
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
  );
}

export default GenerateStep;
