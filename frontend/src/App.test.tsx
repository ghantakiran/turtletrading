import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Simple test to verify TurtleTrading app loads
test('renders TurtleTrading app', () => {
  render(<App />);
  const linkElement = screen.getByText(/TurtleTrading/i);
  expect(linkElement).toBeInTheDocument();
});