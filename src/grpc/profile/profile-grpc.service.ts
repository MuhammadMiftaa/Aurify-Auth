import { Inject, Injectable } from '@nestjs/common';
import { PROFILE_GRPC_CLIENT } from './profile-grpc.module';
import profilePbModule from '@muhammadmiftaa/refina-protobuf/profile/profile_pb.js';

// ─── gRPC contract types (mirrors profile.proto) ────────────────────────────

export interface GrpcProfile {
  getId(): string;
  getUserId(): string;
  getFullname(): string;
  getPhotoUrl(): string;
  getCreatedAt(): string;
  getUpdatedAt(): string;
}

// ─── Promisify helper ────────────────────────────────────────────────────────

function callUnary<TReq, TRes>(
  client: any,
  method: string,
  request: TReq,
): Promise<TRes> {
  return new Promise((resolve, reject) => {
    client[method](request, (error: Error | null, response: TRes) => {
      if (error) return reject(error);
      resolve(response);
    });
  });
}

// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ProfileGrpcService {
  constructor(@Inject(PROFILE_GRPC_CLIENT) private readonly client: any) {}

  async createProfile(data: {
    user_id: string;
    fullname: string;
  }): Promise<GrpcProfile> {
    const ppb = (profilePbModule as any).proto?.profile || profilePbModule;
    const request = new ppb.CreateProfileRequest();
    request.setUserId(data.user_id);
    request.setFullname(data.fullname);

    return callUnary<typeof request, GrpcProfile>(
      this.client,
      'createProfile',
      request,
    );
  }
}
