import { useRef, type MouseEvent } from "react";

/**
 * Whether the stepper's current check comes from the form's submit button.
 * The stepper then checks every step and stops at the first that fails; the
 * loan forms list every missing field at once in that case, as they did
 * before they had steps, and only the open step's on Next.
 *
 * Spread `formProps` on the `<form>`: every click records whether it was on
 * the submit button (Enter on the last step clicks it too), and every key
 * press clears it, since Enter on any other step means Next.
 */
export function useSubmitPressed() {
  const pressed = useRef(false);
  return {
    pressed,
    formProps: {
      onClickCapture(event: MouseEvent<HTMLFormElement>) {
        pressed.current =
          event.target instanceof Element && event.target.closest('button[type="submit"]') !== null;
      },
      onKeyDownCapture() {
        pressed.current = false;
      },
    },
  };
}
