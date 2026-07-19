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
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

const PRESET_COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#9c27b0', '#d32f2f', '#00838f', '#455a64'];

function createDragImage(count, firstSongTitle) {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '-1000px';
  container.style.left = '-1000px';
  container.style.width = '120px';
  container.style.height = '60px';
  container.style.pointerEvents = 'none';

  // Card layers to represent a stack
  // Card 3 (back)
  const card3 = document.createElement('div');
  card3.style.position = 'absolute';
  card3.style.top = '8px';
  card3.style.left = '8px';
  card3.style.width = '90px';
  card3.style.height = '42px';
  card3.style.backgroundColor = '#e0e0e0';
  card3.style.border = '1px solid #bdbdbd';
  card3.style.borderRadius = '6px';
  card3.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
  container.appendChild(card3);

  // Card 2 (middle)
  const card2 = document.createElement('div');
  card2.style.position = 'absolute';
  card2.style.top = '4px';
  card2.style.left = '4px';
  card2.style.width = '90px';
  card2.style.height = '42px';
  card2.style.backgroundColor = '#f5f5f5';
  card2.style.border = '1px solid #ccc';
  card2.style.borderRadius = '6px';
  card2.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
  container.appendChild(card2);

  // Card 1 (top)
  const card1 = document.createElement('div');
  card1.style.position = 'absolute';
  card1.style.top = '0';
  card1.style.left = '0';
  card1.style.width = '90px';
  card1.style.height = '42px';
  card1.style.backgroundColor = '#ffffff';
  card1.style.border = '1.5px solid #1976d2';
  card1.style.borderRadius = '6px';
  card1.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
  
  const text = document.createElement('div');
  text.style.padding = '5px';
  text.style.fontSize = '9px';
  text.style.fontWeight = 'bold';
  text.style.color = '#333';
  text.style.whiteSpace = 'nowrap';
  text.style.overflow = 'hidden';
  text.style.textOverflow = 'ellipsis';
  text.innerText = firstSongTitle || 'Dragging songs';
  card1.appendChild(text);
  container.appendChild(card1);

  // Badge count
  const badge = document.createElement('div');
  badge.style.position = 'absolute';
  badge.style.top = '-8px';
  badge.style.right = '18px';
  badge.style.minWidth = '20px';
  badge.style.height = '20px';
  badge.style.borderRadius = '10px';
  badge.style.backgroundColor = '#d32f2f';
  badge.style.color = '#ffffff';
  badge.style.display = 'flex';
  badge.style.alignItems = 'center';
  badge.style.justifyContent = 'center';
  badge.style.fontSize = '11px';
  badge.style.fontWeight = 'bold';
  badge.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
  badge.innerText = count.toString();
  container.appendChild(badge);

  document.body.appendChild(container);
  return container;
}

