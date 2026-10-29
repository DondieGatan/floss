import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChatStream } from './useChatStream';
import { api } from '../api/client';

vi.mock('../api/client', () => ({ api: { postStream: vi.fn() } }));

const jsonResponse = (status, body) => ({ ok: false, status, body: {}, json: async () => body });

describe('useChatStream errors', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows the server's own reason when it refuses a message (e.g. too long)", async () => {
    api.postStream.mockResolvedValueOnce(jsonResponse(400, { error: 'Please keep messages under 1000 characters.' }));
    const { result } = renderHook(() => useChatStream('7', []));

    await act(async () => {
      await result.current.sendMessage('x'.repeat(1001));
    });

    expect(result.current.error).toBe('Please keep messages under 1000 characters.');
    // the placeholder for the reply that never came is removed
    expect(result.current.messages.filter((m) => m.role === 'assistant')).toHaveLength(0);
  });

  it('keeps a generic line for a network failure instead of the raw browser error', async () => {
    api.postStream.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useChatStream('7', []));

    await act(async () => {
      await result.current.sendMessage('hello');
    });

    expect(result.current.error).toBe('Sorry, can you repeat that again?');
  });

  it('falls back to a generic line when the refusal has no readable reason', async () => {
    api.postStream.mockResolvedValueOnce({ ok: false, status: 500, body: {}, json: async () => { throw new Error('not json'); } });
    const { result } = renderHook(() => useChatStream('7', []));

    await act(async () => {
      await result.current.sendMessage('hello');
    });

    expect(result.current.error).toBe('Failed to reach the assistant.');
  });
});
