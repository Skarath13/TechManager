import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ohhgcmdurcviweoillpc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oaGdjbWR1cmN2aXdlb2lsbHBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0ODY5NTIsImV4cCI6MjA2MDA2Mjk1Mn0.CPb-JXneo8TEeuwYbn4S_o4u0gkjpGW4DPIvudWMcIo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
