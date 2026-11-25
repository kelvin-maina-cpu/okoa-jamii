export type SmsDeliveryState = 'simulated' | 'sent' | 'failed';

export interface SmsDeliveryResult {
  status: SmsDeliveryState;
  providerMessageId?: string;
  errorMessage?: string;
}

export interface SmsProvider {
  readonly name: string;
  send(recipient: string, message: string): Promise<SmsDeliveryResult>;
}

export function isValidKenyanMobile(value: string): boolean {
  return /^\+254(?:7|1)\d{8}$/.test(value);
}

export function normalizeSmsMessage(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) throw new Error('SMS message cannot be empty.');
  return Array.from(normalized).slice(0, 160).join('');
}

/** Development-only provider. It records a masked, non-sensitive simulation and never contacts a carrier. */
export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock';

  async send(recipient: string, message: string): Promise<SmsDeliveryResult> {
    if (process.env.NODE_ENV === 'production') {
      return { status: 'failed', errorMessage: 'Mock SMS delivery is disabled in production.' };
    }
    if (!isValidKenyanMobile(recipient)) {
      return { status: 'failed', errorMessage: 'Recipient must be a valid Kenyan mobile number in +254 format.' };
    }
    const safeRecipient = `${recipient.slice(0, 6)}***${recipient.slice(-2)}`;
    console.info(`[SMS SIMULATION] recipient=${safeRecipient} characters=${Array.from(message).length}; no message was sent`);
    return { status: 'simulated' };
  }
}

export interface SmsConfiguration {
  provider: 'mock' | 'kenyan' | 'none';
  recipients: string[];
  invalidRecipientCount: number;
  realProviderReady: boolean;
}

export function readSmsConfiguration(): SmsConfiguration {
  const rawProvider = process.env.OKOA_SMS_PROVIDER?.toLowerCase();
  const provider: SmsConfiguration['provider'] = rawProvider === 'mock' ? 'mock' : rawProvider === 'kenyan' ? 'kenyan' : 'none';
  const configuredRecipients = [...new Set((process.env.OKOA_SMS_RECIPIENTS ?? '').split(',').map((item) => item.trim()).filter(Boolean))];
  const recipients = configuredRecipients.filter(isValidKenyanMobile);
  const invalidRecipientCount = configuredRecipients.length - recipients.length;
  const authorized = recipients.length > 0 && invalidRecipientCount === 0;
  const realProviderReady = provider === 'kenyan'
    && process.env.OKOA_SMS_REAL_PROVIDER_ENABLED === 'true'
    && Boolean(process.env.OKOA_SMS_API_KEY)
    && Boolean(process.env.OKOA_SMS_SENDER_ID)
    && authorized;
  return { provider, recipients: authorized ? recipients : [], invalidRecipientCount, realProviderReady };
}
