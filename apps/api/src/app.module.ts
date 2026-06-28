import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { HrModule } from "./hr/hr.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [".env.local", ".env"],
      isGlobal: true
    }),
    DatabaseModule,
    HealthModule,
    HrModule
  ]
})
export class AppModule {}
