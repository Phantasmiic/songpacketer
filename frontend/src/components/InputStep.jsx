import { Paper, Stack, TextField, Typography } from '@mui/material';

function InputStep({ inputText, setInputText }) {
  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Input Songs</Typography>
        <Typography variant="body2" color="text.secondary">
          Paste one song title or lyric line per row.
        </Typography>
        <TextField
          multiline
          minRows={10}
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          placeholder={'Lord Jesus you are Lovel\nBe thou my vision'}
        />
      </Stack>
    </Paper>
  );
}

export default InputStep;
