import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);
const sql = fs.readFileSync('supabase/migrations/015_student_groups.sql', 'utf8');

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
  console.log('Result:', data, error);
}
run();
