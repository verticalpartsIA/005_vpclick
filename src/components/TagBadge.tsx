interface TagBadgeProps {
  name: string;
  color: string;
  onRemove?: () => void;
  size?: 'sm' | 'xs';
}

export function TagBadge({ name, color, onRemove, size = 'sm' }: TagBadgeProps) {
  const sizeClass = size === 'xs'
    ? 'text-[10px] px-1.5 py-0'
    : 'text-xs px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium border ${sizeClass}`}
      style={{
        backgroundColor: `${color}18`,
        borderColor: `${color}50`,
        color,
      }}
    >
      {name}
      {onRemove && (
        <button
          onClick={onRemove}
          className="hover:opacity-70 transition-opacity leading-none"
          aria-label={`Remover tag ${name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
