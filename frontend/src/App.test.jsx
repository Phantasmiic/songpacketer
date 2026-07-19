import { render, screen } from '@testing-library/react';
import App from './App';
import { describe, it, expect } from 'vitest';

describe('App', () => {
  it('renders Song Packeter title in the nav bar', () => {
    render(<App />);
    expect(screen.getByText('Song Packeter')).toBeInTheDocument();
  });
});
