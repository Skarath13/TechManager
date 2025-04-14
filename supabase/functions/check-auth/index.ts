import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts'

// Get the allowed origin from environment variable or use the development URL
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'http://localhost:3003';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin'
}

const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'your-secret-key';

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

  try {
    // Get the auth token from Authorization header
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'No auth token found' }),
        { 
          status: 401,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Verify the JWT token
    const { payload } = await jose.jwtVerify(
      token,
      new TextEncoder().encode(JWT_SECRET)
    );

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://ohhgcmdurcviweoillpc.supabase.co';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error: Missing environment variables');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get fresh user data from the database
    const { data: user, error: queryError } = await supabaseAdmin
      .from('users')
      .select('id, name, role, allowed_locations')
      .eq('id', payload.user_id)
      .single();

    if (queryError || !user) {
      throw new Error('User not found');
    }

    return new Response(
      JSON.stringify({ user }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid token' }),
      { 
        status: 401,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
}); 