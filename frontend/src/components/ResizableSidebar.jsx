import React, { useState, useRef, useEffect } from 'react';
import { Box } from '@mui/material';

export default function ResizableSidebar({ children, initialWidth = 500, minWidth = 300, maxWidth = 800 }) {
  const [width, setWidth] = useState(initialWidth);
  const isResizing = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      
      // Calculate width from the right side of the screen
      // This assumes the sidebar is on the far right.
      const newWidth = window.innerWidth - e.clientX;
      
      // Add constraints
      const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth, window.innerWidth - 400));
      setWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto'; // Re-enable text selection
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minWidth, maxWidth]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // Prevent text selection while dragging
  };

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      {/* Grabber Bar */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          width: '12px',
          cursor: 'col-resize',
          bgcolor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.2s',
          marginLeft: '-12px',
          zIndex: 10,
          '&:hover': {
            bgcolor: 'rgba(0,0,0,0.05)',
          },
          '&::after': {
            content: '""',
            display: 'block',
            width: '4px',
            height: '40px',
            bgcolor: '#bdbdbd',
            borderRadius: '2px',
          }
        }}
      />
      {/* Sidebar Content */}
      <Box sx={{ width, flexShrink: 0, pl: 2 }}>
        {children}
      </Box>
    </Box>
  );
}
