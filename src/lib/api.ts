import type { z } from "zod";
import { requireActor } from "@/lib/authz";
import { RequestError } from "@/lib/rbac/authorize";
import type { ServiceUser } from "@/services/programs";

/** Parses and validates a JSON body, or throws a 422 with readable messages. */
export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.output<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new RequestError(400, "Request body must be JSON");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.filter((p: string | number) => p !== "data").join(".");
    throw new RequestError(422, first ? `${where ? `${where}: ` : ""}${first.message}` : "Validation failed");
  }
  return parsed.data;
}

/** The signed-in user with their database-loaded permissions. */
export async function serviceUser(): Promise<ServiceUser & { name: string; email: string }> {
  const { session, actor } = await requireActor();
  return {
    id: session.user.id,
    actor,
    name: session.user.name ?? "A Menty user",
    email: session.user.email ?? "",
  };
}
