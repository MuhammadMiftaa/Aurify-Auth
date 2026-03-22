import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as grpc from '@grpc/grpc-js';
import profileGrpcModule from '@muhammadmiftaa/refina-protobuf/profile/profile_grpc_pb.js';
import { ProfileGrpcService } from './profile-grpc.service';

export const PROFILE_GRPC_CLIENT = 'PROFILE_GRPC_CLIENT';

const pgrpc = (profileGrpcModule as any).profile || profileGrpcModule;

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PROFILE_GRPC_CLIENT,
      useFactory: (configService: ConfigService) => {
        const address =
          configService.get<string>('PROFILE_GRPC_ADDRESS') ||
          'localhost:10005';
        return new pgrpc.ProfileServiceService(
          address,
          grpc.credentials.createInsecure(),
        );
      },
      inject: [ConfigService],
    },
    ProfileGrpcService,
  ],
  exports: [ProfileGrpcService],
})
export class ProfileGrpcModule {}