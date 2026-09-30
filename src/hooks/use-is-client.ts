import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * `false` while rendering on the server and while hydrating that HTML, `true`
 * on the client after that — for markup that can only be drawn in a browser,
 * such as a chart that measures its container.
 *
 * Unlike a `mounted` flag set in an effect, a component that first mounts on
 * the client (any client-side navigation) gets `true` on its first render
 * instead of rendering once without the markup and again with it.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, onClient, onServer);
}
