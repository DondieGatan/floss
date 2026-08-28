const WIDTH = 700;
const HEIGHT = 180;
const BAR_WIDTH = 48;
// Room reserved above the tallest bar for its count label — without this,
// a day at (or near) the week's max count pushes its label's baseline so
// close to y=0 that the digit's ascender gets clipped by the viewBox.
const LABEL_SPACE = 16;

// data: [{ label, count, isToday }, ...] — one entry per day, Monday first.
export default function WeeklyAppointmentsChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const plotHeight = HEIGHT - 40 - LABEL_SPACE;
  const gap = (WIDTH - data.length * BAR_WIDTH) / (data.length + 1);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Appointments this week: ${data.map((d) => `${d.label} ${d.count}`).join(', ')}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {data.map((d, i) => {
        const barHeight = Math.max(Math.round((d.count / max) * plotHeight), d.count > 0 ? 6 : 0);
        const x = gap + i * (BAR_WIDTH + gap);
        const barY = HEIGHT - 26 - Math.max(barHeight, 3);
        const labelY = barY - 8;
        return (
          <g key={d.label + i}>
            <title>
              {d.label}: {d.count} appointment{d.count === 1 ? '' : 's'}
            </title>
            {/* Faint full-height track so every day reads as a bar slot,
                even ones with zero appointments — otherwise an all-zero
                week would render as a blank strip with no chart at all. */}
            <rect
              x={x}
              y={HEIGHT - 26 - plotHeight}
              width={BAR_WIDTH}
              height={plotHeight}
              rx={8}
              fill="var(--surface-2)"
            />
            <rect
              className="weekly-chart-bar"
              x={x}
              y={barY}
              width={BAR_WIDTH}
              height={Math.max(barHeight, 3)}
              rx={8}
              fill={d.isToday ? 'var(--accent-strong)' : 'var(--accent)'}
              style={{ animationDelay: `${i * 70}ms` }}
            />
            <text x={x + BAR_WIDTH / 2} y={HEIGHT - 8} textAnchor="middle" fontSize="13" fill="var(--text-muted)">
              {d.label}
            </text>
            {d.count > 0 && (
              <text
                x={x + BAR_WIDTH / 2}
                y={labelY}
                textAnchor="middle"
                fontSize="14"
                fontWeight="700"
                fill="var(--text)"
              >
                {d.count}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
