import { Inbox, RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react';
import { Button } from './Button.jsx';
import { Card } from './Display.jsx';

export function Table({ headers, children }) {
  return (
    <div className="nb-table-wrap">
      <table className="nb-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function SkeletonGrid({ count = 3 }) {
  return (
    <div className="grid-12" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="col-4 skeleton-box" />
      ))}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <Card accent="yellow">
      <div className="stack-sm" style={{ paddingTop: 8 }}>
        <div className="row-wrap">
          <Inbox size={20} strokeWidth={2} aria-hidden="true" />
          <h3>{title}</h3>
        </div>
        <p className="muted">{description}</p>
        {action && <div style={{ marginTop: 8 }}>{action}</div>}
      </div>
    </Card>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <Card accent="red">
      <div className="stack-sm" style={{ paddingTop: 8 }}>
        <div className="row-wrap">
          <TriangleAlert size={20} strokeWidth={2} aria-hidden="true" />
          <h3>Unable to load data</h3>
        </div>
        <p>{message}</p>
        {onRetry && (
          <div style={{ marginTop: 8 }}>
            <Button variant="secondary" size="sm" onClick={onRetry}>
              <RefreshCw size={15} strokeWidth={2} /> Retry
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export function PermissionDeniedState({ role }) {
  return (
    <Card accent="red">
      <div className="stack-sm" style={{ paddingTop: 8 }}>
        <div className="row-wrap">
          <ShieldAlert size={22} strokeWidth={2} aria-hidden="true" />
          <h3>Access Restricted</h3>
        </div>
        <p>
          Your signed-in role ({role}) does not have authorization for this module according to the
          system access policy.
        </p>
      </div>
    </Card>
  );
}
