type Result = {
  data: unknown;
  error: { message: string; code?: string } | null;
};
interface UserClient {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
  rpc(name: string, args: Record<string, unknown>): PromiseLike<Result>;
}
interface MailClient {
  auth: {
    admin: {
      inviteUserByEmail(
        email: string,
        options: { redirectTo: string },
      ): Promise<Result>;
    };
    signInWithOtp(options: {
      email: string;
      options: { shouldCreateUser: boolean; emailRedirectTo: string };
    }): Promise<Result>;
  };
}
export function createInviteHandler(options: {
  appUrl: string;
  clients: (authorization: string) => { user: UserClient; mail: MailClient };
}) {
  return async (request: Request): Promise<Response> => {
    const origin = new URL(options.appUrl).origin;
    const headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json",
      Vary: "Origin",
    };
    const respond = (status: number, data: unknown) =>
      new Response(JSON.stringify(data), { status, headers });
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== origin
    )
      return respond(403, { error: "Origen no autorizado." });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST")
      return respond(405, { error: "Método no permitido." });
    const authorization = request.headers.get("authorization") ?? "";
    if (!/^Bearer \S+$/i.test(authorization))
      return respond(401, { error: "Sesión requerida." });
    try {
      const raw = await request.text();
      if (raw.length > 4096)
        return respond(400, { error: "Datos de invitación inválidos." });
      const body = JSON.parse(raw);
      if (
        !body ||
        typeof body !== "object" ||
        typeof body.householdId !== "string" ||
        typeof body.id !== "string" ||
        typeof body.email !== "string" ||
        typeof body.name !== "string" ||
        !["admin", "member", "viewer"].includes(body.role) ||
        typeof body.canReview !== "boolean"
      )
        return respond(400, { error: "Datos de invitación inválidos." });
      const { user, mail } = options.clients(authorization);
      const identity = await user.auth.getUser();
      if (identity.error || !identity.data.user)
        return respond(401, { error: "Sesión inválida." });
      // The caller's JWT is used for both permission checks and membership writes.
      const prepared = await user.rpc("prepare_household_invitation", {
        p_household: body.householdId,
        p_id: body.id,
        p_email: body.email,
        p_name: body.name,
        p_role: body.role,
        p_can_review: body.canReview,
      });
      if (prepared.error)
        return respond(prepared.error.code === "42501" ? 403 : 409, {
          error: prepared.error.message,
        });
      const invitation = prepared.data as {
        email: string;
        existingUser: boolean;
      };
      if (
        !invitation ||
        typeof invitation.email !== "string" ||
        typeof invitation.existingUser !== "boolean"
      )
        throw new Error("Invalid invitation response");
      const redirectTo = `${origin}/acceso/confirmar`;
      const sent = invitation.existingUser
        ? await mail.auth.signInWithOtp({
            email: invitation.email,
            options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
          })
        : await mail.auth.admin.inviteUserByEmail(invitation.email, {
            redirectTo,
          });
      if (sent.error)
        return respond(502, {
          error:
            "No se pudo enviar el correo de invitación. Revisa SMTP e inténtalo después de un minuto.",
        });
      const completed = await user.rpc("complete_household_invitation", {
        p_household: body.householdId,
        p_id: body.id,
      });
      if (completed.error)
        return respond(409, { error: completed.error.message });
      return respond(200, { ok: true });
    } catch {
      return respond(400, {
        error:
          "No se pudo completar la invitación. Revisa su estado antes de reenviar.",
      });
    }
  };
}
