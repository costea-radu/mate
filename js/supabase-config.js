import { createClient } from 'https://esm.sh/@supabase/supabase-js';

const SUPABASE_URL = 'https://nuygmshhccetzqxewris.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51eWdtc2hoY2NldHpxeGV3cmlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NjI5MDcsImV4cCI6MjA3MDMzODkwN30.Q2v6cCCvWX5A8sU5Nk14MNnoVPCyZoYZJYEfDLZqFUE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

