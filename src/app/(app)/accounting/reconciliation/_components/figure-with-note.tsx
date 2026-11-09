/**
 * A worksheet figure with the line under it: on a paired row, the books
 * entry's own figure, labelled "Books entry JE-…".
 */
export function FigureWithNote({ figure, note }: { figure: string; note: string | null }) {
  return (
    <>
      {figure}
      {note && <span className="block font-sans text-xs text-muted-foreground">{note}</span>}
    </>
  );
}
