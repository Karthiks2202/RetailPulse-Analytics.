import dotenv from 'dotenv';
import path from 'path';

// Load environmental configuration
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'super_secret_retail_pulse_access_key_987654321_abcd',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'super_secret_retail_pulse_refresh_key_123456789_efgh',
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',
};
