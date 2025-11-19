import { Request } from 'express';

export type TAuthenticatedRequest = Request & {
  user?: {
    id: string;
    googleRefreshToken?: string;
  };
};
