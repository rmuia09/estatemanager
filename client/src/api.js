import { useCallback, useEffect, useState } from 'react'

const TOKEN_KEY = 'estate_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

async function req(path, opts = {}) {
  const token = getToken()
  let res
  try {
    res = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {})
      },
      ...opts
    })
  } catch (e) {
    throw new Error('Cannot reach the server. Make sure it is running: npm run dev')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText)
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  get: (p) => req(p),
  post: (p, body) => req(p, { method: 'POST', body: JSON.stringify(body) }),
  patch: (p, body) => req(p, { method: 'PATCH', body: JSON.stringify(body) }),
  put: (p, body) => req(p, { method: 'PUT', body: JSON.stringify(body) }),
  del: (p, body) => req(p, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined })
}

export function useResource(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api.get(path))
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => { refresh() }, [refresh])

  return { data, error, loading, refresh }
}