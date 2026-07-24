import React, { useState, useEffect } from 'react';
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, FormControl, InputLabel, Select, MenuItem, FormControlLabel, Typography, Switch, TextField, Divider, Slider, CircularProgress } from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import CheckIcon from '@mui/icons-material/Check';
import PresentationHome from './PresentationHome';
import PresentationSlide from './PresentationSlide';
import { parseChordProBlocks } from './chordproParser';

const PRESET_THEMES = {
  dark: { bg: '#000000', text: '#ffffff', chord: '#64b5f6' },
  light: { bg: '#ffffff', text: '#000000', chord: '#1976d2' },
  sepia: { bg: '#f4ebd9', text: '#4a3b32', chord: '#b35c00' },
};

export default function PresentationMode({ packetDetails, isSongbaseMode = false, isLoading, onClose }) {
  // Cache packet details for reloads
  const [cachedDetails, setCachedDetails] = useState(() => {
    try {
      const cached = localStorage.getItem('presentationPacketCache');
      return (cached && cached !== 'undefined' && cached !== 'null') ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  
  const [debugHandler, setDebugHandler] = useState(null);
  const [debugCopied, setDebugCopied] = useState(false);

  const handleOpenSettings = (handlerFn) => {
    if (typeof handlerFn === 'function') {
      setDebugHandler(() => handlerFn);
    } else {
      setDebugHandler(null);
    }
    setSettingsOpen(true);
  };
  
  useEffect(() => {
    if (packetDetails && packetDetails.length > 0) {
      localStorage.setItem('presentationPacketCache', JSON.stringify(packetDetails));
      setCachedDetails(packetDetails);
    }
  }, [packetDetails]);

  const activeDetails = (packetDetails && (packetDetails.length > 0 || isSongbaseMode)) ? packetDetails : (cachedDetails || []);

  const [activeSong, setActiveSong] = useState(() => {
    try {
      // 1. Check URL first
      const path = window.location.pathname;
      if (path.startsWith('/present/')) {
        const id = path.split('/')[2];
        const cached = localStorage.getItem('presentationPacketCache');
        const details = (cached && cached !== 'undefined' && cached !== 'null') ? JSON.parse(cached) : [];
        const songFromUrl = details.find(s => String(s.song_id) === id);
        if (songFromUrl) return songFromUrl;
      }

      // 2. Fallback to localStorage active song
      const id = localStorage.getItem('presentationActiveSongId');
      if (id && activeDetails.length > 0) {
        const found = activeDetails.find(s => String(s.song_id) === id);
        if (found) return found;
      }
    } catch (e) {
      // fallback
    }
    return null;
  });

  // Sync URL when activeSong changes
  useEffect(() => {
    if (activeSong && activeSong.song_id) {
      const newPath = `/present/${activeSong.song_id}`;
      if (window.location.pathname !== newPath) {
        window.history.pushState({}, '', newPath);
      }
      localStorage.setItem('presentationActiveSongId', String(activeSong.song_id));
    } else {
      if (window.location.pathname.startsWith('/present/')) {
        window.history.pushState({}, '', '/present');
      }
      localStorage.removeItem('presentationActiveSongId');
    }
  }, [activeSong]);

  // Handle Browser Back/Forward navigation inside Presentation Mode
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/present') {
        setActiveSong(null);
      } else if (path.startsWith('/present/')) {
        const id = path.split('/')[2];
        const song = activeDetails.find(s => String(s.song_id) === id);
        if (song) setActiveSong(song);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeDetails]);

  // Direct Songbase Mode should always start on PresentationHome index
  useEffect(() => {
    if (isSongbaseMode) {
      setActiveSong(null);
    }
  }, [isSongbaseMode]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDraggingTextSize, setIsDraggingTextSize] = useState(false);
  
  // Customization presets & custom colors
  const [themeMode, setThemeMode] = useState('dark'); // 'dark', 'light', 'sepia', 'custom'
  const [customColors, setCustomColors] = useState({
    bg: '#000000',
    text: '#ffffff',
    chord: '#64b5f6',
  });
  
  const [showChords, setShowChords] = useState(() => {
    return localStorage.getItem('presentationShowChords') === 'true';
  });

  const [autoChorus, setAutoChorus] = useState(() => {
    return localStorage.getItem('presentationAutoChorus') !== 'false';
  });

  const [fullSongMode, setFullSongMode] = useState(() => {
    return localStorage.getItem('presentationFullSongMode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('presentationFullSongMode', fullSongMode);
  }, [fullSongMode]);

  useEffect(() => {
    localStorage.setItem('presentationShowChords', showChords);
  }, [showChords]);

  useEffect(() => {
    localStorage.setItem('presentationAutoChorus', autoChorus);
  }, [autoChorus]);
  
  const [showHeaders, setShowHeaders] = useState(false); // Default: do not show section headers
  const [showSlideLabels, setShowSlideLabels] = useState(false); // Default: do not show slide section labels
  const [slideManualFontPx, setSlideManualFontPx] = useState(null); // Slide manual font px
  const [isSlideAuto, setIsSlideAuto] = useState(true); // Slide auto font size toggle
  const [slideAutoFontPx, setSlideAutoFontPx] = useState(() => Math.round((typeof window !== 'undefined' ? window.innerHeight : 800) * 0.045));
  const [fullSongFontPx, setFullSongFontPx] = useState(36); // Full song current calculated font size
  const [fullSongManualFontPx, setFullSongManualFontPx] = useState(null); // Full song manual font size
  const [isFullSongAuto, setIsFullSongAuto] = useState(true); // Full song auto font size toggle

  const handlePresetChange = (mode) => {
    setThemeMode(mode);
    if (PRESET_THEMES[mode]) {
      setCustomColors(PRESET_THEMES[mode]);
    }
  };

  const handleColorChange = (key, value) => {
    setThemeMode('custom');
    setCustomColors(prev => ({ ...prev, [key]: value }));
  };

  const handleSelectSong = (song) => {
    setActiveSong(song);
  };

  const handleGoHome = () => {
    setActiveSong(null);
  };

  const handleAutoSize = () => { console.log("handleAutoSize RUNNING");
    if (!activeSong) return;
    
    const rawText = activeSong.chordpro_override || activeSong.chordpro_text || '';
    if (!rawText) return;
    const rawBlocks = parseChordProBlocks(rawText, null);
    
    const wh = window.innerHeight;
    const ww = window.innerWidth;
    const availableWidthPx = Math.max(300, ww - 48); // 24px padding left & right
    
    const availablePx = wh - 240;

    let bestMultiplier = 1.0;
    let minSplits = Infinity;
    let minLineWraps = Infinity;
    
    for (let m = 3.5; m >= 1.0; m -= 0.1) {
      const baseFontSizePx = (4.5 * wh / 100) * m;
      const lyricHeightPx = (baseFontSizePx * 1.5) + 8;
      const chordHeightPx = (baseFontSizePx * 0.8) + 8;
      
      const paginationOptions = { 
        availablePx, 
        lyricHeightPx, 
        chordHeightPx, 
        showChords,
        availableWidthPx,
        fontSizePx: baseFontSizePx
      };
      const paginatedBlocks = parseChordProBlocks(rawText, paginationOptions);
      const numSplits = paginatedBlocks.length;
      
      // Calculate total line wraps (extra line breaks) across all raw lines for this font size
      let totalLineWraps = 0;
      for (const block of rawBlocks) {
        for (const line of block.lines) {
          const rawStr = typeof line === 'string' ? line : (line?.lyric || '');
          const pureText = rawStr.replace(/\[[^\]]*\]/g, '').replace(/^(verse\s*\d*[:\.\)]?\s*|v\s*\d+[:\.\)]?\s*|chorus\s*\d*[:\.\)]?\s*|bridge\s*\d*[:\.\)]?\s*|\d+[:\.\)]?\s+)/i, '');
          const estWidth = pureText.length * baseFontSizePx * 0.53;
          const wraps = Math.max(0, Math.ceil(estWidth / availableWidthPx) - 1);
          totalLineWraps += wraps;
        }
      }

      // Hierarchy:
      // 1. Minimum slide splits (numSplits)
      // 2. Minimum line wraps (totalLineWraps)
      // 3. Largest text size multiplier (looping 3.5 -> 1.0 prefers larger m)
      if (numSplits < minSplits) {
        minSplits = numSplits;
        minLineWraps = totalLineWraps;
        bestMultiplier = m;
      } else if (numSplits === minSplits) {
        if (totalLineWraps < minLineWraps) {
          minLineWraps = totalLineWraps;
          bestMultiplier = m;
        }
      }
    }
    const calculatedPx = Math.round((4.5 * wh / 100) * bestMultiplier);
    setSlideAutoFontPx(calculatedPx);
  };

  // Automatically compute optimal text size when a song is navigated to (or layout modes change)
  useEffect(() => {
    if (activeSong && !fullSongMode) {
      handleAutoSize();
    }
  }, [activeSong?.song_id, showChords, fullSongMode]);

  return (
    <Box 
      sx={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        zIndex: 9999, 
        bgcolor: customColors.bg,
        color: customColors.text,
        overflow: 'hidden'
      }}
    >
      {isLoading && activeDetails.length === 0 ? (
        <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress color="inherit" />
        </Box>
      ) : !activeSong ? (
        <PresentationHome 
          songs={activeDetails} 
          showHeaders={showHeaders}
          isSongbaseMode={isSongbaseMode}
          theme={customColors}
          onSelectSong={handleSelectSong} 
          onClose={onClose}
          onOpenSettings={handleOpenSettings}
        />
      ) : (
        <PresentationSlide 
          song={activeSong} 
          onGoHome={handleGoHome} 
          theme={customColors} 
          slideManualFontPx={slideManualFontPx}
          slideAutoFontPx={slideAutoFontPx}
          isSlideAuto={isSlideAuto}
          setSlideAutoFontPx={setSlideAutoFontPx}
          showSlideLabels={showSlideLabels}
          showChords={showChords}
          setShowChords={setShowChords}
          autoChorus={autoChorus}
          setAutoChorus={setAutoChorus}
          fullSongMode={fullSongMode}
          setFullSongMode={setFullSongMode}
          fullSongFontPx={fullSongFontPx}
          setFullSongFontPx={setFullSongFontPx}
          fullSongManualFontPx={fullSongManualFontPx}
          setFullSongManualFontPx={setFullSongManualFontPx}
          isFullSongAuto={isFullSongAuto}
          setIsFullSongAuto={setIsFullSongAuto}
          onOpenSettings={handleOpenSettings}
        />
      )}

      {/* Settings Dialog with higher zIndex so it displays over presentation mode overlay */}
      <Dialog 
        open={settingsOpen} 
        onClose={() => setSettingsOpen(false)}
        sx={{ 
          zIndex: 13000,
          '& .MuiBackdrop-root': {
            opacity: isDraggingTextSize ? 0.05 : undefined,
            transition: 'opacity 0.2s',
          }
        }}
        PaperProps={{
          sx: {
            transition: 'background-color 0.2s, box-shadow 0.2s',
            bgcolor: isDraggingTextSize ? 'transparent' : 'background.paper',
            boxShadow: isDraggingTextSize ? 'none' : 24,
            backgroundImage: isDraggingTextSize ? 'none' : undefined,
          }
        }}
      >
        <DialogTitle sx={{ opacity: isDraggingTextSize ? 0.1 : 1, transition: 'opacity 0.2s' }}>
          Presentation Settings
        </DialogTitle>
        <DialogContent sx={{ minWidth: 340 }}>
          {/* Theme Section */}
          <Box sx={{ opacity: isDraggingTextSize ? 0.1 : 1, transition: 'opacity 0.2s' }}>
            <Typography variant="subtitle1" sx={{ mt: 1, mb: 1, fontWeight: 'bold' }}>Color Theme</Typography>
            <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
              <InputLabel id="theme-select-label">Select Theme</InputLabel>
              <Select
                labelId="theme-select-label"
                id="theme-select"
                value={themeMode}
                label="Select Theme"
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                <MenuItem value="dark">Dark (Black / White / Blue)</MenuItem>
                <MenuItem value="light">Light (White / Black / Dark Blue)</MenuItem>
                <MenuItem value="sepia">Sepia (Cream / Dark Brown / Rust)</MenuItem>
                <MenuItem value="custom">Custom Colors</MenuItem>
              </Select>
            </FormControl>

            {/* Custom Colors - Only show if custom mode selected */}
            {themeMode === 'custom' && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 'bold' }}>Custom Colors</Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Background</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <input 
                        type="color" 
                        value={customColors.bg} 
                        onChange={(e) => handleColorChange('bg', e.target.value)}
                        style={{ width: 36, height: 36, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                      />
                      <TextField 
                        size="small" 
                        value={customColors.bg} 
                        onChange={(e) => handleColorChange('bg', e.target.value)}
                        sx={{ width: 100 }}
                      />
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Text Color</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <input 
                        type="color" 
                        value={customColors.text} 
                        onChange={(e) => handleColorChange('text', e.target.value)}
                        style={{ width: 36, height: 36, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                      />
                      <TextField 
                        size="small" 
                        value={customColors.text} 
                        onChange={(e) => handleColorChange('text', e.target.value)}
                        sx={{ width: 100 }}
                      />
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>Chord Color</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <input 
                        type="color" 
                        value={customColors.chord} 
                        onChange={(e) => handleColorChange('chord', e.target.value)}
                        style={{ width: 36, height: 36, border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                      />
                      <TextField 
                        size="small" 
                        value={customColors.chord} 
                        onChange={(e) => handleColorChange('chord', e.target.value)}
                        sx={{ width: 100 }}
                      />
                    </Box>
                  </Box>
                </Box>
              </>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 'bold' }}>Slide Display Options</Typography>
          </Box>
          
          {/* Text Size Slider (Slide Mode vs Full Song Mode) */}
          {!fullSongMode ? (
            <Box 
              sx={{ 
                mb: 3, 
                p: 1.5, 
                borderRadius: 2, 
                bgcolor: isDraggingTextSize ? 'transparent' : 'transparent',
                transition: 'all 0.2s',
                position: 'relative',
                zIndex: 10
              }}
              onMouseDown={() => setIsDraggingTextSize(true)}
              onTouchStart={() => setIsDraggingTextSize(true)}
              onMouseUp={() => setIsDraggingTextSize(false)}
              onTouchEnd={() => setIsDraggingTextSize(false)}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Slide Text Size</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button 
                    size="small" 
                    variant={isSlideAuto ? 'contained' : 'outlined'} 
                    onClick={() => {
                      setIsSlideAuto(true);
                      setSlideManualFontPx(null);
                    }} 
                    sx={{ py: 0, minWidth: 0, textTransform: 'none', height: 24 }}
                  >
                    Auto
                  </Button>
                  <Typography variant="body2" sx={{ fontWeight: 700, minWidth: '45px', textAlign: 'right' }}>
                    {isSlideAuto 
                      ? `${Math.round(slideAutoFontPx || 38)}px` 
                      : `${Math.round(slideManualFontPx || slideAutoFontPx || 38)}px`}
                  </Typography>
                </Box>
              </Box>
              <Slider
                value={isSlideAuto ? (slideAutoFontPx || 38) : (slideManualFontPx || slideAutoFontPx || 38)}
                onChange={(e, val) => {
                  setIsSlideAuto(false);
                  setSlideManualFontPx(val);
                }}
                onChangeCommitted={() => setIsDraggingTextSize(false)}
                min={25}
                max={110}
                step={1}
                marks={[
                  { value: 25, label: '25px' },
                  { value: 65, label: '65px' },
                  { value: 110, label: '110px' }
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${Math.round(v)}px`}
              />
            </Box>
          ) : (
            <Box 
              sx={{ 
                mb: 3, 
                p: 1.5, 
                borderRadius: 2, 
                bgcolor: isDraggingTextSize ? 'transparent' : 'transparent',
                transition: 'all 0.2s',
                position: 'relative',
                zIndex: 10
              }}
              onMouseDown={() => setIsDraggingTextSize(true)}
              onTouchStart={() => setIsDraggingTextSize(true)}
              onMouseUp={() => setIsDraggingTextSize(false)}
              onTouchEnd={() => setIsDraggingTextSize(false)}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Full Song Text Size</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button 
                    size="small" 
                    variant={isFullSongAuto ? 'contained' : 'outlined'} 
                    onClick={() => {
                      setIsFullSongAuto(true);
                      setFullSongManualFontPx(null);
                    }} 
                    sx={{ py: 0, minWidth: 0, textTransform: 'none', height: 24 }}
                  >
                    Auto
                  </Button>
                  <Typography variant="body2" sx={{ fontWeight: 700, minWidth: '45px', textAlign: 'right' }}>
                    {isFullSongAuto 
                      ? `${Math.round(fullSongFontPx || 32)}px` 
                      : `${Math.round(fullSongManualFontPx || fullSongFontPx || 32)}px`}
                  </Typography>
                </Box>
              </Box>
              <Slider
                value={isFullSongAuto ? (fullSongFontPx || 32) : (fullSongManualFontPx || fullSongFontPx || 32)}
                onChange={(e, val) => {
                  setIsFullSongAuto(false);
                  setFullSongManualFontPx(val);
                }}
                onChangeCommitted={() => setIsDraggingTextSize(false)}
                min={14}
                max={72}
                step={1}
                marks={[
                  { value: 14, label: '14px' },
                  { value: 36, label: '36px' },
                  { value: 72, label: '72px' }
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${Math.round(v)}px`}
              />
            </Box>
          )}

          <Box sx={{ opacity: isDraggingTextSize ? 0.1 : 1, transition: 'opacity 0.2s' }}>
            <FormControlLabel
              control={
                <Switch 
                  checked={showSlideLabels} 
                  onChange={(e) => setShowSlideLabels(e.target.checked)} 
                  color="primary"
                />
              }
              label="Show Verse/Chorus labels on slides"
            />
            {/* Song List Options - Only show on Homepage Settings */}
            {!activeSong && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>Song List Options</Typography>
                <FormControlLabel
                  control={
                    <Switch 
                      checked={showHeaders} 
                      onChange={(e) => setShowHeaders(e.target.checked)} 
                      color="primary"
                    />
                  }
                  label="Show Section Headers in Song List"
                />
              </>
            )}

            {/* Debug Copy Info button inside Settings dialog */}
            {debugHandler && (
              <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Button
                  size="small"
                  variant="outlined"
                  color={debugCopied ? 'success' : 'inherit'}
                  startIcon={debugCopied ? <CheckIcon /> : <BugReportIcon />}
                  onClick={() => {
                    debugHandler();
                    setDebugCopied(true);
                    setTimeout(() => setDebugCopied(false), 2000);
                  }}
                  sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
                >
                  {debugCopied ? 'Copied Debug JSON!' : 'Copy Debug Info'}
                </Button>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ opacity: isDraggingTextSize ? 0.1 : 1, transition: 'opacity 0.2s' }}>
          <Button onClick={() => setSettingsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
