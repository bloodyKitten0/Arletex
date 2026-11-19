import { describe, it, expect, vi } from 'vitest';
import crypto from 'node:crypto';
import {
  EmailProvider,
  ActionPermissionController,
  ClosedLoopAgencyService,
} from '@arletex/core';

describe('Phase 4: Digital Identity & External Communication (arletex.email@gmail.com)', () => {
  it('1. Verifies identity configuration defaults to arletex.email@gmail.com and Arle', () => {
    const provider = new EmailProvider();
    const config = provider.getConfig();

    expect(config.emailAddress).toBe('arletex.email@gmail.com');
    expect(config.displayName).toBe('Arle');
    expect(config.imapHost).toBe('imap.gmail.com');
    expect(config.smtpHost).toBe('smtp.gmail.com');
    expect(config.allowlistedRecipients).toContain('Proof');
    expect(config.allowlistedRecipients).toContain('proof');
  });

  it('2. Correctly parses RFC 822 messages, strips multipart noise, and computes SHA-256 hash', () => {
    const provider = new EmailProvider();
    const rawRfc822 = [
      'From: partner <proof@arletex.dev>',
      'To: Arle <arletex.email@gmail.com>',
      'Subject: Research notes on biological neuroscience',
      'Date: Wed, 18 Nov 2026 12:00:00 GMT',
      'Message-ID: <unique-12345@arletex.dev>',
      'Content-Type: text/plain; charset=utf-8',
      '',
      '--boundary123',
      'Content-Transfer-Encoding: 7bit',
      'Hello Arle, let us investigate recurrent hippocampal circuits together.',
      '--boundary123--',
    ].join('\r\n');

    const parsed = provider.parseRawRfc822(rawRfc822);

    expect(parsed.id).toBe('unique-12345@arletex.dev');
    expect(parsed.from).toBe('partner <proof@arletex.dev>');
    expect(parsed.to).toBe('Arle <arletex.email@gmail.com>');
    expect(parsed.subject).toBe('Research notes on biological neuroscience');
    expect(parsed.bodyText).toBe('Hello Arle, let us investigate recurrent hippocampal circuits together.');
    expect(parsed.bodySnippet).toContain('Hello Arle');
    expect(parsed.contentHash).toBe(
      crypto.createHash('sha256').update(parsed.bodyText).digest('hex'),
    );
  });

  it('3. Sends email to allowlisted recipients (Proof) without explicit approval token', async () => {
    let capturedData = '';
    const mockDriver = {
      sendSmtp: vi.fn().mockImplementation(async (_host, _port, rawData, _from, _to) => {
        capturedData = rawData;
        return { success: true, ack: '250 2.0.0 OK d29sm1234567qkc.12 - gsmtp' };
      }),
    };

    const provider = new EmailProvider({
      config: {
        password: 'mock-app-password',
      },
      transportDriver: mockDriver,
    });

    const res = await provider.sendEmail({
      to: 'proof@local.domain',
      subject: 'Observation update',
      body: 'I have synchronized the cognitive state.',
    });

    expect(res.success).toBe(true);
    expect(res.serverAck).toContain('250 2.0.0 OK');
    expect(mockDriver.sendSmtp).toHaveBeenCalled();
    expect(capturedData).toContain('From: "Arle" <arletex.email@gmail.com>');
    expect(capturedData).toContain('To: proof@local.domain');
    expect(capturedData).toContain('Subject: Observation update');
    expect(capturedData).toContain('I have synchronized the cognitive state.');
  });

  it('4. Rejects outbound email to non-allowlisted external recipient without cryptographic approval token', async () => {
    const mockDriver = {
      sendSmtp: vi.fn().mockResolvedValue({ success: true, ack: '250 OK' }),
    };

    const provider = new EmailProvider({
      config: { password: 'mock-pass' },
      transportDriver: mockDriver,
    });

    const res = await provider.sendEmail({
      to: 'untrusted_stranger@external-domain.org',
      subject: 'External Inquiry',
      body: 'Sensitive internal details',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('requires explicit cryptographic approval token');
    expect(mockDriver.sendSmtp).not.toHaveBeenCalled();
  });

  it('5. Allows external dispatch with valid cryptographically signed approval token, rejects tampered token', async () => {
    const permCtrl = new ActionPermissionController();
    const mockDriver = {
      sendSmtp: vi.fn().mockResolvedValue({ success: true, ack: '250 OK' }),
    };

    const provider = new EmailProvider({
      config: { password: 'mock-pass' },
      permissionController: permCtrl,
      transportDriver: mockDriver,
    });

    const recipient = 'dr_researcher@mit.edu';
    const subject = 'Neuroscience Paper Collaboration';
    const body = 'Regarding synaptic plasticity mechanisms.';

    // Issue genuine approval token bound to recipient and action
    const token = permCtrl.createApprovalToken({
      actionDigest: ActionPermissionController.canonicalizeValue({ to: recipient, subject }),
      targetResource: recipient,
      scope: 'action:send_email',
      userId: 'Proof',
      ttlMs: 60000,
    });

    // Valid token execution
    const validRes = await provider.sendEmail(
      { to: recipient, subject, body },
      token.token,
    );

    expect(validRes.success).toBe(true);
    expect(validRes.serverAck).toBe('250 OK');
    expect(mockDriver.sendSmtp).toHaveBeenCalledTimes(1);

    // Tampered token execution fails
    const tamperedRes = await provider.sendEmail(
      { to: recipient, subject, body },
      'tampered_token_signature_value',
    );

    expect(tamperedRes.success).toBe(false);
    expect(tamperedRes.error).toContain('Approval token rejected');
  });

  it('6. Routes incoming email to CognitiveControlBus as an untrusted external stimulus', async () => {
    const provider = new EmailProvider();
    const inbound = provider.parseRawRfc822([
      'From: collaborator@lab.org',
      'To: arletex.email@gmail.com',
      'Subject: Collaborative experiment update',
      '',
      'The sequencing results are ready for our shared review.',
    ].join('\r\n'));

    const dispatchedEvents: any[] = [];
    const mockBus = {
      dispatch: vi.fn().mockImplementation(async (evt) => {
        dispatchedEvents.push(evt);
        return { eventId: evt.id, processed: true };
      }),
    };

    const busRes = await provider.routeInboundEmailToCognitiveBus(mockBus, inbound);

    expect(busRes.processed).toBe(true);
    expect(dispatchedEvents).toHaveLength(1);
    expect(dispatchedEvents[0].type).toBe('incoming_email');
    expect(dispatchedEvents[0].source).toBe('external_communication');
    expect(dispatchedEvents[0].actor).toBe('environment');
    expect(dispatchedEvents[0].payload.from).toBe('collaborator@lab.org');
    expect(dispatchedEvents[0].payload.subject).toBe('Collaborative experiment update');
    expect(dispatchedEvents[0].payload.bodySnippet).toContain('sequencing results');
  });

  it('7. Integrates with ClosedLoopAgencyService to execute send_email actions fail-closed', async () => {
    const permCtrl = new ActionPermissionController();
    const mockDriver = {
      sendSmtp: vi.fn().mockResolvedValue({ success: true, ack: '250 2.0.0 Dispatched' }),
    };

    const provider = new EmailProvider({
      config: { password: 'mock-pass' },
      permissionController: permCtrl,
      transportDriver: mockDriver,
    });

    const mockAgencyRepo: any = {
      recordObservation: vi.fn(),
      saveTask: vi.fn(),
      savePlan: vi.fn(),
    };
    const mockTaskManager: any = {
      getTask: vi.fn(),
      updateTask: vi.fn(),
    };
    const mockApeService: any = {
      assessAppraisal: vi.fn(),
    };

    const agency = new ClosedLoopAgencyService({
      agencyRepo: mockAgencyRepo,
      taskManager: mockTaskManager,
      apeService: mockApeService,
      permissionController: permCtrl,
      emailProvider: provider,
    });

    const action: any = {
      id: 'act-email-1',
      taskId: 'task-email-1',
      type: 'send_email',
      target: 'proof@local.domain',
      payload: {
        to: 'proof@local.domain',
        subject: 'Closed loop status',
        body: 'All subsystems verified.',
      },
    };

    const obs = await agency.executeAction(action, { id: 'task-email-1' } as any, undefined, true);

    expect(obs.success).toBe(true);
    expect(obs.confidence).toBe(0.98);
    expect(obs.provenance).toBe('EmailProvider.sendEmail');
    expect(obs.data.serverAck).toBe('250 2.0.0 Dispatched');
  });
});
