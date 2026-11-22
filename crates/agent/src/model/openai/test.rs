use super::completion_model_id;
use crate::model::types::Model;

#[test]
fn fireworks_short_name_becomes_the_account_path() {
    let model = Model::try_from("fireworks/kimi-k3").expect("routable id");
    assert_eq!(
        completion_model_id(&model),
        "accounts/fireworks/models/kimi-k3"
    );
}

#[test]
fn fireworks_account_path_is_sent_verbatim() {
    let model = Model::try_from("fireworks/accounts/fireworks/models/kimi-k3")
        .expect("full path is still one provider segment");
    assert_eq!(
        completion_model_id(&model),
        "accounts/fireworks/models/kimi-k3"
    );
}

#[test]
fn other_compatible_providers_keep_the_catalog_name() {
    let model = Model::try_from("cerebras/gpt-oss-120b").expect("routable id");
    assert_eq!(completion_model_id(&model), "gpt-oss-120b");

    let gemini = Model::try_from("google/gemini-3.8-flash").expect("routable id");
    assert_eq!(completion_model_id(&gemini), "gemini-3.8-flash");
}

#[test]
fn groq_gpt_oss_is_sent_as_the_groq_api_id() {
    let model = Model::try_from("groq/gpt-oss-120b").expect("routable id");
    assert_eq!(completion_model_id(&model), "openai/gpt-oss-120b");
}

#[test]
fn compatible_transport_omits_native_tool_pixels_on_live_results_and_replay() {
    use rig_core::{
        OneOrMany,
        completion::CompletionRequest,
        message::{Message, ToolResultContent, UserContent},
    };
    let image = crate::tool_media::model_output(serde_json::json!({"revision":"frozen", "modelMedia":[{"type":"image","mediaType":"image/png","data":"iVBORw0KGgo="}]})).expect("bounded image");
    let request = CompletionRequest {
        model: None,
        preamble: None,
        chat_history: OneOrMany::one(Message::User {
            content: OneOrMany::one(UserContent::tool_result_with_call_id(
                "render",
                "call-1".to_owned(),
                image.into_content(),
            )),
        }),
        documents: vec![],
        tools: vec![],
        temperature: None,
        max_tokens: None,
        tool_choice: None,
        additional_params: None,
        output_schema: None,
        record_telemetry_content: false,
    };
    let adapted = super::compatible_request(request, false);
    let Message::User { content } = adapted.chat_history.first_ref() else {
        panic!("user tool result")
    };
    let UserContent::ToolResult(result) = content.first_ref() else {
        panic!("tool result")
    };
    assert!(
        result
            .content
            .iter()
            .all(|part| !matches!(part, ToolResultContent::Image(_)))
    );
    let wire = serde_json::to_string(&adapted.chat_history).expect("serialize");
    assert!(wire.contains("frozen"));
    assert!(wire.contains("cannot inspect tool images"));
    assert!(!wire.contains("iVBOR"));
    // Every request is adapted at the provider boundary, including stored history.
    assert_eq!(
        serde_json::to_string(&super::compatible_request(adapted, false).chat_history)
            .expect("replay"),
        wire
    );
}

fn tool_loop_request() -> rig_core::completion::CompletionRequest {
    use rig_core::{
        OneOrMany,
        completion::CompletionRequest,
        message::{
            AssistantContent, Message, Reasoning, ToolCall, ToolFunction, ToolResultContent,
            UserContent,
        },
    };
    let call = ToolCall::new(
        "fc_1".to_owned(),
        ToolFunction::new("read".to_owned(), serde_json::json!({"path": "a.txt"})),
    )
    .with_call_id("call_1".to_owned());
    let assistant = OneOrMany::many(vec![
        AssistantContent::Reasoning(Reasoning::new("hidden chain")),
        AssistantContent::text("reading a.txt"),
        AssistantContent::ToolCall(call),
    ])
    .expect("assistant parts");
    let result = OneOrMany::one(UserContent::tool_result_with_call_id(
        "fc_1".to_owned(),
        "call_1".to_owned(),
        OneOrMany::one(ToolResultContent::text("contents")),
    ));
    CompletionRequest {
        model: None,
        preamble: None,
        chat_history: OneOrMany::many(vec![
            Message::Assistant {
                id: None,
                content: assistant,
            },
            Message::User { content: result },
        ])
        .expect("history"),
        documents: vec![],
        tools: vec![],
        temperature: None,
        max_tokens: None,
        tool_choice: None,
        additional_params: None,
        output_schema: None,
        record_telemetry_content: false,
    }
}

#[test]
fn groq_transport_drops_reasoning_but_keeps_the_tool_call() {
    use rig_core::message::AssistantContent;
    let kept = super::compatible_request(tool_loop_request(), false);
    let kept_wire = serde_json::to_string(&kept.chat_history).expect("kept");
    assert!(kept_wire.contains("hidden chain"), "{kept_wire}");

    let stripped = super::compatible_request(tool_loop_request(), true);
    let wire = serde_json::to_string(&stripped.chat_history).expect("stripped");
    assert!(!wire.contains("hidden chain"), "{wire}");
    assert!(!wire.contains("reasoning"), "{wire}");
    assert!(wire.contains("reading a.txt"), "{wire}");
    assert!(wire.contains("\"call_1\""), "{wire}");
    assert!(wire.contains("contents"), "{wire}");
    assert_eq!(stripped.chat_history.len(), 2);
    let rig_core::message::Message::Assistant { content, .. } = stripped.chat_history.first_ref()
    else {
        panic!("assistant turn")
    };
    assert!(matches!(content.first_ref(), AssistantContent::Text(_)));
    assert!(
        content
            .iter()
            .any(|part| matches!(part, AssistantContent::ToolCall(_)))
    );
    assert!(stripped.chat_history.iter().all(|message| {
        !serde_json::to_string(message)
            .expect("message")
            .contains("reasoning")
    }));
}

#[test]
fn a_reasoning_only_assistant_turn_is_dropped_when_stripped() {
    use rig_core::{
        OneOrMany,
        completion::CompletionRequest,
        message::{AssistantContent, Message, Reasoning},
    };
    let request = CompletionRequest {
        model: None,
        preamble: None,
        chat_history: OneOrMany::many(vec![
            Message::Assistant {
                id: None,
                content: OneOrMany::one(AssistantContent::Reasoning(Reasoning::new("only"))),
            },
            Message::user("next"),
        ])
        .expect("history"),
        documents: vec![],
        tools: vec![],
        temperature: None,
        max_tokens: None,
        tool_choice: None,
        additional_params: None,
        output_schema: None,
        record_telemetry_content: false,
    };
    let stripped = super::compatible_request(request, true);
    assert_eq!(stripped.chat_history.len(), 1);
    assert!(matches!(
        stripped.chat_history.first_ref(),
        Message::User { .. }
    ));
}
