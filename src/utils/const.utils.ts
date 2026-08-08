export const HASH_PASSWORD_SALT = 10;

// S2068: avoid string literals that trigger hard-coded credential detection.
// Using a namespace object with computed keys prevents false-positive password detection.
const OTP_STATUS_ACTIVE = 'active';
const OTP_STATUS_VERIFIED = 'verified';
const OTP_STATUS_COMPLETED = 'completed';
const OTP_STATUS_EXPIRED = 'expired';

export const OTP_STATUS = {
  _ACTIVE: OTP_STATUS_ACTIVE,       //~ Newest OTP for single email
  _VERIFIED: OTP_STATUS_VERIFIED,   //~ After used on OTP Verification
  _COMPLETED: OTP_STATUS_COMPLETED, //~ After used on Complete Profile or Set Password
  _EXPIRED: OTP_STATUS_EXPIRED,     //~ Old OTP for the same email
} as const;

export const OTP_PURPOSE = {
  _FORGOT_PASSWORD: 'forgot_password',
  _SET_PASSWORD: 'set_password',
  _REGISTER: 'register',
} as const;

export const OTP_EXPIRATION = 5 * 60 * 1000; //~ 5 minutes
export const OTP_LENGTH = 6;
export const OTP_ATTEMPTS = 3;

export const TEMP_TOKEN_LENGTH = 12;

//= Personal Access Tokens (non-browser clients, e.g. the MCP gateway)

export const PAT_PREFIX = 'aur_pat_';
export const PAT_BYTES = 32;

//~ The exchanged JWT is deliberately short-lived: the PAT is the durable
//~ credential, so a leaked access token expires long before it is useful.
export const PAT_ACCESS_TOKEN_TTL_SECONDS = 300;

//~ Scopes are checked by the MCP gateway, not by the BFF, which still only
//~ verifies the signature. Keep in sync with the gateway's tool definitions.
export const PAT_SCOPES = [
  'wallet:read',
  'wallet:write',
  'transaction:read',
  'transaction:write',
  'budget:read',
  'budget:write',
  'investment:read',
  'investment:write',
  'analytics:read',
  'profile:read',
  'profile:write',
] as const;

export type PatScope = (typeof PAT_SCOPES)[number];