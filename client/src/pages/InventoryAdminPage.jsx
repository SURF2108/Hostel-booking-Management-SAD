import { useCallback, useEffect, useState } from 'react';
import { BedDouble, Building2, DoorOpen, Plus, Trash2, Wrench } from 'lucide-react';
import { apiFetch } from '../lib/api.js';
import { Alert, Badge, Card } from '../components/ui/Display.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input, Select } from '../components/ui/FormControls.jsx';
import { Dialog } from '../components/ui/Dialog.jsx';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/ui/DataStates.jsx';

export function InventoryAdminPage() {
  const [hostels, setHostels] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState({ variant: '', text: '' });

  // Create Hostel Dialog
  const [hostelOpen, setHostelOpen] = useState(false);
  const [hostelForm, setHostelForm] = useState({
    hostelId: '',
    hostelName: '',
    address: '',
    hostelType: 'Co-Ed',
  });
  const [hostelErr, setHostelErr] = useState('');

  // Create Room Dialog
  const [roomOpen, setRoomOpen] = useState(false);
  const [roomForm, setRoomForm] = useState({ roomNumber: '', capacity: 2, roomStatus: 'Available' });
  const [roomErr, setRoomErr] = useState('');

  // Create Bed Dialog
  const [bedRoomTarget, setBedRoomTarget] = useState(null);
  const [bedForm, setBedForm] = useState({
    bedNumber: '',
    maintenanceStatus: 'Operational',
  });
  const [bedErr, setBedErr] = useState('');

  // Confirm delete dialog
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { kind, id, label }
  const [busy, setBusy] = useState(false);

  const loadHostels = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/hostels?includeInactive=true');
      setHostels(data.hostels || []);
      if (data.hostels?.length && !selectedId) {
        setSelectedId(data.hostels[0]._id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await apiFetch(`/hostels/${id}`);
      setDetail(data.hostel);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadHostels();
  }, [loadHostels]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const createHostel = async (e) => {
    e.preventDefault();
    setHostelErr('');
    setBusy(true);
    try {
      const res = await apiFetch('/hostels', {
        method: 'POST',
        body: {
          ...hostelForm,
          hostelId: hostelForm.hostelId.trim() || undefined,
        },
      });
      setHostelOpen(false);
      setHostelForm({ hostelId: '', hostelName: '', address: '', hostelType: 'Co-Ed' });
      setBanner({ variant: 'success', text: `Created hostel ${res.hostel.hostelName}.` });
      await loadHostels();
      setSelectedId(res.hostel._id);
    } catch (err) {
      setHostelErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleHostelActive = async (hostel) => {
    try {
      await apiFetch(`/hostels/${hostel._id}`, {
        method: 'PATCH',
        body: { isActive: !hostel.isActive },
      });
      await loadHostels();
      await loadDetail(hostel._id);
      setBanner({
        variant: 'success',
        text: `${hostel.hostelName} marked ${!hostel.isActive ? 'Active' : 'Inactive'}.`,
      });
    } catch (err) {
      setBanner({ variant: 'error', text: err.message });
    }
  };

  const createRoom = async (e) => {
    e.preventDefault();
    setRoomErr('');
    setBusy(true);
    try {
      await apiFetch(`/hostels/${selectedId}/rooms`, {
        method: 'POST',
        body: roomForm,
      });
      setRoomOpen(false);
      setRoomForm({ roomNumber: '', capacity: 2, roomStatus: 'Available' });
      setBanner({ variant: 'success', text: 'Room added to hostel.' });
      await loadHostels();
      await loadDetail(selectedId);
    } catch (err) {
      setRoomErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  const createBed = async (e) => {
    e.preventDefault();
    if (!bedRoomTarget) return;
    setBedErr('');
    setBusy(true);
    try {
      await apiFetch(`/rooms/${bedRoomTarget._id}/beds`, {
        method: 'POST',
        body: bedForm,
      });
      setBedRoomTarget(null);
      setBedForm({ bedNumber: '', maintenanceStatus: 'Operational' });
      setBanner({ variant: 'success', text: 'Bed added to room.' });
      await loadHostels();
      await loadDetail(selectedId);
    } catch (err) {
      setBedErr(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleBedMaintenance = async (bed) => {
    const nextMaint =
      bed.maintenanceStatus === 'Operational' ? 'UnderMaintenance' : 'Operational';
    try {
      await apiFetch(`/beds/${bed._id}`, {
        method: 'PATCH',
        body: { maintenanceStatus: nextMaint },
      });
      await loadHostels();
      await loadDetail(selectedId);
      setBanner({
        variant: 'success',
        text: `Bed ${bed.bedNumber} set to ${nextMaint}.`,
      });
    } catch (err) {
      setBanner({ variant: 'error', text: err.message });
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setBusy(true);
    try {
      const { kind, id } = deleteConfirm;
      const endpoint =
        kind === 'hostel' ? `/hostels/${id}` : kind === 'room' ? `/rooms/${id}` : `/beds/${id}`;
      await apiFetch(endpoint, { method: 'DELETE' });
      setDeleteConfirm(null);
      setBanner({ variant: 'info', text: `Deleted ${kind}.` });
      if (kind === 'hostel' && selectedId === id) {
        setSelectedId('');
        setDetail(null);
      }
      await loadHostels();
      if (kind !== 'hostel' && selectedId) await loadDetail(selectedId);
    } catch (err) {
      setBanner({ variant: 'error', text: err.message });
      setDeleteConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-lg">
      <div className="row-between">
        <div>
          <h1>Manage Hostels, Rooms &amp; Beds</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Configure residential buildings, room capacities, bed inventory, and maintenance flags.
          </p>
        </div>
        <Button onClick={() => setHostelOpen(true)}>
          <Plus size={16} strokeWidth={2} /> Add Hostel
        </Button>
      </div>

      {banner.text && <Alert variant={banner.variant || 'info'}>{banner.text}</Alert>}
      {error && <ErrorState message={error} onRetry={loadHostels} />}

      {loading ? (
        <SkeletonGrid count={3} />
      ) : hostels.length === 0 ? (
        <EmptyState title="No hostels registered" description="Create your first hostel above." />
      ) : (
        <div className="grid-12">
          {hostels.map((h) => {
            const active = selectedId === h._id;
            return (
              <div key={h._id} className="col-4">
                <Card accent={active ? 'blue' : 'ink'} featured={active}>
                  <div className="stack-sm" style={{ paddingTop: 6 }}>
                    <div className="row-between">
                      <span className="mono">{h.hostelId}</span>
                      <Badge tone={h.isActive ? 'green' : 'neutral'}>
                        {h.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <h3>{h.hostelName}</h3>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {h.hostelType} — {h.address}
                    </div>
                    <div className="mono" style={{ fontSize: 12 }}>
                      {h.totalRooms} Rooms | {h.totalBeds} Beds ({h.availableBedsCount} available)
                    </div>
                    <div className="row-wrap" style={{ marginTop: 6 }}>
                      <Button
                        size="sm"
                        variant={active ? 'primary' : 'secondary'}
                        onClick={() => setSelectedId(h._id)}
                      >
                        <Building2 size={14} strokeWidth={2} /> Manage Rooms
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => toggleHostelActive(h)}>
                        {h.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          setDeleteConfirm({ kind: 'hostel', id: h._id, label: h.hostelName })
                        }
                        aria-label={`Delete ${h.hostelName}`}
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {detail && (
        <Card accent="yellow" featured>
          <div className="stack-md" style={{ paddingTop: 6 }}>
            <div className="row-between">
              <div>
                <h2>
                  {detail.hostelName} ({detail.hostelId})
                </h2>
                <p className="muted" style={{ fontSize: 13 }}>
                  {detail.address}
                </p>
              </div>
              <Button size="sm" onClick={() => setRoomOpen(true)}>
                <DoorOpen size={15} strokeWidth={2} /> Add Room
              </Button>
            </div>

            {!detail.rooms?.length ? (
              <EmptyState title="No rooms yet" description="Add rooms to allocate beds." />
            ) : (
              <div className="grid-12">
                {detail.rooms.map((room) => (
                  <div key={room._id} className="col-6">
                    <div
                      style={{
                        border: '2px solid var(--border-color)',
                        padding: 16,
                        background: 'var(--bg-canvas)',
                      }}
                      className="stack-sm"
                    >
                      <div className="row-between">
                        <div>
                          <strong>Room {room.roomNumber}</strong>{' '}
                          <span className="mono muted">({room.roomId})</span>
                        </div>
                        <div className="row-wrap">
                          <Badge status={room.roomStatus} />
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={room.beds.length >= room.capacity}
                            onClick={() => {
                              setBedErr('');
                              setBedForm({
                                bedNumber: `B${room.beds.length + 1}`,
                                maintenanceStatus: 'Operational',
                              });
                              setBedRoomTarget(room);
                            }}
                          >
                            <Plus size={13} strokeWidth={2} /> Add Bed
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() =>
                              setDeleteConfirm({
                                kind: 'room',
                                id: room._id,
                                label: `Room ${room.roomNumber}`,
                              })
                            }
                            aria-label={`Delete Room ${room.roomNumber}`}
                          >
                            <Trash2 size={13} strokeWidth={2} />
                          </Button>
                        </div>
                      </div>
                      <div className="mono muted" style={{ fontSize: 12 }}>
                        Beds: {room.beds.length} / Capacity: {room.capacity}
                      </div>

                      <div className="stack-sm">
                        {room.beds.map((bed) => (
                          <div
                            key={bed._id}
                            className="row-between"
                            style={{
                              border: '2px solid var(--border-color)',
                              background: 'var(--bg-surface)',
                              padding: 8,
                            }}
                          >
                            <div className="row-wrap">
                              <BedDouble size={15} strokeWidth={2} />
                              <strong>Bed {bed.bedNumber}</strong>
                              <span className="mono muted">#{bed.bedId}</span>
                              <Badge status={bed.bedStatus} />
                              <Badge status={bed.maintenanceStatus} />
                            </div>
                            <div className="row-wrap">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => toggleBedMaintenance(bed)}
                              >
                                <Wrench size={13} strokeWidth={2} />
                                {bed.maintenanceStatus === 'Operational'
                                  ? 'Set Maintenance'
                                  : 'Set Operational'}
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() =>
                                  setDeleteConfirm({
                                    kind: 'bed',
                                    id: bed._id,
                                    label: `Bed ${bed.bedNumber} (#${bed.bedId})`,
                                  })
                                }
                                aria-label={`Delete Bed ${bed.bedNumber}`}
                              >
                                <Trash2 size={13} strokeWidth={2} />
                              </Button>
                            </div>
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

      <Dialog open={hostelOpen} title="Add New Hostel" onClose={() => setHostelOpen(false)}>
        <form onSubmit={createHostel} className="stack-md">
          {hostelErr && <Alert variant="error">{hostelErr}</Alert>}
          <Input
            id="new-hostel-id"
            label="Hostel Code (Optional)"
            value={hostelForm.hostelId}
            onChange={(e) => setHostelForm({ ...hostelForm, hostelId: e.target.value })}
            placeholder="e.g. HST-04"
          />
          <Input
            id="new-hostel-name"
            label="Hostel Name"
            value={hostelForm.hostelName}
            onChange={(e) => setHostelForm({ ...hostelForm, hostelName: e.target.value })}
            required
          />
          <Input
            id="new-hostel-addr"
            label="Address"
            value={hostelForm.address}
            onChange={(e) => setHostelForm({ ...hostelForm, address: e.target.value })}
            required
          />
          <Select
            id="new-hostel-type"
            label="Hostel Type"
            value={hostelForm.hostelType}
            onChange={(e) => setHostelForm({ ...hostelForm, hostelType: e.target.value })}
          >
            <option value="Boys">Boys</option>
            <option value="Girls">Girls</option>
            <option value="Co-Ed">Co-Ed</option>
          </Select>
          <div className="row-between">
            <Button variant="secondary" onClick={() => setHostelOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating...' : 'Create Hostel'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={roomOpen} title="Add Room" onClose={() => setRoomOpen(false)}>
        <form onSubmit={createRoom} className="stack-md">
          {roomErr && <Alert variant="error">{roomErr}</Alert>}
          <Input
            id="new-room-num"
            label="Room Number"
            value={roomForm.roomNumber}
            onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })}
            placeholder="e.g. 204"
            required
          />
          <Input
            id="new-room-cap"
            label="Capacity (Beds)"
            type="number"
            min="1"
            max="20"
            value={roomForm.capacity}
            onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
            required
          />
          <div className="row-between">
            <Button variant="secondary" onClick={() => setRoomOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Adding...' : 'Add Room'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(bedRoomTarget)}
        title={`Add Bed to Room ${bedRoomTarget?.roomNumber || ''}`}
        onClose={() => setBedRoomTarget(null)}
      >
        <form onSubmit={createBed} className="stack-md">
          {bedErr && <Alert variant="error">{bedErr}</Alert>}
          <Input
            id="new-bed-num"
            label="Bed Number"
            value={bedForm.bedNumber}
            onChange={(e) => setBedForm({ ...bedForm, bedNumber: e.target.value })}
            placeholder="e.g. B4"
            required
          />
          <Select
            id="new-bed-maint"
            label="Maintenance Status"
            value={bedForm.maintenanceStatus}
            onChange={(e) => setBedForm({ ...bedForm, maintenanceStatus: e.target.value })}
          >
            <option value="Operational">Operational</option>
            <option value="UnderMaintenance">UnderMaintenance</option>
            <option value="OutOfService">OutOfService</option>
          </Select>
          <div className="row-between">
            <Button variant="secondary" onClick={() => setBedRoomTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Adding...' : 'Create Bed'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(deleteConfirm)}
        title={`Confirm Delete ${deleteConfirm?.kind || ''}`}
        onClose={() => setDeleteConfirm(null)}
      >
        {deleteConfirm && (
          <div className="stack-md">
            <p>
              Are you sure you want to permanently delete <strong>{deleteConfirm.label}</strong>?
              Inventory with dependent rooms, beds, or active allocations will be safely blocked.
            </p>
            <div className="row-between">
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={busy} onClick={confirmDelete}>
                {busy ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