function CategoryItem({ id, title, color, count, isSelected, onClick, onDrop, onDelete }) {
  const [isDragOver, setIsDragOver] = useState(false);
  return (
    <Box
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        setIsDragOver(false);
        onDrop(e);
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        p: 1.25,
        borderRadius: 1.5,
        bgcolor: isSelected ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
        border: isDragOver ? `2px dashed ${color || '#1976d2'}` : '2px solid transparent',
        cursor: 'pointer',
        transition: 'background-color 0.15s, border 0.15s',
        '&:hover': {
          bgcolor: isSelected ? 'rgba(25, 118, 210, 0.12)' : '#f0f0f0',
        },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flexGrow: 1 }}>
        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color || '#757575', flexShrink: 0 }} />
        <Typography variant="body2" sx={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? 'primary.main' : 'text.primary' }} noWrap>
          {title}
        </Typography>
        <Box
          sx={{
            px: 0.8,
            py: 0.2,
            borderRadius: 99,
            bgcolor: isSelected ? 'primary.main' : '#e0e0e0',
            color: isSelected ? '#fff' : 'text.secondary',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}
        >
          {count}
        </Box>
      </Stack>

      {onDelete && (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          color="error"
          sx={{ ml: 1, p: 0.5 }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
}

export default function SectionManagerDialog({ open, onClose, matches, onSave }) {
  const [sections, setSections] = useState([]);
  const [unassigned, setUnassigned] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('unassigned');
  const [selectedSongIds, setSelectedSongIds] = useState(new Set());
  const [newSectionTitle, setNewSectionTitle] = useState('');

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
    setSelectedCategory('unassigned');
  }, [open, matches]);

  const handleSave = () => {
    // Rebuild flat matches array
    const flattened = [...unassigned.map(({ clientRowId, ...rest }) => rest)];
    sections.forEach((sec) => {
      // Save section header
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
    setSelectedCategory(newSecId);
  };

  const handleDeleteSection = (secId) => {
    const targetSec = sections.find((s) => s.id === secId);
    if (!targetSec) return;

    // Put songs back to unassigned
    setUnassigned((prev) => [...prev, ...targetSec.songs]);

    // Remove section
    setSections((prev) => prev.filter((s) => s.id !== secId));

    if (selectedCategory === secId) {
      setSelectedCategory('unassigned');
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

  // HTML5 Drag and Drop Handlers for dragging songs from right pane to left categories
  const handleDragStart = (e, clientRowId) => {
    // Package selected song IDs
    let dragIds = [clientRowId];
    if (selectedSongIds.has(clientRowId)) {
      dragIds = Array.from(selectedSongIds);
    }
    
    if (dragIds.length > 1) {
      const firstSong = rightPaneSongs.find((s) => s.clientRowId === dragIds[0]);
      const firstSongTitle = firstSong ? getSongTitle(firstSong) : 'Dragging songs';
      const dragImage = createDragImage(dragIds.length, firstSongTitle);
      e.dataTransfer.setDragImage(dragImage, 10, 10);
      setTimeout(() => {
        if (dragImage.parentNode) {
          dragImage.parentNode.removeChild(dragImage);
        }
      }, 0);
    }
    
    e.dataTransfer.setData('application/json', JSON.stringify({ dragIds, sourceCategory: selectedCategory }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetCategory) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const { dragIds, sourceCategory } = JSON.parse(dataStr);

      if (sourceCategory === targetCategory) return;

      // Extract dragged songs from source list
      let songsToMove = [];
      if (sourceCategory === 'unassigned') {
        songsToMove = unassigned.filter((s) => dragIds.includes(s.clientRowId));
        setUnassigned((prev) => prev.filter((s) => !dragIds.includes(s.clientRowId)));
      } else {
        setSections((prev) =>
          prev.map((sec) => {
            if (sec.id === sourceCategory) {
              songsToMove = sec.songs.filter((s) => dragIds.includes(s.clientRowId));
              return { ...sec, songs: sec.songs.filter((s) => !dragIds.includes(s.clientRowId)) };
            }
            return sec;
          })
        );
      }

      // Add songs to target list
      if (targetCategory === 'unassigned') {
        setUnassigned((prev) => [...prev, ...songsToMove]);
      } else {
        setSections((prev) =>
          prev.map((sec) => {
            if (sec.id === targetCategory) {
              return { ...sec, songs: [...sec.songs, ...songsToMove] };
            }
            return sec;
          })
        );
      }

      // Clear selection after drag finishes
      setSelectedSongIds(new Set());
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  // Marquee Drag-select event handlers
  const handleMouseDown = (e) => {
    // Only drag marquee on left click and directly on the right pane container or its empty space (not cards)
    if (e.button !== 0) return;
    if (e.target.closest('.song-selectable-card')) return;

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

    // Bounding box selection calculations
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

  // Filter songs by currently selected category
  const rightPaneSongs = selectedCategory === 'unassigned'
    ? unassigned
    : (sections.find((s) => s.id === selectedCategory)?.songs || []);

  const activeCategoryColor = selectedCategory === 'unassigned'
    ? '#757575'
    : (sections.find((s) => s.id === selectedCategory)?.color || '#1976d2');

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ borderBottom: '1px solid #eee', py: 2 }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
          Manage Sections
        </Typography>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0, display: 'flex', height: '70vh' }}>
        {/* Left Pane: Categories list */}
        <Box
          sx={{
            width: '32%',
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
              <Button
                variant="contained"
                size="small"
                onClick={handleAddSection}
                startIcon={<AddIcon />}
                sx={{ height: 40, px: 2, flexShrink: 0 }}
              >
                Add
              </Button>
            </Stack>
          </Box>

          <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
            <Stack spacing={1}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, px: 1, mb: 0.5 }}>
                SECTIONS
              </Typography>
              
              {/* Sections list */}
              {sections.map((sec) => (
                <CategoryItem
                  key={sec.id}
                  id={sec.id}
                  title={sec.title}
                  color={sec.color}
                  count={sec.songs.length}
                  isSelected={selectedCategory === sec.id}
                  onClick={() => {
                    setSelectedCategory(sec.id);
                    setSelectedSongIds(new Set());
                  }}
                  onDrop={(e) => handleDrop(e, sec.id)}
                  onDelete={() => handleDeleteSection(sec.id)}
                />
              ))}

              {sections.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', px: 1, py: 1 }}>
                  No sections created yet. Add a section above.
                </Typography>
              )}

              <Divider sx={{ my: 1.5 }} />

              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, px: 1, mb: 0.5 }}>
                UNASSIGNED
              </Typography>

              {/* Unassigned category */}
              <CategoryItem
                id="unassigned"
                title="Unassigned Songs"
                color="#757575"
                count={unassigned.length}
                isSelected={selectedCategory === 'unassigned'}
                onClick={() => {
                  setSelectedCategory('unassigned');
                  setSelectedSongIds(new Set());
                }}
                onDrop={(e) => handleDrop(e, 'unassigned')}
              />
            </Stack>
          </Box>
        </Box>

        {/* Right Pane: Selected category song pool */}
        <Box
          sx={{
            width: '68%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header indicating current view */}
          <Box sx={{ p: 2, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: activeCategoryColor }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {selectedCategory === 'unassigned' ? 'Unassigned Songs' : sections.find((s) => s.id === selectedCategory)?.title} ({rightPaneSongs.length})
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              {selectedSongIds.size > 0 
                ? `${selectedSongIds.size} song(s) selected (drag card to move group)`
                : 'Click or drag selection box to select. Drag cards to move.'}
            </Typography>
          </Box>

          {/* Song grid view */}
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
              cursor: isDraggingMarquee.current ? 'crosshair' : 'default',
              bgcolor: '#fafafa',
            }}
          >
            {/* Draw selection marquee overlay */}
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
                gridAutoRows: 'max-content',
                gap: 1.5,
                alignContent: 'start',
                minHeight: '100%',
                cursor: 'crosshair',
              }}
            >
              {rightPaneSongs.map((song) => {
                const isSelected = selectedSongIds.has(song.clientRowId);
                return (
                  <Card
                    key={song.clientRowId}
                    data-id={song.clientRowId}
                    className="song-selectable-card"
                    draggable="true"
                    onDragStart={(e) => handleDragStart(e, song.clientRowId)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSelect(song.clientRowId);
                    }}
                    sx={{
                      cursor: 'grab',
                      '&:active': { cursor: 'grabbing' },
                      border: isSelected ? '2px solid #1976d2' : `1px solid #e0e0e0`,
                      borderLeft: `4px solid ${activeCategoryColor}`,
                      bgcolor: isSelected ? '#eef4ff' : '#fff',
                      boxShadow: 'none',
                      transition: 'border 0.15s, background-color 0.15s',
                      userSelect: 'none',
                      height: 'auto',
                      minHeight: '80px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, width: '100%' }}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 700,
                          mb: 0.5,
                          lineHeight: 1.2,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
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

            {rightPaneSongs.length === 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No songs in this category. Drag songs here from other categories to assign them.
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
