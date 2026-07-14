import { memo, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

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
      minRows={10}
      maxRows={isExpanded ? undefined : 10}
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

function ReviewStep({
  matches,
  onSelectionChange,
  onSearchCandidates,
  onDeleteRow,
  onResetChordpro,
  activeRowIndex,
  setActiveRowIndex,
  unmatchedCount,
  duplicateRemovedCount,
}) {
  const hasRows = matches.length > 0;
  const rowRefs = useRef({});
  const [expandedEditors, setExpandedEditors] = useState({});

  const labelForRow = (row) => {
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

  const searchTermForRow = (row, rowIndex) => (
    row.searchQuery ?? row.input ?? ''
  );

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '55% 45%' },
        gap: 2,
      }}
    >
      <Paper elevation={2} sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Refine Matches</Typography>
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
            matches.map((row, rowIndex) => (
              <Box
                key={`${row.input}-${rowIndex}`}
                ref={(element) => {
                  rowRefs.current[rowIndex] = element;
                }}
                sx={{
                  border: '1px solid #e0e0e0',
                  borderRadius: 2,
                  p: 2,
                  outline: activeRowIndex === rowIndex ? '2px solid #0d47a1' : 'none',
                }}
                onClick={() => setActiveRowIndex(rowIndex)}
              >
                <Stack spacing={1.8}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignSelf: 'flex-start',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 99,
                        bgcolor: '#eceff1',
                        color: '#263238',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                      }}
                    >
                      Song {rowIndex + 1}
                    </Box>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignSelf: 'flex-start',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 99,
                        bgcolor: '#f3f4f6',
                        color: '#374151',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        maxWidth: '100%',
                      }}
                    >
                      Input: {row.input}
                    </Box>
                    {!row.selectedSongId && (
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignSelf: 'flex-start',
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 99,
                          bgcolor: '#ffebee',
                          color: '#b71c1c',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                        }}
                      >
                        No Match
                      </Box>
                    )}
                  </Box>
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

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography
                      component="button"
                      type="button"
                      onClick={() => onResetChordpro(rowIndex)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#0d47a1',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      Reset to default
                    </Typography>
                    <Button
                      variant="text"
                      color="error"
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteRow(rowIndex);
                      }}
                      sx={{ minWidth: 'auto' }}
                    >
                      Delete card
                    </Button>
                  </Box>

                  <Button
                    variant="text"
                    size="small"
                    onClick={() => toggleExpandedEditor(rowIndex)}
                    sx={{ alignSelf: 'flex-start', p: 0, minWidth: 'auto' }}
                  >
                    {expandedEditors[rowIndex] ? '▲ Collapse editor' : '▼ Expand editor'}
                  </Button>

                  <SongBodyEditor
                    value={row.chordproOverride || ''}
                    rowIndex={rowIndex}
                    isExpanded={Boolean(expandedEditors[rowIndex])}
                    onSelectionChange={onSelectionChange}
                    setActiveRowIndex={setActiveRowIndex}
                  />
                </Stack>
              </Box>
            ))}
        </Stack>
      </Paper>

      <Paper elevation={2} sx={{ p: 2, height: 'fit-content', position: { md: 'sticky' }, top: { md: 148 } }}>
        <Stack spacing={1}>
          <Typography variant="subtitle1">Song List</Typography>
          <Box sx={{ maxHeight: 520, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}>
            {matches.map((row, index) => (
              <Box
                key={`${row.input}-list-${index}`}
                sx={{
                  px: 1.5,
                  py: 1,
                  borderBottom: '1px solid #f0f0f0',
                  fontWeight: activeRowIndex === index ? 700 : 400,
                  backgroundColor: activeRowIndex === index ? '#eef4ff' : 'transparent',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setActiveRowIndex(index);
                  scrollRowIntoCenter(index);
                }}
              >
                {index + 1}. {labelForRow(row)}
              </Box>
            ))}
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}

export default ReviewStep;
