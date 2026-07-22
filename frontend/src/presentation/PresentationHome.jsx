import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Box, TextField, Typography, List, ListItem, ListItemText, ListItemButton, Divider, Paper, IconButton, InputAdornment } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function PresentationHome({ 
  songs, 
  showHeaders = false, 
  theme = { bg: '#000000', text: '#ffffff', chord: '#64b5f6' }, 
  onSelectSong, 
  onClose, 
  onOpenSettings 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);

  // Theme styles derived from custom theme prop
  const bgColor = theme.bg || '#000000';
  const textColor = theme.text || '#ffffff';
  const accentColor = theme.chord || '#64b5f6';
  
  // Calculate relative borders and surfaces
  const paperBgColor = 'rgba(127, 127, 127, 0.06)';
  const itemHoverBgColor = 'rgba(127, 127, 127, 0.15)';
  const borderColor = 'rgba(127, 127, 127, 0.2)';

  // Assign sequential song numbers to non-section items
  const numberedSongs = useMemo(() => {
    let songCount = 0;
    const list = Array.isArray(songs) ? songs : [];
    return list.map((item) => {
      if (item.type === 'section') return item;
      songCount += 1;
      return { ...item, songNumber: songCount };
    });
  }, [songs]);

  // Intercept Cmd+F / Ctrl+F or '/' so browser quick find doesn't steal focus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredSongs = numberedSongs.filter(song => {
    if (song.type === 'section') {
      return showHeaders;
    }
    if (!searchTerm.trim()) return true;

    const searchLower = searchTerm.toLowerCase();
    const title = (song.title_override || song.title || song.input_text || song.input || '').toLowerCase();
    const lyrics = (song.chordpro_override || song.chordpro_text || song.lyrics || '').toLowerCase();
    const numStr = String(song.songNumber || '');
    return title.includes(searchLower) || lyrics.includes(searchLower) || numStr === searchLower;
  });

  return (
    <Box sx={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      bgcolor: bgColor,
      color: textColor,
      overflow: 'hidden',
      transition: 'background-color 0.2s, color 0.2s'
    }}>
      {/* Header Bar */}
      <Box sx={{ height: 72, boxSizing: 'border-box', p: 2, px: 4, display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid', borderColor: borderColor }}>
        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={onClose} title="Go Back" sx={{ color: textColor }}>
            <ArrowBackIcon />
          </IconButton>
        </Box>
        
        {/* Search Input */}
        <TextField
          inputRef={searchInputRef}
          placeholder="Search"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: textColor, opacity: 0.7 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ 
            width: 280, 
            bgcolor: paperBgColor,
            borderRadius: 1,
            '& .MuiOutlinedInput-root': {
              color: textColor,
              '& fieldset': { borderColor: borderColor },
              '&:hover fieldset': { borderColor: textColor },
            }
          }}
        />

        <IconButton onClick={onOpenSettings} title="Settings" sx={{ color: textColor }}>
          <SettingsIcon />
        </IconButton>
      </Box>

      {/* Main Presentation Homepage Content */}
      <Box sx={{ height: 'calc(100% - 72px)', boxSizing: 'border-box', overflowY: 'auto', p: { xs: 3, md: 6 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <Paper 
            elevation={0}
            sx={{ 
              width: '100%', 
              maxWidth: 1200, 
              bgcolor: paperBgColor, 
              color: textColor,
              borderRadius: 3, 
              border: '1px solid',
              borderColor: borderColor,
              overflow: 'hidden',
              p: 3
            }} 
          >
          <List disablePadding sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, 
            columnGap: 4,
            rowGap: 0.5
          }}>
            {filteredSongs.map((item, index) => {
              if (item.type === 'section') {
                return (
                  <Box key={`section-${index}`} sx={{ gridColumn: '1 / -1', mt: index > 0 ? 2 : 0, mb: 1 }}>
                    {index > 0 && <Divider sx={{ borderColor: borderColor }} />}
                    <ListItem sx={{ bgcolor: 'rgba(127, 127, 127, 0.1)', py: 1.5, borderRadius: 1 }}>
                      <ListItemText 
                        primary={item.title} 
                        primaryTypographyProps={{ variant: 'h6', fontWeight: 'bold', color: accentColor, letterSpacing: 1 }} 
                      />
                    </ListItem>
                  </Box>
                );
              }
              
              const title = item.title_override || item.title || item.input_text || item.input || 'Untitled Song';
              const songNum = item.songNumber;

              return (
                <ListItemButton 
                  key={`song-${item.song_id || index}`} 
                  onClick={() => onSelectSong(item)}
                  sx={{ 
                    py: 1.5, 
                    px: 3,
                    borderRadius: 1.5,
                    transition: 'background-color 0.2s',
                    '&:hover': { bgcolor: itemHoverBgColor } 
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        width: 48, 
                        fontWeight: 700, 
                        color: accentColor,
                        opacity: 0.9,
                        fontFamily: 'monospace' 
                      }}
                    >
                      {songNum}.
                    </Typography>
                    <ListItemText 
                      primary={title} 
                      primaryTypographyProps={{ fontSize: '1.25rem', fontWeight: 500, color: textColor }} 
                    />
                  </Box>
                </ListItemButton>
              );
            })}
            {filteredSongs.length === 0 && (
              <Box sx={{ p: 6, textAlign: 'center', gridColumn: '1 / -1' }}>
                <Typography color="text.secondary" variant="h6">No songs found.</Typography>
              </Box>
            )}
          </List>
        </Paper>
        </Box>
      </Box>
    </Box>
  );
}
