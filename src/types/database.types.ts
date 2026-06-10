// ──────────────────────────────────────────────────────────
// MicroSUB MicroPOS V1 — Database Type Definitions
// Generated from consolidated migration schema
// ──────────────────────────────────────────────────────────

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
          email: string
          name: string
          role: 'admin' | 'agent'
          is_active: boolean
          phone: string | null
          address: string | null
          password: string | null
          approval_status: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          email: string
          name: string
          role?: 'admin' | 'agent'
          is_active?: boolean
          phone?: string | null
          address?: string | null
          password?: string | null
          approval_status?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: 'admin' | 'agent'
          is_active?: boolean
          phone?: string | null
          address?: string | null
          password?: string | null
          approval_status?: string | null
          created_at?: string
          created_by?: string | null
        }
      }
      clients: {
        Row: {
          id: string
          client_name: string
          organization_name: string | null
          activity_type: string | null
          phone: string
          phone2: string | null
          address: string | null
          device_count: number
          active_devices_count: number
          subscription_type: string | null
          subscription_start: string | null
          subscription_end: string | null
          notes: string | null
          agent_id: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          client_name: string
          organization_name?: string | null
          activity_type?: string | null
          phone: string
          phone2?: string | null
          address?: string | null
          device_count?: number
          active_devices_count?: number
          subscription_type?: string | null
          subscription_start?: string | null
          subscription_end?: string | null
          notes?: string | null
          agent_id: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_name?: string
          organization_name?: string | null
          activity_type?: string | null
          phone?: string
          phone2?: string | null
          address?: string | null
          device_count?: number
          active_devices_count?: number
          subscription_type?: string | null
          subscription_start?: string | null
          subscription_end?: string | null
          notes?: string | null
          agent_id?: string
          created_by?: string | null
          created_at?: string
        }
      }
      devices: {
        Row: {
          id: string
          client_id: string
          activation_code: string | null
          device_type: string | null
          subscription_start: string | null
          subscription_end: string | null
          subscription_type: string | null
          email: string | null
          price: number
          notes: string | null
          approval_status: string | null
          approval_date: string | null
          approved_by: string | null
          rejection_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          activation_code?: string | null
          device_type?: string | null
          subscription_start?: string | null
          subscription_end?: string | null
          subscription_type?: string | null
          email?: string | null
          price?: number
          notes?: string | null
          approval_status?: string | null
          approval_date?: string | null
          approved_by?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          activation_code?: string | null
          device_type?: string | null
          subscription_start?: string | null
          subscription_end?: string | null
          subscription_type?: string | null
          email?: string | null
          price?: number
          notes?: string | null
          approval_status?: string | null
          approval_date?: string | null
          approved_by?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      backups: {
        Row: {
          id: number
          created_at: string
          created_by: string | null
          file_name: string
          data: Json
          stats: Json | null
          notes: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          created_by?: string | null
          file_name: string
          data: Json
          stats?: Json | null
          notes?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          created_by?: string | null
          file_name?: string
          data?: Json
          stats?: Json | null
          notes?: string | null
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: string
          is_read: boolean
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          message: string
          type?: string
          is_read?: boolean
          created_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          message?: string
          type?: string
          is_read?: boolean
          created_at?: string
          read_at?: string | null
        }
      }
      repairs: {
        Row: {
          id: string
          device_id: string
          description: string | null
          cost: number
          status: string
          notes: string | null
          created_at: string
          updated_at: string
          completed_at: string | null
          completed_by: string | null
        }
        Insert: {
          id?: string
          device_id: string
          description?: string | null
          cost?: number
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          completed_by?: string | null
        }
        Update: {
          id?: string
          device_id?: string
          description?: string | null
          cost?: number
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          completed_by?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      update_updated_at_column: {
        Args: Record<string, never>
        Returns: unknown
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
