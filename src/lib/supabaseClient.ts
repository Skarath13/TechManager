import { createClient } from '@supabase/supabase-js'
import { Database } from '../types/supabase'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ohhgcmdurcviweoillpc.supabase.co'
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oaGdjbWR1cmN2aXdlb2lsbHBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDc0MjY5NzAsImV4cCI6MjAyMzAwMjk3MH0.Rl5zTFXnqPWuXhHxBEFBvg_zHjos5dZOkIvSqFvl_Vc'

// Create a single Supabase client instance with persistent session
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // storage: localStorage // Removed, as it's the default
  }
})

// Function to get headers with current auth token (LEGACY - uses old token key?)
export const getAuthHeaders = () => {
  // NOTE: Supabase client now manages its own token internally.
  // This function likely uses an outdated key ('auth-token').
  const token = localStorage.getItem('auth-token') // Check if this key is still relevant
  return {
    'apikey': supabaseAnonKey,
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json'
  }
}

// Function to make authenticated requests (LEGACY)
export const authenticatedFetch = async (endpoint: string, options: RequestInit = {}) => {
  // NOTE: Prefer using the supabase client directly (e.g., supabase.from(...).select())
  // as it handles auth automatically.
  const headers = getAuthHeaders()
  const response = await fetch(`${supabaseUrl}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    }
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Request failed')
  }
  
  return response.json()
}

export default supabase 