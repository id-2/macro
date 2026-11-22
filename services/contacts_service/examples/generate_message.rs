// Small utility to generate a sample connections message to send to the SQS service
use contacts::domain::models::messages::ContactsNodes;
use rox_user_id::user_id::RoxUserIdStr;
use std::{collections::HashSet, env};

fn print_contacts_message(users: HashSet<RoxUserIdStr<'static>>) {
    println!(
        "{}",
        serde_json::to_string(&ContactsNodes { users }).unwrap()
    );
}

async fn genmsg_add_user_to_group() {
    let mut users: HashSet<RoxUserIdStr<'static>> = [
        "rox|alice@rox.one",
        "rox|bob@rox.one",
        "rox|carol@rox.one",
        "rox|dave@rox.one",
        "rox|eve@rox.one",
        "rox|frank@rox.one",
        "rox|grace@rox.one",
    ]
    .iter()
    .map(|s| RoxUserIdStr::try_from(s.to_string()).unwrap())
    .collect();
    users.insert(RoxUserIdStr::try_from("rox|henry@rox.one".to_string()).unwrap());
    print_contacts_message(users);
}

async fn genmsg_add_paul() {
    let mut users: HashSet<RoxUserIdStr<'static>> = [
        "rox|zeus@olympus.mountain",
        "rox|athena@olympus.mountain",
        "rox|apollo@olympus.mountain",
        "rox|hermes@olympus.mountain",
        "rox|poseidon@olympus.mountain",
    ]
    .iter()
    .map(|s| RoxUserIdStr::try_from(s.to_string()).unwrap())
    .collect();
    users.insert(RoxUserIdStr::try_from("rox|paul@rox.one".to_string()).unwrap());
    print_contacts_message(users);
}

async fn genmsg_create_group() {
    let users: HashSet<RoxUserIdStr<'static>> = [
        "rox|jupiter@olympus.mountain",
        "rox|athena@olympus.mountain",
        "rox|mercury@olympus.mountain",
        "rox|neptune@olympus.mountain",
        "rox|paul@rox.one",
    ]
    .iter()
    .map(|s| RoxUserIdStr::try_from(s.to_string()).unwrap())
    .collect();
    print_contacts_message(users);
}

async fn genmsg_add_participants() {
    let users: HashSet<RoxUserIdStr<'static>> = [
        "rox|an@uruk.place",
        "rox|enlil@nippur.place",
        "rox|enki@eridu.place",
        "rox|marduk@babylon.place",
        "rox|paul@rox.one",
        "rox|poseidon@olympus.mountain",
    ]
    .iter()
    .map(|s| RoxUserIdStr::try_from(s.to_string()).unwrap())
    .collect();
    print_contacts_message(users);
}

#[tokio::main]
async fn main() {
    let mut args = env::args();
    dbg!(args.len());
    if args.len() < 2 {
        panic!("enter a command");
    }
    let cmd = args.nth(1).unwrap();
    match cmd.as_str() {
        "add_user_to_group" => genmsg_add_user_to_group().await,
        "add_paul" => genmsg_add_paul().await,
        "create_group" => genmsg_create_group().await,
        "add_participants" => genmsg_add_participants().await,
        _ => panic!("could not find command '{}'", cmd),
    }
}
