import amaraOsei from '../assets/doctors/amara-osei.jpg';
import liamChen from '../assets/doctors/liam-chen.jpg';
import priyaNair from '../assets/doctors/priya-nair.jpg';
import marcusWebb from '../assets/doctors/marcus-webb.jpg';
import sofiaTorres from '../assets/doctors/sofia-torres.jpg';
// Generated abstract avatars (DiceBear "shapes"), not photos of real
// people — these 5 were added to seed.py after the original 5, which
// shipped with real stock photos; using more stock photos of actual
// strangers as fake doctor headshots isn't something to do lightly, so
// these get a distinct, consistent, likeness-free style instead.
import elenaVasquez from '../assets/doctors/elena-vasquez.png';
import noahBergstrom from '../assets/doctors/noah-bergstrom.png';
import aishaRahman from '../assets/doctors/aisha-rahman.png';
import thomasOkafor from '../assets/doctors/thomas-okafor.png';
import graceLindqvist from '../assets/doctors/grace-lindqvist.png';

// Keyed by the seeded demo dentists (backend/seed.py) — staff-added dentists
// without a matching name fall back to the initials avatar in DoctorsPage.
const DOCTOR_PHOTOS = {
  'Dr. Amara Osei': amaraOsei,
  'Dr. Liam Chen': liamChen,
  'Dr. Priya Nair': priyaNair,
  'Dr. Marcus Webb': marcusWebb,
  'Dr. Sofia Torres': sofiaTorres,
  'Dr. Elena Vasquez': elenaVasquez,
  'Dr. Noah Bergström': noahBergstrom,
  'Dr. Aisha Rahman': aishaRahman,
  'Dr. Thomas Okafor': thomasOkafor,
  'Dr. Grace Lindqvist': graceLindqvist,
};

export function getDoctorPhoto(fullName) {
  return DOCTOR_PHOTOS[fullName] || null;
}

// A doctor added through the directory can carry its own photoUrl (see
// backend/app/doctors/routes.py) — prefer that over the bundled seed-demo
// photos above, which only ever cover the 5 doctors seed.py creates.
export function resolveDoctorPhoto(doctor) {
  return doctor?.photoUrl || getDoctorPhoto(doctor?.fullName) || null;
}
