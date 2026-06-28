import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Insertable, Transaction } from "kysely";
import type { AuthenticatedUser } from "../auth/auth.types";
import { KyselyProvider } from "../database/kysely.provider";
import type { DB, LeaveApplications } from "../../../../database/generated/db";
import { DocumentsStorageService } from "../documents/documents-storage.service";
import type {
  ApprovalDecisionDto,
  CreateLeaveDraftDto,
  SaveLeaveApplicationDto,
  UpdateClearanceDto,
  UpdateHandoverDto,
  UpdateRejoinDto
} from "./hr-leave.dto";

@Injectable()
export class HrLeaveService {
  constructor(
    @Inject(KyselyProvider) private readonly database: KyselyProvider,
    @Inject(DocumentsStorageService) private readonly storage: DocumentsStorageService
  ) {}

  async getWorkspaceData() {
    const [applications, approvals, handovers, clearances, rejoins, employees] = await Promise.all([
      this.listApplications(),
      this.listApprovals(),
      this.listHandovers(),
      this.listClearances(),
      this.listRejoins(),
      this.database.db
        .selectFrom("employees")
        .leftJoin("departments", "departments.id", "employees.department_id")
        .select([
          "employees.id",
          "employees.employee_number",
          "employees.full_name",
          "employees.designation",
          "departments.name as department_name"
        ])
        .where("employees.deleted_at", "is", null)
        .orderBy("employees.employee_number", "asc")
        .execute()
    ]);

    return {
      applications: applications.map(serializeRecord),
      approvals: approvals.map(serializeRecord),
      handovers: handovers.map(serializeRecord),
      clearances: clearances.map(serializeRecord),
      rejoins: rejoins.map(serializeRecord),
      employees: employees.map(employee => ({
        id: employee.id,
        employee_number: employee.employee_number,
        full_name: employee.full_name,
        designation: employee.designation,
        department: { name: employee.department_name }
      }))
    };
  }

  listApplications() {
    return this.database.db
      .selectFrom("leave_applications")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();
  }

  listApprovals() {
    return this.database.db
      .selectFrom("leave_approvals")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();
  }

  listHandovers() {
    return this.database.db
      .selectFrom("leave_handovers")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();
  }

  listClearances() {
    return this.database.db
      .selectFrom("leave_clearances")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();
  }

  listRejoins() {
    return this.database.db
      .selectFrom("leave_rejoins")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();
  }

