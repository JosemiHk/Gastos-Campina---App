import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { createInviteHandler } from './handler.ts';

const url=Deno.env.get('SUPABASE_URL')!;
const publicKey=Deno.env.get('SUPABASE_ANON_KEY')!;
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const appUrl=Deno.env.get('APP_URL');
if(!appUrl) throw new Error('APP_URL is required');
Deno.serve(createInviteHandler({appUrl,clients:(authorization)=>({
  user:createClient(url,publicKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}}),
  mail:createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}}),
})}));
