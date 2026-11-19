/**
 * One request for however many times it is asked for while it stands. React
 * runs a new effect twice in development (StrictMode), and some AMLA reads are
 * themselves logged by the server (the AMLA log), so each user action must
 * read exactly once. A failed request is forgotten, so Retry sends it again.
 */
export function once<T>(request: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (pending === null) {
      pending = request().catch((err: unknown) => {
        pending = null;
        throw err;
      });
    }
    return pending;
  };
}
