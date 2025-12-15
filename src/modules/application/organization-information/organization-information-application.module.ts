import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OrganizationInformationApplicationService } from './organization-information-application.service';
import { OrganizationInformationApplicationController } from './controllers/organization-information-application.controller';

// Context 모듈들 import
import { OrganizationManagementContextModule } from '../../context/organization-management/organization-management-context.module';
import { AuthorizationContextModule } from '../../context/authorization/authorization-context.module';
import { SystemManagementContextModule } from '../../context/system-management/system-management-context.module';

// JWT 관련 import
import { jwtConfig } from '../../../../libs/configs/jwt.config';

@Module({
    imports: [
        OrganizationManagementContextModule,
        AuthorizationContextModule,
        SystemManagementContextModule,
        PassportModule,
        JwtModule.registerAsync({
            useFactory: jwtConfig,
            inject: [ConfigService],
        }),
    ],
    controllers: [OrganizationInformationApplicationController],
    providers: [OrganizationInformationApplicationService], //JwtStrategy, JwtAuthGuard
    exports: [OrganizationInformationApplicationService],
})
export class OrganizationInformationApplicationModule {}
