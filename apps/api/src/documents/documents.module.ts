import { Module } from "@nestjs/common";
import { DocumentsStorageService } from "./documents-storage.service";

@Module({
  providers: [DocumentsStorageService],
  exports: [DocumentsStorageService]
})
export class DocumentsModule {}
