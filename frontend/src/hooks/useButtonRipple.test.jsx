import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import useButtonRipple from './useButtonRipple';

function Harness() {
  useButtonRipple();
  return (
    <div>
      <button className="btn btn-primary">Save</button>
      <button className="btn" disabled>Disabled</button>
      <button className="plain">Plain</button>
    </div>
  );
}

function press(element) {
  element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 12, clientY: 8 }));
}

describe('useButtonRipple', () => {
  beforeEach(() => {
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  });

  it('adds a ripple to a button when it is pressed', () => {
    render(<Harness />);
    press(screen.getByText('Save'));
    expect(screen.getByText('Save').querySelector('.ripple')).not.toBeNull();
  });

  it('removes the ripple once its animation ends', () => {
    render(<Harness />);
    const button = screen.getByText('Save');
    press(button);
    button.querySelector('.ripple').dispatchEvent(new Event('animationend'));
    expect(button.querySelector('.ripple')).toBeNull();
  });

  it('skips disabled buttons and elements that are not buttons of ours', () => {
    render(<Harness />);
    press(screen.getByText('Disabled'));
    press(screen.getByText('Plain'));
    expect(document.querySelector('.ripple')).toBeNull();
  });

  it('does nothing for people who ask for reduced motion', () => {
    window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    render(<Harness />);
    press(screen.getByText('Save'));
    expect(document.querySelector('.ripple')).toBeNull();
  });
});
