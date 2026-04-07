import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://cykqhlkqsjobsegyblux.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5a3FobGtxc2pvYnNlZ3libHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODAxMDYsImV4cCI6MjA5MDg1NjEwNn0.0jvpdZ9UCs3H-5f7Du3mx51T2-t0mhTQY6xGTRBxONc";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
