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