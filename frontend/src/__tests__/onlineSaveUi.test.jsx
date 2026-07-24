import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';
import * as clientApi from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client');
  return {
    ...actual,
    syncSongbase: vi.fn().mockResolvedValue({ count: 10 }),
    listSongPackets: vi.fn().mockResolvedValue({
      packets: []
    }),
    createSongPacket: vi.fn().mockResolvedValue({
      packet: { id: 1, title: 'Sunday Service Set' }
    }),
    matchSongs: vi.fn().mockResolvedValue({
      results: [
        {
          input: 'Amazing Grace',
          selected: { song_id: 1, title: 'Amazing Grace', key: 'C' },
          candidates: [{ song_id: 1, title: 'Amazing Grace', key: 'C' }]
        }
      ]
    }),
    fetchVersions: vi.fn().mockResolvedValue([
      { id: 'v1', tune_name: 'Standard', capo_default: 0, lyrics_chordpro: 'C Amazing grace' }
    ]),
    updateSongPacketState: vi.fn().mockResolvedValue({
      packet: { id: 1, title: 'Sunday Service Set' }
    }),
    exportSongPacket: vi.fn().mockResolvedValue({
      title: 'Sunday Service Set',
      matches: []
    }),
    checkSlugAvailability: vi.fn().mockResolvedValue({ available: true, error: null }),
    savePacketOnline: vi.fn().mockResolvedValue({
      slug: 'Sunday-Service-Set',
      shareUrl: 'http://localhost:5173/#/p/Sunday-Service-Set'
    })
  };
});

describe('Save & Export Popover UI Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Mock clipboard writeText
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue()
      }
    });
  });

  it('renders online save option and custom slug input in Save Popover after creating a packet', async () => {
    render(<App />);

    // Click "Create New Packet" button card on homepage
    const createCard = await screen.findByText(/create new packet/i);
    fireEvent.click(createCard);

    // Enter title and song list
    const titleInput = screen.getByLabelText(/packet title/i);
    fireEvent.change(titleInput, { target: { value: 'Sunday Service Set' } });

    const textInput = screen.getByPlaceholderText(/Lord Jesus/i);
    fireEvent.change(textInput, { target: { value: 'Amazing Grace' } });

    // Submit form to create packet
    const submitMatchBtn = screen.getByRole('button', { name: /create packet & match songs/i });
    fireEvent.click(submitMatchBtn);

    // Header Save & Export button will now be active
    const saveButton = await screen.findByRole('button', { name: /save & export packet/i });
    fireEvent.click(saveButton);

    expect(screen.getByText(/SAVE & EXPORT PACKET/i)).toBeInTheDocument();
    
    // Checkbox for online save
    const onlineCheckbox = screen.getByRole('checkbox', { name: /save online with shareable url/i });
    expect(onlineCheckbox).not.toBeChecked();

    // Enable online saving
    fireEvent.click(onlineCheckbox);
    expect(onlineCheckbox).toBeChecked();

    // Custom URL slug input should appear
    const slugInput = screen.getByLabelText(/custom url slug/i);
    expect(slugInput).toBeInTheDocument();

    // Should display 18-month deletion explanation
    expect(screen.getByText(/automatically deleted if not accessed for 18 months/i)).toBeInTheDocument();
  });

  it('calls savePacketOnline and copies share URL to clipboard when Save Online button is clicked', async () => {
    render(<App />);

    const createCard = await screen.findByText(/create new packet/i);
    fireEvent.click(createCard);

    const titleInput = screen.getByLabelText(/packet title/i);
    fireEvent.change(titleInput, { target: { value: 'Sunday Service Set' } });

    const textInput = screen.getByPlaceholderText(/Lord Jesus/i);
    fireEvent.change(textInput, { target: { value: 'Amazing Grace' } });

    const submitMatchBtn = screen.getByRole('button', { name: /create packet & match songs/i });
    fireEvent.click(submitMatchBtn);

    const saveButton = await screen.findByRole('button', { name: /save & export packet/i });
    fireEvent.click(saveButton);

    const onlineCheckbox = screen.getByRole('checkbox', { name: /save online with shareable url/i });
    fireEvent.click(onlineCheckbox);

    const slugInput = screen.getByLabelText(/custom url slug/i);
    fireEvent.change(slugInput, { target: { value: 'My-Custom-Worship-Set' } });

    await waitFor(() => {
      expect(clientApi.checkSlugAvailability).toHaveBeenCalledWith('My-Custom-Worship-Set');
    });

    const submitBtn = screen.getByRole('button', { name: /save online & copy link/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(clientApi.savePacketOnline).toHaveBeenCalledWith('My-Custom-Worship-Set', expect.any(Object));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:5173/#/p/Sunday-Service-Set');
    });
  });
});
