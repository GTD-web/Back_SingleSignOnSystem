import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { setupSwagger } from '../libs/common/utils/swagger';
import * as dtos from './dtos.index';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { LoggingInterceptor } from '../libs/common/interceptors/logging.interceptor';
import { LogApplicationService } from './modules/application/admin/log/log-application.service';
import * as hbs from 'hbs';
import { RequestInterceptor } from '../libs/common/interceptors/request.interceptor';
import { ErrorInterceptor } from '../libs/common/interceptors/error.interceptor';

async function bootstrap() {
    // Vercel 환경에서는 실행하지 않음
    if (process.env.VERCEL || process.env.NOW_REGION) {
        console.log('Running in Vercel environment, skipping bootstrap');
        return;
    }

    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // CORS setup
    // CORS setup
    const ALLOW_ORIGINS = [
        'https://lsso.vercel.app',
        'https://lsso-git-dev-lumir-tech7s-projects.vercel.app',
        'https://lsso-git-dev-lumir-web-dev.vercel.app',

        'https://lsso-admin.vercel.app',
        'https://lsso-admin-git-dev-lumir-tech7s-projects.vercel.app',
        'https://portal.lumir.space',
        'https://lsms.lumir.space',
        'https://lsso-dev.vercel.app',
        'http://localhost:3000',
        // 필요하면 스테이징/프로덕션 도메인 추가
    ];

    app.enableCors({
        origin: ALLOW_ORIGINS,
        methods: 'GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS',
    });

    // Global pipes
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        }),
    );

    // API 프리픽스 설정 (AppController 제외)
    app.setGlobalPrefix('api', {
        exclude: ['/set-initial-password', '/change-password'],
    });

    // Swagger setup
    setupSwagger(app, [...Object.values(dtos)]);

    app.useGlobalInterceptors(new RequestInterceptor(), new ErrorInterceptor());
    app.useGlobalInterceptors(new LoggingInterceptor(app.get(LogApplicationService)));

    // 정적 파일 서빙 설정 (Swagger 커스텀 JS 포함)
    app.useStaticAssets(join(__dirname, '..', 'public'), {
        prefix: '/static',
    });

    // Handlebars 설정
    app.setBaseViewsDir(join(__dirname, '..', 'src', 'views'));
    app.setViewEngine('hbs');

    // Handlebars 파셜 설정
    hbs.registerPartials(join(__dirname, '..', 'views/partials'));

    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
