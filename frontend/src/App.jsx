import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Snackbar,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';

import InputStep from './components/InputStep';
import ReviewStep from './components/ReviewStep';
import GenerateStep from './components/GenerateStep';
import {
  fetchVersions,
  generatePacketPdf,
  matchSongs,
  optimizePacketOrder,
  syncSongbase,
} from './api/client';

const steps = ['Input', 'Refine', 'Generate'];

function toSelections(rows) {
  return rows
    .filter((row) => row.selectedSongId)
    .map((row) => ({
      input_text: row.input,
      song_id: row.selectedSongId,
      version_id: row.selectedVersionId || null,
      capo: row.capo === '' || row.capo == null ? 0 : row.capo,
      chordpro_override: row.chordproOverride || '',
      title_override: row.titleOverride || '',
    }));
}

function allRowsMatched(rows) {
  return rows.length > 0 && rows.every((row) => Boolean(row.selectedSongId));
}

function removeDuplicateMatches(rows) {
  const seen = new Set();
  let removedCount = 0;
  const deduped = [];

  rows.forEach((row) => {
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

  const handleMatch = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await matchSongs(inputText);
      const nextRows = await Promise.all(
        data.results.map(async (row) => {
          const selectedSongId = row.selected?.song_id || row.candidates?.[0]?.song_id;
          const versions = selectedSongId ? await fetchVersions(selectedSongId) : [];
          return {
            ...row,
            selectedSongId,
            versions,
            selectedVersionId: versions?.[0]?.id || '',
            capo: versions?.[0]?.capo_default || 0,
            defaultCapo: versions?.[0]?.capo_default || 0,
            chordproOverride: versions?.[0]?.lyrics_chordpro || '',
            defaultChordpro: versions?.[0]?.lyrics_chordpro || '',
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
    } catch (err) {
      setError(err.response?.data?.detail || 'Matching failed.');
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
      setError(err.response?.data?.detail || 'Song sync failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectionChange = async (rowIndex, patch) => {
    const copy = [...matches];
    copy[rowIndex] = { ...copy[rowIndex], ...patch };

    if (patch.selectedSongId) {
      const versions = await fetchVersions(patch.selectedSongId);
      const selectedCandidate = copy[rowIndex].candidates?.find(
        (candidate) => candidate.song_id === patch.selectedSongId
      );
      copy[rowIndex].versions = versions;
      copy[rowIndex].selectedVersionId = versions?.[0]?.id || '';
      copy[rowIndex].capo = versions?.[0]?.capo_default || 0;
      copy[rowIndex].defaultCapo = versions?.[0]?.capo_default || 0;
      copy[rowIndex].chordproOverride = versions?.[0]?.lyrics_chordpro || '';
      copy[rowIndex].defaultChordpro = versions?.[0]?.lyrics_chordpro || '';
      copy[rowIndex].titleOverride =
        selectedCandidate?.title || copy[rowIndex].titleOverride || copy[rowIndex].input;
    } else if (patch.selectedVersionId && copy[rowIndex].versions?.length) {
      const chosen = copy[rowIndex].versions.find(
        (item) => item.id === patch.selectedVersionId
      );
      if (chosen) {
        copy[rowIndex].capo = chosen.capo_default || 0;
        copy[rowIndex].defaultCapo = chosen.capo_default || 0;
        copy[rowIndex].chordproOverride = chosen.lyrics_chordpro || '';
        copy[rowIndex].defaultChordpro = chosen.lyrics_chordpro || '';
      }
    }

    let finalRows = copy;
    let removedCount = duplicateRemovedCount;
    if (allRowsMatched(copy)) {
      const dedupeResult = removeDuplicateMatches(copy);
      finalRows = dedupeResult.deduped;
      removedCount = dedupeResult.removedCount;
    }
    setDuplicateRemovedCount(removedCount);
    setMatches(finalRows);
    setManualOrderCards([]);
    setPacketStats(null);
    if (activeReviewRowIndex >= finalRows.length) {
      setActiveReviewRowIndex(Math.max(0, finalRows.length - 1));
    }
  };

  const handleResetChordpro = (rowIndex) => {
    const copy = [...matches];
    copy[rowIndex] = {
      ...copy[rowIndex],
      chordproOverride: copy[rowIndex].defaultChordpro || '',
    };
    setMatches(copy);
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
      const result = await generatePacketPdf(orderedSelections, true);
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
      setToast('PDF generated. Optimized order saved for manual adjustment.');
    } catch (err) {
      setError(err.response?.data?.detail || 'PDF generation failed.');
    } finally {
      setLoading(false);
    }
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
      return next;
    });
  };

  const handleToggleForceNewPage = (cardId) => {
    setManualOrderCards((previous) =>
      previous.map((item) =>
        item.id === cardId ? { ...item, forceNewPage: !item.forceNewPage } : item
      )
    );
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
      const result = await generatePacketPdf(orderedSelections, true);
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
      setToast('PDF regenerated from manual order.');
    } catch (err) {
      setError(err.response?.data?.detail || 'PDF generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const unmatchedCount = matches.filter((row) => !row.selectedSongId).length;
  const canProceedToGenerate = matches.length > 0 && unmatchedCount === 0;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
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
        }}
      >
        {step === 0 && (
          <>
            <Button
              variant="contained"
              onClick={handleMatch}
              disabled={loading || !inputText.trim()}
            >
              Match Songs
            </Button>
            <Button variant="outlined" onClick={handleSync} disabled={loading}>
              Sync English Songs From Songbase
            </Button>
          </>
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
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Box sx={{ mb: 2 }}>
        {step === 0 && (
          <InputStep
            inputText={inputText}
            setInputText={setInputText}
          />
        )}
        {step === 1 && (
          <ReviewStep
            matches={matches}
            onSelectionChange={handleSelectionChange}
            onResetChordpro={handleResetChordpro}
            activeRowIndex={activeReviewRowIndex}
            setActiveRowIndex={setActiveReviewRowIndex}
            unmatchedCount={unmatchedCount}
            duplicateRemovedCount={duplicateRemovedCount}
          />
        )}
        {step === 2 && (
          <GenerateStep
            maintainOriginalOrder={maintainOriginalOrder}
            setMaintainOriginalOrder={setMaintainOriginalOrder}
            error={error}
            manualOrderCards={manualOrderCards}
            onMoveManualCard={handleMoveManualCard}
            onToggleForceNewPage={handleToggleForceNewPage}
            onRegenerateFromManualOrder={handleRegenerateFromManualOrder}
            loading={loading}
            packetStats={packetStats}
          />
        )}
      </Box>

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
