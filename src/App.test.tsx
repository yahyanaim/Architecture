import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App Component', () => {
  it('renders the main heading', () => {
    render(<App />);
    const heading = screen.getByText(/Clean Architecture Template/i);
    expect(heading).toBeInTheDocument();
  });

  it('renders the architect credit', () => {
    render(<App />);
    const credit = screen.getByText(/Architected by Yahia Naim/i);
    expect(credit).toBeInTheDocument();
  });
});
