import { describe, it, expect } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter, Link, Routes, Route } from 'react-router-dom';
import RouteProgress from './RouteProgress';

describe('RouteProgress', () => {
  it('renders a decorative bar that is hidden from assistive tech', () => {
    const { container } = render(
      <MemoryRouter>
        <RouteProgress />
      </MemoryRouter>
    );
    const bar = container.querySelector('.route-progress');
    expect(bar).not.toBeNull();
    expect(bar).toHaveAttribute('aria-hidden', 'true');
  });

  it('is replaced by a fresh bar on every page change, so the sweep replays', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/a']}>
        <RouteProgress />
        <Link to="/b">go</Link>
        <Routes>
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>
    );
    const first = container.querySelector('.route-progress');
    fireEvent.click(screen.getByText('go'));
    const second = container.querySelector('.route-progress');
    expect(second).not.toBe(first);
  });
});
