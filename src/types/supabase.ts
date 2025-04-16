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
      orders: {
        Row: {
          id: number
          technician_name: string
          location: string
          total: number
          tip: number | null
          payment_method: 'cash' | 'card' | 'venmo' | 'zelle'
          tip_method: 'cash' | 'card' | null
          date: string
          service: string
          style: string
          days_since_last_appointment: string | null
        }
        Insert: {
          id?: number
          technician_name: string
          location: string
          total: number
          tip?: number | null
          payment_method: 'cash' | 'card' | 'venmo' | 'zelle'
          tip_method?: 'cash' | 'card' | null
          date?: string
          service: string
          style: string
          days_since_last_appointment?: string | null
        }
        Update: {
          id?: number
          technician_name?: string
          location?: string
          total?: number
          tip?: number | null
          payment_method?: 'cash' | 'card' | 'venmo' | 'zelle'
          tip_method?: 'cash' | 'card' | null
          date?: string
          service?: string
          style?: string
          days_since_last_appointment?: string | null
        }
      }
      technicians: {
        Row: {
          id: number
          name: string
          email: string
          active: boolean
          location: string
          commission_rate: number
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          email: string
          active?: boolean
          location: string
          commission_rate: number
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          email?: string
          active?: boolean
          location?: string
          commission_rate?: number
          created_at?: string
        }
      }
      submissions: {
        Row: {
          id: number
          technician_id: number
          date: string
          cash_services_count: number
          cash_services_total: number
          cash_tech_keep: number
          cash_manager_keep: number
          cash_tips_total: number
          card_services_count: number
          card_services_total: number
          card_tech_keep: number
          card_manager_keep: number
          card_tips_total: number
          card_processing_fees: number
          card_tips_processing_fee: number
          manager_owed: number
          carry_over: number
          is_cashed_out: boolean
          is_check_requested: boolean
          created_at: string
        }
        Insert: {
          id?: number
          technician_id: number
          date: string
          cash_services_count: number
          cash_services_total: number
          cash_tech_keep: number
          cash_manager_keep: number
          cash_tips_total: number
          card_services_count: number
          card_services_total: number
          card_tech_keep: number
          card_manager_keep: number
          card_tips_total: number
          card_processing_fees: number
          card_tips_processing_fee: number
          manager_owed: number
          carry_over: number
          is_cashed_out: boolean
          is_check_requested: boolean
          created_at?: string
        }
        Update: {
          id?: number
          technician_id?: number
          date?: string
          cash_services_count?: number
          cash_services_total?: number
          cash_tech_keep?: number
          cash_manager_keep?: number
          cash_tips_total?: number
          card_services_count?: number
          card_services_total?: number
          card_tech_keep?: number
          card_manager_keep?: number
          card_tips_total?: number
          card_processing_fees?: number
          card_tips_processing_fee?: number
          manager_owed?: number
          carry_over?: number
          is_cashed_out?: boolean
          is_check_requested?: boolean
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