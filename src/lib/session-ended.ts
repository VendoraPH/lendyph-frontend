/**
 * A request refused in the browser because the session ended while it waited
 * for a token renewal (see axios-client.ts). The "Session Expired" dialog is
 * already showing, so it is not sent only to come back 401. getErrorMessage
 * reads it as the session-expired message.
 *
 * Its own module so api-error.ts can know it without importing the client.
 */
export class SessionEndedError extends Error {
  constructor(message = "Your session has expired. Please sign in again.") {
    super(message);
    this.name = "SessionEndedError";
  }
}
