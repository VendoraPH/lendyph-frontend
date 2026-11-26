/**
 * The flag the staff sign-in's "Remember me for 30 days" kept in localStorage.
 * The option is gone (finish run round 7, Pepito's QA task 14zfbg0eqfd,
 * security): every session follows the normal idle rule, and the server no
 * longer issues 30-day sign-ins. Nothing reads the flag any more; it is only
 * cleared, once on load, where an older sign-in left it.
 */
export const LEGACY_REMEMBER_ME_KEY = "lendy_remember_me";

/** Clears the old flag. Best effort: storage that refuses access is left alone. */
export function forgetRememberMe(storage: Pick<Storage, "removeItem"> | undefined): void {
  try {
    storage?.removeItem(LEGACY_REMEMBER_ME_KEY);
  } catch {
    // Private mode or blocked storage: there is nothing stored to clear.
  }
}
