import Notifications from './Notifications.jsx'
import Activity from './Activity.jsx'

export default function Alerts() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Alerts</h2>
          <p>Delivery status, reminders and the full audit trail in one place</p>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 18, alignItems: 'start' }}>
        <Notifications embedded />
        <Activity embedded />
      </div>
    </div>
  )
}
