interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="text-6xl mb-4">{icon}</div>
      <h2 className="text-lg font-bold text-tg-text mb-1">{title}</h2>
      <p className="text-sm text-tg-hint max-w-xs">{description}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-primary mt-6">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
