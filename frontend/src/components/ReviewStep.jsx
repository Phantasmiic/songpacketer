import { memo, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const SongSearchBox = memo(function SongSearchBox({
  initialValue,
  rowIndex,
  onSearchCandidates,
  setActiveRowIndex,
}) {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    setSearchTerm(initialValue);
  }, [initialValue]);

  const handleSearch = async () => {
    const query = searchTerm.trim();
    if (!query || isSearching) {
      return;
    }

    setActiveRowIndex(rowIndex);
    setIsSearching(true);
    try {
      await onSearchCandidates(rowIndex, query);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr auto' }, gap: 1 }}>
      <TextField
        label="Search Songbase"
        value={searchTerm}
        placeholder="Search by title or lyric fragment"
        InputProps={{ sx: { '& input': { py: 0.55, fontSize: '0.95rem' } } }}
        onFocus={() => setActiveRowIndex(rowIndex)}
        onChange={(event) => setSearchTerm(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            handleSearch();
          }
        }}
      />
      <Button
        variant="outlined"
        disabled={!searchTerm.trim() || isSearching}
        onClick={handleSearch}
        sx={{ minWidth: 96 }}
      >
        {isSearching ? 'Searching…' : 'Search'}
      </Button>
    </Box>
  );
});

const SongBodyEditor = memo(function SongBodyEditor({
  value,
  rowIndex,
  isExpanded,
  onSelectionChange,
  setActiveRowIndex,
}) {
  const normalizedValue = value || '';
  const [draft, setDraft] = useState(normalizedValue);
  const lastCommittedRef = useRef(normalizedValue);
  const commitTimerRef = useRef(null);

  useEffect(() => {
    setDraft(normalizedValue);
    lastCommittedRef.current = normalizedValue;
  }, [normalizedValue]);

  useEffect(() => (
    () => {
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
      }
    }
  ), []);

  const commitDraft = (nextValue = draft) => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    if (nextValue === lastCommittedRef.current) {
      return;
    }

    lastCommittedRef.current = nextValue;
    onSelectionChange(rowIndex, {
      chordproOverride: nextValue,
    });
  };

  const scheduleCommit = (nextValue) => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
    }
    commitTimerRef.current = setTimeout(() => {
      commitDraft(nextValue);
    }, 800);
  };

  return (
    <TextField
      multiline
      minRows={15}
      placeholder="Edit chord/lyric body..."
      value={draft}
      onFocus={() => setActiveRowIndex(rowIndex)}
      onBlur={() => commitDraft()}
      onChange={(event) => {
        const nextValue = event.target.value;
        setDraft(nextValue);
        scheduleCommit(nextValue);
      }}
    />
  );
});

