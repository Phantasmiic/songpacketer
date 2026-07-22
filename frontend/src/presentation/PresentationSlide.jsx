import React, { useState, useMemo, useEffect } from 'react';
import { Box, Typography, IconButton, Button, Tooltip } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import BugReportIcon from '@mui/icons-material/BugReport';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
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
  onOpenSettings 
}) {
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

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

  // Calculate dynamic pagination options based on viewport and text size
  const paginationOptions = useMemo(() => {
    const availablePx = windowHeight - 240; // Safely subtract padding and UI elements
    const baseFontSizePx = (4.5 * windowHeight / 100) * textSizeMultiplier;
    
    // A single text line uses about 1.5em line height + 8px margin bottom
    const lyricHeightPx = (baseFontSizePx * 1.5) + 8;
    
    // Chords use 0.8em font size + 1.0 line height + extra 8px margin
    const chordHeightPx = (baseFontSizePx * 0.8) + 8;
    
    return { availablePx, lyricHeightPx, chordHeightPx, showChords };
  }, [windowHeight, textSizeMultiplier, showChords]);

  // Parse blocks once (with optional chord transposition)
  const rawBlocks = useMemo(() => {
    const rawText = song.chordpro_override || song.chordpro_text || '';
    const transposedText = chordShift !== 0 ? transposeChordProText(rawText, chordShift) : rawText;
    return parseChordProBlocks(transposedText, paginationOptions);
  }, [song, paginationOptions, chordShift]);

  // Build the presentation sequence (handling repeating chorus)
  const presentationSequence = useMemo(() => {
    if (!autoChorus || rawBlocks.length === 0) return rawBlocks;
    
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
  }, [rawBlocks, autoChorus]);

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
      showChords,
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
      if (e.key === 'ArrowRight' || e.key === ' ') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
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
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? 'auto' : 'none',
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
              variant={showChords ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setShowChords(!showChords)}
              sx={{ 
                borderRadius: showChords ? '8px 0 0 8px' : 2,
                fontWeight: 600,
                textTransform: 'none',
                borderColor: textColor,
                color: showChords ? 'primary.contrastText' : textColor,
                px: 2
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

          {/* Repeat Chorus Button with Instant Tooltip */}
          <Tooltip 
            title="Automatically inserts a chorus slide after each verse slide" 
            enterDelay={0} 
            leaveDelay={100} 
            arrow
          >
            <Button
              variant={autoChorus ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setAutoChorus(!autoChorus)}
              sx={{ 
                borderRadius: 2,
                fontWeight: 600,
                textTransform: 'none',
                borderColor: textColor,
                color: autoChorus ? 'primary.contrastText' : textColor,
                px: 2
              }}
            >
              Repeat chorus
            </Button>
          </Tooltip>

          {onOpenSettings && (
            <IconButton onClick={onOpenSettings} sx={{ color: textColor }}>
              <SettingsIcon />
            </IconButton>
          )}

          <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"} enterDelay={0} arrow>
            <IconButton onClick={toggleFullscreen} sx={{ color: textColor }}>
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>

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
      {showSlideLabels && (() => {
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
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3, py: 10 }}>


        {/* Lines */}
        <Box sx={{ fontSize: `calc(${textSizeMultiplier} * 4.5vh)`, fontWeight: 500, lineHeight: 1.5, textAlign: 'left', width: '100%', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
          {currentBlock.lines.map((line, idx) => {
            const hasChord = Boolean(line.chord && line.chord.trim().length > 0);
            let displayLyric = line.lyric || ' ';
            // Strip leading verse numbers/labels from the first line of text
            if (idx === 0) {
              displayLyric = displayLyric.replace(/^(verse\s*\d*[:\.\)]?\s*|v\s*\d+[:\.\)]?\s*|chorus\s*\d*[:\.\)]?\s*|bridge\s*\d*[:\.\)]?\s*|\d+[:\.\)]?\s+)/i, '');
            }
            return (
              <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', minHeight: '1.2em', mb: showChords && hasChord ? 2 : 1 }}>
                {showChords && hasChord && (
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
      </Box>

      {/* Bottom Progress/Navigation Icons */}
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
          opacity: 0.4,
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
                opacity: group.slides.some(s => s.idx === currentBlockIndex) ? 1 : 0.65,
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
    </Box>
  );
}
