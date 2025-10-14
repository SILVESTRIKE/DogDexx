// BFF User Controller
import { Request, Response } from 'express';

export const register = async (req: Request, res: Response) => {
  // TODO: Combine /api/auth/register + create empty collection
  res.status(501).json({ message: 'Not implemented' });
};

export const login = async (req: Request, res: Response) => {
  // TODO: Combine /api/auth/login + /api/users/me + /api/collections/me
  res.status(501).json({ message: 'Not implemented' });
};

export const getProfile = async (req: Request, res: Response) => {
  // TODO: Aggregate /api/users/me + /api/collections/me + /api/histories
  res.status(501).json({ message: 'Not implemented' });
};

export const updateProfile = async (req: Request, res: Response) => {
  // TODO: Update profile and return full data
  res.status(501).json({ message: 'Not implemented' });
};

export const logout = async (req: Request, res: Response) => {
  // TODO: Combine /api/auth/logout + clear cache
  res.status(501).json({ message: 'Not implemented' });
};
