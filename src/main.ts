import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionLoggerFilter } from './common/filters/http-exception.filter';
import { RequestLoggerInterceptor } from './common/interceptors/request-logger.interceptor';
import { correlationIdMiddleware } from './common/middleware/correlation-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsAllowed = process.env.CORS_ALLOWED ?? '*';
  app.enableCors({
    origin: corsAllowed === '*' ? true : corsAllowed.split(',').map((s) => s.trim()),
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.use(correlationIdMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionLoggerFilter());
  app.useGlobalInterceptors(new RequestLoggerInterceptor());

  const config = new DocumentBuilder()
    .setTitle('AurumLedger API')
    .setDescription('Client and contract management API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
