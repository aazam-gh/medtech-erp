import { Global, Module } from "@nestjs/common";
import { KyselyProvider } from "./kysely.provider";
import { TransactionService } from "./transaction";

@Global()
@Module({
  providers: [KyselyProvider, TransactionService],
  exports: [KyselyProvider, TransactionService]
})
export class DatabaseModule {}
