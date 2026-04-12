export const EmptyState = () => {
  return (
    <div
      className="flex min-h-[400px] w-full items-center justify-center ag-glass p-8 text-[var(--text-secondary)] rounded-3xl"
      role="status"
      aria-live="polite"
      tabIndex={0}
    >
      <div className="text-center">
        <p className="text-lg font-bold text-[var(--text-primary)] mb-2">Hive is empty</p>
        <p className="text-sm">Ready to buzz through some tasks? Create one!</p>
      </div>
      <span className="sr-only">Use the form to the right to create a new task.</span>
    </div>
  );
};

export const LoadingState = () => {
  return (
    <div
      className="flex min-h-[400px] animate-pulse items-center justify-center ag-glass p-8 rounded-3xl"
      role="status"
      aria-live="polite"
    >
      <div className="h-8 w-8 rounded-full border-4 border-[var(--accent)] border-t-transparent animate-spin"></div>
      <span className="sr-only">Loading tasks...</span>
    </div>
  );
};
