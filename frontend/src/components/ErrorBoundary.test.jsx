import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

function Boom() {
  throw new Error('secret internal detail');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders its children when nothing goes wrong', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>
    );

    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('shows a friendly page instead of a blank screen when a child throws', () => {
    // React logs the error it caught; silence it so the test output stays readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByRole('heading', { level: 1, name: "That didn't go as planned" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to home' })).toHaveAttribute('href', '/');
  });

  it('logs the error for developers but never shows it to the visitor', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.queryByText(/secret internal detail/)).not.toBeInTheDocument();
    expect(logged.mock.calls.some((call) => String(call[0]).includes('Unhandled render error'))).toBe(true);
  });
});
