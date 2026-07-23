import { chordproToLines } from '../pdf/chordpro';

export function parseChordProBlocks(chordproText, paginationOptions = null) {
  if (!chordproText) return [];

  const lines = chordproText.split('\n');

  // Step 1: Detect if the song has explicit directives or line headers for sections
  let hasExplicitSections = false;
  
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('#')) {
      continue;
    }
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const directive = trimmed.substring(1, trimmed.length - 1).toLowerCase();
      if (
        directive.startsWith('c') || 
        directive.startsWith('v') || 
        directive.startsWith('b') || 
        directive.startsWith('chorus') || 
        directive.startsWith('verse') || 
        directive.startsWith('bridge') || 
        directive.startsWith('soc') || 
        directive.startsWith('comment')
      ) {
        hasExplicitSections = true;
        break;
      }
    }
    // Check for line header like "1", "1. ", "Verse 1:", "Chorus:", "Bridge:"
    if (/^(verse\s*\d*|v\d+|chorus\s*\d*|bridge\s*\d*|\d+[\.\)]?)\s*[:\.]?$/i.test(trimmed)) {
      hasExplicitSections = true;
      break;
    }
    // Check for indented lines (Chorus)
    if (/^(\s{2,}|\t)/.test(rawLine) && trimmed !== '') {
      hasExplicitSections = true;
      break;
    }
  }

  const rawBlocks = [];
  let currentBlockType = hasExplicitSections ? 'verse' : 'section';
  let currentBlockLabel = hasExplicitSections ? 'Verse 1' : '';
  let currentLines = [];
  let verseCount = 0;
  let chorusCount = 0;
  let bridgeCount = 0;

  const getNextVerseLabel = () => {
    verseCount++;
    return `Verse ${verseCount}`;
  };
  
  const getNextChorusLabel = () => {
    chorusCount++;
    return chorusCount > 1 ? `Chorus ${chorusCount}` : 'Chorus';
  };

  const getNextBridgeLabel = () => {
    bridgeCount++;
    return bridgeCount > 1 ? `Bridge ${bridgeCount}` : 'Bridge';
  };

  const pushCurrentBlock = () => {
    if (currentLines.length > 0) {
      // Trim empty lines from top and bottom of currentLines
      let start = 0;
      while (start < currentLines.length && !currentLines[start].trim()) start++;
      let end = currentLines.length - 1;
      while (end >= start && !currentLines[end].trim()) end--;
      
      const trimmedLines = currentLines.slice(start, end + 1);
      if (trimmedLines.length > 0) {
        rawBlocks.push({
          type: currentBlockType,
          label: currentBlockLabel,
          lines: trimmedLines,
        });
      }
      currentLines = [];
    }
  };

  if (hasExplicitSections) {
    let activeLabelAssigned = false;
    let pendingBlankLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.replace(/\r$/, '');
      const trimmed = line.trim();

      // Skip songbase comment / metadata lines like "#NZSSOT 2023-2024" or "#The Church"
      if (trimmed.startsWith('#')) {
        continue;
      }

      if (trimmed === '') {
        if (currentLines.length > 0) {
          pendingBlankLines++;
        }
        continue;
      }

      const isIndented = /^(\s{2,}|\t)/.test(rawLine);
      const expectedType = isIndented ? 'chorus' : 'verse';

      // Check for directives
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const directive = trimmed.substring(1, trimmed.length - 1).toLowerCase();
        
        if (directive.startsWith('c') || directive.startsWith('chorus') || directive.startsWith('soc')) {
          pushCurrentBlock();
          currentBlockType = 'chorus';
          currentBlockLabel = getNextChorusLabel();
          activeLabelAssigned = true;
          pendingBlankLines = 0;
          continue;
        }
        
        if (directive.startsWith('v') || directive.startsWith('verse')) {
          pushCurrentBlock();
          currentBlockType = 'verse';
          currentBlockLabel = getNextVerseLabel();
          activeLabelAssigned = true;
          pendingBlankLines = 0;
          continue;
        }
        
        if (directive.startsWith('b') || directive.startsWith('bridge')) {
          pushCurrentBlock();
          currentBlockType = 'bridge';
          currentBlockLabel = getNextBridgeLabel();
          activeLabelAssigned = true;
          pendingBlankLines = 0;
          continue;
        }
        
        if (directive.startsWith('eoc')) {
          pushCurrentBlock();
          currentBlockType = 'verse';
          currentBlockLabel = getNextVerseLabel();
          activeLabelAssigned = true;
          pendingBlankLines = 0;
          continue;
        }
        
        pendingBlankLines = 0;
        continue;
      }

      // Check for line header like "1", "1. ", "Verse 1:", "Chorus:", etc.
      const headerMatch = trimmed.match(/^(verse\s*(\d+)?|v(\d+)|chorus\s*(\d+)?|bridge\s*(\d+)?|\d+[\.\)]?)\s*[:\.]?\s*/i);
      if (headerMatch) {
        const matchStr = headerMatch[0];
        const lower = matchStr.toLowerCase();
        pushCurrentBlock();
        
        if (lower.includes('chorus')) {
          currentBlockType = 'chorus';
          currentBlockLabel = getNextChorusLabel();
        } else if (lower.includes('bridge')) {
          currentBlockType = 'bridge';
          currentBlockLabel = getNextBridgeLabel();
        } else {
          currentBlockType = 'verse';
          const numMatch = matchStr.match(/\d+/);
          if (numMatch) {
            currentBlockLabel = `Verse ${numMatch[0]}`;
            // Sync verseCount to the highest number seen
            verseCount = Math.max(verseCount, parseInt(numMatch[0], 10));
          } else {
            currentBlockLabel = getNextVerseLabel();
          }
        }

        activeLabelAssigned = true;
        pendingBlankLines = 0;

        // If there's lyric text after the header on the same line, include it
        const rest = line.trim().substring(matchStr.length);
        if (rest) {
          currentLines.push(rest);
        }
        continue;
      }

      // No directive and no explicit header.
      if (currentLines.length > 0 && pendingBlankLines > 0) {
        if (currentBlockType !== expectedType) {
          // Block type changed implicitly (e.g. from verse to chorus)
          pushCurrentBlock();
          currentBlockType = expectedType;
          currentBlockLabel = expectedType === 'chorus' ? getNextChorusLabel() : getNextVerseLabel();
          activeLabelAssigned = true;
        } else {
          // Same block type. Just insert the blank lines to preserve spacing.
          for (let b = 0; b < pendingBlankLines; b++) {
            currentLines.push('');
          }
        }
      } else if (currentLines.length === 0 && !activeLabelAssigned) {
        // Very first line of a block, no header
        currentBlockType = expectedType;
        currentBlockLabel = expectedType === 'chorus' ? getNextChorusLabel() : getNextVerseLabel();
        activeLabelAssigned = true;
      }

      pendingBlankLines = 0;
      currentLines.push(line);
    }
    pushCurrentBlock();
  } else {
    // No explicit sections in song!
    // Separate stanzas by blank lines into individual blocks
    currentBlockType = 'section';
    currentBlockLabel = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\r$/, '');
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        continue;
      }
      if (trimmed === '') {
        pushCurrentBlock();
        continue;
      }
      currentLines.push(line);
    }
    pushCurrentBlock();
  }

  // Now apply height-based pagination to rawBlocks
  const finalBlocks = [];

  for (const block of rawBlocks) {
    if (paginationOptions && paginationOptions.availablePx) {
      const { availablePx, lyricHeightPx, chordHeightPx, showChords, availableWidthPx, fontSizePx } = paginationOptions;
      
      const lineHeights = block.lines.map(line => {
        const rawStr = typeof line === 'string' ? line : (line?.lyric || '');
        const hasChord = showChords && (typeof line === 'string' ? line.includes('[') : Boolean(line?.chord));
        const baseHeight = hasChord ? lyricHeightPx + chordHeightPx : lyricHeightPx;

        if (availableWidthPx && fontSizePx) {
          const pureText = rawStr.replace(/\[[^\]]*\]/g, '').replace(/^(verse\s*\d*[:\.\)]?\s*|v\s*\d+[:\.\)]?\s*|chorus\s*\d*[:\.\)]?\s*|bridge\s*\d*[:\.\)]?\s*|\d+[:\.\)]?\s+)/i, '');
          const estWidth = pureText.length * fontSizePx * 0.53;
          const wrapFactor = Math.max(1, Math.ceil(estWidth / availableWidthPx));
          return baseHeight + (wrapFactor - 1) * lyricHeightPx;
        }

        return baseHeight;
      });

      const totalHeight = lineHeights.reduce((a, b) => a + b, 0);

      if (totalHeight <= availablePx) {
        finalBlocks.push({
          type: block.type,
          label: block.label,
          lines: chordproToLines(block.lines.join('\n')),
        });
      } else {
        // Soft Greedy Pagination
        const minChunks = Math.ceil(totalHeight / availablePx);
        // targetHeight balances the chunks evenly
        const targetHeight = Math.max(availablePx * 0.4, totalHeight / minChunks);
        
        let currentChunk = [];
        const chunks = [];
        let i = 0;

        while (i < block.lines.length) {
          let j = i;
          let currentH = 0;
          
          // Greedily accumulate up to availablePx. 
          // Crucial: always include at least 1 line (j > i) to prevent infinite loops 
          // if a single wrapped line exceeds availablePx.
          while (j < block.lines.length) {
            const h = lineHeights[j];
            if (currentH + h > availablePx && j > i) {
              break; // Hard limit reached
            }
            currentH += h;
            j++;
          }
          
          // If we reached the end, push remaining lines
          if (j === block.lines.length) {
            const finalChunk = [];
            for (let k = i; k < j; k++) finalChunk.push(block.lines[k]);
            if (finalChunk.length > 0) chunks.push(finalChunk);
            break;
          }
          
          let splitAt = j - 1; 
          let splitFound = false;
          
          // 1. Semantic break: Look back up to 4 lines for a blank line
          for (let k = j - 1; k >= Math.max(i, j - 4); k--) {
            const raw = typeof block.lines[k] === 'string' ? block.lines[k] : (block.lines[k]?.lyric || '');
            if (raw.trim() === '') {
              splitAt = k;
              splitFound = true;
              break;
            }
          }
          
          // 2. Even split: If no blank line, split near the targetHeight
          if (!splitFound) {
            let hAcc = 0;
            for (let k = i; k < j; k++) {
              hAcc += lineHeights[k];
              if (hAcc >= targetHeight) {
                splitAt = k;
                break;
              }
            }
          }
          
          // 3. Orphan prevention: If the split leaves 1 or 2 lines for the NEXT chunk, steal lines back
          let remainingLines = block.lines.length - (splitAt + 1);
          if (remainingLines > 0 && remainingLines <= 2 && (splitAt - i + 1) > 3) {
            splitAt -= 2;
          }
          
          const finalChunk = [];
          for (let k = i; k <= splitAt; k++) {
            finalChunk.push(block.lines[k]);
          }
          chunks.push(finalChunk);
          
          i = splitAt + 1;
        }

        const numChunks = chunks.length;
        chunks.forEach((chunkLines, idx) => {
          // Trim empty lines from start and end of chunkLines
          let start = 0;
          while (start < chunkLines.length && !chunkLines[start].trim()) start++;
          let end = chunkLines.length - 1;
          while (end >= start && !chunkLines[end].trim()) end--;
          
          const trimmedLines = chunkLines.slice(start, end + 1);
          if (trimmedLines.length === 0) return;

          const chunkLabel = block.label 
            ? `${block.label} (${idx + 1}/${numChunks})`
            : '';
          
          finalBlocks.push({
            type: block.type,
            label: chunkLabel,
            lines: chordproToLines(trimmedLines.join('\n')),
          });
        });
      }
    } else {
      finalBlocks.push({
        type: block.type,
        label: block.label,
        lines: chordproToLines(block.lines.join('\n')),
      });
    }
  }

  return finalBlocks;
}
