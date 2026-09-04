export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts_receivable: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          observacao: string | null
          sale_id: string | null
          status: string
          updated_at: string
          user_id: string | null
          valor: number
          valor_pago: number
          vencimento: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          observacao?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          valor: number
          valor_pago?: number
          vencimento?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          observacao?: string | null
          sale_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          valor?: number
          valor_pago?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          acao: string
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          entidade: string | null
          id: string
          registro_id: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          entidade?: string | null
          id?: string
          registro_id?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          entidade?: string | null
          id?: string
          registro_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cash_registers: {
        Row: {
          aberto_em: string
          aberto_por: string | null
          diferenca: number | null
          fechado_em: string | null
          fechado_por: string | null
          id: string
          observacao: string | null
          status: string
          valor_esperado: number | null
          valor_informado: number | null
          valor_inicial: number
        }
        Insert: {
          aberto_em?: string
          aberto_por?: string | null
          diferenca?: number | null
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          observacao?: string | null
          status?: string
          valor_esperado?: number | null
          valor_informado?: number | null
          valor_inicial?: number
        }
        Update: {
          aberto_em?: string
          aberto_por?: string | null
          diferenca?: number | null
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          observacao?: string | null
          status?: string
          valor_esperado?: number | null
          valor_informado?: number | null
          valor_inicial?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      command_items: {
        Row: {
          command_id: string
          created_at: string
          id: string
          nome: string
          observacao: string | null
          preco_unitario: number
          product_id: string | null
          quantidade: number
          user_id: string | null
        }
        Insert: {
          command_id: string
          created_at?: string
          id?: string
          nome: string
          observacao?: string | null
          preco_unitario?: number
          product_id?: string | null
          quantidade?: number
          user_id?: string | null
        }
        Update: {
          command_id?: string
          created_at?: string
          id?: string
          nome?: string
          observacao?: string | null
          preco_unitario?: number
          product_id?: string | null
          quantidade?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "command_items_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "command_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      commands: {
        Row: {
          aberto_por: string | null
          created_at: string
          id: string
          numero: number
          observacao: string | null
          status: Database["public"]["Enums"]["command_status"]
          total: number
          updated_at: string
        }
        Insert: {
          aberto_por?: string | null
          created_at?: string
          id?: string
          numero: number
          observacao?: string | null
          status?: Database["public"]["Enums"]["command_status"]
          total?: number
          updated_at?: string
        }
        Update: {
          aberto_por?: string | null
          created_at?: string
          id?: string
          numero?: number
          observacao?: string | null
          status?: Database["public"]["Enums"]["command_status"]
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          limite_credito: number
          nome: string
          observacao: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          limite_credito?: number
          nome: string
          observacao?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          limite_credito?: number
          nome?: string
          observacao?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      financial_entries: {
        Row: {
          cash_register_id: string | null
          categoria: string
          created_at: string
          descricao: string | null
          forma_pagamento: Database["public"]["Enums"]["payment_method"]
          id: string
          tipo: Database["public"]["Enums"]["movement_type"]
          user_id: string | null
          valor: number
        }
        Insert: {
          cash_register_id?: string | null
          categoria: string
          created_at?: string
          descricao?: string | null
          forma_pagamento?: Database["public"]["Enums"]["payment_method"]
          id?: string
          tipo: Database["public"]["Enums"]["movement_type"]
          user_id?: string | null
          valor: number
        }
        Update: {
          cash_register_id?: string | null
          categoria?: string
          created_at?: string
          descricao?: string | null
          forma_pagamento?: Database["public"]["Enums"]["payment_method"]
          id?: string
          tipo?: Database["public"]["Enums"]["movement_type"]
          user_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          custo: number | null
          fornecedor: string | null
          id: string
          motivo: string | null
          observacao: string | null
          product_id: string
          quantidade: number
          tipo: Database["public"]["Enums"]["movement_type"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          custo?: number | null
          fornecedor?: string | null
          id?: string
          motivo?: string | null
          observacao?: string | null
          product_id: string
          quantidade: number
          tipo: Database["public"]["Enums"]["movement_type"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          custo?: number | null
          fornecedor?: string | null
          id?: string
          motivo?: string | null
          observacao?: string | null
          product_id?: string
          quantidade?: number
          tipo?: Database["public"]["Enums"]["movement_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          created_at: string
          forma: Database["public"]["Enums"]["payment_method"]
          id: string
          sale_id: string
          troco: number | null
          valor: number
          valor_recebido: number | null
        }
        Insert: {
          created_at?: string
          forma: Database["public"]["Enums"]["payment_method"]
          id?: string
          sale_id: string
          troco?: number | null
          valor: number
          valor_recebido?: number | null
        }
        Update: {
          created_at?: string
          forma?: Database["public"]["Enums"]["payment_method"]
          id?: string
          sale_id?: string
          troco?: number | null
          valor?: number
          valor_recebido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          aliquota: number | null
          ativo: boolean
          category_id: string | null
          cfop: string | null
          codigo_barras: string | null
          codigo_interno: string | null
          created_at: string
          cst: string | null
          custo: number
          estoque_atual: number
          estoque_minimo: number
          foto_url: string | null
          id: string
          ncm: string | null
          nome: string
          preco_venda: number
          unidade: string
          updated_at: string
        }
        Insert: {
          aliquota?: number | null
          ativo?: boolean
          category_id?: string | null
          cfop?: string | null
          codigo_barras?: string | null
          codigo_interno?: string | null
          created_at?: string
          cst?: string | null
          custo?: number
          estoque_atual?: number
          estoque_minimo?: number
          foto_url?: string | null
          id?: string
          ncm?: string | null
          nome: string
          preco_venda?: number
          unidade?: string
          updated_at?: string
        }
        Update: {
          aliquota?: number | null
          ativo?: boolean
          category_id?: string | null
          cfop?: string | null
          codigo_barras?: string | null
          codigo_interno?: string | null
          created_at?: string
          cst?: string | null
          custo?: number
          estoque_atual?: number
          estoque_minimo?: number
          foto_url?: string | null
          id?: string
          ncm?: string | null
          nome?: string
          preco_venda?: number
          unidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admissao: string | null
          ativo: boolean
          cargo: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          admissao?: string | null
          ativo?: boolean
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          admissao?: string | null
          ativo?: boolean
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      receivable_payments: {
        Row: {
          cash_register_id: string | null
          created_at: string
          forma: Database["public"]["Enums"]["payment_method"]
          id: string
          receivable_id: string
          user_id: string | null
          valor: number
        }
        Insert: {
          cash_register_id?: string | null
          created_at?: string
          forma?: Database["public"]["Enums"]["payment_method"]
          id?: string
          receivable_id: string
          user_id?: string | null
          valor: number
        }
        Update: {
          cash_register_id?: string | null
          created_at?: string
          forma?: Database["public"]["Enums"]["payment_method"]
          id?: string
          receivable_id?: string
          user_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "receivable_payments_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivable_payments_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          nome: string
          preco_unitario: number
          product_id: string | null
          quantidade: number
          sale_id: string
          total: number
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          preco_unitario?: number
          product_id?: string | null
          quantidade?: number
          sale_id: string
          total?: number
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          preco_unitario?: number
          product_id?: string | null
          quantidade?: number
          sale_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cash_register_id: string | null
          command_id: string | null
          created_at: string
          customer_id: string | null
          desconto: number
          id: string
          numero: number
          status: string
          subtotal: number
          total: number
          user_id: string | null
        }
        Insert: {
          cash_register_id?: string | null
          command_id?: string | null
          created_at?: string
          customer_id?: string | null
          desconto?: number
          id?: string
          numero?: number
          status?: string
          subtotal?: number
          total?: number
          user_id?: string | null
        }
        Update: {
          cash_register_id?: string | null
          command_id?: string | null
          created_at?: string
          customer_id?: string | null
          desconto?: number
          id?: string
          numero?: number
          status?: string
          subtotal?: number
          total?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          backup: Json
          caixa: Json
          empresa: Json
          fiado: Json
          fiscal: Json
          id: string
          pdv: Json
          updated_at: string
        }
        Insert: {
          backup?: Json
          caixa?: Json
          empresa?: Json
          fiado?: Json
          fiscal?: Json
          id?: string
          pdv?: Json
          updated_at?: string
        }
        Update: {
          backup?: Json
          caixa?: Json
          empresa?: Json
          fiado?: Json
          fiscal?: Json
          id?: string
          pdv?: Json
          updated_at?: string
        }
        Relationships: []
      }
      time_records: {
        Row: {
          created_at: string
          dispositivo: string | null
          editado_por: string | null
          id: string
          motivo_edicao: string | null
          observacao: string | null
          registrado_em: string
          tipo: Database["public"]["Enums"]["time_record_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          dispositivo?: string | null
          editado_por?: string | null
          id?: string
          motivo_edicao?: string | null
          observacao?: string | null
          registrado_em?: string
          tipo: Database["public"]["Enums"]["time_record_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          dispositivo?: string | null
          editado_por?: string | null
          id?: string
          motivo_edicao?: string | null
          observacao?: string | null
          registrado_em?: string
          tipo?: Database["public"]["Enums"]["time_record_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_operator: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "gerente" | "caixa" | "atendente" | "funcionario"
      command_status:
        | "aberta"
        | "em_consumo"
        | "aguardando_pagamento"
        | "finalizada"
        | "cancelada"
      movement_type: "entrada" | "saida"
      payment_method:
        | "dinheiro"
        | "pix"
        | "debito"
        | "credito"
        | "fiado"
        | "outros"
      time_record_type:
        | "entrada"
        | "inicio_intervalo"
        | "retorno_intervalo"
        | "saida"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gerente", "caixa", "atendente", "funcionario"],
      command_status: [
        "aberta",
        "em_consumo",
        "aguardando_pagamento",
        "finalizada",
        "cancelada",
      ],
      movement_type: ["entrada", "saida"],
      payment_method: [
        "dinheiro",
        "pix",
        "debito",
        "credito",
        "fiado",
        "outros",
      ],
      time_record_type: [
        "entrada",
        "inicio_intervalo",
        "retorno_intervalo",
        "saida",
      ],
    },
  },
} as const
