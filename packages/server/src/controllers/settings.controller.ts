import { Request, Response } from 'express';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import prisma from '../lib/db.js';
import { auditLog } from '../lib/audit.js';
import type { ReadyChannelToggles } from '../lib/notifications.js';

const updateSettingsSchema = z.object({
  siteName: z.string().min(1).optional(),
  siteTitle: z.string().min(1).optional(),
  colorPrimary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  colorSecondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  darkMode: z.enum(['light', 'dark', 'system']).optional(),
  storefrontTemplate: z.string().optional(),
  heroSection: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    ctaPrimaryText: z.string().optional(),
    ctaPrimaryLink: z.string().optional(),
    ctaSecondaryText: z.string().optional(),
    ctaSecondaryLink: z.string().optional(),
    backgroundImage: z.string().optional(),
  }).optional(),
  featuresSection: z.array(z.object({
    icon: z.string(),
    title: z.string(),
    description: z.string(),
  })).optional(),
  ctaSection: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    buttonText: z.string().optional(),
    buttonLink: z.string().optional(),
  }).optional(),
});

async function getOrCreateSettings() {
  let settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
  if (!settings) {
    settings = await prisma.siteSettings.create({ data: { id: 'default' } });
  }
  return settings;
}

// Only the fields required by the public storefront — never include API keys or credentials.
function toPublicSettings(settings: Awaited<ReturnType<typeof getOrCreateSettings>>) {
  return {
    id: settings.id,
    siteName: settings.siteName,
    siteTitle: settings.siteTitle,
    favicon: settings.favicon,
    logo: settings.logo,
    colorPrimary: settings.colorPrimary,
    colorSecondary: settings.colorSecondary,
    darkMode: settings.darkMode,
    storefrontTemplate: settings.storefrontTemplate,
    heroSection: settings.heroSection,
    featuresSection: settings.featuresSection,
    ctaSection: settings.ctaSection,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}

export async function getSettings(_req: Request, res: Response): Promise<void> {
  const settings = await getOrCreateSettings();
  res.json({ success: true, data: toPublicSettings(settings) });
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.errors });
    return;
  }

  await getOrCreateSettings();

  const settings = await prisma.siteSettings.update({
    where: { id: 'default' },
    data: parsed.data,
  });

  auditLog(req, { action: 'update', entity: 'SiteSettings', entityId: 'default', details: { fields: Object.keys(parsed.data) } });

  res.json({ success: true, data: toPublicSettings(settings) });
}

export async function uploadLogo(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }

  await getOrCreateSettings();

  const logoPath = `/uploads/${req.file.filename}`;
  const settings = await prisma.siteSettings.update({
    where: { id: 'default' },
    data: { logo: logoPath },
  });

  res.json({ success: true, data: toPublicSettings(settings) });
}

export async function uploadFavicon(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }

  await getOrCreateSettings();

  const faviconPath = `/uploads/${req.file.filename}`;
  const settings = await prisma.siteSettings.update({
    where: { id: 'default' },
    data: { favicon: faviconPath },
  });

  res.json({ success: true, data: toPublicSettings(settings) });
}

// ============================================================
// SECRET MASKING UTILITIES
// ============================================================

function maskSecret(value: string | undefined | null): string {
  if (!value || value.length < 8) return value ? '••••••••' : '';
  return value.slice(0, 4) + '...' + value.slice(-4);
}

function isMasked(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.includes('...');
}

function preserveIfMasked(newVal: string | undefined | null, existingVal: string | undefined | null): string | undefined | null {
  if (isMasked(newVal)) return existingVal;
  return newVal;
}

// ============================================================
// GENERIC SETTINGS GROUP HELPERS
// ============================================================

type SettingsField =
  | 'generalSettings'
  | 'orderSettings'
  | 'reservationSettings'
  | 'mailSettings'
  | 'paymentSettings'
  | 'reviewSettings'
  | 'advancedSettings'
  | 'notificationSettings';

async function getSettingsGroup(field: SettingsField): Promise<Record<string, any>> {
  const settings = await getOrCreateSettings();
  return (settings[field] as Record<string, any>) || {};
}

