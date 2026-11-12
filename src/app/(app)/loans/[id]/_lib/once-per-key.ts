// One read per key, shared by everyone who asks for it while the page is open.
//
// The "Forward to" picker reads its candidates once per pending step. It
// remounts whenever the step panel does (the chain and the user's roles load,
// a re-read after an action), and React's development mode runs its effect
// twice, so without this one page load asked the server two to four times for
// the same list. A failed read is forgotten, so "Try again" asks again.

export type OncePerKey<T> = (key: string, load: () => Promise<T>) => Promise<T>;

export function oncePerKey<T>(): OncePerKey<T> {
  const reads = new Map<string, Promise<T>>();
  return (key, load) => {
    const known = reads.get(key);
    if (known) return known;
    const read = load();
    reads.set(key, read);
    read.catch(() => {
      if (reads.get(key) === read) reads.delete(key);
    });
    return read;
  };
}
