import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { createInviteHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
function key(collection: string, legacy: string): string {
  const keys = Deno.env.get(collection);
  const value = keys ? JSON.parse(keys).default : Deno.env.get(legacy);
  if (typeof value !== "string" || !value)
    throw new Error(`Missing ${collection}`);
  return value;
}
const publicKey = key("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const secret = key("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const appUrl = Deno.env.get("APP_URL");
if (!appUrl) throw new Error("APP_URL is required");
Deno.serve(
  createInviteHandler({
    appUrl,
    clients: (authorization) => ({
      user: createClient(url, publicKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      }),
      mail: createClient(url, secret, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    }),
  }),
);
