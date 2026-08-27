import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ManageDirectoryPage from './ManageDirectoryPage';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('../components/AppLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

const department = { id: 9, name: 'General Dentistry' };

const doctor = {
  id: 1,
  fullName: 'Dr. Amara Osei',
  specialty: 'General',
  departmentId: 9,
  departmentName: 'General Dentistry',
  photoUrl: null,
  availability: [],
};

describe('ManageDirectoryPage — availability toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path) => {
      if (path === '/departments') return Promise.resolve({ departments: [department] });
      if (path === '/doctors') return Promise.resolve({ doctors: [doctor] });
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });
  });

  it('exposes aria-expanded on the availability toggle, matching its open/closed state', async () => {
    render(<ManageDirectoryPage />);
    const toggle = await screen.findByRole('button', { name: 'Manage availability' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    const hideToggle = screen.getByRole('button', { name: 'Hide availability' });
    expect(hideToggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('lets a dentist be added with a photo URL', async () => {
    api.post.mockResolvedValue({ doctor: { ...doctor, id: 2, photoUrl: 'https://example.com/photo.jpg' } });
    render(<ManageDirectoryPage />);
    await screen.findByText('Dr. Amara Osei');

    fireEvent.change(screen.getByPlaceholderText('Dr. Jane Smith'), { target: { value: 'Dr. New Hire' } });
    fireEvent.change(screen.getByPlaceholderText('https://…'), {
      target: { value: 'https://example.com/photo.jpg' },
    });

    expect(await screen.findByDisplayValue('https://example.com/photo.jpg')).toBeInTheDocument();
  });

  it('opens an edit form for an existing dentist, pre-filled with their current photo URL, and saves via PUT', async () => {
    const withPhoto = { ...doctor, photoUrl: 'https://example.com/existing.jpg' };
    api.get.mockImplementation((path) => {
      if (path === '/departments') return Promise.resolve({ departments: [department] });
      if (path === '/doctors') return Promise.resolve({ doctors: [withPhoto] });
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });
    api.put.mockResolvedValue({ doctor: withPhoto });

    render(<ManageDirectoryPage />);
    // DepartmentCard also has its own "Edit" button, so scope to the dentist's own card.
    const doctorCard = (await screen.findByText('Dr. Amara Osei')).closest('.card');
    fireEvent.click(within(doctorCard).getByRole('button', { name: 'Edit' }));

    expect(screen.getByDisplayValue('https://example.com/existing.jpg')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/doctors/1', {
        fullName: 'Dr. Amara Osei',
        specialty: 'General',
        departmentId: 9,
        bio: undefined,
        photoUrl: 'https://example.com/existing.jpg',
      })
    );
  });
});
