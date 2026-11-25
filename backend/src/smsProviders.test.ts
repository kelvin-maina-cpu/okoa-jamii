import { afterEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { AuditLog } from './models/AuditLog.js';
import { Incident } from './models/Incident.js';
import { IncidentNotification } from './models/IncidentNotification.js';
import { isValidKenyanMobile, MockSmsProvider, normalizeSmsMessage, readSmsConfiguration } from './services/smsProviders.js';
import { createEmergencySmsNotifications } from './services/smsNotificationService.js';

describe('SMS provider safety boundary', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it('accepts only normalized Kenyan mobile destinations', () => {
    expect(isValidKenyanMobile('+254712345678')).toBe(true);
    expect(isValidKenyanMobile('+254112345678')).toBe(true);
    expect(isValidKenyanMobile('0712345678')).toBe(false);
    expect(isValidKenyanMobile('+12025550123')).toBe(false);
  });

  it('normalizes whitespace and truncates messages to 160 characters', () => {
    expect(normalizeSmsMessage('  Okoa   Jamii  alert ')).toBe('Okoa Jamii alert');
    expect(Array.from(normalizeSmsMessage('x'.repeat(200))).length).toBe(160);
    expect(() => normalizeSmsMessage('  ')).toThrow('cannot be empty');
  });

  it('logs only a safe simulation and never reports actual delivery', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const provider = new MockSmsProvider();
    const result = await provider.send('+254712345678', 'Emergency alert text');
    expect(result).toEqual({ status: 'simulated' });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('no message was sent'));
    expect(log.mock.calls[0][0]).not.toContain('Emergency alert text');
    expect(log.mock.calls[0][0]).not.toContain('+254712345678');
  });

  it('rejects invalid recipients and disables mock sending in production', async () => {
    const provider = new MockSmsProvider();
    vi.stubEnv('NODE_ENV', 'development');
    expect((await provider.send('0712345678', 'Test')).status).toBe('failed');
    vi.stubEnv('NODE_ENV', 'production');
    expect(await provider.send('+254712345678', 'Test')).toEqual({
      status: 'failed', errorMessage: 'Mock SMS delivery is disabled in production.',
    });
  });

  it('keeps the future provider disabled without explicit credentials and recipients', () => {
    vi.stubEnv('OKOA_SMS_PROVIDER', 'kenyan');
    vi.stubEnv('OKOA_SMS_REAL_PROVIDER_ENABLED', 'true');
    vi.stubEnv('OKOA_SMS_API_KEY', 'not-a-real-secret');
    vi.stubEnv('OKOA_SMS_SENDER_ID', 'OKOA');
    vi.stubEnv('OKOA_SMS_RECIPIENTS', '0712345678');
    const config = readSmsConfiguration();
    expect(config.realProviderReady).toBe(false);
    expect(config.recipients).toEqual([]);
    expect(config.invalidRecipientCount).toBe(1);
  });

  it('records not_configured when no authorized recipients exist', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('OKOA_SMS_PROVIDER', 'none');
    vi.stubEnv('OKOA_SMS_RECIPIENTS', '');
    const incidentId = new Types.ObjectId();
    vi.spyOn(Incident, 'findById').mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: incidentId, incidentType: 'other' }) } as never);
    const create = vi.spyOn(IncidentNotification, 'findOneAndUpdate').mockResolvedValue({ _id: new Types.ObjectId() } as never);
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as never);
    await createEmergencySmsNotifications(incidentId.toString(), new Types.ObjectId().toString());
    expect(create).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      $set: expect.objectContaining({ status: 'not_configured' }),
    }), expect.any(Object));
  });

  it('tracks mock provider results as simulated, never sent', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('OKOA_SMS_PROVIDER', 'mock');
    vi.stubEnv('OKOA_SMS_RECIPIENTS', '+254712345678');
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const incidentId = new Types.ObjectId();
    vi.spyOn(Incident, 'findById').mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: incidentId, incidentType: 'armed attack' }) } as never);
    vi.spyOn(IncidentNotification, 'findOneAndUpdate').mockResolvedValue({ _id: new Types.ObjectId(), status: 'queued' } as never);
    const update = vi.spyOn(IncidentNotification, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as never);
    await createEmergencySmsNotifications(incidentId.toString(), new Types.ObjectId().toString());
    expect(update).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ $set: expect.objectContaining({ status: 'simulated' }) }));
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'incident.sms.notification', metadata: { channel: 'sms', status: 'simulated' } }));
  });
});
