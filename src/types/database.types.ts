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
          user_id: string
          created_at: string
          approval_status: 'pending' | 'approved' | 'rejected'
          email: string
          name: string
          role: string
          phone: string | null
          address: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          created_at?: string
          approval_status?: 'pending' | 'approved' | 'rejected'
          email: string
          name: string
          role: string
          phone?: string | null
          address?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          approval_status?: 'pending' | 'approved' | 'rejected'
          email?: string
          name?: string
          role?: string
          phone?: string | null
          address?: string | null
          created_by?: string | null
        }
      }
      clients: {
        Row: {
          id: string
          client_name: string
          organization_name: string | null
          activity_type: string | null
          phone: string | null
          activation_code: string | null
          subscription_type: string | null
          address: string | null
          device_count: number | null
          software_version: string | null
          subscription_start: string | null
          subscription_end: string | null
          notes: string | null
          agent_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_name: string
          organization_name?: string | null
          activity_type?: string | null
          phone?: string | null
          activation_code?: string | null
          subscription_type?: string | null
          address?: string | null
          device_count?: number | null
          software_version?: string | null
          subscription_start?: string | null
          subscription_end?: string | null
          notes?: string | null
          agent_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_name?: string
          organization_name?: string | null
          activity_type?: string | null
          phone?: string | null
          activation_code?: string | null
          subscription_type?: string | null
          address?: string | null
          device_count?: number | null
          software_version?: string | null
          subscription_start?: string | null
          subscription_end?: string | null
          notes?: string | null
          agent_id?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          name: string
          role: string
          phone: string | null
          address: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          role: string
          phone?: string | null
          address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: string
          phone?: string | null
          address?: string | null
          created_at?: string
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

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
