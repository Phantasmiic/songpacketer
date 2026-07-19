import { useEffect, useRef, useState } from 'react';
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
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';

import InputStep from './components/InputStep';
import ReviewStep from './components/ReviewStep';
import GenerateStep from './components/GenerateStep';
import PdfPreviewSidebar from './components/PdfPreviewSidebar';
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
} from './api/client';

const steps = ['Input', 'Refine', 'Generate'];

function toSelections(rows, versionsCacheRef = null) {
  return rows
    .filter((row) => row.type === 'section' || row.selectedSongId)
    .map((row) => {
      if (row.type === 'section') {
        return {
          type: 'section',
          title: row.title,
          force_new_page: false,
        };
      }
      let chordpro_text = '';
      if (versionsCacheRef && versionsCacheRef.current[row.selectedSongId]) {
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

function App() {
  const [step, setStep] = useState(0);
  const [inputText, setInputText] = useState('');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [maintainOriginalOrder, setMaintainOriginalOrder] = useState(false);
  const [activeReviewRowIndex, setActiveReviewRowIndex] = useState(0);
  const [duplicateRemovedCount, setDuplicateRemovedCount] = useState(0);
  const [manualOrderCards, setManualOrderCards] = useState([]);
  const [packetStats, setPacketStats] = useState(null);
  const [showSectionHeadersInBody, setShowSectionHeadersInBody] = useState(false);
  const [showSectionHeadersInIndex, setShowSectionHeadersInIndex] = useState(true);

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
  const [hasUnsavedEditorChanges, setHasUnsavedEditorChanges] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const { width: sidebarWidth, isResizing: sidebarResizing, startResize } = useResizableSidebar({ initialWidth: 500, minWidth: 350, maxWidth: 1000 });
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const previewTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      if (previewPdfUrl) window.URL.revokeObjectURL(previewPdfUrl);
    };
  }, [previewPdfUrl]);

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
        const payload = toSelections(manualOrderCards.length > 0 ? manualOrderCards : matches, versionsCacheRef);
        
        const result = await generatePacketPdf(
          payload,
          maintainOriginalOrder,
          showSectionHeadersInBody,
          showSectionHeadersInIndex
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

  }, [matches, manualOrderCards, maintainOriginalOrder, step]);

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

  const hydrateFromPacketState = (state) => {
    const nextState = state || {};
    const nextMatches = Array.isArray(nextState.matches) ? nextState.matches : [];
    setInputText(nextState.input_text || '');
    setMatches(nextMatches);
    primeVersionsCache(nextMatches);
    setMaintainOriginalOrder(Boolean(nextState.maintain_original_order));
    setShowSectionHeadersInBody(nextState.show_section_headers_in_body ?? false);
    setShowSectionHeadersInIndex(nextState.show_section_headers_in_index ?? true);
    setManualOrderCards(Array.isArray(nextState.manual_order_cards) ? nextState.manual_order_cards : []);
    setPacketStats(nextState.packet_stats || null);
    const nextStep = Number.isInteger(nextState.step)
      ? nextState.step
      : nextMatches.length > 0
        ? 1
        : 0;
    setStep(nextStep);
    setActiveReviewRowIndex(0);
    setDuplicateRemovedCount(nextState.duplicate_removed_count || 0);
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

  const buildPacketStateSnapshot = ({
    inputTextValue = inputText,
    matchesValue = matches,
    maintainOrderValue = maintainOriginalOrder,
    showSectionHeadersInBodyValue = showSectionHeadersInBody,
    showSectionHeadersInIndexValue = showSectionHeadersInIndex,
    manualCardsValue = manualOrderCards,
    packetStatsValue = packetStats,
    stepValue = step,
    duplicateRemovedCountValue = duplicateRemovedCount,
  } = {}) => {
    const baseSelections = toSelections(matchesValue);
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
      matches: matchesValue,
      maintain_original_order: maintainOrderValue,
      show_section_headers_in_body: showSectionHeadersInBodyValue,
      show_section_headers_in_index: showSectionHeadersInIndexValue,
      manual_order_cards: manualCardsValue,
      packet_stats: packetStatsValue,
      step: stepValue,
      duplicate_removed_count: duplicateRemovedCountValue,
      selections: orderedSelections,
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

  const handleCreateAndMatch = async () => {
    setLoading(true);
    setError('');
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
          return {
            ...row,
            selectedSongId,
            versions,
            selectedVersionId: versions?.[0]?.id || '',
            capo: versions?.[0]?.capo_default || 0,
            defaultCapo: versions?.[0]?.capo_default || 0,
            chordproOverride: versions?.[0]?.lyrics_chordpro || versions?.[0]?.chordpro_text || '',
            defaultChordpro: versions?.[0]?.lyrics_chordpro || versions?.[0]?.chordpro_text || '',
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

  const handleOpenExisting = async () => {
    if (!selectedPacketId) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = await openLatestSongPacket(selectedPacketId);
      applyPacketPayload(payload, true);
      setPacketMode('existing');
      setToast('Loaded latest packet version.');
      await loadPacketList();
    } catch (err) {
      setError(err.message || 'Failed to open packet.');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await syncSongbase();
      setToast(`Sync complete. Created: ${result.created}, Updated: ${result.updated}`);
    } catch (err) {
      setError(err.message || err.message || 'Song sync failed.');
    } finally {
      setLoading(false);
    }
  };

  const buildResolvedMatchRow = async (previousRow, matchResult) => {
    const candidates = matchResult.candidates || [];
    const selectedSongId = matchResult.selected?.song_id || candidates[0]?.song_id || '';
    const versions = selectedSongId ? await fetchVersionsCached(selectedSongId) : [];
    const selectedCandidate = candidates.find((candidate) => candidate.song_id === selectedSongId);
    const selectedTitle = matchResult.selected?.title || selectedCandidate?.title;

    return {
      ...previousRow,
      ...matchResult,
      input: previousRow.input,
      searchQuery: matchResult.input || previousRow.input,
      candidates,
      selectedSongId,
      versions,
      selectedVersionId: versions?.[0]?.id || '',
      capo: versions?.[0]?.capo_default || 0,
      defaultCapo: versions?.[0]?.capo_default || 0,
      chordproOverride: versions?.[0]?.lyrics_chordpro || versions?.[0]?.chordpro_text || '',
      defaultChordpro: versions?.[0]?.lyrics_chordpro || versions?.[0]?.chordpro_text || '',
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
      copy[rowIndex].versions = versions;
      copy[rowIndex].selectedVersionId = versions?.[0]?.id || '';
      copy[rowIndex].capo = versions?.[0]?.capo_default || 0;
      copy[rowIndex].defaultCapo = versions?.[0]?.capo_default || 0;
      copy[rowIndex].chordproOverride = versions?.[0]?.lyrics_chordpro || versions?.[0]?.chordpro_text || '';
      copy[rowIndex].defaultChordpro = versions?.[0]?.lyrics_chordpro || versions?.[0]?.chordpro_text || '';
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
            return {
              ...row,
              type: 'song',
              selectedSongId,
              versions,
              selectedVersionId: versions?.[0]?.id || '',
              capo: versions?.[0]?.capo_default || 0,
              defaultCapo: versions?.[0]?.capo_default || 0,
              chordproOverride: versions?.[0]?.lyrics_chordpro || versions?.[0]?.chordpro_text || '',
              defaultChordpro: versions?.[0]?.lyrics_chordpro || versions?.[0]?.chordpro_text || '',
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
        showSectionHeadersInBody,
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

  const handleMaintainOriginalOrderChange = (checked) => {
    setMaintainOriginalOrder(checked);
    const snapshot = buildPacketStateSnapshot({
      maintainOrderValue: checked,
      stepValue: 2,
    });
    persistPacketState(snapshot, {
      eventType: 'toggle_maintain_order',
      summary: checked ? 'Enabled maintain original order' : 'Disabled maintain original order',
      change: { maintain_original_order: checked },
    });
  };

  const handleShowSectionHeadersInBodyChange = (checked) => {
    setShowSectionHeadersInBody(checked);
    const snapshot = buildPacketStateSnapshot({
      showSectionHeadersInBodyValue: checked,
      stepValue: 2,
    });
    persistPacketState(snapshot, {
      eventType: 'toggle_show_section_headers_in_body',
      summary: checked ? 'Enabled section headers in PDF body' : 'Disabled section headers in PDF body',
      change: { show_section_headers_in_body: checked },
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
        maintainOriginalOrder,
        showSectionHeadersInBody,
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

  return (
    <Container maxWidth={false} sx={{ py: 4, maxWidth: 1600 }}>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 600 }}>
        Song Packet Generator
      </Typography>

      <Stepper activeStep={step} sx={{ mb: 3 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper
        elevation={2}
        sx={{
          mb: 2,
          p: 1.5,
          position: 'sticky',
          top: 12,
          zIndex: 20,
          display: 'flex',
          gap: 1,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {step === 0 && (
          <Button variant="outlined" onClick={handleSync} disabled={loading}>
            Sync English Songs From Songbase
          </Button>
        )}
        {step === 1 && (
          <>
            <Button variant="text" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              variant="contained"
              onClick={() => setStep(2)}
              disabled={loading || !canProceedToGenerate}
            >
              Continue To Generate
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <Button variant="text" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button variant="contained" onClick={handleGeneratePdf} disabled={loading}>
              Generate PDF
            </Button>
          </>
        )}

        <Button
          variant="outlined"
          disabled={loading || !activePacket?.id}
          onClick={() => setSaveDialogOpen(true)}
        >
          Save Version
        </Button>
        {hasUnsavedEditorChanges ? (
          <Chip
            size="small"
            color="warning"
            label="Editor changes not yet saved"
            sx={{ ml: 0.5 }}
          />
        ) : null}

        {activePacket ? (
          <Box sx={{ ml: 'auto' }}>
            <Chip
              color="info"
              clickable
              label={`${activePacket.title} · v${activeVersionNumber}`}
              onClick={(event) => setPacketMenuAnchor(event.currentTarget)}
            />
          </Box>
        ) : null}
      </Paper>

      <Menu
        anchorEl={packetMenuAnchor}
        open={Boolean(packetMenuAnchor)}
        onClose={() => setPacketMenuAnchor(null)}
      >
        {packetVersions.map((version) => (
          <MenuItem
            key={version.id}
            onClick={() => handleActivatePacketVersion(version.id)}
            selected={version.id === activePacket?.current_version?.id}
          >
            v{version.version_number} {version.description ? `- ${version.description}` : ''}
          </MenuItem>
        ))}
      </Menu>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, alignItems: 'stretch', gap: { xs: 3, lg: 0 } }}>
        <Box sx={{ minWidth: 0, flexGrow: 1, mb: 2 }}>
        {step === 0 && (
          <InputStep
            mode={packetMode}
            setMode={setPacketMode}
            packetTitle={packetTitle}
            setPacketTitle={setPacketTitle}
            inputText={inputText}
            setInputText={setInputText}
            existingPackets={existingPackets}
            selectedPacketId={selectedPacketId}
            setSelectedPacketId={setSelectedPacketId}
            onCreateAndMatch={handleCreateAndMatch}
            onOpenExisting={handleOpenExisting}
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
          />
        )}
        {step === 2 && (
          <GenerateStep
            maintainOriginalOrder={maintainOriginalOrder}
            setMaintainOriginalOrder={handleMaintainOriginalOrderChange}
            showSectionHeadersInBody={showSectionHeadersInBody}
            setShowSectionHeadersInBody={handleShowSectionHeadersInBodyChange}
            showSectionHeadersInIndex={showSectionHeadersInIndex}
            setShowSectionHeadersInIndex={handleShowSectionHeadersInIndexChange}
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
          />
        )}
        </Box>
        <Box sx={{ display: { xs: 'none', lg: 'contents' } }}>
          <ResizeHandle onMouseDown={startResize} />
          <ResizableSidebarPanel width={sidebarWidth} isResizing={sidebarResizing}>
            <PdfPreviewSidebar previewUrl={previewPdfUrl} isGenerating={isGeneratingPreview} />
          </ResizableSidebarPanel>
        </Box>
      </Box>

      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Save Packet Version</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            margin="dense"
            label="Description (optional)"
            value={saveDescription}
            onChange={(event) => setSaveDescription(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSavePacketVersion} disabled={loading}>
            Save Version
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2500}
        onClose={() => setToast('')}
        message={toast}
      />
    </Container>
  );
}

export default App;
