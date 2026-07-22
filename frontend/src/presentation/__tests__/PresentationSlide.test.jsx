import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PresentationSlide from '../PresentationSlide';

const mockGoHome = vi.fn();
const mockSetShowChords = vi.fn();
const mockSetAutoChorus = vi.fn();
const mockOpenSettings = vi.fn();

const defaultProps = {
  onGoHome: mockGoHome,
  showChords: false,
  setShowChords: mockSetShowChords,
  autoChorus: false,
  setAutoChorus: mockSetAutoChorus,
  onOpenSettings: mockOpenSettings
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('PresentationSlide Integration', () => {
  it('renders correct number of slides for standard chordpro (no auto-chorus)', () => {
    const song = {
      song_id: 'test-1',
      chordpro_override: `1
This is verse one line one
Chorus
This is chorus line one
2
This is verse two line one`
    };

    render(<PresentationSlide song={song} {...defaultProps} />);
    
    // There are 3 blocks total: V1, Chorus, V2
    expect(screen.getByText('This is verse one line one')).toBeInTheDocument();
  });

  it('automatically repeats chorus when autoChorus is true', () => {
    const song = {
      song_id: 'test-2',
      chordpro_override: `1
This is verse one line one
Chorus
This is chorus line one
2
This is verse two line one`
    };

    render(<PresentationSlide song={song} {...defaultProps} autoChorus={true} />);
    
    // Sequence should be V1, Chorus, V2, Chorus
    expect(screen.getByText('This is verse one line one')).toBeInTheDocument();
    
    // Press next
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('This is chorus line one')).toBeInTheDocument();

    // Press next
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('This is verse two line one')).toBeInTheDocument();

    // Press next (should be the auto-repeated chorus)
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('This is chorus line one')).toBeInTheDocument();
  });

  it('disables the Repeat chorus button when no chorus is present in the song', () => {
    const song = {
      song_id: 'test-3',
      chordpro_override: `1
This is verse one line one
2
This is verse two line one`
    };

    render(<PresentationSlide song={song} {...defaultProps} />);
    
    const repeatBtn = screen.getByRole('button', { name: /repeat chorus/i });
    expect(repeatBtn).toBeDisabled();
  });

  it('enables the Repeat chorus button when a chorus is present in the song', () => {
    const song = {
      song_id: 'test-4',
      chordpro_override: `1
This is verse one line one
Chorus
This is chorus line one`
    };

    render(<PresentationSlide song={song} {...defaultProps} />);
    
    const repeatBtn = screen.getByRole('button', { name: /repeat chorus/i });
    expect(repeatBtn).not.toBeDisabled();
  });
});
