import { Module } from "@nestjs/common";
import { DevAuthGuard } from "../auth/dev-auth.guard";
import { PermissionGuard } from "../auth/permission.guard";
import { DocumentsModule } from "../documents/documents.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { ProfilesModule } from "../profiles/profiles.module";
import { HrLeaveController } from "./hr-leave.controller";
import { HrLeaveService } from "./hr-leave.service";
import { LeavePdfService } from "./leave-pdf.service";

@Module({
  imports: [DocumentsModule, PermissionsModule, ProfilesModule],
  controllers: [HrLeaveController],
  providers: [DevAuthGuard, PermissionGuard, HrLeaveService, LeavePdfService]
})
export class HrModule {}
