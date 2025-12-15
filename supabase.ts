import { createClient } from '@supabase/supabase-js';

// Supabase credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ahnitzyvzksbiwddaqzb.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Uch-XvpS6qSVZfJgIsIu2A_QsDZMjQL';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);