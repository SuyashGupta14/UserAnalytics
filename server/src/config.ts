import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/user-analytics',
  nodeEnv: process.env.NODE_ENV || 'development',
  dashboardOrigin: process.env.DASHBOARD_ORIGIN || 'http://localhost:3000',
};