async function updateSettingsGroup(field: SettingsField, data: Record<string, any>): Promise<Record<string, any>> {
  await getOrCreateSettings();
  const updated = await prisma.siteSettings.update({
    where: { id: 'default' },
    data: { [field]: data },
  });
  return (updated[field] as Record<string, any>) || {};
}

// ============================================================
// SETTINGS GROUP HANDLER FACTORY
// ============================================================

interface SettingsGroupOptions<T> {
  /** Secrets masked in every response; a masked value submitted on PUT keeps the stored one. */
  maskedFields?: (keyof T & string)[];
  /** PUT merges over the stored group instead of replacing it. */
  mergeOnUpdate?: boolean;
}

type SettingsGroupHandler = (req: Request, res: Response) => Promise<void>;

// Data flows through as Record<string, any> to match the untyped legacy
// getSettingsGroup/updateSettingsGroup seam; maskedFields is keyed to the
// schema type so a misspelt secret field fails to compile.
function createSettingsGroupHandlers<T extends object>(
  field: SettingsField,
  schema: z.ZodType<T>,
  options: SettingsGroupOptions<T> = {},
): { get: SettingsGroupHandler; update: SettingsGroupHandler } {
  const { maskedFields = [], mergeOnUpdate = false } = options;

  const withMaskedSecrets = (data: Record<string, any>): Record<string, any> => {
    if (maskedFields.length === 0) return data;
    const masked = { ...data };
    for (const key of maskedFields) masked[key] = maskSecret(masked[key]);
    return masked;
  };

  return {
    get: async (_req: Request, res: Response): Promise<void> => {
      const data = await getSettingsGroup(field);
      res.json({ success: true, data: withMaskedSecrets(data) });
    },
    update: async (req: Request, res: Response): Promise<void> => {
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: parsed.error.errors });
        return;
      }

      let toWrite: Record<string, any> = { ...parsed.data };
      if (maskedFields.length > 0 || mergeOnUpdate) {
        const existing = await getSettingsGroup(field);
        for (const key of maskedFields) {
          toWrite[key] = preserveIfMasked(toWrite[key], existing[key]);
        }
        // Merge after secret preservation: toWrite already carries resolved
        // masked values, so a group combining both options stays correct
        if (mergeOnUpdate) toWrite = { ...existing, ...toWrite };
      }

      const data = await updateSettingsGroup(field, toWrite);
      res.json({ success: true, data: withMaskedSecrets(data) });
    },
  };
}

// ============================================================
// ZOD SCHEMAS FOR SETTINGS GROUPS
// ============================================================

const generalSettingsSchema = z.object({
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  timezone: z.string().optional(),
  distanceUnit: z.enum(['km', 'mi']).optional(),
  defaultCurrency: z.string().max(3).optional(),
  currencySymbol: z.string().max(5).optional(),
  currencyPosition: z.enum(['before', 'after']).optional(),
  googleMapsApiKey: z.string().optional(),
});

const orderSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  minOrderDelivery: z.number().min(0).optional(),
  minOrderPickup: z.number().min(0).optional(),
  deliveryLeadTime: z.number().min(0).optional(),
  pickupLeadTime: z.number().min(0).optional(),
  enableFutureOrdering: z.boolean().optional(),
  enableTipping: z.boolean().optional(),
  tipOptions: z.array(z.number()).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  dineInEnabled: z.boolean().optional(),
});

const reservationSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  timeInterval: z.number().min(1).optional(),
  stayTime: z.number().min(1).optional(),
  maxAdvanceBookingDays: z.number().min(1).optional(),
  minCancellationNoticeHours: z.number().min(0).optional(),
  autoConfirm: z.boolean().optional(),
});

const mailSettingsSchema = z.object({
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  senderName: z.string().optional(),
  senderEmail: z.string().email().optional().or(z.literal('')),
  encryption: z.enum(['none', 'tls', 'ssl']).optional(),
});

