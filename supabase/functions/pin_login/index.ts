import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts'

// Get the allowed origin from environment variable or use the development URL
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'http://localhost:3003';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  console.log('Request origin:', origin);
  
  if (origin !== ALLOWED_ORIGIN) {
    console.log('Invalid origin. Expected:', ALLOWED_ORIGIN, 'Got:', origin);
    return new Response('Invalid origin', { 
      status: 403,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://ohhgcmdurcviweoillpc.supabase.co';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('Supabase URL:', supabaseUrl);
    console.log('Service key exists:', !!supabaseServiceKey);

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error: Missing environment variables');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const body = await req.json();
    console.log('Request body:', body);

    const { pin_code } = body;

    if (!pin_code || typeof pin_code !== 'string' || pin_code.length !== 4) {
      console.log('Invalid PIN format:', pin_code);
      return new Response(
        JSON.stringify({ error: 'Invalid PIN format: PIN must be a 4-digit string' }),
        { 
          status: 400,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Query the users table to find a user with the matching PIN
    console.log('Querying database for PIN...');
    const { data: user, error: queryError } = await supabaseAdmin
      .from('users')
      .select('id, name, role, allowed_locations')
      .eq('pin_code', pin_code)
      .single();

    if (queryError) {
      console.log('Database error:', queryError);
      throw new Error(`Database error: ${queryError.message}`);
    }

    if (!user) {
      console.log('No user found for PIN');
      return new Response(
        JSON.stringify({ error: 'Invalid PIN' }),
        { 
          status: 401,
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    console.log('User found:', { id: user.id, role: user.role });

    // Generate JWT token
    const token = await new jose.SignJWT({
      user_id: user.id,
      role: user.role,
      allowed_locations: user.allowed_locations
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(new TextEncoder().encode(JWT_SECRET));

    console.log('JWT token generated successfully');

    return new Response(
      JSON.stringify({
        token,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          allowed_locations: user.allowed_locations
        }
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );
  } catch (error) {
    console.error('Error in pin_login:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
}); 