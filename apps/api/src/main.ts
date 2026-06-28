import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.enableCors({
    origin: true,
    credentials: true,
    allowedHeaders: ["Content-Type", "x-dev-user"],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
