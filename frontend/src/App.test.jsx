import { render, screen } from '@testing-library/react';
import App from './App';
import { describe, it, expect } from 'vitest';

describe('App', () => {
  it('renders Song Packet Generator title', () => {
    render(<App />);
    expect(screen.getByText('Song Packet Generator')).toBeInTheDocument();
  });
});
