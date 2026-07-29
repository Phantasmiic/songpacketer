import { useEffect, useRef, useState } from 'react';
import { getDb } from './db/store';
import { CircularProgress } from '@mui/material';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  TextField,
  Typography,
  Popover,
  Divider,
  IconButton,
  Stack,
  Tooltip,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  InputAdornment,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import SettingsIcon from '@mui/icons-material/Settings';
import SyncIcon from '@mui/icons-material/Sync';
import InfoIcon from '@mui/icons-material/Info';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import ShareIcon from '@mui/icons-material/Share';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

import PresentationMode from './presentation/PresentationMode';
import InputStep from './components/InputStep';
import ReviewStep from './components/ReviewStep';
import GenerateStep from './components/GenerateStep';
import PdfPreviewSidebar from './components/PdfPreviewSidebar';
import ReloadPrompt from './components/ReloadPrompt';
import { useResizableSidebar, ResizeHandle, ResizableSidebarPanel } from './components/ResizableSidebar';
import {
  activateSongPacketVersion,
  createSongPacket,
  fetchVersions,
  generatePacketPdf,
  generateSongPacketVersionPdf,
  listSongPackets,
  matchSongs,
  openLatestSongPacket,
  optimizePacketOrder,
  saveSongPacketVersion,
  syncSongbase,
  updateSongPacketState,
  exportSongPacket,
  importSongPacket,
  updateSongPacketTitle,
  deleteSongPacket,
  slugify,
  formatLiveSlug,
  checkSlugAvailability,
  savePacketOnline,
  fetchPacketOnline,
  isKvConfigured,
} from './api/client';

const steps = ['Input', 'Refine', 'Layout'];

function toSelections(rows, versionsCacheRef = null, manualOrderCards = []) {
  const forceMap = {};
  if (Array.isArray(manualOrderCards)) {
    manualOrderCards.forEach((c) => {
      if (c && c.selectionIndex != null) {
        forceMap[c.selectionIndex] = Boolean(c.forceNewPage);
      }
    });
  }

  return rows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => row.type === 'section' || row.selectedSongId)
    .map(({ row, idx }) => {
      if (row.type === 'section') {
        return {
          type: 'section',
          title: row.title,
          id: row.id,
          isUnassigned: row.isUnassigned || row.id === 'unassigned',
          force_new_page: false,
        };
      }
      let chordpro_text = '';
      if (versionsCacheRef && versionsCacheRef.current && versionsCacheRef.current[row.selectedSongId]) {
        const versions = versionsCacheRef.current[row.selectedSongId];
        const selected = row.selectedVersionId
          ? versions.find(v => v.id === row.selectedVersionId)
          : versions[0];
        if (selected) {
          chordpro_text = selected.chordpro_text;
        }
      }
      return {
        type: 'song',
        input_text: row.input,
        song_id: row.selectedSongId,
        version_id: row.selectedVersionId || null,
        capo: row.capo === '' || row.capo == null ? 0 : row.capo,
        chordpro_override: row.chordproOverride || '',
        title_override: row.titleOverride || '',
        chordpro_text: chordpro_text,
        force_new_page: forceMap[idx] !== undefined ? forceMap[idx] : Boolean(row.force_new_page),
      };
    });
}

function allRowsMatched(rows) {
  return rows.length > 0 && rows.filter(r => r.type !== 'section').every((row) => Boolean(row.selectedSongId));
}

function removeDuplicateMatches(rows) {
  const seen = new Set();
  let removedCount = 0;
  const deduped = [];

  rows.forEach((row) => {
    if (row.type === 'section') {
      deduped.push(row);
      return;
    }
    if (!row.selectedSongId) {
      deduped.push(row);
      return;
    }
    if (seen.has(row.selectedSongId)) {
      removedCount += 1;
      return;
    }
    seen.add(row.selectedSongId);
    deduped.push(row);
  });

  return { deduped, removedCount };
}

