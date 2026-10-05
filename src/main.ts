import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true lets webhook handlers (Stripe) verify signatures against
  // the exact bytes received, before Nest's JSON body parser touches them.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Railway terminates TLS and proxies to the app, so without this every
  // request reports the proxy's IP. Rate limiting keyed on `req.ip` would
  // then put all users in one bucket — one abuser would lock out everyone,
  // and a single client could spread its requests across none.
  //
  // `1` (not `true`) on purpose: trusting the whole chain would let a client
  // forge `X-Forwarded-For` and get a fresh bucket per request, defeating the
  // limit entirely. One hop = only the proxy we actually run behind.
  app.set('trust proxy', 1);

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Hispora API')
    .setDescription('API para gerenciamento de histórico médico')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Typed explicitly: with the app now generic over NestExpressApplication,
  // the adapter's handler args are no longer inferred as Express types.
  app.getHttpAdapter().get('/api/docs-json', (_req: Request, res: Response) => {
    res.json(document);
  });

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Swagger documentation available at: ${await app.getUrl()}/api/docs`);
  console.log(`Swagger JSON available at: ${await app.getUrl()}/api/docs-json`);
}
bootstrap();
