const WIDTH = 340;
const HEIGHT = 150;
const BAR_WIDTH = 28;

// data: [{ label, count, isToday }, ...] — one entry per day, Monday first.
export default function WeeklyAppointmentsChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const plotHeight = HEIGHT - 34;
  const gap = (WIDTH - data.length * BAR_WIDTH) / (data.length + 1);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Appointments this week: ${data.map((d) => `${d.label} ${d.count}`).join(', ')}`}
      style={{ width: '100%', height: 'auto', maxWidth: WIDTH }}
    >
      {data.map((d, i) => {
        const barHeight = Math.max(Math.round((d.count / max) * plotHeight), d.count > 0 ? 4 : 0);
        const x = gap + i * (BAR_WIDTH + gap);
        const y = HEIGHT - 20 - barHeight;
        return (
          <g key={d.label + i}>
            <rect
              x={x}
              y={HEIGHT - 20 - Math.max(barHeight, 2)}
              width={BAR_WIDTH}
              height={Math.max(barHeight, 2)}
              rx={5}
              fill={d.isToday ? 'var(--accent-strong)' : 'var(--accent-soft)'}
            />
            <text x={x + BAR_WIDTH / 2} y={HEIGHT - 5} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
              {d.label}
            </text>
            {d.count > 0 && (
              <text
                x={x + BAR_WIDTH / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="12"
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
