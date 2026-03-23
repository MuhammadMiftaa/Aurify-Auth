import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as grpc from '@grpc/grpc-js';
import { ProfileGrpcService } from './profile-grpc.service';
import { PROFILE_GRPC_CLIENT } from './profile-grpc.constants';
import profileGrpcModule from '@muhammadmiftaa/refina-protobuf/profile/profile_grpc_pb.js';

const pgrpc = (profileGrpcModule as any).profile || profileGrpcModule;

@Module({
  providers: [
    {
      provide: PROFILE_GRPC_CLIENT,
      useFactory: (configService: ConfigService) => {
        const address = configService.get<string>('PROFILE_GRPC_ADDRESS');
        return new pgrpc.ProfileServiceClient(
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
