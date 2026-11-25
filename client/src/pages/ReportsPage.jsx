import { useCallback, useEffect, useState } from 'react';
import { Download, FileBarChart2 } from 'lucide-react';
import { apiFetch, downloadCsv, formatDateTime, formatKeyLabel } from '../lib/api.js';
import { Alert, Badge, Card } from '../components/ui/Display.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, Select } from '../components/ui/FormControls.jsx';
import { EmptyState, ErrorState, SkeletonGrid, Table } from '../components/ui/DataStates.jsx';

export function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportType, setReportType] = useState('Occupancy');
  const [reportPeriod, setReportPeriod] = useState('Term 2026');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/reports?limit=30');
      setReports(data.items || []);
      if (data.items?.length && !selectedReport) {
        setSelectedReport(data.items[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedReport]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setBanner('');
    setError('');
    try {
      const res = await apiFetch('/reports', {
        method: 'POST',
        body: { reportType, reportPeriod },
      });
      setSelectedReport(res.report);
      setBanner(`Generated ${res.report.reportType} report (#${res.report.reportId}).`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="stack-lg">
      <div>
        <h1>Generate &amp; Review Reports</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Create operational report snapshots and export tabular summaries to CSV.
        </p>
      </div>

      {banner && <Alert variant="success">{banner}</Alert>}

      <Card accent="blue" featured>
        <form
          onSubmit={handleGenerate}
          className="grid-12"
          style={{ paddingTop: 6, alignItems: 'end' }}
        >
          <div className="col-4">
            <Select
              id="rep-type"
              label="Report Type"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="Occupancy">Occupancy</option>
              <option value="Bookings">Bookings</option>
              <option value="Payments">Payments</option>
              <option value="Complaints">Complaints</option>
              <option value="AuditSummary">AuditSummary</option>
            </Select>
          </div>
          <div className="col-4">
            <Input
              id="rep-period"
              label="Report Period Label"
              value={reportPeriod}
              onChange={(e) => setReportPeriod(e.target.value)}
              required
            />
          </div>
          <div className="col-4">
            <Button type="submit" disabled={generating} style={{ width: '100%' }}>
              <FileBarChart2 size={16} strokeWidth={2} />
              {generating ? 'Generating Snapshot...' : 'Generate Report'}
            </Button>
          </div>
        </form>
      </Card>

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <SkeletonGrid count={3} />
      ) : reports.length === 0 ? (
        <EmptyState
          title="No reports generated yet"
          description="Choose a report type and period above to generate a live report."
        />
      ) : (
        <div className="grid-12">
          <div className="col-4">
            <Card accent="yellow">
              <div className="stack-sm" style={{ paddingTop: 6 }}>
                <h3>Generated Snapshots</h3>
                {reports.map((r) => {
                  const active = selectedReport?._id === r._id;
                  return (
                    <button
                      key={r._id}
                      type="button"
                      onClick={() => setSelectedReport(r)}
                      style={{
                        textAlign: 'left',
                        padding: 12,
                        border: '2px solid var(--border-color)',
                        background: active ? 'var(--accent-blue)' : 'var(--bg-canvas)',
                        color: active ? 'var(--ink-inverse)' : 'var(--ink)',
                        cursor: 'pointer',
                      }}
                    >
                      <div className="row-between">
                        <strong className="mono">RPT-{r.reportId}</strong>
                        <Badge tone={active ? 'yellow' : 'neutral'}>{r.reportType}</Badge>
                      </div>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>{r.reportPeriod}</div>
                      <div style={{ fontSize: 12, opacity: 0.85 }}>
                        {formatDateTime(r.generatedAt)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="col-8">
            {selectedReport && (
              <Card accent="ink" featured>
                <div className="stack-md" style={{ paddingTop: 6 }}>
                  <div className="row-between">
                    <div>
                      <h3>
                        RPT-{selectedReport.reportId}: {selectedReport.reportType}
                      </h3>
                      <div className="muted" style={{ fontSize: 13 }}>
                        Period: {selectedReport.reportPeriod} | Generated by{' '}
                        {selectedReport.generatedBy?.fullName || 'Staff'}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!selectedReport.rows?.length}
                      onClick={() =>
                        downloadCsv(
                          `report-${selectedReport.reportId}-${selectedReport.reportType}.csv`,
                          selectedReport.rows
                        )
                      }
                    >
                      <Download size={14} strokeWidth={2} /> Export CSV
                    </Button>
                  </div>

                  <div className="row-wrap">
                    {Object.entries(selectedReport.summaryMetrics || {}).map(([k, v]) => (
                      <div
                        key={k}
                        style={{
                          border: '2px solid var(--border-color)',
                          background: 'var(--bg-canvas)',
                          padding: '8px 12px',
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                          {formatKeyLabel(k)}
                        </div>
                        <div className="mono" style={{ fontWeight: 700 }}>
                          {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedReport.rows?.length ? (
                    <Table headers={Object.keys(selectedReport.rows[0]).map(formatKeyLabel)}>
                      {selectedReport.rows.map((row, idx) => (
                        <tr key={idx}>
                          {Object.keys(selectedReport.rows[0]).map((col) => (
                            <td key={col} className="mono" style={{ fontSize: 12 }}>
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Table>
                  ) : (
                    <p className="muted">No detail rows in this snapshot.</p>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
