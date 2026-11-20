/** A refusal the page shows as it is. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export function notFound(): never {
  throw new UserError("Not found.");
}
