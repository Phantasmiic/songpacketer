import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, IconButton, Button, Tooltip } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import BugReportIcon from '@mui/icons-material/BugReport';
import FullscreenButton from './FullscreenButton';
import { parseChordProBlocks } from './chordproParser';

// Chromatic scales for chord transposition
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ALT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function transposeSingleChord(chord, shift) {
  if (!chord || shift === 0) return chord;
  
  const parts = chord.split('/');
  const transposedParts = parts.map(part => {
    const match = part.match(/^([A-G][#b]?)(.*)/);
    if (!match) return part;
    const [, note, suffix] = match;
    
    let index = NOTES.indexOf(note);
    if (index === -1) index = ALT_NOTES.indexOf(note);
    if (index === -1) return part;
    
    let newIndex = (index + shift) % 12;
    if (newIndex < 0) newIndex += 12;
    
    const useFlats = note.includes('b') || ['F', 'Bb', 'Eb', 'Ab', 'Db'].includes(note);
    const newNote = useFlats ? ALT_NOTES[newIndex] : NOTES[newIndex];
    return newNote + suffix;
  });
  
  return transposedParts.join('/');
}

function transposeChordProText(text, shift) {
  if (!text || shift === 0) return text;
  return text.replace(/\[(.*?)\]/g, (match, chord) => {
    return `[${transposeSingleChord(chord, shift)}]`;
  });
}

function getSlideMeta(label = '') {
  const splitMatch = label.match(/^(.*?)\s*\((\d+)\/(\d+)\)$/);
  let baseLabel = label;
  let partIndex = 1;
  let totalParts = 1;
  
  if (splitMatch) {
    baseLabel = splitMatch[1].trim();
    partIndex = parseInt(splitMatch[2], 10);
    totalParts = parseInt(splitMatch[3], 10);
  }

  const lowerBase = baseLabel.toLowerCase();
  let displayChar = '';
  
  if (lowerBase.startsWith('chorus')) {
    displayChar = 'C';
  } else if (lowerBase.startsWith('bridge')) {
    const num = baseLabel.match(/\d+/);
    displayChar = num ? `B${num[0]}` : 'B';
  } else if (lowerBase.startsWith('verse')) {
    const num = baseLabel.match(/\d+/);
    displayChar = num ? num[0] : 'V';
  } else if (lowerBase.startsWith('pre')) {
    displayChar = 'P';
  } else if (lowerBase.startsWith('intro')) {
    displayChar = 'I';
  } else if (lowerBase.startsWith('outro')) {
    displayChar = 'O';
  } else {
    displayChar = baseLabel.substring(0, 2).toUpperCase();
  }

  return {
    baseLabel,
    partIndex,
    totalParts,
    isSplit: totalParts > 1,
    displayChar
  };
}

function getUpperLeftLabel(block) {
  if (!block || !block.label) return '';
  const label = block.label.replace(/\s*\(\d+\/\d+\)$/, '').trim();
  const lower = label.toLowerCase();
  
  if (lower.startsWith('verse')) {
    const num = label.match(/\d+/);
    return num ? num[0] : 'Verse';
  }
  if (lower.startsWith('chorus')) {
    return 'Chorus';
  }
  return label;
}

export default function PresentationSlide({ 
  song, 
  onGoHome, 
  theme = { bg: '#000000', text: '#ffffff', chord: '#64b5f6' },
  textSizeMultiplier = 1.0,
  showSlideLabels = false,
  showChords,
  setShowChords,
  autoChorus,
  setAutoChorus,
  fullSongMode,
  setFullSongMode,
  onOpenSettings 
}) {
  const effectiveShowChords = fullSongMode ? false : showChords;
  const [currentBlockIndex, setCurrentBlockIndex] = useState(() => {
    const cached = localStorage.getItem('presentationSlideIndex');
    const cachedSongId = localStorage.getItem('presentationSlideSongId');
    return (cached && cachedSongId === song.song_id) ? parseInt(cached, 10) : 0;
  });

  useEffect(() => {
    localStorage.setItem('presentationSlideIndex', currentBlockIndex);
    localStorage.setItem('presentationSlideSongId', song.song_id);
  }, [currentBlockIndex, song.song_id]);

  const [chordShift, setChordShift] = useState(song.capo || 0);
  const [debugCopied, setDebugCopied] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const alwaysShowControls = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('alwaysShowControls') === 'true' || 
           params.get('agent') === 'true' || 
           params.get('showControls') === 'true' || 
           localStorage.getItem('alwaysShowControls') === 'true';
  }, []);

  const effectiveShowControls = alwaysShowControls || showControls;

  useEffect(() => {
    let timer = null;
    const handleMouseMove = () => {
      setShowControls(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleMouseMove);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Setup theme styles
  const bgColor = theme.bg || '#000000';
  const textColor = theme.text || '#ffffff';
  const chordColor = theme.chord || '#64b5f6';

  const [windowHeight, setWindowHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);

  useEffect(() => {
    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const paginationOptions = useMemo(() => {
    const availablePx = windowHeight - 240; // Safely subtract padding and UI elements
    const baseFontSizePx = (4.5 * windowHeight / 100) * textSizeMultiplier;
    
    // A single text line uses about 1.5em line height + 8px margin bottom
    const lyricHeightPx = (baseFontSizePx * 1.5) + 8;
    
    // Chords use 0.8em font size + 1.0 line height + extra 8px margin
    const chordHeightPx = (baseFontSizePx * 0.8) + 8;
    
    // Approximate available width
    const ww = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const availableWidthPx = Math.max(300, ww - 48);
    
    return { 
      availablePx, 
      lyricHeightPx, 
      chordHeightPx, 
      showChords: effectiveShowChords,
      availableWidthPx,
      fontSizePx: baseFontSizePx
    };
  }, [windowHeight, textSizeMultiplier, effectiveShowChords]);

  // Parse blocks once (with optional chord transposition)
  const rawBlocks = useMemo(() => {
    const rawText = song.chordpro_override || song.chordpro_text || '';
    const transposedText = chordShift !== 0 ? transposeChordProText(rawText, chordShift) : rawText;
    return parseChordProBlocks(transposedText, fullSongMode ? null : paginationOptions);
  }, [song, paginationOptions, chordShift, fullSongMode]);

  // Ref for the full-song container, used for DOM-based auto-sizing
  const fullSongRef = useRef(null);
  const [fullSongFontPx, setFullSongFontPx] = useState(16);
  const [fullSongColumns, setFullSongColumns] = useState('auto');


  const hasChorus = useMemo(() => rawBlocks.some(b => b.type === 'chorus'), [rawBlocks]);

  // Build the presentation sequence (handling repeating chorus)
  const presentationSequence = useMemo(() => {
    if (!autoChorus || fullSongMode || rawBlocks.length === 0) return rawBlocks;
    
    // Find the first chorus to use as the repeating chorus
    const firstChorusBlock = rawBlocks.find(b => b.type === 'chorus');
    if (!firstChorusBlock) return rawBlocks;

    const chorusBaseLabel = getSlideMeta(firstChorusBlock.label).baseLabel;
    const fullChorusBlocks = rawBlocks.filter(b => b.type === 'chorus' && getSlideMeta(b.label).baseLabel === chorusBaseLabel);

    const sequence = [];
    for (let i = 0; i < rawBlocks.length; i++) {
      const currentBlock = rawBlocks[i];
      sequence.push(currentBlock);
      
      if (currentBlock.type === 'verse') {
        const currentMeta = getSlideMeta(currentBlock.label);
        const nextBlock = rawBlocks[i + 1];
        
        let isLastChunkOfVerse = true;
        if (nextBlock) {
          const nextMeta = getSlideMeta(nextBlock.label);
          if (nextMeta.baseLabel === currentMeta.baseLabel) {
            isLastChunkOfVerse = false;
          }
        }
        
        if (isLastChunkOfVerse && (!nextBlock || nextBlock.type !== 'chorus')) {
          sequence.push(...fullChorusBlocks);
        }
      }
    }
    return sequence;
  }, [rawBlocks, autoChorus, fullSongMode]);

  const optimalColumnWidthEm = useMemo(() => {
    const lengths = [];
    for (const block of rawBlocks) {
      for (const line of block.lines) {
        let text = typeof line === 'string' ? line : (line?.lyric || '');
        text = text.replace(/\[[^\]]*\]/g, '').trim(); // strip chords
        if (text.length > 0) lengths.push(text.length);
      }
    }
    if (lengths.length === 0) return 16;
    
    lengths.sort((a, b) => a - b);
    // Use the 85th percentile to ignore extreme outliers (like copyright lines)
    const p85 = lengths[Math.floor(lengths.length * 0.85)];
    const calculated = p85 * 0.55; // roughly 0.55em per char
    
    // Cap between 15em and 20em. >20em is too wide for readability and hurts multi-column packing.
    return Math.max(15, Math.min(20, calculated));
  }, [rawBlocks]);

  // DOM-measurement auto-sizing for full song mode.
  // Binary search for the largest font-size (px) where the content doesn't overflow.
  // We use a ResizeObserver to re-run layout checks whenever the container size changes.
  useEffect(() => {
    if (!fullSongMode || !fullSongRef.current) return;

    const el = fullSongRef.current;

    const resizeObserver = new ResizeObserver(() => {
      // Temporarily remove overflow:hidden so we can measure true scroll dimensions
      el.style.overflow = 'auto';

      const fits = (sizePx) => {
        el.style.fontSize = `${sizePx}px`;
        const colWidthPx = optimalColumnWidthEm * sizePx;
        const colGapPx = 1.2 * sizePx;
        const maxCols = Math.max(1, Math.floor((el.clientWidth + colGapPx) / (colWidthPx + colGapPx)));
        el.style.columnCount = maxCols;
        // Force reflow
        void el.offsetHeight;
        // With CSS columns, overflow shows as scrollWidth > clientWidth (extra columns)
        // or scrollHeight > clientHeight (content too tall for a single column to fill)
        return el.scrollWidth <= el.clientWidth + 2 && el.scrollHeight <= el.clientHeight + 2;
      };

      let lo = 6;
      let hi = 80;
      let best = lo;

      // Binary search: find the largest font that fits
      while (hi - lo > 0.5) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) {
          best = mid;
          lo = mid;
        } else {
          hi = mid;
        }
      }

      const finalSize = Math.floor(best * 2) / 2; // round to nearest 0.5
      setFullSongFontPx(finalSize);
      const colWidthPx = optimalColumnWidthEm * finalSize;
      const colGapPx = 1.2 * finalSize;
      const finalCols = Math.max(1, Math.floor((el.clientWidth + colGapPx) / (colWidthPx + colGapPx)));
      setFullSongColumns(finalCols);
      el.style.fontSize = `${finalSize}px`;
      el.style.columnCount = finalCols;
      el.style.overflow = 'hidden';
    });

    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [fullSongMode, presentationSequence, optimalColumnWidthEm]);

  // Pre-calculate slide metadata for grouping bars
  const slideMetas = useMemo(() => {
    return presentationSequence.map(b => getSlideMeta(b.label));
  }, [presentationSequence]);

  // Group split slides together for rendering as continuous rectangles
  const groupedSlides = useMemo(() => {
    const groups = [];
    let currentGroup = null;

    presentationSequence.forEach((block, idx) => {
      const meta = slideMetas[idx];
      if (!currentGroup) {
        currentGroup = { baseLabel: meta.baseLabel, slides: [{ idx, block, meta }] };
      } else if (meta.baseLabel === currentGroup.baseLabel && meta.isSplit) {
        currentGroup.slides.push({ idx, block, meta });
      } else {
        groups.push(currentGroup);
        currentGroup = { baseLabel: meta.baseLabel, slides: [{ idx, block, meta }] };
      }
    });
    if (currentGroup) {
      groups.push(currentGroup);
    }
    return groups;
  }, [presentationSequence, slideMetas]);

  const handleCopyDebugInfo = () => {
    const sId = song.song_id || song.id || null;
    const payload = {
      songId: sId,
      songbaseUrl: sId ? `https://songbase.life/${sId}` : null,
      title: song.title_override || song.title || song.input_text || '',
      autoChorus,
      fullSongMode,
      showChords: effectiveShowChords,
      chordShift,
      textSizeMultiplier,
      windowHeight,
      rawBlocksCount: rawBlocks.length,
      presentationSequenceCount: presentationSequence.length,
      currentSlideIndex: currentBlockIndex,
      slides: presentationSequence.map((block, idx) => ({
        slideIndex: idx,
        type: block.type,
        label: block.label,
        lineCount: block.lines.length,
        firstLineLyric: block.lines[0]?.lyric || '',
        lastLineLyric: block.lines[block.lines.length - 1]?.lyric || ''
      })),
      fullSongFontPx,
      rawTextSample: (song.chordpro_override || song.chordpro_text || '').slice(0, 300)
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setDebugCopied(true);
      setTimeout(() => setDebugCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy debug info:', err);
    });
  };

  // Safe clamp for index
  useEffect(() => {
    if (currentBlockIndex >= presentationSequence.length) {
      setCurrentBlockIndex(Math.max(0, presentationSequence.length - 1));
    }
  }, [presentationSequence, currentBlockIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't navigate if focused inside an input or text field
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        return;
      }
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        handleNext();
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        onGoHome();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentBlockIndex, presentationSequence.length]);

  const handleNext = () => {
    if (currentBlockIndex < presentationSequence.length - 1) {
      setCurrentBlockIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentBlockIndex > 0) {
      setCurrentBlockIndex(prev => prev - 1);
    }
  };

  const currentBlock = presentationSequence[currentBlockIndex];

  if (!currentBlock) {
    return (
      <Box sx={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: bgColor, color: textColor }}>
        <Typography variant="h4">No lyrics available.</Typography>
        <IconButton onClick={onGoHome} sx={{ position: 'absolute', top: 16, left: 16, color: textColor }}>
          <HomeIcon fontSize="large" />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: '100vh', 
      width: '100vw', 
      bgcolor: bgColor, 
      color: textColor,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      transition: 'background-color 0.2s, color 0.2s'
    }}>
      {/* Top Bar (hidden by default, fades in on mouse movement) */}
      <Box 
        sx={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          p: 2, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          zIndex: 10,
          opacity: effectiveShowControls ? 1 : 0,
          pointerEvents: effectiveShowControls ? 'auto' : 'none',
          transition: 'opacity 0.3s ease-in-out'
        }}
      >
        
        {/* Left Controls: Home */}
        <IconButton 
          onClick={onGoHome} 
          sx={{ 
            color: textColor,
            transition: 'transform 0.2s', 
            '&:hover': { transform: 'scale(1.1)' } 
          }}
        >
          <HomeIcon fontSize="large" />
        </IconButton>
        
        {/* Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          
          {/* Chords & Transpose Group */}
          <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
            <Button
              variant={effectiveShowChords ? 'contained' : 'outlined'}
              size="small"
              disabled={fullSongMode}
              onClick={() => setShowChords(!showChords)}
              sx={{ 
                borderRadius: effectiveShowChords ? '8px 0 0 8px' : 2,
                fontWeight: 600,
                textTransform: 'none',
                borderColor: textColor,
                color: effectiveShowChords ? 'primary.contrastText' : textColor,
                px: 2,
                '&.Mui-disabled': {
                  borderColor: 'rgba(127,127,127,0.3)',
                  color: 'rgba(127,127,127,0.5)'
                }
              }}
            >
              Chords
            </Button>

            {/* Chord Shift UI - Seamlessly attached */}
            {showChords && (
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  borderRadius: '0 8px 8px 0',
                  overflow: 'hidden',
                  pl: 0.5,
                  pr: 0.5
                }}
              >
                <IconButton 
                  size="small" 
                  onClick={() => setChordShift(prev => prev - 1)}
                  sx={{ color: 'inherit' }}
                  title="Shift -1 semitone"
                >
                  <RemoveIcon fontSize="small" />
                </IconButton>
                <Typography 
                  sx={{ 
                    px: 0.5, 
                    fontSize: '0.9rem', 
                    fontWeight: 700, 
                    fontFamily: 'monospace', 
                    color: 'inherit', 
                    minWidth: 28, 
                    textAlign: 'center', 
                    userSelect: 'none' 
                  }}
                >
                  {chordShift > 0 ? `+${chordShift}` : chordShift}
                </Typography>
                <IconButton 
                  size="small" 
                  onClick={() => setChordShift(prev => prev + 1)}
                  sx={{ color: 'inherit' }}
                  title="Shift +1 semitone"
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Box>

          <Tooltip title="Maximize text and display the entire song on one screen without pagination" enterDelay={0} arrow>
            <Button
              variant={fullSongMode ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setFullSongMode(!fullSongMode)}
              sx={{ 
                borderRadius: 2,
                fontWeight: 600,
                textTransform: 'none',
                borderColor: textColor,
                color: fullSongMode ? 'primary.contrastText' : textColor,
                px: 2
              }}
            >
              Full song
            </Button>
          </Tooltip>

          {/* Repeat Chorus Button with Instant Tooltip */}
          <Tooltip 
            title={hasChorus ? "Automatically inserts a chorus slide after each verse slide" : "No chorus detected in this song"} 
            enterDelay={0} 
            leaveDelay={100} 
            arrow
          >
            <span>
              <Button
                variant={autoChorus && !fullSongMode ? 'contained' : 'outlined'}
                size="small"
                disabled={!hasChorus || fullSongMode}
                onClick={() => setAutoChorus(!autoChorus)}
                sx={{ 
                  borderRadius: 2,
                  fontWeight: 600,
                  textTransform: 'none',
                  borderColor: textColor,
                  color: autoChorus && hasChorus ? 'primary.contrastText' : textColor,
                  px: 2,
                  '&.Mui-disabled': {
                    borderColor: 'rgba(127,127,127,0.3)',
                    color: 'rgba(127,127,127,0.5)'
                  }
                }}
              >
                Repeat chorus
              </Button>
            </span>
          </Tooltip>

          {onOpenSettings && (
            <IconButton onClick={onOpenSettings} sx={{ color: textColor }}>
              <SettingsIcon />
            </IconButton>
          )}

          <FullscreenButton textColor={textColor} />

          <Tooltip title={debugCopied ? "Copied debug JSON!" : "Copy Debug Info"} enterDelay={0} arrow>
            <IconButton 
              onClick={handleCopyDebugInfo} 
              sx={{ color: debugCopied ? '#4caf50' : textColor, transition: 'color 0.2s' }}
            >
              <BugReportIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Large Section Indicator - Top Left (below home button) */}
      {!fullSongMode && showSlideLabels && (() => {
        const label = getUpperLeftLabel(currentBlock);
        const isNumber = /^\d+$/.test(label);
        return (
          <Box sx={{ position: 'absolute', top: 80, left: { xs: 24, md: 40 }, zIndex: 5, opacity: 0.85 }}>
            <Typography 
              sx={{ 
                fontSize: isNumber ? { xs: '3.5rem', md: '5rem' } : { xs: '2rem', md: '2.8rem' }, 
                fontWeight: 900, 
                color: textColor, 
                userSelect: 'none',
                lineHeight: 1,
                letterSpacing: '-1px'
              }}
            >
              {label}
            </Typography>
          </Box>
        );
      })()}

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: fullSongMode ? 'flex-start' : 'center', justifyContent: fullSongMode ? 'flex-start' : 'center', px: fullSongMode ? 2 : 3, pt: fullSongMode ? '56px' : 10, pb: fullSongMode ? 1 : 10 }}>

        {fullSongMode ? (
          /* Full Song Mode: fixed-height container, auto columns, DOM-measured font size */
          <Box
            key="full-song-box"
            ref={fullSongRef}
            sx={{
              fontWeight: 500,
              lineHeight: 1.35,
              textAlign: 'left',
              width: '100%',
              fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
              fontSize: `${fullSongFontPx}px`,
              columnCount: fullSongColumns,
              columnGap: '1.2em',
              columnFill: 'balance',
              height: 'calc(100vh - 100px)',
              overflow: 'hidden',
            }}
          >
            {presentationSequence.map((block, blockIdx) => (
              <Box key={blockIdx} sx={{ mb: '1.2em', breakInside: 'avoid-column' }}>
                {block.label && (
                  <Box sx={{
                    fontWeight: 700,
                    fontSize: '0.7em', // proportional to the lyric font size
                    color: chordColor,
                    opacity: 0.85,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    mb: '0.1em'
                  }}>
                    {block.label}
                  </Box>
                )}
                {block.lines.map((line, idx) => {
                  let displayLyric = line.lyric || ' ';
                  if (idx === 0) {
                    displayLyric = displayLyric.replace(/^(verse\s*\d*[:\.\)]?\s*|v\s*\d+[:\.\)]?\s*|chorus\s*\d*[:\.\)]?\s*|bridge\s*\d*[:\.\)]?\s*|\d+[:\.\)]?\s+)/i, '');
                  }
                  return (
                    <Box key={idx} sx={{ whiteSpace: 'pre-wrap', minHeight: '1.1em' }}>
                      {displayLyric}
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>
        ) : (
          /* Normal paginated mode */
          <Box key="paginated-box" sx={{ fontSize: `calc(${textSizeMultiplier} * 4.5vh)`, fontWeight: 500, lineHeight: 1.5, textAlign: 'left', width: '100%', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
            {currentBlock.lines.map((line, idx) => {
              const hasChord = Boolean(line.chord && line.chord.trim().length > 0);
              let displayLyric = line.lyric || ' ';
              // Strip leading verse numbers/labels from the first line of text
              if (idx === 0) {
                displayLyric = displayLyric.replace(/^(verse\s*\d*[:\.\)]?\s*|v\s*\d+[:\.\)]?\s*|chorus\s*\d*[:\.\)]?\s*|bridge\s*\d*[:\.\)]?\s*|\d+[:\.\)]?\s+)/i, '');
              }
              return (
                <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', minHeight: '1.2em', mb: effectiveShowChords && hasChord ? 2 : 1 }}>
                  {effectiveShowChords && hasChord && (
                    <Box sx={{ color: chordColor, fontWeight: 'bold', fontFamily: 'monospace', whiteSpace: 'pre', fontSize: '0.8em', lineHeight: 1 }}>
                      {line.chord}
                    </Box>
                  )}
                  <Box sx={{ whiteSpace: 'pre-wrap' }}>
                    {displayLyric}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Bottom Progress/Navigation Icons */}
      {!fullSongMode && (
        <Box 
          sx={{ 
            position: 'absolute', 
            bottom: 20, 
            left: 0, 
            right: 0, 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1.2,
            px: 2,
            opacity: 0.7,
            transition: 'opacity 0.25s ease-in-out',
            '&:hover': { opacity: 0.95 }
          }}
        >
          {groupedSlides.map((group, groupIdx) => {
            return (
              <Box 
                key={groupIdx} 
                sx={{ 
                  display: 'flex', 
                  border: '1.5px solid', 
                  borderColor: textColor, 
                  borderRadius: 1.5, 
                  overflow: 'hidden',
                  opacity: group.slides.some(s => s.idx === currentBlockIndex) ? 1 : 0.8,
                  transition: 'all 0.2s',
                  '&:hover': { transform: 'scale(1.1)', opacity: 1 }
                }}
              >
                {group.slides.map((slide, i) => {
                  const isCurrent = slide.idx === currentBlockIndex;
                  const isLastInGroup = i === group.slides.length - 1;

                  return (
                    <Box 
                      key={slide.idx}
                      onClick={() => setCurrentBlockIndex(slide.idx)}
                      sx={{
                        width: 32, 
                        height: 32, 
                        bgcolor: isCurrent ? textColor : 'transparent',
                        color: isCurrent ? bgColor : textColor,
                        borderRight: !isLastInGroup ? '1.5px solid' : 'none',
                        borderRightColor: textColor,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        fontFamily: 'system-ui, sans-serif',
                        userSelect: 'none',
                        transition: 'all 0.2s',
                        '&:hover': { bgcolor: isCurrent ? textColor : 'rgba(127,127,127,0.2)' }
                      }}
                      title={slide.block.label}
                    >
                      {slide.meta.displayChar}
                    </Box>
                  );
                })}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
