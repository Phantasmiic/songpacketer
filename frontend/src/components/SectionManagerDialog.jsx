import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stack,
  TextField,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Card,
  CardContent,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

const PRESET_COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#9c27b0', '#d32f2f', '#00838f', '#455a64'];

export default function SectionManagerDialog({ open, onClose, matches, onSave }) {
  const [sections, setSections] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [selectedSongIds, setSelectedSongIds] = useState(new Set());
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [targetSectionId, setTargetSectionId] = useState('');

  // Drag select marquee ref
  const rightPaneRef = useRef(null);
  const [marquee, setMarquee] = useState(null); // { startX, startY, currentX, currentY }
  const isDraggingMarquee = useRef(false);

  // Initialize state from matches
  useEffect(() => {
    if (!open) return;

    const sectionsList = [];
    const unassignedList = [];
    let currentSection = null;

    matches.forEach((item, index) => {
      // Ensure each item has a unique client-side ID for drag and drop
      const clientRowId = item.id || (item.type === 'section' ? `sec-${index}` : `song-${index}-${Date.now()}`);
      const rowWithId = { ...item, clientRowId };

      if (item.type === 'section') {
        currentSection = {
          id: clientRowId,
          title: item.title,
          color: PRESET_COLORS[sectionsList.length % PRESET_COLORS.length],
          songs: [],
        };
        sectionsList.push(currentSection);
      } else {
        if (currentSection) {
          currentSection.songs.push(rowWithId);
        } else {
          unassignedList.push(rowWithId);
        }
      }
    });

    setSections(sectionsList);
    setUnassigned(unassignedList);
    setSelectedSongIds(new Set());
    setNewSectionTitle('');
    if (sectionsList.length > 0) {
      setTargetSectionId(sectionsList[0].id);
    } else {
      setTargetSectionId('');
    }
  }, [open, matches]);

  const handleSave = () => {
    // Rebuild the flat matches array
    const flattened = [...unassigned.map(({ clientRowId, ...rest }) => rest)];
    sections.forEach((sec) => {
      // Save section
      flattened.push({ type: 'section', title: sec.title, id: sec.id });
      // Save section songs
      sec.songs.forEach(({ clientRowId, ...rest }) => {
        flattened.push(rest);
      });
    });
    onSave(flattened);
    onClose();
  };

  const handleAddSection = () => {
    const title = newSectionTitle.trim();
    if (!title) return;

    const newSecId = `sec-new-${Date.now()}`;
    const newSec = {
      id: newSecId,
      title,
      color: PRESET_COLORS[sections.length % PRESET_COLORS.length],
      songs: [],
    };

    setSections((prev) => [...prev, newSec]);
    setNewSectionTitle('');
    setTargetSectionId(newSecId);
  };

  const handleDeleteSection = (secId) => {
    const targetSec = sections.find((s) => s.id === secId);
    if (!targetSec) return;

    // Put songs back to unassigned
    setUnassigned((prev) => [...prev, ...targetSec.songs]);

    // Remove section
    setSections((prev) => prev.filter((s) => s.id !== secId));

    if (targetSectionId === secId) {
      setTargetSectionId('');
    }
  };

  // Toggle individual card click selection
  const handleToggleSelect = (clientRowId) => {
    setSelectedSongIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientRowId)) {
        next.delete(clientRowId);
      } else {
        next.add(clientRowId);
      }
      return next;
    });
  };

  // Batch assign selected songs to target section
  const handleBatchAssign = () => {
    if (!targetSectionId || selectedSongIds.size === 0) return;

    // Find target section
    const targetSec = sections.find((s) => s.id === targetSectionId);
    if (!targetSec) return;

    // Gather selected songs from sections and unassigned
    const songsToAssign = [];
    const filterOutSelected = (songList) =>
      songList.filter((s) => {
        if (selectedSongIds.has(s.clientRowId)) {
          songsToAssign.push(s);
          return false;
        }
        return true;
      });

    const updatedSections = sections.map((sec) => ({
      ...sec,
      songs: filterOutSelected(sec.songs),
    }));

    const updatedUnassigned = filterOutSelected(unassigned);

    // Append to target section songs list
    const finalSections = updatedSections.map((sec) => {
      if (sec.id === targetSectionId) {
        return {
          ...sec,
          songs: [...sec.songs, ...songsToAssign],
        };
      }
      return sec;
    });

    setSections(finalSections);
    setUnassigned(updatedUnassigned);
    setSelectedSongIds(new Set());
  };

  // HTML5 Drag and Drop Handlers for left-pane lists
  const handleDragStart = (e, clientRowId, sourceSecId) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ clientRowId, sourceSecId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetSecId) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const { clientRowId, sourceSecId } = JSON.parse(dataStr);

      if (sourceSecId === targetSecId) return;

      // Find the dragged song
      let draggedSong = null;
      if (sourceSecId === 'unassigned') {
        draggedSong = unassigned.find((s) => s.clientRowId === clientRowId);
      } else {
        const sourceSec = sections.find((s) => s.id === sourceSecId);
        draggedSong = sourceSec?.songs.find((s) => s.clientRowId === clientRowId);
      }

      if (!draggedSong) return;

      // Remove from source
      if (sourceSecId === 'unassigned') {
        setUnassigned((prev) => prev.filter((s) => s.clientRowId !== clientRowId));
      } else {
        setSections((prev) =>
          prev.map((s) => {
            if (s.id === sourceSecId) {
              return { ...s, songs: s.songs.filter((song) => song.clientRowId !== clientRowId) };
            }
            return s;
          })
        );
      }

      // Add to target
      if (targetSecId === 'unassigned') {
        setUnassigned((prev) => [...prev, draggedSong]);
      } else {
        setSections((prev) =>
          prev.map((s) => {
            if (s.id === targetSecId) {
              return { ...s, songs: [...s.songs, draggedSong] };
            }
            return s;
          })
        );
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  // Marquee Drag-select event handlers
  const handleMouseDown = (e) => {
    // Only drag marquee on left click and directly on the right pane container or its empty space
    if (e.button !== 0) return;
    const rect = rightPaneRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    isDraggingMarquee.current = true;
    setMarquee({ startX, startY, currentX: startX, currentY: startY });
  };

  const handleMouseMove = (e) => {
    if (!isDraggingMarquee.current || !marquee) return;
    const rect = rightPaneRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    setMarquee((prev) => ({
      ...prev,
      currentX,
      currentY,
    }));

    // Perform bounding box calculations to select cards in real-time
    const parentRect = rightPaneRef.current.getBoundingClientRect();
    const selectBox = {
      left: Math.min(marquee.startX, currentX) + parentRect.left,
      right: Math.max(marquee.startX, currentX) + parentRect.left,
      top: Math.min(marquee.startY, currentY) + parentRect.top,
      bottom: Math.max(marquee.startY, currentY) + parentRect.top,
    };

    const cardElements = rightPaneRef.current.querySelectorAll('.song-selectable-card');
    const newSelected = new Set();

    cardElements.forEach((el) => {
      const elId = el.getAttribute('data-id');
      const elRect = el.getBoundingClientRect();

      // Check intersection
      const intersects = !(
        elRect.left > selectBox.right ||
        elRect.right < selectBox.left ||
        elRect.top > selectBox.bottom ||
        elRect.bottom < selectBox.top
      );

      if (intersects) {
        newSelected.add(elId);
      }
    });

    setSelectedSongIds(newSelected);
  };

  const handleMouseUp = () => {
    isDraggingMarquee.current = false;
    setMarquee(null);
  };

  // Clean label helper
  const getSongTitle = (song) => {
    const chosen = song.candidates?.find((c) => c.song_id === song.selectedSongId);
    return chosen?.title || song.selected?.title || song.titleOverride || song.input || 'Untitled';
  };

  // All songs list for the right pane pool
  const allSongPool = [
    ...unassigned,
    ...sections.flatMap((s) => s.songs),
  ];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ borderBottom: '1px solid #eee', py: 2 }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
          Manage Sections
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ p: 0, display: 'flex', height: '70vh' }}>
        {/* Left Pane: Sections Panel */}
        <Box
          sx={{
            width: '38%',
            borderRight: '1px solid #e0e0e0',
            bgcolor: '#fcfcfc',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                label="New Section Title"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSection();
                  }
                }}
                fullWidth
              />
              <Button variant="contained" size="small" onClick={handleAddSection} startIcon={<AddIcon />}>
                Add
              </Button>
            </Stack>
          </Box>

          <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
            <Stack spacing={2}>
              {/* Unassigned section drop area */}
              <Box
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, 'unassigned')}
                sx={{
                  border: '1px dashed #bdbdbd',
                  borderRadius: 2,
                  p: 1.5,
                  bgcolor: '#fafafa',
                  minHeight: 80,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1 }}>
                  Unassigned ({unassigned.length})
                </Typography>
                <Stack spacing={1}>
                  {unassigned.map((song) => (
                    <Box
                      key={song.clientRowId}
                      draggable
                      onDragStart={(e) => handleDragStart(e, song.clientRowId, 'unassigned')}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        bgcolor: '#fff',
                        border: '1px solid #e0e0e0',
                        borderRadius: 1,
                        cursor: 'grab',
                        '&:active': { cursor: 'grabbing' },
                      }}
                    >
                      <DragIndicatorIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                        {getSongTitle(song)}
                      </Typography>
                    </Box>
                  ))}
                  {unassigned.length === 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', textAlign: 'center', py: 1 }}>
                      No unassigned songs. Drag songs here to remove them from sections.
                    </Typography>
                  )}
                </Stack>
              </Box>

              {/* Sections list */}
              {sections.map((sec) => (
                <Box
                  key={sec.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, sec.id)}
                  sx={{
                    border: `1px solid ${sec.color}`,
                    borderRadius: 2,
                    p: 1.5,
                    bgcolor: '#fff',
                    minHeight: 100,
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: sec.color }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: sec.color }}>
                        {sec.title} ({sec.songs.length})
                      </Typography>
                    </Stack>
                    <IconButton size="small" onClick={() => handleDeleteSection(sec.id)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>

                  <Stack spacing={1}>
                    {sec.songs.map((song) => (
                      <Box
                        key={song.clientRowId}
                        draggable
                        onDragStart={(e) => handleDragStart(e, song.clientRowId, sec.id)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 1,
                          bgcolor: '#fff',
                          border: '1px solid #e0e0e0',
                          borderLeft: `3px solid ${sec.color}`,
                          borderRadius: 1,
                          cursor: 'grab',
                          '&:active': { cursor: 'grabbing' },
                        }}
                      >
                        <DragIndicatorIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                          {getSongTitle(song)}
                        </Typography>
                      </Box>
                    ))}
                    {sec.songs.length === 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', textAlign: 'center', py: 1 }}>
                        Empty. Drag songs here or batch-assign from the right.
                      </Typography>
                    )}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        </Box>

        {/* Right Pane: Song Pool Panel */}
        <Box
          sx={{
            width: '62%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Batch assign options */}
          <Box sx={{ p: 2, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Song Pool ({allSongPool.length})
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {selectedSongIds.size} selected
              </Typography>
              <FormControl size="small" sx={{ minWidth: 150 }} disabled={sections.length === 0 || selectedSongIds.size === 0}>
                <InputLabel>Assign Selected To</InputLabel>
                <Select
                  value={targetSectionId}
                  label="Assign Selected To"
                  onChange={(e) => setTargetSectionId(e.target.value)}
                >
                  {sections.map((sec) => (
                    <MenuItem key={sec.id} value={sec.id}>
                      {sec.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                size="small"
                onClick={handleBatchAssign}
                disabled={sections.length === 0 || selectedSongIds.size === 0}
              >
                Apply
              </Button>
            </Stack>
          </Box>

          {/* Song grid view with marquee select */}
          <Box
            ref={rightPaneRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              p: 2,
              position: 'relative',
              userSelect: 'none',
              bgcolor: '#fafafa',
            }}
          >
            {/* Draw selection marquee */}
            {marquee && (
              <Box
                sx={{
                  position: 'absolute',
                  border: '1px dashed #1976d2',
                  bgcolor: 'rgba(25, 118, 210, 0.08)',
                  pointerEvents: 'none',
                  left: Math.min(marquee.startX, marquee.currentX),
                  top: Math.min(marquee.startY, marquee.currentY),
                  width: Math.abs(marquee.startX - marquee.currentX),
                  height: Math.abs(marquee.startY - marquee.currentY),
                  zIndex: 1000,
                }}
              />
            )}

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 2,
              }}
            >
              {allSongPool.map((song) => {
                const isSelected = selectedSongIds.has(song.clientRowId);
                const sectionColor = sections.find((s) => s.songs.some((songItem) => songItem.clientRowId === song.clientRowId))?.color || '#bdbdbd';
                return (
                  <Card
                    key={song.clientRowId}
                    data-id={song.clientRowId}
                    className="song-selectable-card"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSelect(song.clientRowId);
                    }}
                    sx={{
                      cursor: 'pointer',
                      border: isSelected ? '2px solid #1976d2' : `1px solid ${sectionColor}`,
                      bgcolor: isSelected ? '#eef4ff' : '#fff',
                      boxShadow: 'none',
                      transition: 'border 0.15s, background-color 0.15s',
                      userSelect: 'none',
                      height: '100%',
                      minHeight: 80,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, width: '100%' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, lineHeight: 1.2 }} noWrap>
                        {getSongTitle(song)}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }} noWrap>
                        Req: {song.input}
                      </Typography>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>

            {allSongPool.length === 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography variant="body1" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No songs in current packet.
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ borderTop: '1px solid #eee', px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save Sections
        </Button>
      </DialogActions>
    </Dialog>
  );
}
