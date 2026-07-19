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
import SectionManagerDialog from './SectionManagerDialog';

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



const getSolidBg = (hexColor) => {
  const colorMap = {
    '#1976d2': '#f0f7ff', // Light Blue
    '#2e7d32': '#f1fbf0', // Light Green
    '#ed6c02': '#fff8eb', // Light Orange
    '#9c27b0': '#fdf0ff', // Light Purple
    '#d32f2f': '#fff1f1', // Light Red
    '#00838f': '#e2fafd', // Light Cyan
    '#455a64': '#f0f4f6', // Light Slate
  };
  return colorMap[hexColor] || '#fafafa';
};

function ReviewStep({
  matches,
  onSelectionChange,
  onSearchCandidates,
  onDeleteRow,
  onResetChordpro,
  onUpdateMatches,
  activeRowIndex,
  setActiveRowIndex,
  unmatchedCount,
  duplicateRemovedCount,
}) {
  const hasRows = matches.length > 0;
  const rowRefs = useRef({});
  const [expandedEditors, setExpandedEditors] = useState({});
  const [expandedCards, setExpandedCards] = useState({});
  const [sectionManagerOpen, setSectionManagerOpen] = useState(false);

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
            <Button variant="outlined" size="small" onClick={() => setSectionManagerOpen(true)}>
              Manage Sections
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
          )}          {hasRows && (() => {
            const SECTION_COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#9c27b0', '#d32f2f', '#00838f', '#455a64'];

            // Group matches by section
            const groups = [];
            let currentGroup = { type: 'unassigned', songs: [] };

            matches.forEach((item, index) => {
              if (item.type === 'section') {
                currentGroup = {
                  type: 'section',
                  id: item.id || `sec-${index}`,
                  title: item.title,
                  originalIndex: index,
                  songs: [],
                };
                groups.push(currentGroup);
              } else {
                if (groups.length === 0) {
                  groups.push(currentGroup);
                }
                currentGroup.songs.push({ ...item, originalIndex: index });
              }
            });

            const renderSongCard = (row, rowIndex, currentSongNumber, isExpanded, sectionColor) => {
              return (
                <Box
                  key={`${row.input}-${rowIndex}`}
                  ref={(element) => {
                    rowRefs.current[rowIndex] = element;
                  }}
                  sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 2,
                    p: 2,
                    outline: activeRowIndex === rowIndex ? `2px solid ${sectionColor}` : 'none',
                    backgroundColor: '#fff',
                    cursor: isExpanded ? 'default' : 'pointer',
                    '&:hover': {
                      backgroundColor: isExpanded ? '#fff' : '#f9f9f9',
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
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
            };

            return groups.map((group, groupIndex) => {
              if (group.type === 'unassigned') {
                return group.songs.map((row) => {
                  const rowIndex = row.originalIndex;
                  const isExpanded = expandedCards[rowIndex];
                  const currentSongNumber = songNumber++;
                  return renderSongCard(row, rowIndex, currentSongNumber, isExpanded, '#757575');
                });
              }

              const color = SECTION_COLORS[(groupIndex - 1) % SECTION_COLORS.length];
              const isSectionActive = activeRowIndex === group.originalIndex;

              return (
                <Box
                  key={group.id}
                  sx={{
                    border: `1.5px solid ${color}`,
                    borderRadius: 2,
                    p: 2.5,
                    mt: 2.5,
                    bgcolor: getSolidBg(color),
                    outline: isSectionActive ? `2px solid ${color}` : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                  onClick={() => {
                    setActiveRowIndex(group.originalIndex);
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexGrow: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color }} />
                      <TextField
                        variant="standard"
                        value={group.title || ''}
                        onChange={(e) => onSelectionChange(group.originalIndex, { title: e.target.value })}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveRowIndex(group.originalIndex);
                        }}
                        placeholder="Untitled Section"
                        InputProps={{ disableUnderline: true, sx: { fontSize: '1.15rem', fontWeight: 700, color: color } }}
                        fullWidth
                      />
                    </Stack>
                    <Button
                      variant="text"
                      color="error"
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteRow(group.originalIndex);
                      }}
                      sx={{ minWidth: 'auto', ml: 2 }}
                    >
                      Delete Section
                    </Button>
                  </Stack>

                  <Stack spacing={1.8}>
                    {group.songs.map((row) => {
                      const rowIndex = row.originalIndex;
                      const isExpanded = expandedCards[rowIndex];
                      const currentSongNumber = songNumber++;
                      return renderSongCard(row, rowIndex, currentSongNumber, isExpanded, color);
                    })}
                    {group.songs.length === 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', pl: 3.5 }}>
                        Empty section. Manage sections to assign songs here.
                      </Typography>
                    )}
                  </Stack>
                </Box>
              );
            });
          })()}
        </Stack>
      </Paper>



      <SectionManagerDialog
        open={sectionManagerOpen}
        onClose={() => setSectionManagerOpen(false)}
        matches={matches}
        onSave={onUpdateMatches}
      />
    </Box>
  );
}

export default ReviewStep;
