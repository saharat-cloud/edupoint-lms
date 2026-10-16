// Supabase auto-generated types placeholder
// Replace this file with the output of: supabase gen types typescript --project-id YOUR_PROJECT_ID
// or use the Supabase dashboard > API > TypeScript Types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: Record<string, unknown>
    Views: Record<string, unknown>
    Functions: Record<string, unknown>
    Enums: Record<string, unknown>
  }
}
