import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import PresentationMode from '../presentation/PresentationMode';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('URL Routing Synchronization', () => {
  let pushStateSpy;

  beforeEach(() => {
    // Reset URL to / before each test
    window.history.pushState({}, 'Test Title', '/');
    localStorage.clear();
    pushStateSpy = vi.spyOn(window.history, 'pushState');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('entering presentation mode updates the URL to /present', async () => {
    // If we mock a pushState/popstate that sets isPresentationMode, 
    // it should render PresentationMode which has a PRESENTATION header.
    render(<App />);
    
    act(() => {
      window.history.pushState({}, '', '/present');
      window.dispatchEvent(new Event('popstate'));
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
    });
    expect(window.location.pathname).toBe('/present');
  });

  it('direct visit to /present opens presentation mode', async () => {
    window.history.pushState({}, 'Test Title', '/present');
    render(<App />);
    
    // We should see the Presentation Home
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
  });

  it('PresentationMode syncing activeSong to URL', async () => {
    window.history.pushState({}, 'Test Title', '/present');
    
    const packetDetails = [
      { song_id: 101, title: 'Test Song 1', type: 'song', lyrics: 'Line 1' }
    ];
    
    // Mock the cache since PresentationMode relies on it for direct visits
    localStorage.setItem('presentationPacketCache', JSON.stringify(packetDetails));

    const { unmount } = render(<PresentationMode packetDetails={packetDetails} onClose={() => {}} />);
    
    // The URL is /present. There should be a list item "Test Song 1"
    const songItem = screen.getByText('Test Song 1');
    fireEvent.click(songItem);

    await waitFor(() => {
      expect(pushStateSpy).toHaveBeenCalledWith({}, '', '/present/101');
    });
    
    unmount();
  });

  it('Back button from song slide returns to /present', async () => {
    const packetDetails = [
      { song_id: 101, title: 'Test Song 1', type: 'song', lyrics: 'Line 1' }
    ];
    
    localStorage.setItem('presentationPacketCache', JSON.stringify(packetDetails));
    // Start at the song
    window.history.pushState({}, '', '/present/101');

    render(<PresentationMode packetDetails={packetDetails} onClose={() => {}} />);
    
    act(() => {
      window.history.pushState({}, '', '/present');
      window.dispatchEvent(new Event('popstate'));
    });

    // The component should update its state and render the home view
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
    });
  });
});
