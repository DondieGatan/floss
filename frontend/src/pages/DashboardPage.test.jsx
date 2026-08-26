import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardPage from './DashboardPage';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));

vi.mock('../api/client', () => ({ api: { get: vi.fn() } }));

vi.mock('../components/AppLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
}

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('patient view', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ user: { fullName: 'Jordan Ellis', role: 'patient' } });
    });

    it('greets the patient by first name and shows an empty state with no appointments', async () => {
      api.get.mockResolvedValue({ appointments: [] });
      renderDashboard();

      expect(screen.getByRole('heading', { level: 1, name: 'Welcome back, Jordan' })).toBeInTheDocument();
      expect(await screen.findByText('No upcoming appointments. Ready to book one?')).toBeInTheDocument();
      expect(api.get).toHaveBeenCalledWith('/appointments');
    });

    it('counts only scheduled, future appointments as upcoming', async () => {
      const makeAppt = (id, status, scheduledStart) => ({
        id,
        status,
        scheduledStart,
        scheduledEnd: scheduledStart,
        doctorName: 'Dr. Amara Osei',
      });
      api.get.mockResolvedValue({
        appointments: [
          makeAppt(1, 'scheduled', future),
          makeAppt(2, 'scheduled', past),
          makeAppt(3, 'completed', past),
        ],
      });
      renderDashboard();

      await screen.findByText('scheduled');
      const upcomingStat = screen.getAllByText('Upcoming appointments').find((el) => el.className === 'stat-label');
      expect(upcomingStat.previousElementSibling).toHaveTextContent('1');
      const pastStat = screen.getByText('Past visits');
      expect(pastStat.previousElementSibling).toHaveTextContent('1');
    });

    it('renders every upcoming appointment with no cap, each with Cancel and Edit', async () => {
      const makeAppt = (id) => ({
        id,
        status: 'scheduled',
        scheduledStart: new Date(Date.now() + id * 86400000).toISOString(),
        scheduledEnd: new Date(Date.now() + id * 86400000).toISOString(),
        doctorName: 'Dr. Amara Osei',
      });
      api.get.mockResolvedValue({ appointments: [1, 2, 3, 4, 5, 6].map(makeAppt) });
      renderDashboard();

      const cancelButtons = await screen.findAllByRole('button', { name: 'Cancel' });
      expect(cancelButtons).toHaveLength(6);
      expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(6);
    });
  });

  describe('staff view', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ user: { fullName: 'Nora Bennett', role: 'staff' } });
    });

    it('greets staff and loads today/admissions/beds independently', async () => {
      api.get.mockImplementation((path) => {
        if (path.startsWith('/appointments')) {
          return Promise.resolve({
            appointments: [
              {
                id: 1,
                status: 'scheduled',
                scheduledStart: future,
                scheduledEnd: future,
                doctorName: 'Dr. Amara Osei',
                patientName: 'Jordan Ellis',
              },
            ],
          });
        }
        if (path === '/admissions?status=active') return Promise.resolve({ admissions: [] });
        if (path === '/admissions/beds?status=available') return Promise.resolve({ beds: [{ id: 1 }, { id: 2 }] });
        return Promise.reject(new Error(`unexpected path: ${path}`));
      });
      renderDashboard();

      expect(screen.getByRole('heading', { level: 1, name: 'Welcome back, Nora' })).toBeInTheDocument();
      const apptStat = await screen.findByText('Appointments today');
      expect(apptStat.previousElementSibling).toHaveTextContent('1');
      const bedsStat = screen.getByText('Chairs available');
      expect(bedsStat.previousElementSibling).toHaveTextContent('2');
    });

    it('shows the admin/staff quick actions, not the patient ones', () => {
      api.get.mockResolvedValue({ appointments: [], admissions: [], beds: [] });
      renderDashboard();
      expect(screen.getByText('Manage directory')).toBeInTheDocument();
      expect(screen.getByText('Treatment rooms')).toBeInTheDocument();
      expect(screen.queryByText('+ Book an appointment')).not.toBeInTheDocument();
    });
  });
});
