import amaraOsei from '../assets/doctors/amara-osei.jpg';
import liamChen from '../assets/doctors/liam-chen.jpg';
import priyaNair from '../assets/doctors/priya-nair.jpg';
import marcusWebb from '../assets/doctors/marcus-webb.jpg';
import sofiaTorres from '../assets/doctors/sofia-torres.jpg';

// Keyed by the seeded demo dentists (backend/seed.py) — staff-added dentists
// without a matching name fall back to the initials avatar in DoctorsPage.
const DOCTOR_PHOTOS = {
  'Dr. Amara Osei': amaraOsei,
  'Dr. Liam Chen': liamChen,
  'Dr. Priya Nair': priyaNair,
  'Dr. Marcus Webb': marcusWebb,
  'Dr. Sofia Torres': sofiaTorres,
};

export function getDoctorPhoto(fullName) {
  return DOCTOR_PHOTOS[fullName] || null;
}
