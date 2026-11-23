import type { CodeSent } from "@/types/public-application";

/** What the code step says after a code is asked for, and the code itself in staging's test mode. */
export interface OtpNotice {
  text: string;
  /** Shown on screen only in test mode, where nothing is sent. */
  testCode: string | null;
}

/**
 * The line under the code box, by what the server says happened: "sent" only
 * when a provider sent it; in test mode the server's own notice and the code;
 * otherwise that nothing went out.
 */
export function otpNotice(sent: CodeSent): OtpNotice {
  const minutes = Math.round(sent.expires_in / 60);
  if (sent.test_mode) {
    return {
      text: `${sent.test_mode.notice}. Use the code below; it expires in ${minutes} minutes.`,
      testCode: sent.test_mode.code,
    };
  }
  if (sent.delivered) {
    return { text: `We sent a code to ${sent.destination}. It expires in ${minutes} minutes.`, testCode: null };
  }
  return { text: `No code was sent to ${sent.destination}. Check the number, or contact the office.`, testCode: null };
}

/** The code as typed, without spaces. */
export function cleanCode(value: string): string {
  return value.replace(/\s/g, "");
}

/** The server takes exactly six digits (`PublicApplyController::verifyCode()`). */
export function isOtpCode(value: string): boolean {
  return /^\d{6}$/.test(value);
}
