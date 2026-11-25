import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button.jsx';

export function Dialog({ open, title, onClose, children, maxWidth = 560 }) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    const focusTimer = setTimeout(() => {
      if (dialogRef.current) {
        const focusable = dialogRef.current.querySelector(
          'input, select, textarea, button:not([data-close-icon="true"])'
        );
        (focusable || dialogRef.current).focus();
      }
    }, 10);

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="nb-dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="nb-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nb-dialog-title"
        tabIndex={-1}
        style={{ maxWidth }}
      >
        <div className="nb-dialog-header">
          <h3 id="nb-dialog-title">{title}</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close dialog"
            data-close-icon="true"
          >
            <X size={18} strokeWidth={2} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
