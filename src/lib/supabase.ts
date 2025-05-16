import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://cpgnvnrrgiepsuasryny.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZ252bnJyZ2llcHN1YXNyeW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MjYxMDksImV4cCI6MjA2MjIwMjEwOX0.uzsum8IQd5fjqDBnyU8zqVWoSkF73xE5k_IIqsaFK9c'

export const supabase = createClient(supabaseUrl, supabaseAnonKey) 