function AddSectionModal({ open, onClose, onAddSection }) {
  const [title, setTitle] = useState('');
  const [pastedText, setPastedText] = useState('');

  const handleSubmit = () => {
    onAddSection(title, pastedText);
    setTitle('');
    setPastedText('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Add Section</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label="Section Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sunday Morning Worship"
          />
          <TextField
            fullWidth
            multiline
            minRows={4}
            label="Paste songs (optional)"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Paste song titles here, one per line, to auto-assign them to this section."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!title.trim() && !pastedText.trim()}>
          Add Section
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ReviewStep({
  matches,
  onSelectionChange,
  onSearchCandidates,
  onDeleteRow,
  onResetChordpro,
  onAddSection,
  activeRowIndex,
  setActiveRowIndex,
  unmatchedCount,
  duplicateRemovedCount,
}) {
  const hasRows = matches.length > 0;
  const rowRefs = useRef({});
  const [expandedEditors, setExpandedEditors] = useState({});
  const [expandedCards, setExpandedCards] = useState({});
  const [addSectionOpen, setAddSectionOpen] = useState(false);

  const labelForRow = (row) => {
    if (row.type === 'section') return row.title;
    const chosen = row.candidates?.find((candidate) => candidate.song_id === row.selectedSongId);
    return chosen?.title || row.selected?.title || row.input;
  };

  const scrollRowIntoCenter = (rowIndex) => {
    const target = rowRefs.current[rowIndex];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const toggleExpandedEditor = (rowIndex) => {
    setExpandedEditors((prev) => ({ ...prev, [rowIndex]: !prev[rowIndex] }));
  };

  const toggleCardExpanded = (rowIndex, e) => {
    if (e) e.stopPropagation();
    setExpandedCards((prev) => ({ ...prev, [rowIndex]: !prev[rowIndex] }));
  };

  const searchTermForRow = (row, rowIndex) => (
    row.searchQuery ?? row.input ?? ''
  );

  let currentSection = null;
  let songNumber = 1;

  return (
    <Box
      sx={{
        width: '100%',
        minWidth: 0,
      }}
    >
      <Paper elevation={2} sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Refine Matches</Typography>
            <Button variant="outlined" size="small" onClick={() => setAddSectionOpen(true)}>
              + Add Section
            </Button>
          </Stack>
          
          {!hasRows && <Alert severity="info">No matches yet. Go back and run matching first.</Alert>}
          {unmatchedCount > 0 && (
            <Alert severity="warning">
              {unmatchedCount} song(s) have no match yet. Fill all blank song cards before continuing to PDF generation.
            </Alert>
          )}
          {duplicateRemovedCount > 0 && unmatchedCount === 0 && (
            <Alert severity="info">
              Removed {duplicateRemovedCount} duplicate song occurrence(s) automatically (kept first occurrence).
            </Alert>
          )}

          {hasRows &&
            matches.map((row, rowIndex) => {
              if (row.type === 'section') {
                currentSection = row.id || `sec-${rowIndex}`;
                return (
                  <Box
                    key={`sec-${rowIndex}`}
                    ref={(element) => {
                      rowRefs.current[rowIndex] = element;
                    }}
                    sx={{
                      border: '1px solid #c5cae9',
                      backgroundColor: '#e8eaf6',
                      borderRadius: 2,
                      p: 2,
                      outline: activeRowIndex === rowIndex ? '2px solid #3f51b5' : 'none',
                      mt: 2,
                    }}
                    onClick={() => setActiveRowIndex(rowIndex)}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <TextField
                        variant="standard"
                        value={row.title || ''}
                        onChange={(e) => onSelectionChange(rowIndex, { title: e.target.value })}
                        placeholder="Section Title"
                        InputProps={{ disableUnderline: true, sx: { fontSize: '1.25rem', fontWeight: 600, color: '#1a237e' } }}
                        fullWidth
                      />
                      <Button
                        variant="text"
                        color="error"
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteRow(rowIndex);
                        }}
                        sx={{ minWidth: 'auto', ml: 2 }}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </Box>
                );
              }

              const isIndented = currentSection !== null;
              const isExpanded = expandedCards[rowIndex];
              const currentSongNumber = songNumber++;

              return (
                <Box
                  key={`${row.input}-${rowIndex}`}
                  ref={(element) => {
                    rowRefs.current[rowIndex] = element;
                  }}
                  sx={{
                    border: '1px solid #e0e0e0',
                    borderLeft: isIndented ? '4px solid #3f51b5' : '1px solid #e0e0e0',
                    marginLeft: isIndented ? 3 : 0,
                    borderRadius: 2,
                    p: 2,
                    outline: activeRowIndex === rowIndex ? '2px solid #0d47a1' : 'none',
                    backgroundColor: '#fff',
                    cursor: isExpanded ? 'default' : 'pointer',
                    '&:hover': {
                      backgroundColor: isExpanded ? '#fff' : '#f9f9f9',
                    }
                  }}
                  onClick={() => {
                    setActiveRowIndex(rowIndex);
                    if (!isExpanded) {
                      toggleCardExpanded(rowIndex);
                    }
                  }}
                >
                  <Stack spacing={1.8}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', flexGrow: 1 }}>
                        <Typography sx={{ fontWeight: 700, color: 'text.secondary', minWidth: '60px' }}>
                          Song {currentSongNumber}
                        </Typography>
                        
                        <Typography sx={{ fontWeight: 600, color: row.selectedSongId ? 'text.primary' : 'error.main' }}>
                          {labelForRow(row)}
                        </Typography>

                        {row.input && row.input.trim().toLowerCase() !== labelForRow(row).trim().toLowerCase() && (
                          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                            (Input: "{row.input}")
                          </Typography>
                        )}

                        {!row.selectedSongId && (
                          <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: '#ffebee', color: '#b71c1c', fontWeight: 700, fontSize: '0.75rem' }}>
                            No Match
                          </Box>
                        )}
                      </Box>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {isExpanded ? (
                          <Button 
                            variant="text" 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCardExpanded(rowIndex);
                            }}
                            startIcon={<ExpandMoreIcon />}
                          >
                            Collapse
                          </Button>
                        ) : (
                          <Button 
                            variant="text" 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCardExpanded(rowIndex);
                            }}
                            startIcon={<ChevronRightIcon />}
                          >
                            Edit
                          </Button>
                        )}
                      </Box>
                    </Box>

                    {isExpanded && (
                      <>
                        <SongSearchBox
                          initialValue={searchTermForRow(row, rowIndex)}
                          rowIndex={rowIndex}
                          onSearchCandidates={onSearchCandidates}
                          setActiveRowIndex={setActiveRowIndex}
                        />

                        <TextField
                          select
                          label="Matched Song"
                          value={row.selectedSongId || ''}
                          error={!row.selectedSongId}
                          InputLabelProps={{ shrink: true }}
                          SelectProps={{
                            MenuProps: { PaperProps: { sx: { maxHeight: 280 } } },
                            sx: { '& .MuiSelect-select': { py: 0.55, fontSize: '0.95rem' } },
                          }}
                          onFocus={() => setActiveRowIndex(rowIndex)}
                          onChange={(event) =>
                            onSelectionChange(rowIndex, {
                              selectedSongId: Number(event.target.value),
                              selectedVersionId: '',
                            })
                          }
                        >
                          {(row.candidates || []).length === 0 && (
                            <MenuItem disabled value="">
                              No candidates found. Try a different search above.
                            </MenuItem>
                          )}
                          {(row.candidates || []).map((candidate) => (
                            <MenuItem key={candidate.song_id} value={candidate.song_id} sx={{ py: 0.4, minHeight: 32, fontSize: '0.95rem' }}>
                              {candidate.title} ({Math.round(candidate.score * 100)}%)
                            </MenuItem>
                          ))}
                        </TextField>

                        <TextField
                          label="Song Title"
                          value={row.titleOverride || ''}
                          InputProps={{ sx: { '& input': { py: 0.55, fontSize: '0.95rem' } } }}
                          onFocus={() => setActiveRowIndex(rowIndex)}
                          onChange={(event) =>
                            onSelectionChange(rowIndex, {
                              titleOverride: event.target.value,
                            })
                          }
                        />

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 1.25 }}>
                          <TextField
                            select
                            label="Tune / Version"
                            value={row.selectedVersionId || ''}
                            SelectProps={{
                              MenuProps: { PaperProps: { sx: { maxHeight: 280 } } },
                              sx: { '& .MuiSelect-select': { py: 0.55, fontSize: '0.95rem' } },
                            }}
                            onFocus={() => setActiveRowIndex(rowIndex)}
                            onChange={(event) =>
                              onSelectionChange(rowIndex, {
                                selectedVersionId: Number(event.target.value),
                              })
                            }
                            disabled={!row.versions?.length || row.versions.length <= 1}
                          >
                            {row.versions?.map((version) => (
                              <MenuItem key={version.id} value={version.id} sx={{ py: 0.4, minHeight: 32, fontSize: '0.95rem' }}>
                                {version.tune_name || 'Default'}
                              </MenuItem>
                            ))}
                          </TextField>

                          <TextField
                            type="number"
                            label="Capo"
                            value={row.capo === '' || row.capo == null ? 0 : row.capo}
                            inputProps={{ min: 0, step: 1 }}
                            InputProps={{ sx: { '& input': { py: 0.55, fontSize: '0.95rem' } } }}
                            onFocus={() => setActiveRowIndex(rowIndex)}
                            onChange={(event) => {
                              const next = Number(event.target.value);
                              onSelectionChange(rowIndex, {
                                capo: Number.isNaN(next) ? 0 : Math.max(0, next),
                              });
                            }}
                          />
                        </Box>

                        <Box sx={{ borderTop: '1px solid #eee', pt: 1.5, mt: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Button
                              variant="text"
                              size="small"
                              onClick={() => toggleExpandedEditor(rowIndex)}
                              sx={{ 
                                color: 'text.secondary', 
                                p: 0, 
                                minWidth: 'auto',
                                textTransform: 'none',
                                fontWeight: 500,
                                '&:hover': { background: 'transparent', color: 'primary.main' } 
                              }}
                              startIcon={expandedEditors[rowIndex] ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                            >
                              Edit chords and lyrics
                            </Button>
                            
                            <Box sx={{ display: 'flex', gap: 2 }}>
                              {expandedEditors[rowIndex] && (
                                <Typography
                                  component="button"
                                  type="button"
                                  onClick={() => onResetChordpro(rowIndex)}
                                  sx={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'primary.main',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    p: 0,
                                    '&:hover': { textDecoration: 'underline' }
                                  }}
                                >
                                  Reset
                                </Typography>
                              )}
                              <Typography
                                component="button"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onDeleteRow(rowIndex);
                                }}
                                sx={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'error.main',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                  p: 0,
                                  '&:hover': { textDecoration: 'underline' }
                                }}
                              >
                                Delete
                              </Typography>
                            </Box>
                          </Box>

                          {expandedEditors[rowIndex] && (
                            <SongBodyEditor
                              value={row.chordproOverride || ''}
                              rowIndex={rowIndex}
                              isExpanded={true}
                              onSelectionChange={onSelectionChange}
                              setActiveRowIndex={setActiveRowIndex}
                            />
                          )}
                        </Box>
                      </>
                    )}
                  </Stack>
                </Box>
              );
            })}
        </Stack>
      </Paper>



      <AddSectionModal
        open={addSectionOpen}
        onClose={() => setAddSectionOpen(false)}
        onAddSection={onAddSection}
      />
    </Box>
  );
}

export default ReviewStep;
