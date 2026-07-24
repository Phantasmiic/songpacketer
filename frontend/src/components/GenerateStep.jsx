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
  requireOnePagePerSong,
  setRequireOnePagePerSong,
  showPageNumbers = true,
  setShowPageNumbers,
  startingPageNumber = 1,
  setStartingPageNumber,
  pageNumberPrefix = 'S',
  setPageNumberPrefix,
  pdfFontSize = 11,
  setPdfFontSize,
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
  onGoBack,
}) {
  const [draggedCardId, setDraggedCardId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: manualOrderCards.length > 0 ? '45% 55%' : '1fr' }, gap: 2 }}>
      <Paper elevation={2} sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          <Typography variant="h6">Packet Layout & PDF Settings</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure layout preferences, page boundaries, and song ordering.
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}

          <Stack spacing={1.5}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary' }}>PDF SETTINGS</Typography>
            <Box sx={{ pb: 1 }}>
              <TextField
                label="Lyric Font Size (pt)"
                type="number"
                size="small"
                value={pdfFontSize}
                onChange={(e) => setPdfFontSize(Math.max(6, Math.min(24, parseFloat(e.target.value) || 11)))}
                slotProps={{ htmlInput: { min: 6, max: 24, step: 0.5 } }}
                sx={{ maxWidth: 180 }}
              />
            </Box>
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showPageNumbers}
                    onChange={(event) => setShowPageNumbers(event.target.checked)}
                  />
                }
                label="Show page numbers"
              />
              {showPageNumbers && (
                <Stack direction="row" spacing={2} sx={{ pl: 4, pt: 0.5 }}>
                  <TextField
                    label="Prefix (e.g. S, Songs, Page)"
                    size="small"
                    value={pageNumberPrefix}
                    onChange={(e) => setPageNumberPrefix(e.target.value)}
                    sx={{ maxWidth: 180 }}
                  />
                  <TextField
                    label="Starting Page Number"
                    type="number"
                    size="small"
                    value={startingPageNumber}
                    onChange={(e) => setStartingPageNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    slotProps={{ htmlInput: { min: 1 } }}
                    sx={{ maxWidth: 180 }}
                  />
                </Stack>
              )}
            </Stack>
            <FormControlLabel
              control={
                <Checkbox
                  checked={requireOnePagePerSong}
                  onChange={(event) => setRequireOnePagePerSong(event.target.checked)}
                />
              }
              label="Require each song to fit entirely on one page"
            />
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

      {onGoBack && (
        <Paper elevation={1} sx={{ p: 2, gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-start', borderRadius: 2 }}>
          <Button variant="outlined" onClick={onGoBack} sx={{ textTransform: 'none', fontWeight: 600 }}>
            ← Back to Refine
          </Button>
        </Paper>
      )}
    </Box>
  );
}

export default GenerateStep;
