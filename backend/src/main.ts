import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { requireJwtSecret } from './auth/auth.constants';
import { AppModule } from './app.module';

async function bootstrap() {
  requireJwtSecret();
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one allowed frontend origin.');
  }

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();

  await app.listen(process.env.PORT || 4000);
}

bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(
    'API failed to start',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
