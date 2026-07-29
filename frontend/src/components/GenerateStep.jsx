import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { useEffect, useState } from 'react';

function GenerateStep({
  orderingMode = 'within_sections',
  setOrderingMode,
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
  pdfFontSize = 12,
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

  const [startingPageInput, setStartingPageInput] = useState(String(startingPageNumber ?? 1));

  useEffect(() => {
    setStartingPageInput(String(startingPageNumber ?? 1));
  }, [startingPageNumber]);

  const handleStartingPageChange = (e) => {
    const val = e.target.value;
    setStartingPageInput(val);
    if (val !== '') {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 1) {
        setStartingPageNumber(num);
      }
    }
  };

  const handleStartingPageBlur = () => {
    const num = parseInt(startingPageInput, 10);
    if (isNaN(num) || num < 1) {
      setStartingPageNumber(1);
      setStartingPageInput('1');
    } else {
      setStartingPageNumber(num);
      setStartingPageInput(String(num));
    }
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: manualOrderCards.length > 0 ? '45% 55%' : '1fr' }, gap: 2 }}>
      <Paper elevation={2} sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          <Typography variant="h6">Packet Layout & PDF Settings</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure page fitting, song ordering, and display options for your printable PDF.
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}

          {/* SECTION 1: PAGE FITTING & BOUNDARIES */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                PAGE FITTING & BOUNDARIES
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={requireOnePagePerSong}
                    onChange={(event) => setRequireOnePagePerSong(event.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Require each song to fit entirely on one page
                  </Typography>
                }
              />
              <Typography variant="caption" color="text.secondary" sx={{ pl: 4, display: 'block', mt: -0.5 }}>
                Pushes songs to start on a fresh page to avoid mid-song breaks. Adheres to your selected font size; if a song is too long to fit at the set font size, it may eventually go to the next page.
              </Typography>
            </Stack>
          </Paper>

          {/* SECTION 2: SONG ARRANGEMENT & ORDERING */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Stack spacing={1.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                SONG ARRANGEMENT & ORDERING
              </Typography>
              <RadioGroup
                value={orderingMode}
                onChange={(e) => setOrderingMode(e.target.value)}
              >
                <FormControlLabel
                  value="within_sections"
                  control={<Radio size="small" color="primary" />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Optimize Within Sections (Recommended)
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Reorders songs inside each section to fit pages efficiently, keeping section headers and boundaries intact.
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="original"
                  control={<Radio size="small" color="primary" />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Keep Exact Original Order
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Preserves manual setlist sequence without reordering songs.
                      </Typography>
                    </Box>
                  }
                  sx={{ mt: 1 }}
                />
                <FormControlLabel
                  value="global"
                  control={<Radio size="small" color="primary" />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Global Compact Optimization
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Reorders songs across the whole packet for maximum page compression.
                      </Typography>
                    </Box>
                  }
                  sx={{ mt: 1 }}
                />
              </RadioGroup>
            </Stack>
          </Paper>

          {/* SECTION 3: TYPOGRAPHY & PAGE DISPLAY */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Stack spacing={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                TYPOGRAPHY & DISPLAY
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  Lyric Font Size:
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 0.5, py: 0.25, bgcolor: 'background.paper' }}>
                  <IconButton
                    size="small"
                    onClick={() => setPdfFontSize((prev) => Math.max(6, Math.round((prev - 0.5) * 2) / 2))}
                    disabled={pdfFontSize <= 6}
                    aria-label="decrease font size"
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 44, textAlign: 'center', userSelect: 'none' }}>
                    {pdfFontSize} pt
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setPdfFontSize((prev) => Math.min(24, Math.round((prev + 0.5) * 2) / 2))}
                    disabled={pdfFontSize >= 24}
                    aria-label="increase font size"
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>

              <Stack spacing={1}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={showPageNumbers}
                      onChange={(event) => setShowPageNumbers(event.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Show page numbers
                    </Typography>
                  }
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
                      value={startingPageInput}
                      onChange={handleStartingPageChange}
                      onBlur={handleStartingPageBlur}
                      slotProps={{ htmlInput: { min: 1 } }}
                      sx={{ maxWidth: 180 }}
                    />
                  </Stack>
                )}
              </Stack>

              <Stack spacing={1}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={orderingMode !== 'global' && showSectionHeadersInIndex}
                      disabled={orderingMode === 'global'}
                      onChange={(event) => setShowSectionHeadersInIndex(event.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Show section headers in index
                      </Typography>
                      {orderingMode === 'global' ? (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Unavailable during global compact optimization because songs are reordered across section boundaries.
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Displays section titles above song groups in the PDF table of contents.
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </Stack>
            </Stack>
          </Paper>

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
