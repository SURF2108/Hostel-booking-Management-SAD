import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { apiFetch, formatDate } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { Badge, Card } from '../components/ui/Display.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, Select } from '../components/ui/FormControls.jsx';
import { EmptyState, ErrorState, SkeletonGrid, Table } from '../components/ui/DataStates.jsx';

export function HistoryPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ category, limit: '50' });
      if (search.trim()) params.set('search', search.trim());
      const data = await apiFetch(`/history?${params.toString()}`);
      setRecords(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = (e) => {
    e.preventDefault();
    load();
  };

  return (
    <div className="stack-lg">
      <div>
        <h1>Search Historical Records</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Query historical bookings, bed allocations, complaints, visitor logs, and ledger entries.
        </p>
      </div>

      <Card accent="blue">
        <form onSubmit={handleSubmit} className="grid-12" style={{ paddingTop: 6, alignItems: 'end' }}>
          <div className="col-4">
            <Select
              id="hist-cat"
              label="Record Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="All">All Categories</option>
              <option value="Bookings">Bookings</option>
              <option value="Allocations">Allocations</option>
              <option value="Complaints">Complaints</option>
              <option value="Visitors">Visitors</option>
              {user.role !== 'Warden' && <option value="Payments">Payments</option>}
            </Select>
          </div>
          <div className="col-6">
            <Input
              id="hist-q"
              label="Keyword / ID / Status"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. BKG-2026, CheckedOut, Resolved"
            />
          </div>
          <div className="col-2" style={{ gridColumn: 'span 2' }}>
            <Button type="submit" style={{ width: '100%' }}>
              <Search size={16} strokeWidth={2} /> Search
            </Button>
          </div>
        </form>
      </Card>

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <SkeletonGrid count={3} />
      ) : records.length === 0 ? (
        <EmptyState
          title="No matching historical records"
          description="Try broadening your category or keyword."
        />
      ) : (
        <Table headers={['Category', 'Reference ID', 'Subject', 'Hostel / Context', 'Date', 'Status', 'Summary']}>
          {records.map((r, idx) => (
            <tr key={`${r.recordType}-${r.referenceId}-${idx}`}>
              <td>
                <Badge tone="ink">{r.recordType}</Badge>
              </td>
              <td className="mono">{r.referenceId}</td>
              <td>{r.subject}</td>
              <td>{r.hostelName || '—'}</td>
              <td className="mono">{formatDate(r.date)}</td>
              <td>
                <Badge status={r.status} />
              </td>
              <td style={{ fontSize: 13 }}>{r.summary}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
