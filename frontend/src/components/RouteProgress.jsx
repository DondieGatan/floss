import { useLocation } from 'react-router-dom';

// A thin brand-coloured bar that sweeps across the top on first load and on every page change.
// Keyed on the path so each navigation remounts it and replays the animation; it is purely
// decorative, so it stays out of the accessibility tree.
export default function RouteProgress() {
  const { pathname } = useLocation();
  return <div key={pathname} className="route-progress" aria-hidden="true" />;
}