const paymentSettingsSchema = z.object({
  stripeEnabled: z.boolean().optional(),
  stripePublishableKey: z.string().optional(),
  stripeSecretKey: z.string().optional(),
  stripeWebhookSecret: z.string().optional(),
  paypalEnabled: z.boolean().optional(),
  paypalClientId: z.string().optional(),
  paypalClientSecret: z.string().optional(),
  paypalSandbox: z.boolean().optional(),
  cashEnabled: z.boolean().optional(),
});

const reviewSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  requireOrder: z.boolean().optional(),
  autoApprove: z.boolean().optional(),
  minimumRating: z.number().min(1).max(5).optional(),
});

const advancedSettingsSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().optional(),
  enableRateLimiting: z.boolean().optional(),
});

// Typed against the lib's toggle shape so a renamed toggle fails to compile here
const notificationSettingsSchema: z.ZodType<Partial<ReadyChannelToggles>> = z.object({
  readyEmailEnabled: z.boolean().optional(),
  readySmsEnabled: z.boolean().optional(),
  readyPushEnabled: z.boolean().optional(),
});

// ============================================================
// SETTINGS GROUP HANDLERS (factory-generated)
// ============================================================

export const { get: getGeneralSettings, update: updateGeneralSettings } =
  createSettingsGroupHandlers('generalSettings', generalSettingsSchema);

export const { get: getOrderSettings, update: updateOrderSettings } =
  createSettingsGroupHandlers('orderSettings', orderSettingsSchema);

export const { get: getReservationSettings, update: updateReservationSettings } =
  createSettingsGroupHandlers('reservationSettings', reservationSettingsSchema);

export const { get: getMailSettings, update: updateMailSettings } =
  createSettingsGroupHandlers('mailSettings', mailSettingsSchema, { maskedFields: ['smtpPass'] });

export const { get: getPaymentSettings, update: updatePaymentSettings } =
  createSettingsGroupHandlers('paymentSettings', paymentSettingsSchema, {
    maskedFields: ['stripeSecretKey', 'stripeWebhookSecret', 'paypalClientSecret'],
  });

export const { get: getReviewSettings, update: updateReviewSettings } =
  createSettingsGroupHandlers('reviewSettings', reviewSettingsSchema);

// Merge-on-update: a partial PUT must not reset the omitted ready-channel toggles
export const { get: getNotificationSettings, update: updateNotificationSettings } =
  createSettingsGroupHandlers('notificationSettings', notificationSettingsSchema, { mergeOnUpdate: true });

export const { get: getAdvancedSettings, update: updateAdvancedSettings } =
  createSettingsGroupHandlers('advancedSettings', advancedSettingsSchema);

// ============================================================
// TEST EMAIL
// ============================================================

export async function sendTestEmail(req: Request, res: Response): Promise<void> {
  const { to } = req.body;
  if (!to || typeof to !== 'string') {
    res.status(400).json({ success: false, error: 'Recipient email (to) is required' });
    return;
  }

  const mail = await getSettingsGroup('mailSettings');
  const host = mail.smtpHost || process.env.SMTP_HOST || 'localhost';
  const port = mail.smtpPort || parseInt(process.env.SMTP_PORT || '1025');
  const user = mail.smtpUser || process.env.SMTP_USER;
  const pass = mail.smtpPass || process.env.SMTP_PASS;
  const senderName = mail.senderName || 'KitchenAsty';
  const senderEmail = mail.senderEmail || 'noreply@kitchenasty.com';
  const encryption = mail.encryption || 'none';

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: encryption === 'ssl',
      auth: user ? { user, pass } : undefined,
      ...(encryption === 'tls' ? { requireTLS: true } : {}),
    });

    await transporter.sendMail({
      from: `${senderName} <${senderEmail}>`,
      to,
      subject: 'KitchenAsty — Test Email',
      html: '<div style="font-family:sans-serif;padding:20px"><h2>Test Email</h2><p>If you received this, your mail settings are configured correctly.</p></div>',
    });

    res.json({ success: true, message: 'Test email sent successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message ? err.message : 'Failed to send test email';
    res.status(500).json({ success: false, error: message });
  }
}
