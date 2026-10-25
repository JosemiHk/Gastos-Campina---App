export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type PeriodArgs = { p_household: string; p_month: string; p_revision: number };
export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      get_household: { Args: Record<string, never>; Returns: Json };
      save_receipt: {
        Args: PeriodArgs & { p_receipt: Json; p_reason?: string };
        Returns: undefined;
      };
      request_receipt_correction: {
        Args: PeriodArgs & { p_receipt: Json; p_base_revision: number; p_reason: string };
        Returns: undefined;
      };
      resolve_receipt_correction: {
        Args: PeriodArgs & { p_correction: string; p_approve: boolean; p_reason: string };
        Returns: undefined;
      };
      get_household_access: { Args: { p_household: string }; Returns: Json };
      update_household_access: {
        Args: {
          p_household: string;
          p_user: string;
          p_revision: number;
          p_name: string;
          p_role: string;
          p_can_review: boolean;
          p_active: boolean;
        };
        Returns: undefined;
      };
      prepare_household_invitation: {
        Args: {
          p_household: string;
          p_id: string;
          p_email: string;
          p_name: string;
          p_role: string;
          p_can_review: boolean;
        };
        Returns: Json;
      };
      complete_household_invitation: {
        Args: { p_household: string; p_id: string };
        Returns: undefined;
      };
      cancel_household_invitation: {
        Args: { p_household: string; p_id: string };
        Returns: undefined;
      };
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
      save_household_settings: {
        Args: PeriodArgs & {
          p_configuration_revision: number;
          p_fixed: number;
          p_accounts: Json;
          p_groups: Json;
          p_participants: Json;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
