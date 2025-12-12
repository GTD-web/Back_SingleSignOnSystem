import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
    id: string;
    employeeNumber: string;
    name: string;
    email: string;
    status: string;
    currentRankId?: string;
    token: {
        id: string;
        expiresAt: Date;
    };
}

export const User = createParamDecorator(
    (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): AuthenticatedUser | any => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user;
        console.log('user', user);
        return data ? user?.[data] : user;
    },
);
