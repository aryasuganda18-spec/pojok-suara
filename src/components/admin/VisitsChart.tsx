import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface DayPoint {
  date: string;
  hits: number;
  views: number;
}

const dayLabel = (iso: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00`));

export default function VisitsChart({ data }: { data: DayPoint[] }) {
  const total = data.reduce((s, d) => s + d.views, 0);
  return (
    <figure>
      <div className="h-56 w-full sm:h-64" role="img" aria-label={`Grafik pembacaan artikel 14 hari terakhir, total ${total} pembacaan`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
            <Tooltip
              labelFormatter={(l) => dayLabel(String(l))}
              contentStyle={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 4, fontSize: 12 }}
              formatter={(v, name) => [v as number, name === 'views' ? 'Pembacaan artikel' : 'Kunjungan halaman']}
            />
            <Area type="monotone" dataKey="hits" stroke="var(--muted)" strokeDasharray="4 3" fill="none" strokeWidth={1.5} name="hits" />
            <Area type="monotone" dataKey="views" stroke="var(--accent)" fill="url(#gv)" strokeWidth={2} name="views" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="meta mt-1 flex gap-4">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-accent" aria-hidden="true" />Pembacaan artikel</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 border-t border-dashed border-muted" aria-hidden="true" />Kunjungan halaman</span>
      </figcaption>
    </figure>
  );
}
