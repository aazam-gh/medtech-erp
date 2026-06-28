import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { generateLeaveApplicationPdf } from "../../../../lib/hr/leave-pdf";
import type { LeaveApplication, LeaveApproval } from "../../../../lib/hr/leave-types";
import { KyselyProvider } from "../database/kysely.provider";
import { DocumentsStorageService } from "../documents/documents-storage.service";

@Injectable()
export class LeavePdfService {
  constructor(
    @Inject(KyselyProvider) private readonly database: KyselyProvider,
    @Inject(DocumentsStorageService) private readonly storage: DocumentsStorageService
  ) {}

  async generateForApplication(id: string) {
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

    const employee = await this.database.db
      .selectFrom("employees")
      .select(["join_date"])
      .where("id", "=", application.employee_id)
      .executeTakeFirst();

    const pdf = await generateLeaveApplicationPdf({
      application: serializeLeaveApplication(application) as LeaveApplication,
      approval: approval ? (serializeLeaveApproval(approval) as LeaveApproval) : null,
      employee: employee ? { join_date: serializeDate(employee.join_date) } : null
    });

    const objectKey = `hr/leave-applications/${id}/${sanitizeFilename(application.request_no)}.pdf`;
    const storedKey = await this.storage.write(objectKey, pdf);

    await this.database.db.transaction().execute(async (trx) => {
      await trx
        .updateTable("leave_applications")
        .set({ pdf_url: storedKey, updated_at: new Date() })
        .where("id", "=", id)
        .execute();

      if (approval) {
        await trx
          .updateTable("leave_approvals")
          .set({ pdf_url: storedKey, updated_at: new Date() })
          .where("leave_application_id", "=", id)
          .execute();
      }
    });

    return { pdf_url: storedKey };
  }
}

function serializeLeaveApplication(application: Record<string, unknown>) {
  return {
    ...application,
    start_date: serializeDate(application.start_date),
    end_date: serializeDate(application.end_date),
    travel_from: serializeNullableDate(application.travel_from),
    travel_to: serializeNullableDate(application.travel_to),
    created_at: serializeDate(application.created_at),
    updated_at: serializeDate(application.updated_at),
    calendar_days: Number(application.calendar_days),
    working_days: Number(application.working_days),
    balance_before: Number(application.balance_before),
    balance_after: Number(application.balance_after)
  };
}

function serializeLeaveApproval(approval: Record<string, unknown>) {
  return {
    ...approval,
    approved_from: serializeDate(approval.approved_from),
    approved_to: serializeDate(approval.approved_to),
    decision_date: serializeNullableDate(approval.decision_date),
    created_at: serializeDate(approval.created_at),
    updated_at: serializeDate(approval.updated_at),
    days: Number(approval.days)
  };
}

function serializeDate(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function serializeNullableDate(value: unknown) {
  return value == null ? null : serializeDate(value);
}

function sanitizeFilename(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "leave-application";
}
