import { initializeUiOperationTelemetry } from '@app/observability/ui-operation';
import { UserMention } from '@core/component/LexicalMarkdown/component/decorator/UserMention';
import { setDecorator, UserMentionNode } from '@rox-one/lexical-core';
import { Telemetry } from '@rox-one/observability';
import {
  createWebTracingProvider,
  StackContextManager,
} from '@rox-one/observability/web';
import { render } from 'solid-js/web';
import { UniversalInputFixture } from './fixture';

if (new URLSearchParams(location.search).has('trace')) {
  const config = {
    serviceName: 'command-fixture',
    environment: 'test',
    tracesUrl: `${location.origin}/traces`,
    contextManager: new StackContextManager(),
    enabled: async () => true,
  };
  initializeUiOperationTelemetry();
  await Telemetry.init({
    ...config,
    tracingProvider: (resource, getUserId, sampling) =>
      createWebTracingProvider(config, resource, getUserId, sampling),
  });
}

setDecorator(UserMentionNode, UserMention);

render(() => <UniversalInputFixture />, document.getElementById('root')!);
