import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as express from 'express';
import { join } from 'path';
import { SwaggerAuthMiddleware } from './common/middleware/swagger-auth.middleware';
import { ApiKeysService } from './api-keys/api-keys.service';

// Bootstrap aplikacije - inicijalizacija NestJS servera
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global API prefix - MORA BITI PRE static files
  app.setGlobalPrefix('api');

  // Serve static files for uploads (samo u development)
  // Ovo mora biti posle setGlobalPrefix da bi radilo na /uploads putanji
  if (process.env.NODE_ENV === 'development') {
    const uploadPath = join(process.cwd(), 'uploads');

    // CORS middleware za static files
    app.use('/uploads', (req, res, next) => {
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

      if (req.method === 'OPTIONS') {
        res.sendStatus(204);
      } else {
        next();
      }
    });

    app.use('/uploads', express.static(uploadPath));
    console.log('Serving static files from:', uploadPath);
  }

  // Increase payload size limits for large user sync operations
  app.use(express.json({ limit: '500mb' }));
  app.use(express.urlencoded({ limit: '500mb', extended: true }));

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3011',
      'http://localhost:3012',
      'http://localhost:3000',
      'https://gsp-admin.smart-city.rs',
      'https://admin.smart-city.rs',
    ],
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Class Serializer for @Exclude decorators
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Swagger sa API Key zaštitom
  const apiKeysService = app.get(ApiKeysService);
  const swaggerAuthMiddleware = new SwaggerAuthMiddleware(apiKeysService);

  app.use('/api/docs', (req, res, next) => {
    swaggerAuthMiddleware.use(req, res, next);
  });

  const config = new DocumentBuilder()
    .setTitle('Smart City API')
    .setDescription('API for Smart City Platform - Zaštićeno API ključem')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description:
          'API ključ za pristup dokumentaciji (bilo koji aktivan ključ)',
      },
      'ApiKeyAuth',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3010;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);
  console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
}
bootstrap();
