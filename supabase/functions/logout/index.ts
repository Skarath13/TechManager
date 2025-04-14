import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Get the allowed origin from environment variable or use the development URL
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'http://localhost:3003';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cookie',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Validate origin
  const origin = req.headers.get('Origin');
  if (origin !== ALLOWED_ORIGIN) {
    return new Response('Invalid origin', { status: 403 });
  }

  // Clear the auth cookie by setting it to expire immediately
  const cookieHeader = 'auth-token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';

  return new Response(
    JSON.stringify({ message: 'Logged out successfully' }),
    { 
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Set-Cookie': cookieHeader
      } 
    }
  );
}); 