import { useMemo } from 'react'
import { useResource } from '../api.js'
import Paginator, { usePagination } from '../components/Paginator.jsx'

const dlabel = (d) => {
  if (!d) return ''
  const parts = d.split('-')
  if (parts.length < 3) return d
  return `${parts[2]}/${parts[1]}`
}

export default function Visitors() {
  const { data, loading, error } = useResource('/api/visits')

  const recent = useMemo(() => (data ? data.recent : []), [data])
  const { page, setPage, totalItems, totalPages, pageItems } = usePagination(recent, 20)

  const maxViews = useMemo(() => Math.max(1, ...(data ? data.by_day.map((d) => d.views) : [1])), [data])

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Visitors</h2>
          <p>Page loads, unique visitors and devices — who&apos;s been opening the site</p>
        </div>
      </div>

      {loading && <div className="loading">Loading visitor stats…</div>}
      {error && <div className="error-banner">{error}</div>}

      {data && (
        <>
          <div className="card">
            <div className="stats">
              <div className="stat"><span>Total page loads</span><div className="value">{data.total}</div></div>
              <div className="stat"><span>Unique visitors</span><div className="value">{data.unique_ips}</div></div>
              <div className="stat"><span>Last 24 hours</span><div className="value">{data.last24h}</div></div>
            </div>
          </div>

          <div className="card">
            <div className="card-title"><h3>Daily views (30 days)</h3></div>
            {data.by_day.length === 0 && <p className="empty">No visits recorded yet.</p>}
            {data.by_day.length > 0 && (
              <div className="bars" style={{ height: 140 }}>
                {data.by_day.map((d) => (
                  <div className="bar-col" key={d.day} title={`${d.day}: ${d.views} view(s), ${d.uniques} visitor(s)`}>
                    <div className="bar" style={{ height: `${Math.max(2, Math.round((d.views / maxViews) * 100))}%` }}>
                      <span className="bar-val">{d.views}</span>
                    </div>
                    <div className="bar-label">{dlabel(d.day)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title"><h3>Top pages <span className="muted">({data.by_path.length})</span></h3></div>
            {data.by_path.length === 0 && <p className="empty">None yet.</p>}
            {data.by_path.length > 0 && (
              <div className="chips">
                {data.by_path.map((p) => <span className="chip" key={p.path}><b>{p.path}</b> × {p.views}</span>)}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">
              <h3>Recent visits <span className="muted">({data.total})</span></h3>
            </div>
            {recent.length === 0 && <p className="empty">No visits recorded yet.</p>}
            {recent.length > 0 && (
              <>
                <Paginator page={page} totalPages={totalPages} totalItems={totalItems} setPage={setPage} />
                <div className="tbl-wrap">
                  <table>
                    <thead>
                      <tr><th>When</th><th>IP</th><th>Path</th><th>Device</th><th>Browser</th></tr>
                    </thead>
                    <tbody>
                      {pageItems.map((v) => (
                        <tr key={v.id}>
                          <td data-label="When" className="small muted">{v.created_at}</td>
                          <td data-label="IP" className="small mono">{v.ip || '—'}</td>
                          <td data-label="Path" className="small">{v.path}</td>
                          <td data-label="Device"><span className="badge neutral">{v.device}</span></td>
                          <td data-label="Browser" className="small">{v.browser}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Paginator page={page} totalPages={totalPages} totalItems={totalItems} setPage={setPage} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}