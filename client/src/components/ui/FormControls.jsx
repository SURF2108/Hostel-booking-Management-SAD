export function Input({ id, label, error, className = '', ...props }) {
  return (
    <div className={`nb-field ${className}`.trim()}>
      {label && (
        <label className="nb-label" htmlFor={id}>
          {label}
        </label>
      )}
      <input
        id={id}
        className="nb-input"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <span id={`${id}-error`} className="nb-field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function Select({ id, label, error, children, className = '', ...props }) {
  return (
    <div className={`nb-field ${className}`.trim()}>
      {label && (
        <label className="nb-label" htmlFor={id}>
          {label}
        </label>
      )}
      <select
        id={id}
        className="nb-select"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      >
        {children}
      </select>
      {error && (
        <span id={`${id}-error`} className="nb-field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function Textarea({ id, label, error, className = '', ...props }) {
  return (
    <div className={`nb-field ${className}`.trim()}>
      {label && (
        <label className="nb-label" htmlFor={id}>
          {label}
        </label>
      )}
      <textarea
        id={id}
        className="nb-textarea"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <span id={`${id}-error`} className="nb-field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
