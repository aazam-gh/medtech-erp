import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../auth/current-user.decorator";
import { DevAuthGuard } from "../auth/dev-auth.guard";
import { PermissionGuard } from "../auth/permission.guard";
import { RequirePermission } from "../auth/permission.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import type {
  ApprovalDecisionDto,
  SaveLeaveApplicationDto,
  UpdateClearanceDto,
  UpdateHandoverDto,
  UpdateRejoinDto
} from "./hr-leave.dto";
import { HrLeaveService } from "./hr-leave.service";
import { LeavePdfService } from "./leave-pdf.service";

@Controller("hr")
@UseGuards(DevAuthGuard, PermissionGuard)
@RequirePermission("hr", "view")
export class HrLeaveController {
  constructor(
    @Inject(HrLeaveService) private readonly leaveService: HrLeaveService,
    @Inject(LeavePdfService) private readonly leavePdfService: LeavePdfService
  ) {}

  @Get("leave-applications")
  listApplications() {
    return this.leaveService.listApplications();
  }

  @Get("leave-workspace")
  workspace() {
    return this.leaveService.getWorkspaceData();
  }

  @Post("leave-applications")
  @RequirePermission("hr", "create")
  createDraft(@Body() body: SaveLeaveApplicationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveService.saveApplication(body, user);
  }

  @Patch("leave-applications/:id")
  @RequirePermission("hr", "update")
  updateApplication(@Param("id") id: string, @Body() body: SaveLeaveApplicationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveService.updateApplication(id, body, user);
  }

  @Patch("leave-applications/:id/submit")
  @RequirePermission("hr", "create")
  submit(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveService.submit(id, user);
  }

  @Patch("leave-applications/:id/cancel")
  @RequirePermission("hr", "update")
  cancel(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveService.cancel(id, user);
  }

  @Patch("leave-applications/:id/decision")
  @RequirePermission("hr", "approve")
  decide(@Param("id") id: string, @Body() body: ApprovalDecisionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveService.decide(id, body, user);
  }

  @Post("leave-applications/:id/pdf")
  @RequirePermission("hr", "view")
  generatePdf(@Param("id") id: string) {
    return this.leavePdfService.generateForApplication(id);
  }

  @Get("documents")
  @Header("Content-Type", "application/octet-stream")
  async readDocument(@Query("key") key: string) {
    return new StreamableFile(await this.leaveService.readDocument(key));
  }

  @Get("leave-handovers")
  listHandovers() {
    return this.leaveService.listHandovers();
  }

  @Patch("leave-handovers/:id")
  @RequirePermission("hr", "update")
  updateHandover(@Param("id") id: string, @Body() body: UpdateHandoverDto) {
    return this.leaveService.updateHandover(id, body);
  }

  @Post("leave-handovers/:id/attachment")
  @RequirePermission("hr", "update")
  @UseInterceptors(FileInterceptor("file"))
  uploadHandoverAttachment(@Param("id") id: string, @UploadedFile() file: { originalname?: string; buffer: Buffer }) {
    return this.leaveService.storeAttachment("leave-handovers", id, file).then((attachment_url) => ({ attachment_url }));
  }

  @Get("leave-clearances")
  listClearances() {
    return this.leaveService.listClearances();
  }

  @Patch("leave-clearances/:id")
  @RequirePermission("hr", "update")
  updateClearance(@Param("id") id: string, @Body() body: UpdateClearanceDto) {
    return this.leaveService.updateClearance(id, body);
  }

  @Get("leave-rejoins")
  listRejoins() {
    return this.leaveService.listRejoins();
  }

  @Patch("leave-rejoins/:id")
  @RequirePermission("hr", "update")
  updateRejoin(@Param("id") id: string, @Body() body: UpdateRejoinDto, @CurrentUser() user: AuthenticatedUser) {
    return this.leaveService.updateRejoin(id, body, user);
  }

  @Post("leave-rejoins/:id/attachment")
  @RequirePermission("hr", "update")
  @UseInterceptors(FileInterceptor("file"))
  uploadRejoinAttachment(@Param("id") id: string, @UploadedFile() file: { originalname?: string; buffer: Buffer }) {
    return this.leaveService.storeAttachment("leave-rejoins", id, file).then((medical_or_supporting_attachment) => ({ medical_or_supporting_attachment }));
  }
}
