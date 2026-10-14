/** An error whose message is safe to show the user. */
export class PublicError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "PublicError";
  }
}
