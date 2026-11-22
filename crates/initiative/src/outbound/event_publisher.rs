//! Initiative event publication through Rox's shared event broker.

use rox_event_broker::RoxEventBroker;
use std::{future::Future, pin::Pin};

use crate::domain::{
    events::{InitiativeEventPublisher, InitiativeRoxEvent},
    models::InitiativeError,
};

/// Adapter for the broker assembled by the host composition root.
pub struct BrokerInitiativeEventPublisher<B> {
    broker: B,
}

impl<B> BrokerInitiativeEventPublisher<B> {
    /// Compose from the host's shared broker.
    pub fn new(broker: B) -> Self {
        Self { broker }
    }
}

impl<B: RoxEventBroker + 'static> InitiativeEventPublisher for BrokerInitiativeEventPublisher<B> {
    /// Resolves once the broker has the event. Like document, chat and team events,
    /// delivery continues in the broker's own task, which logs failures, so a slow
    /// broker (bounded only by its publish timeout) never delays the mutation.
    fn publish(
        &self,
        event: InitiativeRoxEvent,
    ) -> Pin<Box<dyn Future<Output = Result<(), InitiativeError>> + Send + '_>> {
        let scheduled = self
            .broker
            .send_event(&event)
            .map(drop)
            .map_err(|error| InitiativeError::Internal(rootcause::report!(error).into()));
        Box::pin(async move { scheduled })
    }
}

#[cfg(test)]
mod test;
