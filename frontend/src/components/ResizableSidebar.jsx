import React, { useState, useRef, useEffect } from 'react';
import { Box } from '@mui/material';

export default function ResizableSidebar({ children, initialWidth = 500, minWidth = 300, maxWidth = 800 }) {
  const [width, setWidth] = useState(initialWidth);
  const [isResizingState, setIsResizingState] = useState(false);
  const dragState = useRef({ isResizing: false, startX: 0, startWidth: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragState.current.isResizing) return;
      
      const deltaX = e.clientX - dragState.current.startX;
      // Since sidebar is on the right, moving mouse left (negative deltaX) increases width
      const newWidth = dragState.current.startWidth - deltaX;
      
      // Add constraints
      const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth, window.innerWidth - 400));
      setWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      if (dragState.current.isResizing) {
        dragState.current.isResizing = false;
        setIsResizingState(false);
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
    dragState.current = {
      isResizing: true,
      startX: e.clientX,
      startWidth: width,
    };
    setIsResizingState(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // Prevent text selection while dragging
  };

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      {/* Grabber Bar */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          width: '16px',
          cursor: 'col-resize',
          bgcolor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.2s',
          marginRight: 0,
          marginLeft: 0,
          zIndex: 10,
          '&:hover': {
            bgcolor: 'rgba(0,0,0,0.05)',
            borderRadius: '8px',
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
      <Box sx={{ width, flexShrink: 0, position: 'relative' }}>
        {children}
        {isResizingState && (
          <Box 
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              cursor: 'col-resize',
              bgcolor: 'transparent'
            }}
          />
        )}
      </Box>
    </Box>
  );
}
