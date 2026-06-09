import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET || 'devhub-dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32-chars-long!',

  defaultOpenCommand: process.env.DEFAULT_OPEN_COMMAND || 'code .',

  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  },
  gitlab: {
    clientId: process.env.GITLAB_CLIENT_ID || '',
    clientSecret: process.env.GITLAB_CLIENT_SECRET || '',
  },
  gitee: {
    clientId: process.env.GITEE_CLIENT_ID || '',
    clientSecret: process.env.GITEE_CLIENT_SECRET || '',
  },
};
