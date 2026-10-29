import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBookingAssistant } from './useBookingAssistant';
import { api } from '../api/client';

vi.mock('../api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const pendingAction = { id: 5, kind: 'book', status: 'pending', summary: 'Book Dr. Chen on Monday at 10:00 AM' };

function setup() {
  let messages = [];
  const setMessages = vi.fn((update) => {
    messages = typeof update === 'function' ? update(messages) : update;
  });
  const hook = renderHook(() => useBookingAssistant('9', setMessages));
  return { ...hook, getMessages: () => messages };
}

describe('useBookingAssistant', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('stays off when the server says the assistant is disabled, and loads nothing more', async () => {
    api.get.mockResolvedValueOnce({ enabled: false });
    const { result } = setup();

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/agent/status'));
    expect(result.current.enabled).toBe(false);
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('stays off, without an error, when the status check fails', async () => {
    api.get.mockRejectedValueOnce(new Error('boom'));
    const { result } = setup();

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(result.current.enabled).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('turns on and restores requests that were still waiting for confirmation', async () => {
    api.get.mockResolvedValueOnce({ enabled: true }).mockResolvedValueOnce({ actions: [pendingAction] });
    const { result } = setup();

    await waitFor(() => expect(result.current.enabled).toBe(true));
    await waitFor(() => expect(result.current.actions).toEqual([pendingAction]));
    expect(api.get).toHaveBeenCalledWith('/agent/conversations/9/actions');
  });

  it('sends a message to the booking endpoint and shows the reply and any proposal', async () => {
    api.get.mockResolvedValue({ enabled: false });
    api.post.mockResolvedValueOnce({
      message: { id: 41, role: 'assistant', content: 'Press Confirm to go ahead.' },
      pendingActions: [pendingAction],
    });
    const { result, getMessages } = setup();

    await act(async () => {
      await result.current.sendBookingMessage('Monday at 10');
    });

    expect(api.post).toHaveBeenCalledWith('/agent/conversations/9/messages', { content: 'Monday at 10' });
    expect(getMessages().map((m) => [m.role, m.content])).toEqual([
      ['user', 'Monday at 10'],
      ['assistant', 'Press Confirm to go ahead.'],
    ]);
    expect(result.current.actions).toEqual([pendingAction]);
    expect(result.current.sending).toBe(false);
  });

  it('removes the unsent message and reports the problem when the assistant fails', async () => {
    api.get.mockResolvedValue({ enabled: false });
    api.post.mockRejectedValueOnce(new Error('The assistant is temporarily unavailable. Please try again shortly.'));
    const { result, getMessages } = setup();

    await act(async () => {
      await result.current.sendBookingMessage('Monday at 10');
    });

    expect(getMessages()).toEqual([]);
    expect(result.current.error).toMatch(/temporarily unavailable/);
  });

  it('confirms a request, shows what happened, and clears the card', async () => {
    api.get.mockResolvedValueOnce({ enabled: true }).mockResolvedValueOnce({ actions: [pendingAction] });
    api.post.mockResolvedValueOnce({
      action: { ...pendingAction, status: 'confirmed', resultMessage: 'Confirmed: Book Dr. Chen.' },
    });
    const { result, getMessages } = setup();
    await waitFor(() => expect(result.current.actions).toHaveLength(1));

    await act(async () => {
      await result.current.resolveAction(5, 'confirm');
    });

    expect(api.post).toHaveBeenCalledWith('/agent/actions/5/confirm');
    expect(getMessages().map((m) => m.content)).toEqual(['Confirmed: Book Dr. Chen.']);
    expect(result.current.actions).toEqual([]);
  });

  it('rejects a request through the reject endpoint', async () => {
    api.get.mockResolvedValueOnce({ enabled: true }).mockResolvedValueOnce({ actions: [pendingAction] });
    api.post.mockResolvedValueOnce({
      action: { ...pendingAction, status: 'rejected', resultMessage: "Okay, I won't go ahead." },
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.actions).toHaveLength(1));

    await act(async () => {
      await result.current.resolveAction(5, 'reject');
    });

    expect(api.post).toHaveBeenCalledWith('/agent/actions/5/reject');
    expect(result.current.actions).toEqual([]);
  });

  it('explains a failed confirm (slot taken) and drops the card', async () => {
    api.get.mockResolvedValueOnce({ enabled: true }).mockResolvedValueOnce({ actions: [pendingAction] });
    api.post.mockRejectedValueOnce(new Error('This doctor already has an appointment at that time.'));
    const { result, getMessages } = setup();
    await waitFor(() => expect(result.current.actions).toHaveLength(1));

    await act(async () => {
      await result.current.resolveAction(5, 'confirm');
    });

    expect(getMessages()[0].content).toMatch(/could not be made: This doctor already has an appointment/);
    expect(result.current.actions).toEqual([]);
  });

  it('shows the busy notice up front when the server says every model is rate-limited', async () => {
    api.get.mockResolvedValueOnce({ enabled: true, available: false }).mockResolvedValueOnce({ actions: [] });
    const { result } = setup();

    await waitFor(() => expect(result.current.busy).toMatch(/busy right now/));
    expect(result.current.enabled).toBe(true);
  });

  it('treats a busy reply as a notice, not an error, and reports the message as undelivered', async () => {
    api.get.mockResolvedValue({ enabled: false });
    const busyError = Object.assign(new Error('The booking assistant is busy right now. Use the Dentists page.'), {
      status: 503,
      data: { code: 'assistant_busy', retryAfterSeconds: 30 },
    });
    api.post.mockRejectedValueOnce(busyError);
    const { result, getMessages } = setup();

    let delivered;
    await act(async () => {
      delivered = await result.current.sendBookingMessage('Monday at 10');
    });

    expect(delivered).toBe(false);
    expect(result.current.busy).toBe('The booking assistant is busy right now. Use the Dentists page.');
    expect(result.current.error).toBeNull();
    expect(getMessages()).toEqual([]);
  });

  it('clears the busy notice once a message gets through', async () => {
    api.get.mockResolvedValueOnce({ enabled: true, available: false }).mockResolvedValueOnce({ actions: [] });
    api.post.mockResolvedValueOnce({ message: { id: 1, role: 'assistant', content: 'Hi!' }, pendingActions: [] });
    const { result } = setup();
    await waitFor(() => expect(result.current.busy).not.toBeNull());

    let delivered;
    await act(async () => {
      delivered = await result.current.sendBookingMessage('hello');
    });

    expect(delivered).toBe(true);
    expect(result.current.busy).toBeNull();
  });

  it('still reports an ordinary failure as an error, not as busy', async () => {
    api.get.mockResolvedValue({ enabled: false });
    api.post.mockRejectedValueOnce(Object.assign(new Error('The assistant is temporarily unavailable.'), { status: 502, data: {} }));
    const { result } = setup();

    await act(async () => {
      await result.current.sendBookingMessage('hello');
    });

    expect(result.current.busy).toBeNull();
    expect(result.current.error).toMatch(/temporarily unavailable/);
  });
});
