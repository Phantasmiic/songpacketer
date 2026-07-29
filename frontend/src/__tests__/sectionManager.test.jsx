import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import SectionManagerDialog from '../components/SectionManagerDialog';

describe('SectionManagerDialog - Remove All Sections & Flat Saving', () => {
  const initialMatches = [
    { type: 'section', title: 'Worship Flow', id: 'sec-1' },
    { input: 'Amazing Grace', selectedSongId: 's1' },
    { input: 'How Great Is Our God', selectedSongId: 's2' },
  ];

  test('removes all sections when Remove All Sections button is clicked and saves flat song list', () => {
    let savedMatches = null;
    const handleSave = (newMatches) => {
      savedMatches = newMatches;
    };
    const handleClose = vi.fn();

    render(
      <SectionManagerDialog
        open={true}
        onClose={handleClose}
        matches={initialMatches}
        onSave={handleSave}
      />
    );

    // Verify "Remove All Sections" button is rendered when sections exist
    const removeBtn = screen.getByText('Remove All Sections');
    expect(removeBtn).toBeInTheDocument();

    // Click "Remove All Sections"
    fireEvent.click(removeBtn);

    // Save Sections
    const saveBtn = screen.getByText('Save Sections');
    fireEvent.click(saveBtn);

    // Verify saved matches contain NO section headers
    expect(savedMatches).not.toBeNull();
    expect(savedMatches.some((m) => m.type === 'section')).toBe(false);
    expect(savedMatches).toHaveLength(2);
    expect(savedMatches[0].selectedSongId).toBe('s1');
    expect(savedMatches[1].selectedSongId).toBe('s2');
  });
});
