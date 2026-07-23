import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FullscreenButton from '../FullscreenButton';

describe('FullscreenButton', () => {
  let originalFullscreenElement;
  let requestFullscreenMock;
  let exitFullscreenMock;

  beforeEach(() => {
    vi.clearAllMocks();
    requestFullscreenMock = vi.fn().mockResolvedValue();
    exitFullscreenMock = vi.fn().mockResolvedValue();

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      writable: true,
      value: null
    });

    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: requestFullscreenMock
    });

    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      writable: true,
      value: exitFullscreenMock
    });
  });

  it('renders Fullscreen button by default when not in fullscreen', () => {
    render(<FullscreenButton />);
    const button = screen.getByRole('button', { name: 'Fullscreen' });
    expect(button).toBeInTheDocument();
  });

  it('calls requestFullscreen on click when not in fullscreen', () => {
    render(<FullscreenButton />);
    const button = screen.getByRole('button', { name: 'Fullscreen' });
    fireEvent.click(button);
    expect(requestFullscreenMock).toHaveBeenCalledTimes(1);
  });

  it('updates to Exit Fullscreen when fullscreenchange event fires with active fullscreen element', () => {
    render(<FullscreenButton />);
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toBeInTheDocument();

    act(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        writable: true,
        value: document.documentElement
      });
      document.dispatchEvent(new Event('fullscreenchange'));
    });

    expect(screen.getByRole('button', { name: 'Exit Fullscreen' })).toBeInTheDocument();
  });

  it('calls exitFullscreen on click when in fullscreen', () => {
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      writable: true,
      value: document.documentElement
    });

    render(<FullscreenButton />);
    const button = screen.getByRole('button', { name: 'Exit Fullscreen' });
    fireEvent.click(button);
    expect(exitFullscreenMock).toHaveBeenCalledTimes(1);
  });
});
