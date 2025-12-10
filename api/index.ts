import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { setupSwagger } from '../libs/common/utils/swagger';
import { ENV } from '../libs/configs/env.config';
import * as dtos from '../src/dtos.index';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { LoggingInterceptor } from '../libs/common/interceptors/logging.interceptor';
import { LogApplicationService } from '../src/modules/application/admin/log/log-application.service';
import * as hbs from 'hbs';
import { RequestInterceptor } from '../libs/common/interceptors/request.interceptor';
import { ErrorInterceptor } from '../libs/common/interceptors/error.interceptor';

let cachedApp: NestExpressApplication;

async function createApp(): Promise<NestExpressApplication> {
    if (!cachedApp) {
        console.log('Creating new NestJS app for Vercel...');

        const app = await NestFactory.create<NestExpressApplication>(AppModule);
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
            // origin: ALLOW_ORIGINS,
            origin: function (origin, callback) {
                const whitelist = ALLOW_ORIGINS;
                if (!origin || whitelist.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: 'GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS',
            credentials: true,
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

        // Handlebars 설정 (Vercel에서는 static assets 경로 조정 필요)
        try {
            app.useStaticAssets(join(__dirname, '..', 'public'));
            app.setBaseViewsDir(join(__dirname, '..', 'src', 'views'));
            app.setViewEngine('hbs');

            // Handlebars 파셜 설정
            hbs.registerPartials(join(__dirname, '..', 'views/partials'));
        } catch (error) {
            console.warn('Handlebars setup failed in Vercel environment:', error.message);
        }

        await app.init();
        cachedApp = app;

        console.log('NestJS app created and initialized for Vercel');
    }

    return cachedApp;
}

// Vercel용 handler export
export default async function handler(req: any, res: any) {
    try {
        // 수동 CORS 처리 (Vercel serverless 환경 대응)

        const app = await createApp();
        const server = app.getHttpAdapter().getInstance();

        // Express 서버를 Vercel handler로 래핑
        return server(req, res);
    } catch (error) {
        console.error('Vercel handler error:', error);

        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message,
        });
    }
}
