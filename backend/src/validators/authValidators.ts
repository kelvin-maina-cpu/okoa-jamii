import { z } from 'zod';

const emailSchema = z.string().trim().email();
const phoneSchema = z.string().trim().min(8).max(20).regex(/^[+0-9\-()\s]+$/);

export const registerSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
  preferredLanguage: z.string().trim().min(2).max(20).optional(),
}).superRefine((value, ctx) => {
  if (!value.email && !value.phone) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'Email or phone is required' });
  }
  if (value.password !== value.confirmPassword) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'Passwords do not match' });
  }
});

export const loginSchema = z.object({
  emailOrPhone: z.string().trim().min(3).max(254),
  password: z.string().min(8).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

export const provisionAdminSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  password: z.string().min(8).max(128),
  role: z.enum(['Community Leader', 'Security Officer', 'County Administrator', 'Super Administrator']),
}).superRefine((value, ctx) => {
  if (!value.email && !value.phone) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'Email or phone is required' });
  }
});
