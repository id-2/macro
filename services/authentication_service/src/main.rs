// `run()`'s future type is deep enough to need the library's recursion limit
// wherever it is awaited.
#![recursion_limit = "256"]

use rox_entrypoint::RoxEntrypoint;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    RoxEntrypoint::default().init();
    authentication_service::run().await
}
