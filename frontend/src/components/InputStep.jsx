import {
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

function InputStep({
  mode,
  setMode,
  packetTitle,
  setPacketTitle,
  inputText,
  setInputText,
  existingPackets,
  selectedPacketId,
  setSelectedPacketId,
  onCreateAndMatch,
  onOpenExisting,
  loading,
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
      <Paper
        elevation={2}
        sx={{
          p: 3,
          border: mode === 'new' ? '2px solid #0d47a1' : '1px solid #e0e0e0',
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h6">Create New Packet</Typography>
          <Typography variant="body2" color="text.secondary">
            Enter a required packet title and paste one song title or lyric line per row.
          </Typography>
          <TextField
            label="Packet Title"
            value={packetTitle}
            onFocus={() => setMode('new')}
            onChange={(event) => setPacketTitle(event.target.value)}
            required
          />
          <TextField
            multiline
            minRows={12}
            value={inputText}
            onFocus={() => setMode('new')}
            onChange={(event) => setInputText(event.target.value)}
            placeholder={'Lord Jesus you are Lovel\nBe thou my vision'}
          />
          <Button
            variant="contained"
            onClick={onCreateAndMatch}
            disabled={
              loading ||
              !packetTitle.trim() ||
              !inputText.trim()
            }
            sx={{ alignSelf: 'flex-start' }}
          >
            Create Packet And Match Songs
          </Button>
        </Stack>
      </Paper>

      <Paper
        elevation={2}
        sx={{
          p: 3,
          border: mode === 'existing' ? '2px solid #0d47a1' : '1px solid #e0e0e0',
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h6">Use Existing Packet</Typography>
          <Typography variant="body2" color="text.secondary">
            Select an existing packet from this browser session. Latest version loads automatically.
          </Typography>
          <TextField
            select
            label="Existing Packets"
            value={selectedPacketId || ''}
            onFocus={() => setMode('existing')}
            onChange={(event) => setSelectedPacketId(Number(event.target.value))}
            disabled={!existingPackets.length}
          >
            {existingPackets.length === 0 && (
              <MenuItem value="" disabled>
                No packets in this session yet
              </MenuItem>
            )}
            {existingPackets.map((packet) => (
              <MenuItem key={packet.id} value={packet.id}>
                {packet.title} (v{packet.latest_version_number || 1})
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={onOpenExisting}
            disabled={loading || !selectedPacketId}
            sx={{ alignSelf: 'flex-start' }}
          >
            Open Latest Version
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export default InputStep;