  async createDraft(input: CreateLeaveDraftDto, user: AuthenticatedUser) {
    validateCreateDraft(input);

    return this.database.db.transaction().execute(async (trx) => {
      const employee = await trx
        .selectFrom("employees")
        .leftJoin("departments", "departments.id", "employees.department_id")
        .select([
          "employees.id",
          "employees.employee_number",
          "employees.full_name",
          "employees.designation",
          "departments.name as department_name"
        ])
        .where("employees.id", "=", input.employee_id)
        .where("employees.deleted_at", "is", null)
        .executeTakeFirst();

      if (!employee) {
        throw new NotFoundException("Employee was not found.");
      }

      const handoverEmployee = input.handover_to_employee_id
        ? await trx
          .selectFrom("employees")
          .select(["id", "employee_number", "full_name"])
          .where("id", "=", input.handover_to_employee_id)
          .where("deleted_at", "is", null)
          .executeTakeFirst()
        : null;

      if (input.handover_to_employee_id && !handoverEmployee) {
        throw new NotFoundException("Handover employee was not found.");
      }

      if (handoverEmployee?.id === employee.id) {
        throw new BadRequestException("Handover employee must be different from the leave applicant.");
      }

      const balanceBefore = await resolveBalanceBefore(trx, employee.id, input.leave_type, input.balance_before);
      const days = calculateLeaveDays(input.start_date, input.end_date);

      const payload: Insertable<LeaveApplications> = {
        employee_id: employee.id,
        employee_code: employee.employee_number,
        employee_name: employee.full_name,
        department: employee.department_name,
        designation: employee.designation,
        leave_type: input.leave_type,
        start_date: input.start_date,
        end_date: input.end_date,
        calendar_days: days.calendarDays,
        working_days: days.workingDays,
        balance_before: balanceBefore,
        balance_after: balanceBefore,
        purpose: emptyToNull(input.purpose),
        destination: emptyToNull(input.destination),
        travel_from: emptyToNull(input.travel_from),
        travel_to: emptyToNull(input.travel_to),
        emergency_contact_name: emptyToNull(input.emergency_contact_name),
        emergency_contact_phone: emptyToNull(input.emergency_contact_phone),
        emergency_contact_email: emptyToNull(input.emergency_contact_email),
        handover_to_employee_id: handoverEmployee?.id ?? null,
        handover_to_employee_code: handoverEmployee?.employee_number ?? null,
        handover_to_name: handoverEmployee?.full_name ?? null,
        status: "draft",
        created_by: user.id
      };

      return trx
        .insertInto("leave_applications")
        .values(payload)
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }

  async saveApplication(input: SaveLeaveApplicationDto, user: AuthenticatedUser) {
    const created = await this.createDraft(input, user);
    if (input.status === "submitted") {
      return this.submit(created.id, user);
    }
    return { application: serializeRecord(created), approval: null };
  }

  async updateApplication(id: string, input: SaveLeaveApplicationDto, user: AuthenticatedUser) {
    validateCreateDraft(input);

    await this.database.db.transaction().execute(async (trx) => {
      const existing = await getApplicationForUpdate(trx, id);
      if (!["draft", "submitted"].includes(existing.status)) {
        throw new BadRequestException("Only draft or submitted applications can be edited.");
      }

      const employee = await trx
        .selectFrom("employees")
        .leftJoin("departments", "departments.id", "employees.department_id")
        .select([
          "employees.id",
          "employees.employee_number",
          "employees.full_name",
          "employees.designation",
          "departments.name as department_name"
        ])
        .where("employees.id", "=", input.employee_id)
        .where("employees.deleted_at", "is", null)
        .executeTakeFirst();

      if (!employee) {
        throw new NotFoundException("Employee was not found.");
      }

      const handoverEmployee = input.handover_to_employee_id
        ? await trx
          .selectFrom("employees")
          .select(["id", "employee_number", "full_name"])
          .where("id", "=", input.handover_to_employee_id)
          .where("deleted_at", "is", null)
          .executeTakeFirst()
        : null;

      if (input.handover_to_employee_id && !handoverEmployee) {
        throw new NotFoundException("Handover employee was not found.");
      }

      if (handoverEmployee?.id === employee.id) {
        throw new BadRequestException("Handover employee must be different from the leave applicant.");
      }

      const balanceBefore = await resolveBalanceBefore(trx, employee.id, input.leave_type, input.balance_before);
      const days = calculateLeaveDays(input.start_date, input.end_date);

      await trx
        .updateTable("leave_applications")
        .set({
          employee_id: employee.id,
          employee_code: employee.employee_number,
          employee_name: employee.full_name,
          department: employee.department_name,
          designation: employee.designation,
          leave_type: input.leave_type,
          start_date: input.start_date,
          end_date: input.end_date,
          calendar_days: days.calendarDays,
          working_days: days.workingDays,
          balance_before: balanceBefore,
          balance_after: balanceBefore,
          purpose: emptyToNull(input.purpose),
          destination: emptyToNull(input.destination),
          travel_from: emptyToNull(input.travel_from),
          travel_to: emptyToNull(input.travel_to),
          emergency_contact_name: emptyToNull(input.emergency_contact_name),
          emergency_contact_phone: emptyToNull(input.emergency_contact_phone),
          emergency_contact_email: emptyToNull(input.emergency_contact_email),
          handover_to_employee_id: handoverEmployee?.id ?? null,
          handover_to_employee_code: handoverEmployee?.employee_number ?? null,
          handover_to_name: handoverEmployee?.full_name ?? null,
          status: input.status === "submitted" ? "submitted" : "draft",
          created_by: existing.created_by ?? user.id,
          updated_at: new Date()
        })
        .where("id", "=", id)
        .executeTakeFirst();
    });

    return this.getApplicationWithApproval(id);
  }

  async submit(id: string, _user: AuthenticatedUser) {
    await this.database.db.transaction().execute(async (trx) => {
      const application = await getApplicationForUpdate(trx, id);
      if (application.status !== "draft") {
        throw new BadRequestException("Only draft leave applications can be submitted.");
      }

      await trx
        .updateTable("leave_applications")
        .set({ status: "submitted", updated_at: new Date() })
        .where("id", "=", id)
        .executeTakeFirst();
    });

    return this.getApplicationWithApproval(id);
  }

  async cancel(id: string, _user: AuthenticatedUser) {
    await this.database.db.transaction().execute(async (trx) => {
      const application = await getApplicationForUpdate(trx, id);
      if (!["draft", "submitted", "pending_approval"].includes(application.status)) {
        throw new BadRequestException("Only draft, submitted, or pending approval applications can be cancelled.");
      }

      await trx
        .updateTable("leave_applications")
        .set({ status: "cancelled", updated_at: new Date() })
        .where("id", "=", id)
        .executeTakeFirst();
    });

    return this.getApplicationWithApproval(id);
  }

  async decide(id: string, input: ApprovalDecisionDto, user: AuthenticatedUser) {
    if (input.decision !== "approved" && input.decision !== "rejected") {
      throw new BadRequestException("Decision must be approved or rejected.");
    }

    await this.database.db.transaction().execute(async (trx) => {
      const application = await getApplicationForUpdate(trx, id);
      if (application.status !== "pending_approval") {
        throw new BadRequestException("Only pending approval applications can receive a decision.");
      }

      const approval = await trx
        .selectFrom("leave_approvals")
        .selectAll()
        .where("leave_application_id", "=", id)
        .where("decision", "=", "pending")
        .executeTakeFirst();

      if (!approval) {
        throw new NotFoundException("Pending leave approval was not found.");
      }

      await trx
        .updateTable("leave_approvals")
        .set({
          decision: input.decision,
          decision_date: new Date(),
          approver_id: user.id,
          approver_name: user.fullName,
          approval_notes: emptyToNull(input.approval_notes),
          updated_at: new Date()
        })
        .where("id", "=", approval.id)
        .executeTakeFirst();
    });

    return this.getApplicationWithApproval(id);
  }

  async updateHandover(id: string, input: UpdateHandoverDto) {
    const handover = await this.database.db
      .updateTable("leave_handovers")
      .set({
        tasks_notes: emptyToNull(input.tasks_notes),
        attachment_url: input.attachment_url ?? undefined,
        status: input.status,
        accepted_at: input.accepted_at ? new Date(input.accepted_at) : input.status === "accepted" ? new Date() : null,
        updated_at: new Date()
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!handover) throw new NotFoundException("Leave handover was not found.");
    return serializeRecord(handover);
  }

  async updateClearance(id: string, input: UpdateClearanceDto) {
    const clearance = await this.database.db
      .updateTable("leave_clearances")
      .set({
        clearance_items: input.clearance_items,
        responsible_person: emptyToNull(input.responsible_person),
        status: input.status,
        comments: emptyToNull(input.comments),
        completed_at: input.completed_at ? new Date(input.completed_at) : null,
        updated_at: new Date()
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!clearance) throw new NotFoundException("Leave clearance was not found.");
    return serializeRecord(clearance);
  }

  async updateRejoin(id: string, input: UpdateRejoinDto, user: AuthenticatedUser) {
    const verifiedBy = input.status === "verified"
      ? input.hr_verified_by ?? user.fullName ?? user.email ?? "HR"
      : null;
    const verifiedAt = input.status === "verified"
      ? input.verified_at ? new Date(input.verified_at) : new Date()
      : null;

    const rejoin = await this.database.db
      .updateTable("leave_rejoins")
      .set({
        actual_rejoin_date: input.actual_rejoin_date || null,
        reason_for_delay: emptyToNull(input.reason_for_delay),
        medical_or_supporting_attachment: input.medical_or_supporting_attachment ?? undefined,
        status: input.status,
        hr_verified_by: verifiedBy,
        verified_at: verifiedAt,
        updated_at: new Date()
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirst();

    if (!rejoin) throw new NotFoundException("Leave rejoin record was not found.");
    return serializeRecord(rejoin);
  }

  async storeAttachment(prefix: string, id: string, file: { originalname?: string; buffer: Buffer }) {
    const safeName = (file.originalname ?? "attachment").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "attachment";
    return this.storage.write(`hr/${prefix}/${id}/${Date.now()}-${safeName}`, file.buffer);
  }

  readDocument(key: string) {
    return this.storage.read(key);
  }

  async getApplicationWithApproval(id: string) {
    const application = await this.database.db
      .selectFrom("leave_applications")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!application) {
      throw new NotFoundException("Leave application was not found.");
    }

    const approval = await this.database.db
      .selectFrom("leave_approvals")
      .selectAll()
      .where("leave_application_id", "=", id)
      .executeTakeFirst();

    return { application: serializeRecord(application), approval: approval ? serializeRecord(approval) : null };
  }
}

async function getApplicationForUpdate(trx: Transaction<DB>, id: string) {
  const application = await trx
    .selectFrom("leave_applications")
    .selectAll()
    .where("id", "=", id)
    .forUpdate()
    .executeTakeFirst();

  if (!application) {
    throw new NotFoundException("Leave application was not found.");
  }

  return application;
}

async function resolveBalanceBefore(
  trx: Transaction<DB>,
  employeeId: string,
  leaveType: string,
  providedBalance: number | string | undefined
) {
  if (providedBalance != null) {
    const parsed = Number(providedBalance);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException("balance_before must be a non-negative number.");
    }
    return parsed;
  }

  const balance = await trx
    .selectFrom("employee_leave_balances")
    .select("balance_days")
    .where("employee_id", "=", employeeId)
    .where("leave_type", "=", leaveType)
    .executeTakeFirst();

  return Number(balance?.balance_days ?? 0);
}

function validateCreateDraft(input: CreateLeaveDraftDto) {
  if (!input.employee_id) throw new BadRequestException("employee_id is required.");
  if (!input.leave_type) throw new BadRequestException("leave_type is required.");
  calculateLeaveDays(input.start_date, input.end_date);
  if (input.travel_from && input.travel_to) {
    const travelFrom = parseDate(input.travel_from, "travel_from");
    const travelTo = parseDate(input.travel_to, "travel_to");
    if (travelTo < travelFrom) {
      throw new BadRequestException("travel_to must be on or after travel_from.");
    }
  }
}

function calculateLeaveDays(startDateValue: string, endDateValue: string) {
  const startDate = parseDate(startDateValue, "start_date");
  const endDate = parseDate(endDateValue, "end_date");
  if (endDate < startDate) {
    throw new BadRequestException("end_date must be on or after start_date.");
  }

  let calendarDays = 0;
  let workingDays = 0;
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    calendarDays += 1;
    const day = cursor.getUTCDay();
    if (day !== 5 && day !== 6) workingDays += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (workingDays <= 0) {
    throw new BadRequestException("Leave period must include at least one working day.");
  }

  return { calendarDays, workingDays };
}

function parseDate(value: string | undefined, field: string) {
  if (!value) throw new BadRequestException(`${field} is required.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} must use YYYY-MM-DD format.`);
  }
  return date;
}

function emptyToNull(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function serializeRecord<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (value instanceof Date) return [key, value.toISOString()];
      if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value) && numericFields.has(key)) return [key, Number(value)];
      return [key, value];
    })
  );
}

const numericFields = new Set(["calendar_days", "working_days", "balance_before", "balance_after", "days", "delay_days"]);
