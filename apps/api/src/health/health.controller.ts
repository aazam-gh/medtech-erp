import { Controller, Get, Inject } from "@nestjs/common";
import { sql } from "kysely";
import { KyselyProvider } from "../database/kysely.provider";

@Controller("health")
export class HealthController {
  constructor(@Inject(KyselyProvider) private readonly database: KyselyProvider) {}

  @Get()
  health() {
    return {
      status: "ok",
      service: "medtech-api",
      time: new Date().toISOString()
    };
  }

  @Get("database")
  async databaseHealth() {
    const result = await sql<{ current_time: Date }>`select now() as current_time`.execute(this.database.db);
    return {
      status: "ok",
      current_time: result.rows[0]?.current_time
    };
  }
}
