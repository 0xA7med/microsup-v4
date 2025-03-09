export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string
          created_at: string
          email: string
          name: string | null
          role: string
          is_active: boolean
          password: string
          approval_status?: string
        }
        Insert: {
          id?: string
          created_at?: string
          email: string
          name?: string | null
          role?: string
          is_active?: boolean
          password: string
          approval_status?: string
        }
        Update: {
          id?: string
          created_at?: string
          email?: string
          name?: string | null
          role?: string
          is_active?: boolean
          password?: string
          approval_status?: string
        }
      }
      clients: {
        Row: {
          id: string
          created_at: string
          client_name: string
          organization_name: string
          activity_type: string
          phone: string
          activation_code: string
          subscription_type: string
          subscription_start: string
          subscription_end: string
          notes: string | null
          agent_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          client_name: string
          organization_name: string
          activity_type: string
          phone: string
          activation_code: string
          subscription_type: string
          subscription_start: string
          subscription_end: string
          notes?: string | null
          agent_id: string
        }
        Update: {
          id?: string
          created_at?: string
          client_name?: string
          organization_name?: string
          activity_type?: string
          phone?: string
          activation_code?: string
          subscription_type?: string
          subscription_start?: string
          subscription_end?: string
          notes?: string | null
          agent_id?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}