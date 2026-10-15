export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type PeriodArgs = { p_household: string; p_month: string; p_revision: number };
export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      get_household: { Args: Record<string, never>; Returns: Json };
      save_receipt: { Args: PeriodArgs & { p_receipt: Json }; Returns: undefined };
      close_period: { Args: PeriodArgs; Returns: undefined };
      confirm_payment: {
        Args: PeriodArgs & { p_group: string; p_method: string };
        Returns: undefined;
      };
      void_payment: {
        Args: PeriodArgs & { p_payment: string; p_reason: string };
        Returns: undefined;
      };
      save_settings: {
        Args: PeriodArgs & { p_fixed: number; p_accounts: Json };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
