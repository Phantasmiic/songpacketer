import { Box, CircularProgress, Typography, Paper, IconButton, Tooltip } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

function PdfPreviewSidebar({ previewUrl, isGenerating }) {
  return (
    <Paper
      elevation={2}
      sx={{
        height: '100%',
        minHeight: 600,
        position: 'sticky',
        top: 12,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: '#f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Live Preview</Typography>
        {previewUrl && (
          <Tooltip title="View Larger in New Tab">
            <IconButton 
              size="small" 
              onClick={() => window.open(previewUrl, '_blank')}
              sx={{ color: 'text.secondary' }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Box sx={{ flexGrow: 1, position: 'relative', bgcolor: '#e0e0e0' }}>
        {isGenerating && (
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
              bgcolor: 'rgba(255, 255, 255, 0.7)',
              zIndex: 10,
            }}
          >
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Updating preview...
            </Typography>
          </Box>
        )}
        {previewUrl ? (
          <iframe
            src={previewUrl}
            title="PDF Preview"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              p: 3,
              textAlign: 'center',
            }}
          >
            <Typography variant="body1" color="text.secondary">
              Complete the Refine step to see the live PDF preview.
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

export default PdfPreviewSidebar;
