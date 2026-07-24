/**
 * Tests for InputStep.jsx – landing picker dashboard and sub-views.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import InputStep from '../InputStep';

const DEFAULT_PROPS = {
  packetTitle: '',
  setPacketTitle: vi.fn(),
  inputText: '',
  setInputText: vi.fn(),
  existingPackets: [],
  onOpenExisting: vi.fn(),
  onCreateAndMatch: vi.fn(),
  onImportPacket: vi.fn(),
  loading: false,
};

describe('InputStep – landing picker menu', () => {
  it('renders all four action cards including Present Songs by default', () => {
    render(<InputStep {...DEFAULT_PROPS} />);
    expect(screen.getByText('Create New Packet')).toBeInTheDocument();
    expect(screen.getByText('Open Saved Packet')).toBeInTheDocument();
    expect(screen.getByText('Import Backup File')).toBeInTheDocument();
    expect(screen.getByText('Present Songs from Songbase')).toBeInTheDocument();
    expect(screen.getByText('Search & present directly without creating a packet')).toBeInTheDocument();
  });

  it('calls onPresentSongs when Present Songs card is clicked', () => {
    const onPresentSongs = vi.fn();
    render(<InputStep {...DEFAULT_PROPS} onPresentSongs={onPresentSongs} />);
    fireEvent.click(screen.getByText('Present Songs from Songbase'));
    expect(onPresentSongs).toHaveBeenCalledTimes(1);
  });

  it('does not immediately show the create form on mount', () => {
    render(<InputStep {...DEFAULT_PROPS} />);
    expect(screen.queryByText('Create New Song Packet')).not.toBeInTheDocument();
  });

  it('does not immediately show the open list on mount', () => {
    render(<InputStep {...DEFAULT_PROPS} />);
    expect(screen.queryByText('Open Saved Packet List')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Search saved packets...')).not.toBeInTheDocument();
  });
});

describe('InputStep – Create flow', () => {
  it('navigates to create form when card is clicked', () => {
    render(<InputStep {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByText('Create New Packet'));
    expect(screen.getByText('Create New Song Packet')).toBeInTheDocument();
  });

  it('shows Back to Menu button in create view', () => {
    render(<InputStep {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByText('Create New Packet'));
    expect(screen.getByText('Back to Menu')).toBeInTheDocument();
  });

  it('returns to dashboard when Back to Menu is clicked in create view', () => {
    render(<InputStep {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByText('Create New Packet'));
    fireEvent.click(screen.getByText('Back to Menu'));
    expect(screen.getByText('Open Saved Packet')).toBeInTheDocument();
    expect(screen.queryByText('Create New Song Packet')).not.toBeInTheDocument();
  });

  it('disables Create Packet button when title is empty', () => {
    render(<InputStep {...DEFAULT_PROPS} packetTitle="" inputText="Song Line" />);
    fireEvent.click(screen.getByText('Create New Packet'));
    const createButton = screen.getByText('Create Packet & Match Songs');
    expect(createButton).toBeDisabled();
  });

  it('disables Create Packet button when input text is empty', () => {
    render(<InputStep {...DEFAULT_PROPS} packetTitle="Good Title" inputText="" />);
    fireEvent.click(screen.getByText('Create New Packet'));
    const createButton = screen.getByText('Create Packet & Match Songs');
    expect(createButton).toBeDisabled();
  });

  it('enables Create Packet button when both title and input are non-empty', () => {
    render(<InputStep {...DEFAULT_PROPS} packetTitle="My Set" inputText="Amazing Grace" />);
    fireEvent.click(screen.getByText('Create New Packet'));
    const createButton = screen.getByText('Create Packet & Match Songs');
    expect(createButton).not.toBeDisabled();
  });

  it('calls onCreateAndMatch when create button is clicked', () => {
    const onCreateAndMatch = vi.fn();
    render(
      <InputStep
        {...DEFAULT_PROPS}
        packetTitle="My Set"
        inputText="Amazing Grace"
        onCreateAndMatch={onCreateAndMatch}
      />
    );
    fireEvent.click(screen.getByText('Create New Packet'));
    fireEvent.click(screen.getByText('Create Packet & Match Songs'));
    expect(onCreateAndMatch).toHaveBeenCalledTimes(1);
  });

  it('calls setPacketTitle when title field changes', () => {
    const setPacketTitle = vi.fn();
    render(<InputStep {...DEFAULT_PROPS} setPacketTitle={setPacketTitle} />);
    fireEvent.click(screen.getByText('Create New Packet'));
    const titleInput = screen.getByLabelText(/Packet Title/i);
    fireEvent.change(titleInput, { target: { value: 'Sunday Service' } });
    expect(setPacketTitle).toHaveBeenCalledWith('Sunday Service');
  });
});

describe('InputStep – Open flow', () => {
  it('navigates to open list when card is clicked', () => {
    render(<InputStep {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByText('Open Saved Packet'));
    expect(screen.getByText('Open Saved Packet', { selector: 'h5' })).toBeInTheDocument();
  });

  it('shows a search bar in the open view', () => {
    render(<InputStep {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByText('Open Saved Packet'));
    expect(screen.getByPlaceholderText('Search saved packets...')).toBeInTheDocument();
  });

  it('shows empty state message when no packets exist', () => {
    render(<InputStep {...DEFAULT_PROPS} existingPackets={[]} />);
    fireEvent.click(screen.getByText('Open Saved Packet'));
    expect(screen.getByText('No local packets saved yet.')).toBeInTheDocument();
  });

  it('renders existing packets in the list', () => {
    const packets = [
      { id: 1, title: 'Sunday Morning', latest_version_number: 2, updated_at: null },
      { id: 2, title: 'Evening Service', latest_version_number: 1, updated_at: null },
    ];
    render(<InputStep {...DEFAULT_PROPS} existingPackets={packets} />);
    fireEvent.click(screen.getByText('Open Saved Packet'));
    expect(screen.getByText('Sunday Morning')).toBeInTheDocument();
    expect(screen.getByText('Evening Service')).toBeInTheDocument();
  });

  it('filters packets by search query', () => {
    const packets = [
      { id: 1, title: 'Sunday Morning', latest_version_number: 1, updated_at: null },
      { id: 2, title: 'Evening Service', latest_version_number: 1, updated_at: null },
    ];
    render(<InputStep {...DEFAULT_PROPS} existingPackets={packets} />);
    fireEvent.click(screen.getByText('Open Saved Packet'));
    const searchInput = screen.getByPlaceholderText('Search saved packets...');
    fireEvent.change(searchInput, { target: { value: 'Evening' } });
    expect(screen.queryByText('Sunday Morning')).not.toBeInTheDocument();
    expect(screen.getByText('Evening Service')).toBeInTheDocument();
  });

  it('shows no results message when search has no matches', () => {
    const packets = [
      { id: 1, title: 'Sunday Morning', latest_version_number: 1, updated_at: null },
    ];
    render(<InputStep {...DEFAULT_PROPS} existingPackets={packets} />);
    fireEvent.click(screen.getByText('Open Saved Packet'));
    const searchInput = screen.getByPlaceholderText('Search saved packets...');
    fireEvent.change(searchInput, { target: { value: 'zzz-nothing' } });
    expect(screen.getByText('No packets match your search.')).toBeInTheDocument();
  });

  it('calls onOpenExisting with packet id when a packet row is clicked', () => {
    const onOpenExisting = vi.fn();
    const packets = [
      { id: 42, title: 'Click Me', latest_version_number: 1, updated_at: null },
    ];
    render(
      <InputStep {...DEFAULT_PROPS} existingPackets={packets} onOpenExisting={onOpenExisting} />
    );
    fireEvent.click(screen.getByText('Open Saved Packet'));
    fireEvent.click(screen.getByText('Click Me'));
    expect(onOpenExisting).toHaveBeenCalledWith(42);
  });

  it('returns to dashboard when Back to Menu is clicked in open view', () => {
    render(<InputStep {...DEFAULT_PROPS} />);
    fireEvent.click(screen.getByText('Open Saved Packet'));
    fireEvent.click(screen.getByText('Back to Menu'));
    expect(screen.getByText('Import Backup File')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search saved packets...')).not.toBeInTheDocument();
  });
});
