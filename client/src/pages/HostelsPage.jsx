import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BedDouble, Building2, CalendarSearch, CheckCircle2, Search } from 'lucide-react';
import { apiFetch, formatDate } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { Alert, Badge, Card } from '../components/ui/Display.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, Select, Textarea } from '../components/ui/FormControls.jsx';
import { Dialog } from '../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/ui/DataStates.jsx';

function defaultDateOffset(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function HostelsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [hostelType, setHostelType] = useState('All');
  const [startDate, setStartDate] = useState(() => defaultDateOffset(7));
  const [endDate, setEndDate] = useState(() => defaultDateOffset(120));

  const [hostels, setHostels] = useState([]);
  const [selectedHostelId, setSelectedHostelId] = useState(null);
  const [hostelDetail, setHostelDetail] = useState(null);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  // Booking Modal state
  const [bookingTarget, setBookingTarget] = useState(null); // { hostel, room, bed }
  const [notes, setNotes] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadHostels = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (hostelType !== 'All') params.set('hostelType', hostelType);
      if (startDate && endDate) {
        params.set('startDate', startDate);
        params.set('endDate', endDate);
      }
      const data = await apiFetch(`/hostels?${params.toString()}`);
      setHostels(data.hostels || []);
      if (data.hostels?.length && !selectedHostelId) {
        setSelectedHostelId(data.hostels[0]._id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, hostelType, startDate, endDate, selectedHostelId]);

  const loadDetail = useCallback(
    async (id) => {
      if (!id) return;
      setDetailLoading(true);
      try {
        const params = new URLSearchParams();
        if (startDate && endDate) {
          params.set('startDate', startDate);
          params.set('endDate', endDate);
        }
        const data = await apiFetch(`/hostels/${id}?${params.toString()}`);
        setHostelDetail(data.hostel);
      } catch (err) {
        setError(err.message);
      } finally {
        setDetailLoading(false);
      }
    },
    [startDate, endDate]
  );

  useEffect(() => {
    loadHostels();
  }, [loadHostels]);

  useEffect(() => {
    if (selectedHostelId) loadDetail(selectedHostelId);
  }, [selectedHostelId, loadDetail]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    loadHostels();
    if (selectedHostelId) loadDetail(selectedHostelId);
  };

  const openBookingDialog = (room, bed) => {
    setSubmitError('');
    setNotes('');
    setBookingTarget({ hostel: hostelDetail, room, bed });
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!bookingTarget) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const res = await apiFetch('/bookings', {
        method: 'POST',
        body: {
          bedId: bookingTarget.bed._id,
          startDate,
          endDate,
          notes,
        },
      });
      setBookingTarget(null);
      setSuccessMsg(
        `Booking request ${res.booking.bookingId} submitted with Pending status. Redirecting or review under My Bookings.`
      );
      await loadHostels();
      await loadDetail(selectedHostelId);
    } catch (err) {
      setSubmitError(err.message || 'Unable to submit booking.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="stack-lg">
      <div className="row-between">
        <div>
          <h1>Hostels &amp; Bed Availability</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Search hostels and inspect real-time bed availability across your target stay dates.
          </p>
        </div>
      </div>

      {successMsg && (
        <Alert variant="success">
          <div className="row-between">
            <span>{successMsg}</span>
            <Button size="sm" variant="secondary" onClick={() => navigate('/bookings')}>
              View My Bookings
            </Button>
          </div>
        </Alert>
      )}

      <Card accent="blue">
        <form onSubmit={handleFilterSubmit} className="grid-12" style={{ paddingTop: 6, alignItems: 'end' }}>
          <div className="col-3">
            <Input
              id="hostel-search"
              label="Search Hostel"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, code, address"
            />
          </div>
          <div className="col-3">
            <Select
              id="hostel-type-filter"
              label="Hostel Type"
              value={hostelType}
              onChange={(e) => setHostelType(e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="Boys">Boys</option>
              <option value="Girls">Girls</option>
              <option value="Co-Ed">Co-Ed</option>
            </Select>
          </div>
          <div className="col-2" style={{ gridColumn: 'span 2' }}>
            <Input
              id="avail-start"
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="col-2" style={{ gridColumn: 'span 2' }}>
            <Input
              id="avail-end"
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="col-2" style={{ gridColumn: 'span 2' }}>
            <Button type="submit" style={{ width: '100%' }}>
              <Search size={16} strokeWidth={2} /> Check
            </Button>
          </div>
        </form>
      </Card>

      {error && <ErrorState message={error} onRetry={loadHostels} />}

      {loading ? (
        <SkeletonGrid count={3} />
      ) : hostels.length === 0 ? (
        <EmptyState
          title="No matching hostels found"
          description="Try clearing your search query or selecting All Types."
        />
      ) : (
        <div className="grid-12">
          {hostels.map((h) => {
            const active = selectedHostelId === h._id;
            return (
              <div key={h._id} className="col-4">
                <Card
                  accent={active ? 'blue' : 'yellow'}
                  featured={active}
                  style={{ height: '100%' }}
                >
                  <div className="stack-sm" style={{ paddingTop: 6 }}>
                    <div className="row-between">
                      <span className="mono">{h.hostelId}</span>
                      <Badge tone="ink">{h.hostelType}</Badge>
                    </div>
                    <h3>{h.hostelName}</h3>
                    <p className="muted" style={{ fontSize: 13 }}>
                      {h.address}
                    </p>
                    <div className="row-wrap" style={{ marginTop: 6 }}>
                      <Badge tone={h.availableBedsCount > 0 ? 'green' : 'red'}>
                        {h.availableBedsCount} / {h.totalBeds} Beds Available
                      </Badge>
                      <Badge tone="neutral">{h.totalRooms} Rooms</Badge>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <Button
                        variant={active ? 'primary' : 'secondary'}
                        size="sm"
                        style={{ width: '100%' }}
                        onClick={() => setSelectedHostelId(h._id)}
                      >
                        <Building2 size={15} strokeWidth={2} />
                        {active ? 'Inspecting Rooms' : 'Inspect Rooms & Beds'}
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {selectedHostelId && (
        <Card accent="ink" featured>
          <div className="stack-md" style={{ paddingTop: 6 }}>
            <div className="row-between">
              <div>
                <h2>
                  {hostelDetail?.hostelName || 'Room & Bed Matrix'} ({hostelDetail?.hostelId})
                </h2>
                <p className="muted" style={{ fontSize: 13 }}>
                  Availability evaluated for {formatDate(startDate)} to {formatDate(endDate)}
                </p>
              </div>
              <CalendarSearch size={22} strokeWidth={2} aria-hidden="true" />
            </div>

            {detailLoading ? (
              <SkeletonGrid count={3} />
            ) : !hostelDetail?.rooms?.length ? (
              <EmptyState
                title="No rooms configured"
                description="This hostel has no rooms added yet."
              />
            ) : (
              <div className="grid-12">
                {hostelDetail.rooms.map((room) => (
                  <div key={room._id} className="col-6">
                    <div
                      style={{
                        border: '2px solid var(--border-color)',
                        padding: 16,
                        backgroundColor: 'var(--bg-canvas)',
                      }}
                      className="stack-sm"
                    >
                      <div className="row-between">
                        <div>
                          <strong>Room {room.roomNumber}</strong>{' '}
                          <span className="mono muted">({room.roomId})</span>
                        </div>
                        <Badge status={room.roomStatus} />
                      </div>
                      <div style={{ fontSize: 13 }} className="muted">
                        Capacity: {room.capacity} | Period Available: {room.availableCount}
                      </div>

                      <div className="stack-sm" style={{ marginTop: 6 }}>
                        {room.beds.map((bed) => (
                          <div
                            key={bed._id}
                            className="row-between"
                            style={{
                              padding: 10,
                              border: '2px solid var(--border-color)',
                              backgroundColor: 'var(--bg-surface)',
                            }}
                          >
                            <div className="row-wrap">
                              <BedDouble size={16} strokeWidth={2} aria-hidden="true" />
                              <strong>Bed {bed.bedNumber}</strong>
                              <span className="mono muted">#{bed.bedId}</span>
                              <Badge status={bed.isAvailableForQuery ? 'Available' : bed.bedStatus} />
                              {bed.maintenanceStatus !== 'Operational' && (
                                <Badge status={bed.maintenanceStatus} />
                              )}
                            </div>

                            {user.role === 'Student' && (
                              <Button
                                size="sm"
                                variant={bed.isAvailableForQuery ? 'primary' : 'secondary'}
                                disabled={!bed.isAvailableForQuery}
                                onClick={() => openBookingDialog(room, bed)}
                              >
                                {bed.isAvailableForQuery ? 'Select & Book' : 'Unavailable'}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      <Dialog
        open={Boolean(bookingTarget)}
        title="Confirm Booking Request"
        onClose={() => setBookingTarget(null)}
      >
        {bookingTarget && (
          <form onSubmit={handleBookingSubmit} className="stack-md">
            <div
              style={{
                border: '2px solid var(--border-color)',
                background: 'var(--bg-canvas)',
                padding: 12,
              }}
              className="stack-sm"
            >
              <div>
                <strong>{bookingTarget.hostel.hostelName}</strong> — Room{' '}
                {bookingTarget.room.roomNumber}, Bed {bookingTarget.bed.bedNumber}
              </div>
              <div className="mono">
                Period: {startDate} to {endDate}
              </div>
              <div style={{ fontSize: 13 }} className="muted">
                Request will enter <strong>Pending</strong> status. Bed allocation occurs only after
                Warden review and availability re-verification.
              </div>
            </div>

            {submitError && <Alert variant="error">{submitError}</Alert>}

            <Textarea
              id="booking-notes"
              label="Booking Notes (Optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any room or accessibility preference"
            />

            <div className="row-between">
              <Button variant="secondary" onClick={() => setBookingTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                <CheckCircle2 size={16} strokeWidth={2} />
                {submitting ? 'Submitting Request...' : 'Submit Booking Request'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
