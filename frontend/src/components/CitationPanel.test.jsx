import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CitationPanel from './CitationPanel';

const citations = [{ chunkId: 1, index: 1, pageNumber: 3, excerpt: 'Excerpt text.' }];

describe('CitationPanel', () => {
  it('renders nothing when there are no citations', () => {
    const { container } = render(<CitationPanel citations={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('exposes aria-expanded and aria-controls, toggled by the button', () => {
    render(<CitationPanel citations={citations} />);
    const toggle = screen.getByRole('button', { name: /Show sources/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    const hideToggle = screen.getByRole('button', { name: 'Hide sources' });
    expect(hideToggle).toHaveAttribute('aria-expanded', 'true');
    const controlsId = hideToggle.getAttribute('aria-controls');
    expect(document.getElementById(controlsId)).toHaveTextContent('Excerpt text.');
  });

  it('uses a unique id per instance so two panels on one page never collide', () => {
    render(
      <>
        <CitationPanel citations={citations} />
        <CitationPanel citations={citations} />
      </>
    );
    const [firstToggle, secondToggle] = screen.getAllByRole('button', { name: /Show sources/ });
    expect(firstToggle.getAttribute('aria-controls')).not.toBe(secondToggle.getAttribute('aria-controls'));
  });
});
