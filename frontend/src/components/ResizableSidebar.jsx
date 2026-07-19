import React, { useState, useRef, useEffect } from 'react';
import { Box } from '@mui/material';

export function useResizableSidebar({ initialWidth = 500, minWidth = 300, maxWidth = 800 } = {}) {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const dragState = useRef({ active: false, startX: 0, startWidth: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragState.current.active) return;
      const deltaX = e.clientX - dragState.current.startX;
      const newWidth = dragState.current.startWidth - deltaX;
      const constrained = Math.max(minWidth, Math.min(newWidth, maxWidth, window.innerWidth - 400));
      setWidth(constrained);
    };

    const handleMouseUp = () => {
      if (dragState.current.active) {
        dragState.current.active = false;
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minWidth, maxWidth]);

  const startResize = (e) => {
    e.preventDefault();
    dragState.current = { active: true, startX: e.clientX, startWidth: width };
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return { width, isResizing, startResize };
}

// Grabber bar rendered between the two columns
export function ResizeHandle({ onMouseDown }) {
  return (
    <Box
      onMouseDown={onMouseDown}
      sx={{
        width: '24px',
        flexShrink: 0,
        cursor: 'col-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.15s',
        zIndex: 20,
        '&:hover': {
          bgcolor: 'rgba(0,0,0,0.05)',
          borderRadius: '6px',
        },
        '&::after': {
          content: '""',
          display: 'block',
          width: '4px',
          height: '40px',
          bgcolor: '#bdbdbd',
          borderRadius: '2px',
        },
      }}
    />
  );
}

// Sidebar panel that blocks iframe mouse capture during resize
export function ResizableSidebarPanel({ width, isResizing, children }) {
  return (
    <Box sx={{ width, flexShrink: 0, position: 'relative' }}>
      {children}
      {isResizing && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 9999,
            cursor: 'col-resize',
          }}
        />
      )}
    </Box>
  );
}
