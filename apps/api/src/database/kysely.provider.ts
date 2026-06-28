import { Inject, Injectable, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { DB } from "../../../../database/generated/db";

export const DATABASE = Symbol("DATABASE");

@Injectable()
export class KyselyProvider implements OnApplicationShutdown {
  readonly db: Kysely<DB>;
  private readonly pool: Pool;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const connectionString = config.get<string>("DATABASE_URL");
    if (!connectionString) {
      throw new Error("DATABASE_URL is required");
    }

    this.pool = new Pool({ connectionString });
    this.db = new Kysely<DB>({
      dialect: new PostgresDialect({ pool: this.pool })
    });
  }

  async onApplicationShutdown() {
    await this.db.destroy();
  }
}

export const InjectDatabase = () => Inject(KyselyProvider);
