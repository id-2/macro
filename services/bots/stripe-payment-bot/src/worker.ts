import Stripe from 'stripe';
import type { Env as RoxEnv } from '../../../../packages/sdk/src/config';
import { createChannelBroadcaster } from './channel';
import { formatNotification, notificationFromEvent } from './notification';

type WorkerEnv = {
  ROX_BOT_TOKEN: string;
  ROX_ENV: string;
  ROX_STORAGE_URL?: string;
  STRIPE_API_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
};

const REQUIRED_BINDINGS: readonly (keyof WorkerEnv)[] = [
  'ROX_BOT_TOKEN',
  'ROX_ENV',
  'STRIPE_API_KEY',
  'STRIPE_WEBHOOK_SECRET',
];

const ROX_ENVIRONMENTS: readonly RoxEnv[] = ['dev', 'prod', 'local'];

const cryptoProvider = Stripe.createSubtleCryptoProvider();

function missingBindings(env: WorkerEnv): string[] {
  return REQUIRED_BINDINGS.filter((key) => !env[key]);
}

function parseMacroEnv(value: string): RoxEnv | undefined {
  return ROX_ENVIRONMENTS.find((environment) => environment === value);
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true });
    }
    if (request.method !== 'POST' || url.pathname !== '/webhook') {
      return new Response('Not found', { status: 404 });
    }

    const missing = missingBindings(env);
    if (missing.length > 0) {
      return Response.json(
        { error: `missing worker bindings: ${missing.join(', ')}` },
        { status: 500 }
      );
    }

    const macroEnv = parseMacroEnv(env.ROX_ENV);
    if (!macroEnv) {
      return Response.json(
        {
          error: `ROX_ENV must be one of: ${ROX_ENVIRONMENTS.join(', ')}`,
        },
        { status: 500 }
      );
    }

    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return new Response('Missing Stripe-Signature header', { status: 400 });
    }

    const stripe = new Stripe(env.STRIPE_API_KEY, {
      httpClient: Stripe.createFetchHttpClient(),
    });
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        await request.text(),
        signature,
        env.STRIPE_WEBHOOK_SECRET,
        undefined,
        cryptoProvider
      );
    } catch (error) {
      console.error('Invalid Stripe webhook', error);
      return new Response('Invalid Stripe webhook', { status: 400 });
    }

    let notification;
    try {
      notification = await notificationFromEvent(stripe, event);
    } catch (error) {
      console.error('Failed to load Stripe notification details', error);
      return new Response('Failed to load Stripe notification details', {
        status: 502,
      });
    }
    if (!notification) return Response.json({ ok: true, ignored: true });

    try {
      await createChannelBroadcaster({
        botToken: env.ROX_BOT_TOKEN,
        env: macroEnv,
        storageUrl: env.ROX_STORAGE_URL,
      })(formatNotification(notification));
    } catch (error) {
      console.error('Failed to post Stripe notification to Rox', error);
      return new Response('Failed to post Stripe notification to Rox', {
        status: 502,
      });
    }

    console.log('Posted Stripe notification', {
      kind: notification.kind,
      eventId: notification.eventId,
      subscriptionId: notification.subscriptionId,
    });
    return Response.json({ ok: true });
  },
};
