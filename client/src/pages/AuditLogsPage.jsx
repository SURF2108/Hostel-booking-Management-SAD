import { useCallback, useEffect, useState } from 'react';
import { apiFetch, formatDateTime } from '../lib/api.js';
import { Badge, Card } from '../components/ui/Display.jsx';
import { Input, Select } from '../components/ui/FormControls.jsx';
import { EmptyState, ErrorState, SkeletonGrid, Table } from '../components/ui/DataStates.jsx';

export function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [affectedModel, setAffectedModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (search.trim()) params.set('search', search.trim());
      if (affectedModel) params.set('affectedModel', affectedModel);
      const data = await apiFetch(`/audit-logs?${params.toString()}`);
      setLogs(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, affectedModel]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="stack-lg">
      <div>
        <h1>Audit Logs</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Immutable chronological log of authentication, inventory, booking, allocation, and
          financial mutations.
        </p>
      </div>

      <Card accent="red">
        <div className="row-wrap" style={{ paddingTop: 6 }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <Input
              id="audit-search"
              label="Search Action / Record / Actor"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. BOOKING_APPROVED"
            />
          </div>
          <div style={{ minWidth: 200 }}>
            <Select
              id="audit-model"
              label="Affected Entity"
              value={affectedModel}
              onChange={(e) => setAffectedModel(e.target.value)}
            >
              <option value="">All Models</option>
              <option value="User">User</option>
              <option value="Hostel">Hostel</option>
              <option value="Room">Room</option>
              <option value="Bed">Bed</option>
              <option value="Booking">Booking</option>
              <option value="Allocation">Allocation</option>
              <option value="PaymentRecord">PaymentRecord</option>
              <option value="Complaint">Complaint</option>
              <option value="VisitorRecord">VisitorRecord</option>
              <option value="Report">Report</option>
            </Select>
          </div>
        </div>
      </Card>

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <SkeletonGrid count={3} />
      ) : logs.length === 0 ? (
        <EmptyState title="No audit events matched" description="Adjust search or entity filters." />
      ) : (
        <Table headers={['Log ID', 'Timestamp', 'Action', 'Entity & Record', 'Actor', 'Details']}>
          {logs.map((l) => (
            <tr key={l._id}>
              <td className="mono">#{l.logId}</td>
              <td className="mono" style={{ fontSize: 12 }}>
                {formatDateTime(l.timestamp)}
              </td>
              <td>
                <Badge tone="ink">{l.action}</Badge>
              </td>
              <td>
                <strong>{l.affectedModel}</strong>
                <div className="mono muted">{l.affectedRecord}</div>
              </td>
              <td>
                <div>{l.actorUsername}</div>
                <Badge status={l.actorRole} />
              </td>
              <td className="mono" style={{ fontSize: 12, maxWidth: 260, wordBreak: 'break-word' }}>
                {JSON.stringify(l.details || {})}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
