/** The server's 422 messages, shown where the field is and announced to screen readers. */
export function FieldMessages({ id, messages }: { id: string; messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div id={id} role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
      {messages.map((m) => (
        <p key={m}>{m}</p>
      ))}
    </div>
  );
}
