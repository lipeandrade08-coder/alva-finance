import { createNoticeHandler } from './handler.js';

Deno.serve(createNoticeHandler({
  env: name => Deno.env.get(name),
  background: task => EdgeRuntime.waitUntil(task)
}));
