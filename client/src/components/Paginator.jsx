import { useMemo, useState, useEffect } from 'react'

export function usePagination(items = [], pageSize = 20) {
  const [page, setPage] = useState(1)
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  )
  useEffect(() => {
    if (page > totalPages) setPage(1)
  }, [totalPages, page])
  return { page: safePage, setPage, totalItems, totalPages, pageItems }
}

export default function Paginator({ page, totalPages, totalItems, setPage, pageSize = 20 }) {
  if (totalPages <= 1) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)
  return (
    <div className="paginator">
      <span className="pag-status">{from}–{to} of {totalItems}</span>
      <div className="pag-btns">
        <button className="btn small secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button>
        <button className="btn small secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next ›</button>
      </div>
    </div>
  )
}