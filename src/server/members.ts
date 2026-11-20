import { isAdmin } from "@every-app/sdk/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { UserError } from "@/server/errors";

/** The part of the Gateway's verified user the queries use. */
export interface Caller {
  id: string;
  email: string;
  admin: boolean;
  familyId: string | null;
  activeLearnerId: string | null;
}

/** Reads the caller's own row, creating it on first sight. */
export async function loadCaller(user: {
  id: string;
  email: string;
  orgRole?: string;
}): Promise<Caller> {
  await db
    .insert(users)
    .values({ id: user.id, email: user.email })
    .onConflictDoNothing();
  const [row] = await db.select().from(users).where(eq(users.id, user.id));
  if (row && row.email !== user.email) {
    await db
      .update(users)
      .set({ email: user.email })
      .where(eq(users.id, user.id));
  }
  return {
    id: user.id,
    email: user.email,
    admin: isAdmin(user as Parameters<typeof isAdmin>[0]),
    familyId: row?.familyId ?? null,
    activeLearnerId: row?.activeLearnerId ?? null,
  };
}

export function requireAdmin(caller: Caller): void {
  if (!caller.admin) throw new UserError("Only admins can change the library.");
}
