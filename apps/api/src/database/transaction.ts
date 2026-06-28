import { Inject, Injectable } from "@nestjs/common";
import type { Kysely, Transaction } from "kysely";
import type { DB } from "../../../../database/generated/db";
import { KyselyProvider } from "./kysely.provider";

@Injectable()
export class TransactionService {
  constructor(@Inject(KyselyProvider) private readonly database: KyselyProvider) {}

  get db(): Kysely<DB> {
    return this.database.db;
  }

  execute<T>(callback: (trx: Transaction<DB>) => Promise<T>) {
    return this.database.db.transaction().execute(callback);
  }
}
