//! Prints all Kafka topic names defined in `rox_event_topics` as a JSON array.

fn main() {
    println!(
        "{}",
        serde_json::to_string(&rox_event_topics::all_topic_names())
            .expect("serializing topic names cannot fail")
    );
}
