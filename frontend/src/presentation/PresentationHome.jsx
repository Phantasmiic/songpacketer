import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Box, TextField, Typography, List, ListItem, ListItemText, ListItemButton, Divider, Paper, IconButton, InputAdornment } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FullscreenButton from './FullscreenButton';

export default function PresentationHome({ 
  songs, 
  showHeaders = false, 
  isSongbaseMode = false,
  title = 'Songbase Presentation',
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

  const filteredSongs = useMemo(() => {
    return numberedSongs.filter(song => {
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
  }, [numberedSongs, showHeaders, searchTerm]);

  // Group filtered songs into sections for column rendering
  const sectionGroups = useMemo(() => {
    const groups = [];
    let currentGroup = { header: null, songs: [] };

    filteredSongs.forEach((item) => {
      if (item.type === 'section') {
        if (currentGroup.header || currentGroup.songs.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = { header: item, songs: [] };
      } else {
        currentGroup.songs.push(item);
      }
    });

    if (currentGroup.header || currentGroup.songs.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }, [filteredSongs]);

  // Pre-index lightweight search strings to ensure 60fps instant search across 1500+ songs
  const searchCache = useMemo(() => {
    if (!isSongbaseMode || !Array.isArray(songs)) return [];
    return songs
      .filter((song) => song.type !== 'section')
      .map((song) => {
        const titleStr = song.title_override || song.title || song.input_text || song.input || 'Untitled';
        const titleLower = titleStr.toLowerCase();
        const rawLyrics = song.chordpro_override || song.chordpro_text || song.lyrics_plain || song.lyrics || '';
        const lyricsClean = rawLyrics.replace(/\[[^\]]*\]/g, '');
        const lyricsLower = lyricsClean.toLowerCase();
        const keyLower = (song.key || '').toLowerCase();
        const snippet = lyricsClean ? lyricsClean.substring(0, 80).replace(/\s+/g, ' ').trim() + '...' : '';

        return {
          song,
          titleStr,
          titleLower,
          lyricsLower,
          keyLower,
          snippet,
        };
      });
  }, [songs, isSongbaseMode]);

  // Fast relevance search scoring for direct Songbase mode capped at top 30 matches
  const songbaseSearchResults = useMemo(() => {
    if (!isSongbaseMode || !searchTerm.trim()) return [];

    const searchLower = searchTerm.trim().toLowerCase();
    const scored = [];

    for (let i = 0; i < searchCache.length; i++) {
      const item = searchCache[i];
      let score = 0;

      if (item.titleLower === searchLower) score = 1000;
      else if (item.titleLower.startsWith(searchLower)) score = 800 + Math.max(0, 100 - item.titleLower.length);
      else if (item.titleLower.includes(searchLower)) score = 600 + Math.max(0, 100 - item.titleLower.length);
      else if (item.keyLower === searchLower) score = 500;
      else if (item.lyricsLower.includes(searchLower)) score = 300;

      if (score > 0) {
        let snippet = item.snippet;
        if (item.lyricsLower.includes(searchLower)) {
          const idx = item.lyricsLower.indexOf(searchLower);
          const start = Math.max(0, idx - 20);
          const end = Math.min(item.lyricsLower.length, idx + 60);
          snippet = (start > 0 ? '...' : '') + item.lyricsLower.substring(start, end).replace(/\s+/g, ' ') + (end < item.lyricsLower.length ? '...' : '');
        }
        scored.push({ ...item.song, score, snippet });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 30);
  }, [searchCache, isSongbaseMode, searchTerm]);

  const renderSongItem = (item, index, showSnippet = false) => {
    const itemTitle = item.title_override || item.title || item.input_text || item.input || 'Untitled Song';
    const songNum = item.songNumber;
    const songKey = item.key;
    const snippet = item.snippet || item.preview;

    return (
      <ListItemButton 
        key={`song-${item.song_id || item.id || index}`} 
        data-testid="presentation-song-card"
        onClick={() => onSelectSong(item)}
        sx={{ 
          py: 1.75, 
          px: 3,
          borderRadius: 2,
          mb: 1,
          border: '1px solid transparent',
          transition: 'all 0.2s ease-in-out',
          '&:hover': { bgcolor: itemHoverBgColor, borderColor: borderColor } 
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 2 }}>
          {songNum ? (
            <Typography 
              variant="h6" 
              sx={{ 
                width: 36, 
                fontWeight: 700, 
                color: accentColor,
                opacity: 0.9,
                fontFamily: 'monospace' 
              }}
            >
              {songNum}.
            </Typography>
          ) : null}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="body1" sx={{ fontSize: '1.25rem', fontWeight: 600, color: textColor }}>
                {itemTitle}
              </Typography>
              {songKey && (
                <Typography variant="caption" sx={{ px: 1, py: 0.2, borderRadius: 1, bgcolor: 'rgba(127,127,127,0.2)', color: accentColor, fontWeight: 700 }}>
                  {songKey}
                </Typography>
              )}
            </Box>
            {showSnippet && snippet && (
              <Typography variant="caption" noWrap sx={{ color: textColor, opacity: 0.7, display: 'block', mt: 0.5, fontSize: '0.85rem' }}>
                {snippet}
              </Typography>
            )}
          </Box>
        </Box>
      </ListItemButton>
    );
  };

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
        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton onClick={onClose} title="Go Back" sx={{ color: textColor }}>
            <ArrowBackIcon />
          </IconButton>
          {isSongbaseMode && (
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.5, color: textColor }}>
              Songbase Presentation
            </Typography>
          )}
        </Box>
        
        {/* Search Input for Packet Mode only; Songbase Mode uses prominent central search */}
        {!isSongbaseMode && (
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
        )}

        <FullscreenButton textColor={textColor} />
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
            {isSongbaseMode ? (
              /* Direct Songbase Search Mode */
              <Box sx={{ width: '100%', maxWidth: 720, mx: 'auto' }}>
                {/* Prominent Centralized Search Input */}
                <Box sx={{ mb: searchTerm.trim() ? 3 : 4, mt: searchTerm.trim() ? 1 : 4, transition: 'all 0.25s ease-in-out' }}>
                  <TextField
                    inputRef={searchInputRef}
                    autoFocus
                    placeholder="Search songs by title, lyrics, or key..."
                    variant="outlined"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ color: accentColor, fontSize: 26, mr: 0.5 }} />
                          </InputAdornment>
                        ),
                        endAdornment: searchTerm ? (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setSearchTerm('')} sx={{ color: textColor, opacity: 0.7 }}>
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </InputAdornment>
                        ) : null
                      },
                    }}
                    sx={{ 
                      width: '100%',
                      bgcolor: 'rgba(127, 127, 127, 0.08)',
                      borderRadius: 3,
                      '& .MuiOutlinedInput-root': {
                        fontSize: '1.2rem',
                        py: 0.5,
                        px: 1.5,
                        color: textColor,
                        '& fieldset': { borderColor: borderColor, borderRadius: 3, borderWidth: 1.5 },
                        '&:hover fieldset': { borderColor: accentColor },
                        '&.Mui-focused fieldset': { borderColor: accentColor },
                      }
                    }}
                  />
                </Box>

                {!searchTerm.trim() ? (
                  /* Initial Empty Search Prompt */
                  <Box sx={{ py: 6, px: 2, textAlign: 'center', opacity: 0.65 }}>
                    <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '1.1rem' }}>
                      Type any title, lyric phrase, or key to search Songbase
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.75 }}>
                      Results will be sorted by best match first
                    </Typography>
                  </Box>
                ) : (
                  /* Single Column Best-Match Search Results */
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    {songbaseSearchResults.map((song, i) => renderSongItem(song, i, true))}
                    {songbaseSearchResults.length === 0 && (
                      <Box sx={{ p: 6, textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ color: textColor, opacity: 0.7 }}>No matching songs found.</Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            ) : (
              /* Standard Packet Setlist View (2 Columns) */
              <List disablePadding>
                {sectionGroups.map((group, groupIdx) => {
                  const mid = Math.ceil(group.songs.length / 2);
                  const leftSongs = group.songs.slice(0, mid);
                  const rightSongs = group.songs.slice(mid);

                  return (
                    <Box key={`group-${groupIdx}`} sx={{ mb: groupIdx < sectionGroups.length - 1 ? 3 : 0 }}>
                      {group.header && (
                        <Box sx={{ mb: 2 }}>
                          {groupIdx > 0 && <Divider sx={{ borderColor: borderColor, mb: 2 }} />}
                          <ListItem sx={{ bgcolor: 'rgba(127, 127, 127, 0.1)', py: 1.5, borderRadius: 1 }}>
                            <ListItemText 
                              primary={group.header.title} 
                              primaryTypographyProps={{ variant: 'h6', fontWeight: 'bold', color: accentColor, letterSpacing: 1 }} 
                            />
                          </ListItem>
                        </Box>
                      )}
                      <Box 
                        sx={{ 
                          display: 'grid', 
                          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, 
                          columnGap: 4, 
                          alignItems: 'start' 
                        }}
                      >
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          {leftSongs.map((song, i) => renderSongItem(song, i))}
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          {rightSongs.map((song, i) => renderSongItem(song, i))}
                        </Box>
                      </Box>
                    </Box>
                  );
                })}

                {filteredSongs.length === 0 && (
                  <Box sx={{ p: 6, textAlign: 'center' }}>
                    <Typography color="text.secondary" variant="h6">No songs found.</Typography>
                  </Box>
                )}
              </List>
            )}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