const formatLastSynced = (isoString) => {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) {
    return `Today at ${timeStr}`;
  }
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${dateStr} at ${timeStr}`;
};

function App() {
  const [step, setStep] = useState(0);
  const [inputText, setInputText] = useState('');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [initializing, setInitializing] = useState(true);
  const [isHydrating, setIsHydrating] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(localStorage.getItem('songpacketer_last_sync') || null);

  const updateSyncedCount = async () => {
    try {
      const db = await getDb();
      const count = await db.count('songs');
      setSyncedCount(count);
    } catch (err) {
      console.error('Failed to update synced count:', err);
    }
  };

  const [toast, setToast] = useState('');
  const [orderingMode, setOrderingMode] = useState('within_sections');
  const [activeReviewRowIndex, setActiveReviewRowIndex] = useState(0);
  const [duplicateRemovedCount, setDuplicateRemovedCount] = useState(0);
  const [manualOrderCards, setManualOrderCards] = useState([]);
  const [packetStats, setPacketStats] = useState(null);
  const [showSectionHeadersInIndex, setShowSectionHeadersInIndex] = useState(true);
  const [requireOnePagePerSong, setRequireOnePagePerSong] = useState(false);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [startingPageNumber, setStartingPageNumber] = useState(1);
  const [pageNumberPrefix, setPageNumberPrefix] = useState('S');
  const [pdfFontSize, setPdfFontSize] = useState(11);

  const [packetMode, setPacketMode] = useState('new');
  const [packetTitle, setPacketTitle] = useState('');
  const [existingPackets, setExistingPackets] = useState([]);
  const [selectedPacketId, setSelectedPacketId] = useState('');
  const [activePacket, setActivePacket] = useState(null);
  const [packetVersions, setPacketVersions] = useState([]);
  const [packetHistory, setPacketHistory] = useState([]);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDescription, setSaveDescription] = useState('');
  const [packetMenuAnchor, setPacketMenuAnchor] = useState(null);
  const [saveOnlineEnabled, setSaveOnlineEnabled] = useState(false);
  const [customSlug, setCustomSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState({ checking: false, available: null, error: '' });
  const [hasUnsavedEditorChanges, setHasUnsavedEditorChanges] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const { width: sidebarWidth, isResizing: sidebarResizing, startResize } = useResizableSidebar({ initialWidth: 500, minWidth: 350, maxWidth: 1000 });
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(() => {
    return typeof window !== 'undefined' && window.location.pathname.startsWith('/present');
  });
  const [isSongbasePresenting, setIsSongbasePresenting] = useState(false);
  const [songbaseSongs, setSongbaseSongs] = useState([]);

  const handlePresentSongs = async () => {
    try {
      setLoading(true);
      let formatted = [];
      try {
        const db = await getDb();
        if (db && db.objectStoreNames && db.objectStoreNames.contains('songs')) {
          let allSongs = await db.getAll('songs');

          if ((!allSongs || allSongs.length === 0) && typeof syncSongbase === 'function') {
            try {
              await Promise.race([
                syncSongbase(),
                new Promise((resolve) => setTimeout(resolve, 1500))
              ]);
              allSongs = await db.getAll('songs');
            } catch (syncErr) {
              console.warn('Sync skipped or timed out in handlePresentSongs', syncErr);
            }
          }

          formatted = (allSongs || []).map((song) => {
            return {
              song_id: String(song.id),
              title: song.title,
              key: song.key,
              chordpro_override: song.lyrics_chordpro || song.lyrics_plain || '',
              capo: song.capo_default || 0,
            };
          });

          formatted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        }
      } catch (dbErr) {
        console.warn('DB songs fetch warning in handlePresentSongs', dbErr);
      }

      localStorage.removeItem('presentationActiveSongId');
      localStorage.removeItem('presentationSlideIndex');
      if (typeof window !== 'undefined' && window.location.pathname !== '/present') {
        window.history.pushState({}, '', '/present');
      }
      setSongbaseSongs(formatted);
      setIsSongbasePresenting(true);
      setIsPresentationMode(true);
    } catch (err) {
      console.error('Failed to load songs for presentation', err);
      setError('Failed to load Songbase library for presentation');
    } finally {
      setLoading(false);
    }
  };

  // Automatically format custom slug when popover opens or packet title changes
  useEffect(() => {
    if (packetMenuAnchor) {
      setCustomSlug(slugify(packetTitle || 'song-packet'));
    }
  }, [packetMenuAnchor]);

  // Debounced availability check for custom URL slug
  useEffect(() => {
    if (!saveOnlineEnabled || !customSlug || customSlug.trim().length < 3) {
      setSlugStatus({ checking: false, available: false, error: customSlug ? 'Slug must be at least 3 characters' : '' });
      return;
    }

    setSlugStatus({ checking: true, available: null, error: '' });
    const timer = setTimeout(async () => {
      const res = await checkSlugAvailability(customSlug);
      setSlugStatus({ checking: false, available: res.available, error: res.error || '' });
    }, 300);

    return () => clearTimeout(timer);
  }, [saveOnlineEnabled, customSlug]);

  // Load online packet if URL contains #/p/:slug or ?packet=:slug
  useEffect(() => {
    async function checkOnlineRoute() {
      const pathname = window.location.pathname;
      const hash = window.location.hash;
      let slug = null;

      if (pathname && pathname.startsWith('/p/')) {
        slug = pathname.replace(/^\/p\//, '').split('?')[0].split('/')[0];
      } else if (hash && hash.startsWith('#/p/')) {
        slug = hash.replace('#/p/', '').split('?')[0];
      } else {
        const params = new URLSearchParams(window.location.search);
        if (params.get('packet')) {
          slug = params.get('packet');
        }
      }
      if (!slug) return;

      try {
        setLoading(true);
        const packetData = await fetchPacketOnline(slug);
        if (packetData) {
          await importSongPacket(packetData);
          await loadPacketList();
          setToast(`Loaded online packet: "${packetData.title || slug}"`);
        }
      } catch (err) {
        console.error('Failed to load online packet:', err);
        setError(err.message || 'Failed to load online packet');
      } finally {
        setLoading(false);
      }
    }
    checkOnlineRoute();
    window.addEventListener('hashchange', checkOnlineRoute);
    return () => window.removeEventListener('hashchange', checkOnlineRoute);
  }, []);

  useEffect(() => {
    // Save to local storage
    localStorage.setItem('presentationActive', isPresentationMode ? 'true' : 'false');

    // Sync state to URL
    const path = window.location.pathname;
    if (isPresentationMode && path === '/') {
      window.history.pushState({}, '', '/present');
    } else if (!isPresentationMode && path.startsWith('/present')) {
      window.history.pushState({}, '', '/');
    }
  }, [isPresentationMode]);

  // Handle Browser Back/Forward
  useEffect(() => {
    const handlePopState = () => {
      setIsPresentationMode(window.location.pathname.startsWith('/present'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const previewTimerRef = useRef(null);
  const importFileRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      if (previewPdfUrl) window.URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

  // Initial sync check: if the local songs DB is empty, perform a one‑time sync and show a full‑screen loading overlay.
  useEffect(() => {
    if (import.meta.env?.MODE === 'test') {
      setInitializing(false);
      return;
    }
    async function initSync() {
      try {
        const db = await getDb();
        const count = await db.count('songs');
        if (count === 0) {
          setSyncing(true);
          await syncSongbase();
          const now = new Date().toISOString();
          localStorage.setItem('songpacketer_last_sync', now);
          setLastSynced(now);
        }
        await updateSyncedCount();
      } catch (e) {
        console.error('Initial sync failed', e);
        setError(e.message || 'Initial sync error');
      } finally {
        setSyncing(false);
        setInitializing(false);
      }
    }
    initSync();
  }, []);

  const versionsCacheRef = useRef({});

  const handleUpdatePacketState = async (eventType, summary, change) => {
    try {
      await updateSongPacketState(selectedPacketId, {
        state: { matches, manualOrderCards },
        event_type: eventType,
        summary: summary,
        change: change,
      });
    } catch (err) {
      console.error('Failed to update state on backend:', err);
    }
  };

  const loadPacketList = async () => {
    try {
      const data = await listSongPackets();
      const packets = data.packets || [];
      setExistingPackets(packets);
      if (!selectedPacketId && packets.length > 0) {
        setSelectedPacketId(packets[0].id);
      }
    } catch (_err) {
      // Keep current UI state; packet APIs should not block page usage.
    }
  };

  useEffect(() => {
    loadPacketList();
  }, []);

  useEffect(() => {
    const songRows = matches.filter(r => r.type !== 'section');
    const unmatchedCount = songRows.filter((row) => !row.selectedSongId).length;
    const canProceed = songRows.length > 0 && unmatchedCount === 0;

    if (step === 0 || !canProceed) {
      return;
    }

    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }

    previewTimerRef.current = setTimeout(async () => {
      setIsGeneratingPreview(true);
      try {
        const payload = toSelections(matches, versionsCacheRef, manualOrderCards);

        const result = await generatePacketPdf(
          payload,
          orderingMode,
          showSectionHeadersInIndex,
          requireOnePagePerSong,
          showPageNumbers,
          startingPageNumber,
          pageNumberPrefix,
          pdfFontSize
        );
        const blob = result.blob;
        const newUrl = window.URL.createObjectURL(blob);
        setPreviewPdfUrl(oldUrl => {
          if (oldUrl) window.URL.revokeObjectURL(oldUrl);
          return newUrl;
        });
      } catch (err) {
        console.error('Failed to generate preview PDF', err);
      } finally {
        setIsGeneratingPreview(false);
      }
    }, 1000);

  }, [matches, manualOrderCards, orderingMode, showSectionHeadersInIndex, requireOnePagePerSong, showPageNumbers, startingPageNumber, pageNumberPrefix, pdfFontSize, step]);

  useEffect(() => {
    if (step === 2 && matches.length > 0 && manualOrderCards.length === 0) {
      const cards = matches
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => row.type !== 'section')
        .map(({ row, index }, cardIdx) => ({
          id: row.id || `card-${index}`,
          selectionIndex: index,
          title: row.titleOverride || row.title || row.input || `Song ${cardIdx + 1}`,
          originalOrder: cardIdx + 1,
          forceNewPage: Boolean(row.force_new_page),
        }));
      if (cards.length > 0) {
        setManualOrderCards(cards);
      }
    }
  }, [step, matches, manualOrderCards]);

  const primeVersionsCache = (rows) => {
    rows.forEach((row) => {
      if (row.selectedSongId && Array.isArray(row.versions) && row.versions.length > 0) {
        versionsCacheRef.current[row.selectedSongId] = row.versions;
      }
    });
  };

  const fetchVersionsCached = async (songId) => {
    if (versionsCacheRef.current[songId]) {
      return versionsCacheRef.current[songId];
    }
    const versions = await fetchVersions(songId);
    versionsCacheRef.current[songId] = versions;
    return versions;
  };

  const pushLocalHistoryEvent = (eventType, summary, change = {}) => {
    if (!eventType && !summary) {
      return;
    }
    setPacketHistory((previous) => [
      {
        id: `local-${Date.now()}-${Math.random()}`,
        event_type: eventType || 'update',
        summary: summary || eventType || 'update',
        change,
        created_at: new Date().toISOString(),
        packet_version_id: activePacket?.current_version?.id || null,
      },
      ...previous,
    ]);
  };

  const hydrateFromPacketState = async (state) => {
    setIsHydrating(true);
    const nextState = state || {};
    const nextMatches = Array.isArray(nextState.matches) ? nextState.matches : [];
    setInputText(nextState.input_text || '');

    // Hydrate candidates and versions dynamically from IndexedDB if they are missing
    const hydratedMatches = await Promise.all(
      nextMatches.map(async (row) => {
        if (row.type === 'section') return row;

        let candidates = row.candidates;
        // Rebuild candidates list if missing or empty
        if (!candidates || candidates.length === 0) {
          const query = row.query || row.input;
          if (query) {
            try {
              const data = await matchSongs('', [query]);
              const matchResult = data.results?.[0];
              if (matchResult?.candidates) {
                // Ensure we prune candidate versions
                candidates = matchResult.candidates.map(({ versions, ...cRest }) => cRest);
              }
            } catch (err) {
              console.error('Failed to run dynamic match for row on hydration', query, err);
            }
          }
        }
        if (!candidates) candidates = [];

        // Ensure currently selected song is in the candidates list
        if (row.selectedSongId && !candidates.some(c => c.song_id === row.selectedSongId)) {
          try {
            const db = await getDb();
            const song = await db.get('songs', parseInt(row.selectedSongId, 10));
            if (song) {
              candidates.unshift({
                song_id: song.id,
                title: song.title,
                key: song.key,
                preview: song.lyrics_plain?.substring(0, 100).replace(/\n/g, ' ') + '...',
                score: 1.0,
              });
            }
          } catch (err) {
            console.error('Failed to pre-populate selected song in candidates list on hydration', err);
          }
        }

        let versions = row.versions;
        if (row.selectedSongId && (!versions || versions.length === 0)) {
          try {
            versions = await fetchVersionsCached(row.selectedSongId);
          } catch (err) {
            console.error('Failed to hydrate versions for song', row.selectedSongId, err);
          }
        }
        if (!versions) versions = [];

        return {
          ...row,
          candidates,
          versions,
        };
      })
    );

    setMatches(hydratedMatches);
    primeVersionsCache(hydratedMatches);
    const restoredOrderingMode = nextState.ordering_mode || (nextState.maintain_original_order ? 'original' : 'within_sections');
    setOrderingMode(restoredOrderingMode);
    setShowSectionHeadersInIndex(nextState.show_section_headers_in_index ?? true);
    setManualOrderCards(Array.isArray(nextState.manual_order_cards) ? nextState.manual_order_cards : []);
    setPacketStats(nextState.packet_stats || null);
    const nextStep = Number.isInteger(nextState.step)
      ? nextState.step
      : hydratedMatches.length > 0
        ? 1
        : 0;
    setStep(nextStep);
    setActiveReviewRowIndex(0);
    setDuplicateRemovedCount(nextState.duplicate_removed_count || 0);
    // Restore PDF layout settings (persisted since they affect the generated output)
    if (nextState.require_one_page_per_song !== undefined) setRequireOnePagePerSong(Boolean(nextState.require_one_page_per_song));
    if (nextState.show_page_numbers !== undefined) setShowPageNumbers(Boolean(nextState.show_page_numbers));
    if (nextState.starting_page_number !== undefined) setStartingPageNumber(Number(nextState.starting_page_number));
    if (nextState.page_number_prefix !== undefined) setPageNumberPrefix(String(nextState.page_number_prefix));
    if (nextState.pdf_font_size !== undefined) setPdfFontSize(Number(nextState.pdf_font_size));
    setIsHydrating(false);
  };

  const applyPacketPayload = (payload, shouldHydrateState = true) => {
    if (!payload?.packet) {
      return;
    }
    setActivePacket(payload.packet);
    setPacketTitle(payload.packet.title || '');
    setSelectedPacketId(payload.packet.id);
    setPacketVersions(payload.versions || []);
    setPacketHistory(payload.edit_history || []);
    setHasUnsavedEditorChanges(false);
    if (shouldHydrateState) {
      hydrateFromPacketState(payload.state || {});
    }
  };

  const cleanMatchesForSave = (matchesList) => {
    return matchesList.map((row) => {
      if (row.type === 'section') return row;
      const cleanRowObj = { ...row };
      delete cleanRowObj.versions;
      delete cleanRowObj.candidates;
      return cleanRowObj;
    });
  };

  const buildPacketStateSnapshot = ({
    inputTextValue = inputText,
    matchesValue = matches,
    orderingModeValue = orderingMode,
    showSectionHeadersInIndexValue = showSectionHeadersInIndex,
    manualCardsValue = manualOrderCards,
    packetStatsValue = packetStats,
    stepValue = step,
    duplicateRemovedCountValue = duplicateRemovedCount,
    requireOnePagePerSongValue = requireOnePagePerSong,
    showPageNumbersValue = showPageNumbers,
    startingPageNumberValue = startingPageNumber,
    pageNumberPrefixValue = pageNumberPrefix,
    pdfFontSizeValue = pdfFontSize,
  } = {}) => {
    const cleanedMatches = cleanMatchesForSave(matchesValue);
    const baseSelections = toSelections(cleanedMatches);
    const orderedSelections = manualCardsValue.length
      ? manualCardsValue
        .map((card) => {
          const base = baseSelections[card.selectionIndex];
          if (!base) {
            return null;
          }
          return {
            ...base,
            force_new_page: Boolean(card.forceNewPage),
          };
        })
        .filter(Boolean)
      : baseSelections.map((selection) => ({
        ...selection,
        force_new_page: false,
      }));

    return {
      packet_title: activePacket?.title || packetTitle.trim(),
      input_text: inputTextValue,
      matches: cleanedMatches,
      ordering_mode: orderingModeValue,
      maintain_original_order: orderingModeValue === 'original',
      show_section_headers_in_index: showSectionHeadersInIndexValue,
      manual_order_cards: manualCardsValue,
      packet_stats: packetStatsValue,
      step: stepValue,
      duplicate_removed_count: duplicateRemovedCountValue,
      selections: orderedSelections,
      require_one_page_per_song: requireOnePagePerSongValue,
      show_page_numbers: showPageNumbersValue,
      starting_page_number: startingPageNumberValue,
      page_number_prefix: pageNumberPrefixValue,
      pdf_font_size: pdfFontSizeValue,
    };
  };

  const persistPacketState = async (snapshot, event) => {
    if (!activePacket?.id) {
      return;
    }
    try {
      const result = await updateSongPacketState(activePacket.id, snapshot, event);
      if (result?.packet) {
        setActivePacket(result.packet);
      }
      pushLocalHistoryEvent(event?.eventType, event?.summary, event?.change || {});
    } catch (err) {
      setError(err.message || 'Packet autosave failed.');
    }
  };

  const getDefaultVersion = (versions) => {
    if (!Array.isArray(versions) || versions.length === 0) return null;
    return versions.find(v => /\[[^\]]+\]/.test(v.lyrics_chordpro || v.chordpro_text || '')) || versions[0];
  };

  const handleCreateAndMatch = async () => {
    setLoading(true);
    setError('');
    await new Promise((r) => setTimeout(r, 30));
    try {
      const initialState = {
        packet_title: packetTitle.trim(),
        input_text: inputText,
        matches: [],
        maintain_original_order: false,
        show_section_headers_in_body: false,
        show_section_headers_in_index: true,
        manual_order_cards: [],
        packet_stats: null,
        step: 0,
        duplicate_removed_count: 0,
        selections: [],
      };
      const created = await createSongPacket(packetTitle.trim(), initialState);
      applyPacketPayload(created, false);

      const data = await matchSongs(inputText);
      const nextRows = await Promise.all(
        data.results.map(async (row) => {
          const selectedSongId = row.selected?.song_id || row.candidates?.[0]?.song_id;
          const versions = selectedSongId ? await fetchVersionsCached(selectedSongId) : [];
          const defaultVersion = getDefaultVersion(versions);
          return {
            ...row,
            selectedSongId,
            versions,
            selectedVersionId: defaultVersion?.id || '',
            capo: defaultVersion?.capo_default || 0,
            defaultCapo: defaultVersion?.capo_default || 0,
            chordproOverride: defaultVersion?.lyrics_chordpro || defaultVersion?.chordpro_text || '',
            defaultChordpro: defaultVersion?.lyrics_chordpro || defaultVersion?.chordpro_text || '',
            titleOverride: row.selected?.title || row.candidates?.[0]?.title || row.input || '',
          };
        })
      );

      let finalRows = nextRows;
      let removedCount = 0;
      if (allRowsMatched(finalRows)) {
        const dedupeResult = removeDuplicateMatches(finalRows);
        finalRows = dedupeResult.deduped;
        removedCount = dedupeResult.removedCount;
      }

      setDuplicateRemovedCount(removedCount);
      setMatches(finalRows);
      setManualOrderCards([]);
      setPacketStats(null);
      setActiveReviewRowIndex(0);
      setStep(1);

      const snapshot = buildPacketStateSnapshot({
        matchesValue: finalRows,
        manualCardsValue: [],
        packetStatsValue: null,
        stepValue: 1,
        duplicateRemovedCountValue: removedCount,
      });
      const saved = await updateSongPacketState(created.packet.id, snapshot, {
        eventType: 'match_songs',
        summary: 'Matched songs from input',
        change: { input_count: data.results.length, resolved_count: finalRows.length },
      });
      if (saved?.packet) {
        setActivePacket(saved.packet);
      }
      pushLocalHistoryEvent('match_songs', 'Matched songs from input', {
        input_count: data.results.length,
        resolved_count: finalRows.length,
      });
      await loadPacketList();
    } catch (err) {
      setError(err.message || 'Matching failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenExisting = async (packetId) => {
    const idToOpen = packetId || selectedPacketId;
    if (!idToOpen) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = await openLatestSongPacket(idToOpen);
      applyPacketPayload(payload, true);
      setPacketMode('existing');
      setToast('Loaded latest packet version.');
      setStep(1);
      await loadPacketList();
    } catch (err) {
      setError(err.message || 'Failed to open packet.');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    try {
      const result = await syncSongbase();
      setToast(`Sync complete. Created: ${result.created}, Updated: ${result.updated}`);
      const now = new Date().toISOString();
      localStorage.setItem('songpacketer_last_sync', now);
      setLastSynced(now);
      await updateSyncedCount();
    } catch (err) {
      setError(err.message || 'Song sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const buildResolvedMatchRow = async (previousRow, matchResult) => {
    const candidates = matchResult.candidates || [];
    const selectedSongId = matchResult.selected?.song_id || candidates[0]?.song_id || '';
    const versions = selectedSongId ? await fetchVersionsCached(selectedSongId) : [];
    const selectedCandidate = candidates.find((candidate) => candidate.song_id === selectedSongId);
    const selectedTitle = matchResult.selected?.title || selectedCandidate?.title;
    const defaultVersion = getDefaultVersion(versions);

    return {
      ...previousRow,
      ...matchResult,
      input: previousRow.input,
      searchQuery: matchResult.input || previousRow.input,
      candidates,
      selectedSongId,
      versions,
      selectedVersionId: defaultVersion?.id || '',
      capo: defaultVersion?.capo_default || 0,
      defaultCapo: defaultVersion?.capo_default || 0,
      chordproOverride: defaultVersion?.lyrics_chordpro || defaultVersion?.chordpro_text || '',
      defaultChordpro: defaultVersion?.lyrics_chordpro || defaultVersion?.chordpro_text || '',
      titleOverride: selectedTitle || previousRow.titleOverride || previousRow.input || '',
    };
  };

  const finalizeRefinedRows = (rows) => {
    if (!allRowsMatched(rows)) {
      return { finalRows: rows, removedCount: 0 };
    }
    const dedupeResult = removeDuplicateMatches(rows);
    return { finalRows: dedupeResult.deduped, removedCount: dedupeResult.removedCount };
  };

  const handleSelectionChange = async (rowIndex, patch) => {
    const copy = [...matches];
    copy[rowIndex] = { ...copy[rowIndex], ...patch };

    if (patch.selectedSongId) {
      const versions = await fetchVersionsCached(patch.selectedSongId);
      const selectedCandidate = copy[rowIndex].candidates?.find(
        (candidate) => candidate.song_id === patch.selectedSongId
      );
      const defaultVersion = getDefaultVersion(versions);
      copy[rowIndex].versions = versions;
      copy[rowIndex].selectedVersionId = defaultVersion?.id || '';
      copy[rowIndex].capo = defaultVersion?.capo_default || 0;
      copy[rowIndex].defaultCapo = defaultVersion?.capo_default || 0;
      copy[rowIndex].chordproOverride = defaultVersion?.lyrics_chordpro || defaultVersion?.chordpro_text || '';
      copy[rowIndex].defaultChordpro = defaultVersion?.lyrics_chordpro || defaultVersion?.chordpro_text || '';
      copy[rowIndex].titleOverride =
        selectedCandidate?.title || copy[rowIndex].titleOverride || copy[rowIndex].input;
    } else if (patch.selectedVersionId && copy[rowIndex].versions?.length) {
      const chosen = copy[rowIndex].versions.find(
        (item) => item.id === patch.selectedVersionId
      );
      if (chosen) {
        copy[rowIndex].capo = chosen.capo_default || 0;
        copy[rowIndex].defaultCapo = chosen.capo_default || 0;
        copy[rowIndex].chordproOverride = chosen.lyrics_chordpro || chosen.chordpro_text || '';
        copy[rowIndex].defaultChordpro = chosen.lyrics_chordpro || chosen.chordpro_text || '';
      }
    }

    const { finalRows, removedCount } = finalizeRefinedRows(copy);
    setDuplicateRemovedCount(removedCount);
    setMatches(finalRows);
    setManualOrderCards([]);
    setPacketStats(null);
    const patchFields = Object.keys(patch);
    const editorOnlyChange =
      patchFields.length === 1 && patchFields[0] === 'chordproOverride';
    if (editorOnlyChange) {
      setHasUnsavedEditorChanges(true);
    }
    if (activeReviewRowIndex >= finalRows.length) {
      setActiveReviewRowIndex(Math.max(0, finalRows.length - 1));
    }

    if (editorOnlyChange) {
      return;
    }

    const snapshot = buildPacketStateSnapshot({
      matchesValue: finalRows,
      manualCardsValue: [],
      packetStatsValue: null,
      stepValue: 1,
      duplicateRemovedCountValue: removedCount,
    });
    await persistPacketState(snapshot, {
      eventType: 'edit_song',
      summary: 'Updated song refinement',
      change: { row_index: rowIndex, fields: Object.keys(patch) },
    });
  };

  const handleCandidateSearch = async (rowIndex, query) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return;
    }

    setError('');
    try {
      const data = await matchSongs('', [trimmedQuery]);
      const matchResult = data.results?.[0] || {
        input: trimmedQuery,
        selected: null,
        candidates: [],
      };
      const copy = [...matches];
      if (!copy[rowIndex]) {
        return;
      }

      copy[rowIndex] = await buildResolvedMatchRow(copy[rowIndex], matchResult);
      const { finalRows, removedCount } = finalizeRefinedRows(copy);
      setDuplicateRemovedCount(removedCount);
      setMatches(finalRows);
      setManualOrderCards([]);
      setPacketStats(null);
      if (activeReviewRowIndex >= finalRows.length) {
        setActiveReviewRowIndex(Math.max(0, finalRows.length - 1));
      }

      const snapshot = buildPacketStateSnapshot({
        matchesValue: finalRows,
        manualCardsValue: [],
        packetStatsValue: null,
        stepValue: 1,
        duplicateRemovedCountValue: removedCount,
      });
      await persistPacketState(snapshot, {
        eventType: 'search_song',
        summary: 'Searched for replacement song',
        change: {
          row_index: rowIndex,
          query: trimmedQuery,
          candidate_count: matchResult.candidates?.length || 0,
          selected_song_id: copy[rowIndex].selectedSongId || null,
        },
      });
    } catch (err) {
      setError(err.message || 'Song search failed.');
    }
  };

  const handleDeleteRow = async (rowIndex) => {
    const removedRow = matches[rowIndex];
    if (!removedRow) {
      return;
    }

    const nextRows = matches.filter((_row, index) => index !== rowIndex);
    const { finalRows, removedCount } = finalizeRefinedRows(nextRows);

    setDuplicateRemovedCount(removedCount);
    setMatches(finalRows);
    setManualOrderCards([]);
    setPacketStats(null);
    setActiveReviewRowIndex((previousIndex) => {
      if (!finalRows.length) {
        return 0;
      }
      if (previousIndex > rowIndex) {
        return previousIndex - 1;
      }
      return Math.min(previousIndex, finalRows.length - 1);
    });

    const snapshot = buildPacketStateSnapshot({
      matchesValue: finalRows,
      manualCardsValue: [],
      packetStatsValue: null,
      stepValue: 1,
      duplicateRemovedCountValue: removedCount,
    });
    await persistPacketState(snapshot, {
      eventType: 'delete_song',
      summary: 'Deleted song from refinement',
      change: {
        row_index: rowIndex,
        input: removedRow.input,
        selected_song_id: removedRow.selectedSongId || null,
      },
    });
  };

  const handleAddSection = async (title, pastedText) => {
    if (!title.trim() && !pastedText.trim()) return;
    setLoading(true);
    try {
      const sectionRow = { type: 'section', title: title.trim(), input: title.trim(), id: `sec-${Date.now()}` };
      let nextRows = title.trim() ? [sectionRow] : [];
      let newMatchesCount = 0;

      if (pastedText.trim()) {
        const data = await matchSongs(pastedText);
        const newSongs = await Promise.all(
          data.results.map(async (row) => {
            const selectedSongId = row.selected?.song_id || row.candidates?.[0]?.song_id;
            const versions = selectedSongId ? await fetchVersionsCached(selectedSongId) : [];
            const defaultVersion = getDefaultVersion(versions);
            return {
              ...row,
              type: 'song',
              selectedSongId,
              versions,
              selectedVersionId: defaultVersion?.id || '',
              capo: defaultVersion?.capo_default || 0,
              defaultCapo: defaultVersion?.capo_default || 0,
              chordproOverride: defaultVersion?.lyrics_chordpro || defaultVersion?.chordpro_text || '',
              defaultChordpro: defaultVersion?.lyrics_chordpro || defaultVersion?.chordpro_text || '',
              titleOverride: row.selected?.title || row.candidates?.[0]?.title || row.input || '',
            };
          })
        );
        nextRows = [...nextRows, ...newSongs];
        newMatchesCount = newSongs.length;
      }

      const copy = [...matches, ...nextRows];
      const { finalRows, removedCount } = finalizeRefinedRows(copy);
      setDuplicateRemovedCount(removedCount);
      setMatches(finalRows);
      setManualOrderCards([]);
      setPacketStats(null);

      const snapshot = buildPacketStateSnapshot({
        matchesValue: finalRows,
        manualCardsValue: [],
        packetStatsValue: null,
        stepValue: 1,
        duplicateRemovedCountValue: removedCount,
      });
      await persistPacketState(snapshot, {
        eventType: 'add_section',
        summary: 'Added section and pasted songs',
        change: { title: title.trim(), added_songs: newMatchesCount },
      });
    } catch (err) {
      setError(err.message || 'Failed to add section and match songs.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMatches = async (newMatches) => {
    setLoading(true);
    try {
      const { finalRows, removedCount } = finalizeRefinedRows(newMatches);
      setDuplicateRemovedCount(removedCount);
      setMatches(finalRows);
      setManualOrderCards([]);
      setPacketStats(null);

      const snapshot = buildPacketStateSnapshot({
        matchesValue: finalRows,
        manualCardsValue: [],
        packetStatsValue: null,
        stepValue: 1,
        duplicateRemovedCountValue: removedCount,
      });
      await persistPacketState(snapshot, {
        eventType: 'update_sections',
        summary: 'Reorganized sections and songs',
        change: { total_rows: finalRows.length },
      });
    } catch (err) {
      setError(err.message || 'Failed to update sections.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetChordpro = async (rowIndex) => {
    const copy = [...matches];
    copy[rowIndex] = {
      ...copy[rowIndex],
      chordproOverride: copy[rowIndex].defaultChordpro || '',
    };
    setMatches(copy);

    const snapshot = buildPacketStateSnapshot({
      matchesValue: copy,
      stepValue: 1,
    });
    await persistPacketState(snapshot, {
      eventType: 'reset_song_body',
      summary: 'Reset song body to default',
      change: { row_index: rowIndex },
    });
  };

  const handleGeneratePdf = async () => {
    setLoading(true);
    setError('');
    try {
      const baseSelections = toSelections(matches);
      const selectedRows = matches.filter((row) => row.selectedSongId);
      const optimized = await optimizePacketOrder(baseSelections, maintainOriginalOrder);
      const order = Array.isArray(optimized.order)
        ? optimized.order
        : baseSelections.map((_, index) => index);
      const cards = order.map((selectionIndex, generatedOrderIndex) => ({
        id: `selection-${selectionIndex}`,
        selectionIndex,
        title:
          selectedRows[selectionIndex]?.titleOverride ||
          selectedRows[selectionIndex]?.selected?.title ||
          selectedRows[selectionIndex]?.input ||
          `Song ${selectionIndex + 1}`,
        originalOrder: generatedOrderIndex + 1,
        forceNewPage: false,
      }));
      setManualOrderCards(cards);

      const orderedSelections = cards.map((card) => ({
        ...baseSelections[card.selectionIndex],
        force_new_page: card.forceNewPage,
      }));
      const result = await generatePacketPdf(
        orderedSelections,
        maintainOriginalOrder,
        showSectionHeadersInIndex
      );
      const blob = result.blob;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'song-packet.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setPacketStats(result.stats);

      const snapshot = buildPacketStateSnapshot({
        manualCardsValue: cards,
        packetStatsValue: result.stats,
        stepValue: 2,
      });
      await persistPacketState(snapshot, {
        eventType: 'generate_pdf',
        summary: 'Generated PDF from current packet state',
        change: result.stats || {},
      });

      setToast('PDF generated. Optimized order saved for manual adjustment.');
    } catch (err) {
      setError(err.message || 'PDF generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderingModeChange = (mode) => {
    setOrderingMode(mode);
    const snapshot = buildPacketStateSnapshot({
      orderingModeValue: mode,
      stepValue: 2,
    });
    persistPacketState(snapshot, {
      eventType: 'change_ordering_mode',
      summary: `Set ordering mode to ${mode}`,
      change: { ordering_mode: mode, maintain_original_order: mode === 'original' },
    });
  };

  const handleShowSectionHeadersInIndexChange = (checked) => {
    setShowSectionHeadersInIndex(checked);
    const snapshot = buildPacketStateSnapshot({
      showSectionHeadersInIndexValue: checked,
      stepValue: 2,
    });
    persistPacketState(snapshot, {
      eventType: 'toggle_show_section_headers_in_index',
      summary: checked ? 'Enabled section headers in index' : 'Disabled section headers in index',
      change: { show_section_headers_in_index: checked },
    });
  };

  const handleRequireOnePagePerSongChange = (checked) => {
    setRequireOnePagePerSong(checked);
    const snapshot = buildPacketStateSnapshot({ requireOnePagePerSongValue: checked, stepValue: 2 });
    persistPacketState(snapshot, {
      eventType: 'toggle_require_one_page_per_song',
      summary: checked ? 'Enabled require one page per song' : 'Disabled require one page per song',
      change: { require_one_page_per_song: checked },
    });
  };

  const handleShowPageNumbersChange = (checked) => {
    setShowPageNumbers(checked);
    const snapshot = buildPacketStateSnapshot({ showPageNumbersValue: checked, stepValue: 2 });
    persistPacketState(snapshot, {
      eventType: 'toggle_show_page_numbers',
      summary: checked ? 'Enabled page numbers' : 'Disabled page numbers',
      change: { show_page_numbers: checked },
    });
  };

  const handleStartingPageNumberChange = (num) => {
    setStartingPageNumber(num);
    const snapshot = buildPacketStateSnapshot({ startingPageNumberValue: num, stepValue: 2 });
    persistPacketState(snapshot, {
      eventType: 'set_starting_page_number',
      summary: `Set starting page number to ${num}`,
      change: { starting_page_number: num },
    });
  };

  const handlePageNumberPrefixChange = (prefix) => {
    setPageNumberPrefix(prefix);
    const snapshot = buildPacketStateSnapshot({ pageNumberPrefixValue: prefix, stepValue: 2 });
    persistPacketState(snapshot, {
      eventType: 'set_page_number_prefix',
      summary: `Set page number prefix to "${prefix}"`,
      change: { page_number_prefix: prefix },
    });
  };

  const handlePdfFontSizeChange = (updaterOrValue) => {
    setPdfFontSize((prev) => {
      const next = typeof updaterOrValue === 'function' ? updaterOrValue(prev) : updaterOrValue;
      const snapshot = buildPacketStateSnapshot({ pdfFontSizeValue: next, stepValue: 2 });
      persistPacketState(snapshot, {
        eventType: 'set_pdf_font_size',
        summary: `Set PDF font size to ${next}pt`,
        change: { pdf_font_size: next },
      });
      return next;
    });
  };

  const handleMoveManualCard = (draggedCardId, targetCardId) => {
    if (!draggedCardId || !targetCardId || draggedCardId === targetCardId) {
      return;
    }
    setManualOrderCards((previous) => {
      const dragIndex = previous.findIndex((item) => item.id === draggedCardId);
      const targetIndex = previous.findIndex((item) => item.id === targetCardId);
      if (dragIndex === -1 || targetIndex === -1) {
        return previous;
      }
      const next = [...previous];
      const [dragged] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, dragged);
      const snapshot = buildPacketStateSnapshot({ manualCardsValue: next, stepValue: 2 });
      persistPacketState(snapshot, {
        eventType: 'reorder_songs',
        summary: 'Reordered songs in manual generation',
        change: { drag_index: dragIndex, target_index: targetIndex },
      });
      return next;
    });
  };

  const handleToggleForceNewPage = (cardId) => {
    setManualOrderCards((previous) => {
      const next = previous.map((item) =>
        item.id === cardId ? { ...item, forceNewPage: !item.forceNewPage } : item
      );
      const snapshot = buildPacketStateSnapshot({ manualCardsValue: next, stepValue: 2 });
      persistPacketState(snapshot, {
        eventType: 'toggle_force_new_page',
        summary: 'Updated force new page setting',
        change: { card_id: cardId },
      });
      return next;
    });
  };

  const handleRegenerateFromManualOrder = async () => {
    if (!manualOrderCards.length) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const baseSelections = toSelections(matches);
      const orderedSelections = manualOrderCards.map((card) => ({
        ...baseSelections[card.selectionIndex],
        force_new_page: card.forceNewPage,
      }));
      const result = await generatePacketPdf(
        orderedSelections,
        orderingMode,
        showSectionHeadersInIndex
      );
      const blob = result.blob;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'song-packet.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setPacketStats(result.stats);

      const snapshot = buildPacketStateSnapshot({
        manualCardsValue: manualOrderCards,
        packetStatsValue: result.stats,
        stepValue: 2,
      });
      await persistPacketState(snapshot, {
        eventType: 'generate_pdf',
        summary: 'Re-generated PDF from manual order',
        change: result.stats || {},
      });

      setToast('PDF regenerated from manual order.');
    } catch (err) {
      setError(err.message || 'PDF generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePacketVersion = async () => {
    if (!activePacket?.id) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const snapshot = buildPacketStateSnapshot();
      await updateSongPacketState(activePacket.id, snapshot, {
        eventType: 'manual_save',
        summary: 'Saved packet state before versioning',
        change: { unsaved_editor_changes: hasUnsavedEditorChanges },
      });
      const result = await saveSongPacketVersion(activePacket.id, saveDescription);
      if (result?.packet) {
        setActivePacket(result.packet);
      }
      if (Array.isArray(result?.versions)) {
        setPacketVersions(result.versions);
      }
      pushLocalHistoryEvent('save_version', saveDescription || 'Saved new version');
      setHasUnsavedEditorChanges(false);
      setSaveDialogOpen(false);
      setSaveDescription('');
      await loadPacketList();
      setToast('Saved new packet version.');
    } catch (err) {
      setError(err.message || 'Saving version failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRenameActivePacket = async (newTitle) => {
    if (!activePacket?.id || !newTitle.trim()) return;
    try {
      const payload = await updateSongPacketTitle(activePacket.id, newTitle.trim());
      setActivePacket(payload.packet);
      await loadPacketList();
    } catch (err) {
      setError(err.message || 'Failed to rename packet.');
    }
  };

  const handleDeletePacket = async (packetId) => {
    try {
      await deleteSongPacket(packetId);
      if (activePacket?.id === packetId) {
        setActivePacket(null);
        setPacketTitle('');
        setSelectedPacketId('');
        setPacketMode('new');
        setMatches([]);
        setInputText('');
      }
      await loadPacketList();
      setToast('Packet deleted successfully.');
    } catch (err) {
      setError(err.message || 'Failed to delete packet.');
    }
  };

  const handleExportPacket = async () => {
    if (!activePacket?.id) return;
    try {
      const data = await exportSongPacket(activePacket.id);
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      downloadBlob(blob, `${activePacket.title.replace(/\s+/g, '_')}_packet.json`);
      setToast('Packet exported successfully.');
    } catch (err) {
      setError(err.message || 'Failed to export packet.');
    }
  };

  const handleImportPacket = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setIsHydrating(true);
    setError('');
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const packetData = JSON.parse(event.target.result);
          const payload = await importSongPacket(packetData);
          applyPacketPayload(payload, true);
          await loadPacketList();
          setToast('Packet imported successfully.');
          setPacketMenuAnchor(null);
        } catch (err) {
          setError('Failed to parse or save imported JSON file.');
          setIsHydrating(false);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      setError('Failed to read file.');
      setIsHydrating(false);
      setLoading(false);
    }
    e.target.value = null;
  };

  const handleActivatePacketVersion = async (versionId) => {
    if (!activePacket?.id) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = await activateSongPacketVersion(activePacket.id, versionId);
      applyPacketPayload(payload, true);
      setPacketMenuAnchor(null);
      setToast('Switched packet version.');
    } catch (err) {
      setError(err.message || 'Version switch failed.');
    } finally {
      setLoading(false);
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleGenerateFromVersion = async (versionId) => {
    if (!activePacket?.id) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await generateSongPacketVersionPdf(activePacket.id, versionId);
      downloadBlob(result.blob, `song-packet-v${versionId}.pdf`);
      setPacketStats(result.stats);
      setToast('Generated PDF from selected version.');
    } catch (err) {
      setError(err.message || 'Version PDF generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const songMatches = matches.filter((row) => row.type !== 'section');
  const unmatchedCount = songMatches.filter((row) => !row.selectedSongId).length;
  const canProceedToGenerate = songMatches.length > 0 && unmatchedCount === 0;
  const activeVersionNumber = activePacket?.current_version?.version_number || activePacket?.latest_version_number || 1;

  if (initializing) {
    return (
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          bgcolor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          zIndex: 9999,
        }}
      >
        <CircularProgress color="inherit" size={60} sx={{ mb: 3 }} />
        <Typography variant="h5" sx={{ fontWeight: 'medium', mb: 1 }}>
          Syncing Songbase
        </Typography>
        <Typography variant="body1" color="grey.400">
          This is a one-time setup to download the song library for offline search.
        </Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: 2, maxWidth: 1600 }}>
      {/* ── Unified sticky nav bar ─────────────────────────────── */}
      <Paper
        elevation={3}
        sx={{
          mb: 2,
          px: 2,
          py: 1,
          position: 'sticky',
          top: 8,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderRadius: 2,
          minHeight: 68,
        }}
      >
        {/* Left: app title */}
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 700, letterSpacing: '-0.3px', whiteSpace: 'nowrap', mr: 1 }}
        >
          Song Packeter
        </Typography>

        {/* Centre: inline step indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {steps.map((label, idx) => {
            const isActive = step === idx;
            const isCompleted = step > idx;
            const isDisabled =
              (idx === 1 && !activePacket) ||
              (idx === 2 && !canProceedToGenerate);
            const canClick =
              !isDisabled &&
              (idx < step || (idx === step + 1 && !isDisabled));

            return (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                  onClick={() => {
                    if (isDisabled) return;
                    if (idx < step) { setStep(idx); return; }
                    if (idx === 1 && step === 0 && activePacket) { setStep(1); return; }
                    if (idx === 2 && canProceedToGenerate) { setStep(2); return; }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 2,
                    cursor: isDisabled ? 'default' : 'pointer',
                    transition: 'background 0.15s',
                    '&:hover': !isDisabled ? {
                      bgcolor: 'action.hover',
                    } : {},
                  }}
                >
                  {/* Step number circle */}
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      flexShrink: 0,
                      bgcolor: isCompleted
                        ? 'success.main'
                        : isActive
                          ? 'primary.main'
                          : 'action.disabled',
                      color: isCompleted || isActive ? 'white' : 'text.disabled',
                    }}
                  >
                    {isCompleted ? '✓' : idx + 1}
                  </Box>
                  <Typography
                    sx={{
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '1rem',
                      color: isDisabled ? 'text.disabled' : 'text.primary',
                      userSelect: 'none',
                      lineHeight: 1.2,
                    }}
                  >
                    {label}
                  </Typography>
                </Box>
                {idx < steps.length - 1 && (
                  <Typography sx={{ color: 'text.secondary', fontSize: '1.6rem', mx: 0.5, userSelect: 'none', fontWeight: 200, lineHeight: 1 }}>›</Typography>
                )}
              </Box>
            );
          })}
        </Box>

        {/* Step navigation buttons */}
        {step === 0 && activePacket && (
          <Button
            variant="contained"
            size="small"
            onClick={() => setStep(1)}
            disabled={loading || !canProceedToGenerate}
            sx={{ textTransform: 'none', ml: 1 }}
          >
            Continue to Refine →
          </Button>
        )}

        {step === 1 && (
          <Box sx={{ display: 'flex', gap: 1, ml: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setStep(0)}
              disabled={loading}
              sx={{ textTransform: 'none' }}
            >
              ← Back to Input
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => setStep(2)}
              disabled={loading || !canProceedToGenerate}
              sx={{ textTransform: 'none' }}
            >
              Continue to Layout →
            </Button>
          </Box>
        )}

        {step === 2 && (
          <Box sx={{ display: 'flex', gap: 1, ml: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setStep(1)}
              disabled={loading}
              sx={{ textTransform: 'none' }}
            >
              ← Back to Refine
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleGeneratePdf}
              disabled={loading}
              sx={{ textTransform: 'none' }}
            >
              Generate PDF
            </Button>
          </Box>
        )}

        {hasUnsavedEditorChanges ? (
          <Chip size="small" color="warning" label="Unsaved" sx={{ ml: 0.5 }} />
        ) : null}

        {/* Spacer to push sync status and packet settings to the right */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Right Action Controls Container with Consistent Spacing */}
        <Box sx={{ flexShrink: 0, display: 'flex', gap: 1.5, alignItems: 'center' }}>
          {/* Sync status display - only shown on homepage / Input step (step === 0) */}
          {step === 0 ? (
            <Tooltip
              title={
                <Box sx={{ p: 1, maxWidth: 280 }}>
                  <Typography variant="caption" display="block" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                    Songbase Library Sync
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, lineHeight: 1.3 }}>
                    Songs available from Songbase for use in packets.
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 0.75, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                      {syncing ? 'Syncing...' : `Last synced: ${formatLastSynced(lastSynced)}`}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={handleSync}
                      disabled={syncing || loading}
                      title="Resync songs from Songbase"
                      sx={{
                        p: 0.25,
                        color: 'primary.main',
                        '&:hover': { color: 'primary.dark' },
                        animation: syncing ? 'spin 2s linear infinite' : 'none',
                        '@keyframes spin': {
                          '0%': { transform: 'rotate(0deg)' },
                          '100%': { transform: 'rotate(360deg)' },
                        },
                      }}
                    >
                      <SyncIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </Box>
              }
              disableInteractive={false}
              placement="bottom"
              arrow
              enterDelay={100}
              leaveDelay={300}
              slotProps={{
                tooltip: {
                  sx: {
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    boxShadow: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 0.75,
                  },
                },
                arrow: {
                  sx: {
                    color: 'background.paper',
                    '&::before': {
                      border: '1px solid',
                      borderColor: 'divider',
                    },
                  },
                },
              }}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: 'action.selected',
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 16,
                  border: '1px solid',
                  borderColor: 'divider',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background-color 0.2s',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: syncing ? 'warning.main' : syncedCount > 0 ? 'success.main' : 'error.main',
                    animation: syncing ? 'pulse 1.5s infinite' : 'none',
                    '@keyframes pulse': {
                      '0%': { transform: 'scale(0.95)', opacity: 0.7 },
                      '70%': { transform: 'scale(1)', opacity: 1 },
                      '100%': { transform: 'scale(0.95)', opacity: 0.7 },
                    },
                  }}
                />
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                  {syncing ? 'Syncing...' : `${syncedCount.toLocaleString()} songs synced`}
                </Typography>
                <InfoIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              </Box>
            </Tooltip>
          ) : null}

          {/* Manage Packet & Save Icon */}
          {activePacket ? (
            <>
              <Button
                variant="contained"
                color="secondary"
                size="small"
                startIcon={<PlayArrowIcon />}
                onClick={() => setIsPresentationMode(true)}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Present
              </Button>
              <Tooltip title="Save & Export Packet">
                <IconButton
                  color="primary"
                  onClick={(event) => setPacketMenuAnchor(event.currentTarget)}
                  sx={{
                    bgcolor: 'action.selected',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <SaveIcon />
                </IconButton>
              </Tooltip>
            </>
          ) : null}
        </Box>
      </Paper>

      <Popover
        anchorEl={packetMenuAnchor}
        open={Boolean(packetMenuAnchor)}
        onClose={() => setPacketMenuAnchor(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 360,
            p: 2.5,
            borderRadius: 2.5,
            boxShadow: 8,
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            border: '1px solid',
            borderColor: 'divider',
            opacity: 1,
          }
        }}
      >
        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700 }}>
            SAVE & EXPORT PACKET
          </Typography>

          <TextField
            label="Packet Title"
            size="small"
            value={packetTitle}
            onChange={(e) => setPacketTitle(e.target.value)}
            onBlur={(e) => handleRenameActivePacket(e.target.value)}
            fullWidth
          />

          <Divider sx={{ my: 0.5 }} />

          <FormControlLabel
            control={
              <Checkbox
                checked={saveOnlineEnabled}
                onChange={(e) => setSaveOnlineEnabled(e.target.checked)}
                color="primary"
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Save online with shareable URL
                </Typography>
                <Tooltip
                  title="Packets saved to a URL cannot be edited online once created. However, you can continue editing your packet locally anytime and save it at a new URL (for example: adding _v1, _v2 to the URL)."
                  arrow
                  placement="top"
                  slotProps={{
                    popper: {
                      sx: {
                        '& .MuiTooltip-tooltip': {
                          bgcolor: '#0f172a',
                          color: '#ffffff',
                          fontSize: '0.825rem',
                          lineHeight: 1.45,
                          p: 1.5,
                          borderRadius: 2,
                          boxShadow: 8,
                          border: '1px solid #334155',
                          opacity: 1,
                        },
                        '& .MuiTooltip-arrow': {
                          color: '#0f172a',
                        },
                      },
                    },
                  }}
                >
                  <IconButton size="small" sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                    <InfoIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            }
          />

          {saveOnlineEnabled && (
            <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
              <TextField
                label="Custom URL"
                size="small"
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
                fullWidth
                placeholder="sunday-service"
                InputProps={{
                  startAdornment: <InputAdornment position="start">/p/</InputAdornment>,
                }}
                sx={{ mb: 1 }}
              />
              {slugStatus.checking ? (
                <Typography variant="caption" sx={{ color: 'warning.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  Checking availability...
                </Typography>
              ) : slugStatus.available ? (
                <Typography variant="caption" sx={{ color: 'success.main', display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600 }}>
                  <CheckCircleIcon fontSize="inherit" /> URL is available!
                </Typography>
              ) : (
                <Typography variant="caption" sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <ErrorIcon fontSize="inherit" /> {slugStatus.error || 'Invalid URL'}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontSize: '0.75rem', lineHeight: 1.3 }}>
                Automatically deleted if not accessed for 18 months. Opening the packet URL resets the 18-month timer.
              </Typography>
            </Box>
          )}

          <Button
            variant="contained"
            size="medium"
            startIcon={saveOnlineEnabled ? <ShareIcon /> : <DownloadIcon />}
            onClick={async () => {
              if (saveOnlineEnabled && activePacket) {
                if (!slugStatus.available) return;
                try {
                  setLoading(true);
                  const exportData = await exportSongPacket(activePacket.id);
                  const { shareUrl } = await savePacketOnline(customSlug, exportData);
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(shareUrl);
                    setToast(`Saved online! Share link copied: ${shareUrl}`);
                  } else {
                    setToast(`Saved online! Share link: ${shareUrl}`);
                  }
                  setPacketMenuAnchor(null);
                } catch (err) {
                  setError(err.message || 'Failed to save online packet');
                } finally {
                  setLoading(false);
                }
              } else {
                handleExportPacket();
                setPacketMenuAnchor(null);
              }
            }}
            disabled={loading || (saveOnlineEnabled && (!customSlug || slugStatus.checking || !slugStatus.available))}
            fullWidth
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {saveOnlineEnabled ? 'Save Online & Copy Link' : 'Export JSON File'}
          </Button>
        </Stack>
      </Popover>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, alignItems: 'stretch', gap: { xs: 3, lg: 0 } }}>
        <Box sx={{ minWidth: 0, flexGrow: 1, mb: 2, position: 'relative' }}>
          {(loading || isHydrating) && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(255, 255, 255, 0.75)',
                backdropFilter: 'blur(3px)',
                zIndex: 100,
                minHeight: 350,
                borderRadius: 3,
                gap: 2,
                transition: 'all 0.3s ease-in-out',
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: '4px solid',
                  borderColor: 'divider',
                  borderTopColor: 'primary.main',
                  animation: 'smoothSpin 0.75s linear infinite',
                  willChange: 'transform',
                  '@keyframes smoothSpin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  },
                }}
              />
              <Typography variant="body1" color="text.primary" sx={{ fontWeight: 600 }}>
                Processing & Loading Packet...
              </Typography>
            </Box>
          )}
          <Box sx={{ opacity: loading || isHydrating ? 0.35 : 1, transition: 'opacity 0.25s ease-in-out', pointerEvents: loading || isHydrating ? 'none' : 'auto' }}>
            {step === 0 && (
              <InputStep
                packetTitle={packetTitle}
                setPacketTitle={setPacketTitle}
                inputText={inputText}
                setInputText={setInputText}
                existingPackets={existingPackets}
                onOpenExisting={handleOpenExisting}
                onCreateAndMatch={handleCreateAndMatch}
                onImportPacket={handleImportPacket}
                onDeletePacket={handleDeletePacket}
                onPresentSongs={handlePresentSongs}
                loading={loading}
              />
            )}
            {step === 1 && (
              <ReviewStep
                matches={matches}
                onSelectionChange={handleSelectionChange}
                onSearchCandidates={handleCandidateSearch}
                onDeleteRow={handleDeleteRow}
                onResetChordpro={handleResetChordpro}
                onUpdateMatches={handleUpdateMatches}
                activeRowIndex={activeReviewRowIndex}
                setActiveRowIndex={setActiveReviewRowIndex}
                unmatchedCount={unmatchedCount}
                duplicateRemovedCount={duplicateRemovedCount}
                onGoBack={() => setStep(0)}
                onGoForward={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <GenerateStep
                orderingMode={orderingMode}
                setOrderingMode={handleOrderingModeChange}
                showSectionHeadersInIndex={showSectionHeadersInIndex}
                setShowSectionHeadersInIndex={handleShowSectionHeadersInIndexChange}
                requireOnePagePerSong={requireOnePagePerSong}
                setRequireOnePagePerSong={handleRequireOnePagePerSongChange}
                showPageNumbers={showPageNumbers}
                setShowPageNumbers={handleShowPageNumbersChange}
                startingPageNumber={startingPageNumber}
                setStartingPageNumber={handleStartingPageNumberChange}
                pageNumberPrefix={pageNumberPrefix}
                setPageNumberPrefix={handlePageNumberPrefixChange}
                pdfFontSize={pdfFontSize}
                setPdfFontSize={handlePdfFontSizeChange}
                error={error}
                manualOrderCards={manualOrderCards}
                onMoveManualCard={handleMoveManualCard}
                onToggleForceNewPage={handleToggleForceNewPage}
                onRegenerateFromManualOrder={handleRegenerateFromManualOrder}
                loading={loading}
                packetStats={packetStats}
                packetVersions={packetVersions}
                activePacketVersionNumber={activePacket?.current_version?.version_number || null}
                onActivateVersion={handleActivatePacketVersion}
                onGenerateFromVersion={handleGenerateFromVersion}
                packetHistory={packetHistory}
                onGoBack={() => setStep(1)}
              />
            )}
          </Box>
        </Box>
        {step > 0 && activePacket ? (
          <Box sx={{ display: { xs: 'none', lg: 'contents' } }}>
            <ResizeHandle onMouseDown={startResize} />
            <ResizableSidebarPanel width={sidebarWidth} isResizing={sidebarResizing}>
              <PdfPreviewSidebar previewUrl={previewPdfUrl} isGenerating={isGeneratingPreview} />
            </ResizableSidebarPanel>
          </Box>
        ) : null}
      </Box>



      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2500}
        onClose={() => setToast('')}
        message={toast}
      />

      {isPresentationMode && (
        <PresentationMode
          isLoading={isHydrating}
          isSongbaseMode={isSongbasePresenting}
          packetDetails={isSongbasePresenting ? songbaseSongs : toSelections(matches, versionsCacheRef, manualOrderCards)}
          onClose={() => {
            setIsPresentationMode(false);
            setIsSongbasePresenting(false);
          }}
        />
      )}

      <ReloadPrompt />
    </Container>
  );
}

export default App;
