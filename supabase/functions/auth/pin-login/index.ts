import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:3003',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pin_code } = await req.json()

    if (!pin_code || typeof pin_code !== 'string' || pin_code.length !== 4) {
      return new Response(
        JSON.stringify({ error: 'Invalid PIN format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Query the users table to find a user with the matching PIN
    const { data: user, error: queryError } = await supabaseAdmin
      .from('users')
      .select('id, name, role, allowed_locations')
      .eq('pin_code', pin_code)
      .single()

    if (queryError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid PIN' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate a session for the user
    const { data: { session }, error: signInError } = await supabaseAdmin.auth.admin.createSession({
      user_id: user.id
    })

    if (signInError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          allowed_locations: user.allowed_locations
        },
        session
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Set-Cookie': `sb-access-token=${session.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax`
        } 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}) 