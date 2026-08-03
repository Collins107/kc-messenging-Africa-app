import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  // Support requests using either the root paths (e.g. /auth) or the
  // OpenAPI-prefixed paths (/api/auth) by rewriting known API paths to the
  // /api namespace. This keeps the server compatible with both generated
  // clients (which expect /api) and handwritten clients/artifacts that hit
  // root routes.
  app.use((req: any, _res: any, next: any) => {
    const apiPrefixes = ['/auth', '/users', '/conversations', '/healthz'];
    const path = req.path || req.url || '';
    if (apiPrefixes.some((p) => path === p || path.startsWith(p + '/'))) {
      // Rewrite the incoming URL so that Nest routes registered under /api
      // will receive the request as if it were mounted at /api.
      req.url = `/api${req.url}`;
    }
    next();
  });

  // Expose all REST controllers under /api so they match the OpenAPI
  // specification and the generated frontend client. The middleware above
  // keeps compatibility with clients that call root routes.
  app.setGlobalPrefix('api');

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`KC Messaging backend listening on :${port}`);
}
bootstrap();
