export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  children,
  ...props
}) {
  const sizeClass = size === 'sm' ? 'nb-btn-sm' : '';
  return (
    <button
      type={type}
      className={`nb-btn nb-btn-${variant} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
