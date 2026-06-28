export interface CreateLeaveDraftDto {
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  balance_before?: number | string;
  purpose?: string | null;
  destination?: string | null;
  travel_from?: string | null;
  travel_to?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_email?: string | null;
  handover_to_employee_id?: string | null;
}

export interface ApprovalDecisionDto {
  decision: "approved" | "rejected";
  approval_notes?: string | null;
}

export interface SaveLeaveApplicationDto extends CreateLeaveDraftDto {
  status?: "draft" | "submitted";
}

export interface UpdateHandoverDto {
  tasks_notes?: string | null;
  attachment_url?: string | null;
  status?: "pending" | "accepted" | "cancelled";
  accepted_at?: string | null;
}

export interface UpdateClearanceDto {
  clearance_items?: string[];
  responsible_person?: string | null;
  status?: "not_required" | "pending" | "in_progress" | "cleared" | "blocked";
  comments?: string | null;
  completed_at?: string | null;
}

export interface UpdateRejoinDto {
  actual_rejoin_date?: string | null;
  reason_for_delay?: string | null;
  medical_or_supporting_attachment?: string | null;
  status?: "pending_rejoin" | "rejoined_on_time" | "delayed_rejoin" | "no_show" | "verified";
  hr_verified_by?: string | null;
  verified_at?: string | null;
}
