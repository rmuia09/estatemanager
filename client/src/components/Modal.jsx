export default function Modal({ title, onClose, children, wide }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={wide ? { maxWidth: 680 } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}