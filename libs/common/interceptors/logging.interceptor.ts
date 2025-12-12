import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { Request, Response } from 'express';
import { LogApplicationService } from '../../../src/modules/application/admin/log/log-application.service';
// import { DateUtil } from '../utils/date.util';
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    constructor(private readonly logsService: LogApplicationService) {}

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const startTime = Date.now();
        const ctx = context.switchToHttp();
        const request = ctx.getRequest<Request>();

        const passUrl = ['/api/admin', '/api/domain', '/api/webhook', '/api/auth/verify'];
        if (passUrl.some((url) => request.url.startsWith(url))) {
            return next.handle();
        }

        let ip: string = Array.isArray(request.headers['x-forwarded-for'])
            ? request.headers['x-forwarded-for'][0]
            : (request.headers['x-forwarded-for'] as string) || request.socket.remoteAddress || '';

        if (ip.includes(',')) {
            ip = ip.split(',')[0];
        }
        if (ip === '::ffff:127.0.0.1' || ip === '::1') {
            ip = '127.0.0.1';
        }

        // SDK에서 전송한 시스템 정보 추출 (X-System-ID, X-System-Name 헤더)
        // const systemId = request.headers['x-system-id'] as string;
        const systemName = request.headers['x-system-name'] as string;
        console.log('systemName', systemName);

        // 요청 정보 수집
        const logData = {
            // 요청 정보
            origin: request.headers.origin,
            host: request.headers.host,
            method: request.method,
            url: request.url,
            params: request.params,
            query: request.query,
            body: request.body,
            ip: ip,
            userAgent: request.get('user-agent'),
            requestTimestamp: new Date(),
            // 응답 정보는 나중에 채워질 예정
            responseTimestamp: null,
            responseTime: null,
            statusCode: null,
            response: null,
            system: systemName || null,
            error: null,
            isError: false,
        };

        return next.handle().pipe(
            tap(async (response) => {
                // 성공 응답 정보 추가
                logData.responseTimestamp = new Date();
                logData.responseTime = logData.responseTimestamp - startTime;
                logData.statusCode = context.switchToHttp().getResponse<Response>().statusCode;
                logData.response = request.method !== 'GET' ? response : null;
                logData.system = logData.system !== null ? logData.system : response?.systemName;
            }),
            catchError(async (error) => {
                // 에러 정보 추가
                logData.responseTimestamp = new Date();
                logData.responseTime = logData.responseTimestamp - startTime;
                logData.statusCode = error.status || 500;
                logData.error = {
                    message: error.message,
                    // stack: error.stack,
                };
                logData.isError = true;
                throw error;
            }),
            finalize(() => {
                this.logsService.로그생성(logData);
            }),
        );
    }
}
