/**
 * Generate an image and post it to a channel as an image attachment.
 *
 * Usage:
 *   ROX_API_KEY=mak_... bun examples/generate-image.ts <channel-id> [prompt]
 *
 * The image is charged to your AI allowance. Set ROX_ENV for dev/prod/local.
 */
import { Rox } from '../src/rox';

const [channelId, prompt = 'A watercolor lighthouse at dusk, soft light'] =
  process.argv.slice(2);
if (!channelId) {
  console.error(
    'usage: ROX_API_KEY=mak_... bun examples/generate-image.ts <channel-id> [prompt]',
  );
  process.exit(1);
}

const macro = new Rox();

const image = await macro.images.generate({
  prompt,
  aspectRatio: 'widescreen',
});
console.log(`generated ${image.width}×${image.height} ${image.url}`);

// The image carries its width and height, so the message reserves its space
// before the bytes load.
const message = await macro.channels
  .byId(channelId)
  .send(`Generated: ${prompt}`, { images: [image] });
console.log(`posted message ${message.id}`);
