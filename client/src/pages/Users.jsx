import { useEffect, useState } from 'react'
import { api, useResource } from '../api.js'
import Modal from '../components/Modal.jsx'
import ConfirmDelete from '../components/ConfirmDelete.jsx'
import Paginator, { usePagination } from '../components/Paginator.jsx'

const empty = { username: '', password: '', full_name: '', role: 'manager' }

export default function Users() {
  const { data: users, loading, error, refresh } = useResource('/api/users')
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [confirmDel, setConfirmDel] = useState(null)
  const [filterText, setFilterText] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const shown = (users || []).filter((u) => {
    if (filterRole && u.role !== filterRole) return false
    if (filterStatus === 'active' && !u.active) return false
    if (filterStatus === 'disabled' && u.active) return false
    if (filterText) {
      const q = filterText.toLowerCase()
      if (!`${u.username} ${u.full_name || ''}`.toLowerCase().includes(q)) return false
    }
    return true
  })

  const { page, setPage, totalItems, totalPages, pageItems } = usePagination(shown, 20)
  useEffect(() => setPage(1), [filterText, filterRole, filterStatus])

  function openAdd() { setForm(empty); setAdding(true) }
  function openEdit(u) { setForm({ username: u.username, password: '', full_name: u.full_name || '', role: u.role }); setEditing(u) }

  async function save(e) {
    e.preventDefault()
    setErr(''); setMsg('')
    try {
      if (editing) {
        const body = { username: form.username, full_name: form.full_name, role: form.role }
        if (form.password) body.password = form.password
        await api.patch(`/api/users/${editing.id}`, body)
        setMsg(`User "${form.username}" updated`)
      } else {
        await api.post('/api/users', form)
        setMsg(`User "${form.username}" added`)
      }
      setAdding(false); setEditing(null)
      refresh()
    } catch (x) { setErr(x.message) }
  }

  async function remove(reason) {
    setErr(''); setMsg('')
    try {
      await api.del(`/api/users/${confirmDel.id}`, { reason })
      setMsg(`User ${confirmDel.username} deleted`)
      setConfirmDel(null)
      refresh()
    } catch (x) { setErr(x.message) }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Users</h2>
          <p>Manage who can sign in to Estate Manager</p>
        </div>
        <button className="btn" onClick={openAdd}>+ Add user</button>
      </div>

      {msg && <div className="success-banner">{msg}</div>}
      {err && <div className="error-banner">{err}</div>}
      {loading && <div className="loading">Loading users…</div>}

      {(adding || editing) && (
        <Modal title={editing ? `Edit user: ${editing.username}` : 'Add user'} onClose={() => { setAdding(false); setEditing(null) }}>
          {err && <div className="error-banner">{err}</div>}
          <form onSubmit={save}>
            <div className="form-grid">
              <div className="field">
                <label>Username *</label>
                <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required autoFocus />
              </div>
              <div className="field">
                <label>Full name</label>
                <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="field">
                <label>{editing ? 'New password (leave blank to keep)' : 'Password *'}</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editing} minLength={6} />
              </div>
              <div className="field">
                <label>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <p className="muted small" style={{ marginTop: 10 }}>
              Managers use all business features; only admins manage users.
            </p>
            <div className="modal-foot" style={{ padding: '16px 0 0', border: 0, background: 'transparent' }}>
              <button type="button" className="btn secondary" onClick={() => { setAdding(false); setEditing(null) }}>Cancel</button>
              <button type="submit" className="btn">{editing ? 'Save changes' : 'Add user'}</button>
            </div>
          </form>
        </Modal>
      )}

      {users && (
        <div className="card">
          <div className="card-title">
            <h3>All users <span className="muted">({shown.length})</span></h3>
            <div className="filters">
              <input className="inp" placeholder="Search username / full name…" value={filterText} onChange={(e) => setFilterText(e.target.value)} />
              <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                <option value="">All roles</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
              {(filterText || filterRole || filterStatus) && (
                <button className="btn small secondary" onClick={() => { setFilterText(''); setFilterRole(''); setFilterStatus('') }}>Clear</button>
              )}
            </div>
          </div>
          <Paginator page={page} totalPages={totalPages} totalItems={totalItems} setPage={setPage} />
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Username</th><th>Full name</th><th>Role</th><th>Status</th><th>Created</th><th></th></tr>
              </thead>
              <tbody>
                {pageItems.map((u) => (
                  <tr key={u.id}>
                    <td data-label="Username"><strong>{u.username}</strong></td>
                    <td data-label="Full name">{u.full_name || '—'}</td>
                    <td data-label="Role"><span className={`badge ${u.role === 'admin' ? 'accent' : 'neutral'}`}>{u.role}</span></td>
                    <td data-label="Status">{u.active ? <span className="badge ok">active</span> : <span className="badge danger">disabled</span>}</td>
                    <td data-label="Created" className="muted small">{u.created_at}</td>
                    <td data-label="">
                      <div className="inline-chips">
                        <button className="btn small secondary" onClick={() => openEdit(u)}>Edit</button>
                        {u.active ? (
                          <button className="btn small secondary" onClick={() => api.patch(`/api/users/${u.id}`, { active: 0 }).then(refresh).catch((x) => setErr(x.message))}>Disable</button>
                        ) : (
                          <button className="btn small secondary" onClick={() => api.patch(`/api/users/${u.id}`, { active: 1 }).then(refresh).catch((x) => setErr(x.message))}>Enable</button>
                        )}
                        <button className="btn small danger" onClick={() => setConfirmDel(u)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td data-label="Username" colSpan="6" className="muted">No users match your filters.</td></tr>}
              </tbody>
            </table>
            <Paginator page={page} totalPages={totalPages} totalItems={totalItems} setPage={setPage} />
          </div>
        </div>
      )}

      {confirmDel && (
        <ConfirmDelete
          title="Delete user"
          message={<p>Delete user <strong>{confirmDel.username}</strong>?</p>}
          onConfirm={remove}
          onClose={() => setConfirmDel(null)}
        />
      )}
    </div>
  )
}