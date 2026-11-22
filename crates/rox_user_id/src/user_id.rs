//! Module defines the [RoxUserId] and the methods to read the email
use crate::{
    cowlike::{ArcCowStr, CowLike},
    email::{Email, ReadEmailParts, email},
    error::ParseErr,
    lowercased::Lowercase,
};
use nom::{
    Finish, IResult, Parser, branch::alt, bytes::complete::tag, character::complete::char,
};
use serde::{Deserialize, Serialize};
use std::ops::Deref;

#[cfg(test)]
mod tests;

/// The legacy prefix carried by ids created before the product was renamed.
pub const MACRO_PREFIX: &str = "macro";
/// The current prefix. New ids are always written with this one.
pub const ROX_PREFIX: &str = "rox";

/// Which of the two supported prefixes a parsed user id carried.
///
/// The parser records this so callers can tell a legacy id from a current one
/// and [canonicalise](RoxUserIdStr::canonical) it when they need to look it up.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum UserIdPrefix {
    /// The legacy `macro|` prefix.
    Macro,
    /// The current `rox|` prefix.
    Rox,
}

impl UserIdPrefix {
    /// The prefix text without its separator.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Macro => MACRO_PREFIX,
            Self::Rox => ROX_PREFIX,
        }
    }
}

fn user_id(input: &str) -> IResult<&str, RoxUserId<ArcCowStr<'_>>> {
    let (rest, ((prefix, pipe), email)) = alt((tag(ROX_PREFIX), tag(MACRO_PREFIX)))
        .and(char('|'))
        .and(email)
        .parse(input)?;
    let prefix = if prefix == ROX_PREFIX {
        UserIdPrefix::Rox
    } else {
        UserIdPrefix::Macro
    };
    let email_part = email.map(|_| ());
    // add 1 for the length of char
    let email_part_offset = prefix.as_str().len() + pipe.len_utf8();
    Ok((
        rest,
        RoxUserId {
            prefix,
            email_part,
            email_part_offset,
            user_id: ArcCowStr::Borrowed(input),
        },
    ))
}

/// Return the email part of a user id, accepting both supported prefixes.
///
/// Values that do not carry a prefix are returned unchanged, so callers that
/// also handle plain email addresses can use this directly.
pub fn strip_user_id_prefix(id: &str) -> &str {
    id.strip_prefix(MACRO_PREFIX)
        .and_then(|rest| rest.strip_prefix('|'))
        .or_else(|| {
            id.strip_prefix(ROX_PREFIX)
                .and_then(|rest| rest.strip_prefix('|'))
        })
        .unwrap_or(id)
}

/// A structure that encapsulates a macro user id
#[derive(Clone, Copy)]
pub struct RoxUserId<T> {
    prefix: UserIdPrefix,
    email_part: Email<()>,
    email_part_offset: usize,
    user_id: T,
}

impl<T> std::fmt::Debug for RoxUserId<T>
where
    T: AsRef<str>,
{
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.user_id.as_ref())
    }
}

impl<T> PartialEq for RoxUserId<T>
where
    T: PartialEq,
{
    fn eq(&self, other: &Self) -> bool {
        // because T contains the full string, all other information is 'derived' from T
        // only compare these values
        self.user_id == other.user_id
    }
}

impl<T> Eq for RoxUserId<T> where T: Eq {}

impl<T> std::hash::Hash for RoxUserId<T>
where
    T: std::hash::Hash,
{
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.user_id.hash(state);
    }
}

/// The standard inner type for a [RoxUserId]
/// This is a value which is guaranteed to be unmodified from its original input
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(try_from = "String", into = "String")]
pub struct RoxUserIdStr<'a>(pub RoxUserId<Lowercase<'a>>);

#[cfg(feature = "schema")]
impl<'a> utoipa::ToSchema for RoxUserIdStr<'a> {
    fn name() -> std::borrow::Cow<'static, str> {
        std::borrow::Cow::Borrowed("RoxUserIdStr")
    }
}

#[cfg(feature = "schema")]
impl<'a> utoipa::PartialSchema for RoxUserIdStr<'a> {
    fn schema() -> utoipa::openapi::RefOr<utoipa::openapi::schema::Schema> {
        String::schema()
    }
}

impl<'a> std::fmt::Debug for RoxUserIdStr<'a> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0.as_ref())
    }
}

/// Deserialize a RoxUserId to a guaranteed borrowed lifetime from the 'de argument
#[derive(Clone, Deserialize)]
#[serde(try_from = "&str")]
pub struct BorrowedUserIdStr<'a>(#[serde(borrow)] pub RoxUserId<ArcCowStr<'a>>);

impl<'a> std::fmt::Debug for BorrowedUserIdStr<'a> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0.as_ref())
    }
}

impl<'a> doppleganger::Primitive for RoxUserIdStr<'a> {}

impl<'a> std::fmt::Display for RoxUserIdStr<'a> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0.as_ref())
    }
}

impl<'a> Deref for RoxUserIdStr<'a> {
    type Target = RoxUserId<Lowercase<'a>>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<'a> RoxUserIdStr<'a> {
    /// parse the inner value from the input string
    pub fn parse_from_str(s: &'a str) -> Result<Self, ParseErr> {
        RoxUserId::parse_from_str(s)
            .map(|id| id.lowercase())
            .map(RoxUserIdStr)
    }

    /// Rewrite a legacy `macro|` id to the current `rox|` prefix.
    ///
    /// Values that already carry the current prefix are returned unchanged.
    /// The email part is preserved exactly, including plus-tags.
    pub fn canonical(self) -> RoxUserIdStr<'static> {
        match self.0.prefix {
            UserIdPrefix::Rox => self.into_owned(),
            UserIdPrefix::Macro => {
                let canonical = format!("{}|{}", ROX_PREFIX, self.email_str());
                RoxUserIdStr(RoxUserId {
                    prefix: UserIdPrefix::Rox,
                    email_part: self.0.email_part,
                    email_part_offset: ROX_PREFIX.len() + 1,
                    user_id: Lowercase::new(ArcCowStr::Owned(std::sync::Arc::from(canonical))),
                })
            }
        }
    }
}

impl<'a> From<RoxUserIdStr<'a>> for RoxUserId<String> {
    fn from(value: RoxUserIdStr<'a>) -> Self {
        RoxUserId {
            prefix: value.0.prefix,
            email_part: value.email_part,
            email_part_offset: value.email_part_offset,
            user_id: value.0.user_id.as_ref().into(),
        }
    }
}

impl RoxUserIdStr<'static> {
    /// Create a RoxUserIdStr from an email address by prepending the current
    /// `rox|` prefix.
    pub fn try_from_email(email: &str) -> Result<Self, ParseErr> {
        Self::try_from(format!("{}|{}", ROX_PREFIX, email))
    }
}

impl TryFrom<String> for RoxUserIdStr<'static> {
    type Error = ParseErr;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        let s = value.as_str();
        RoxUserIdStr::try_from(s).map(CowLike::into_owned)
    }
}

impl<'a> TryFrom<&'a str> for RoxUserIdStr<'a> {
    type Error = ParseErr;

    fn try_from(value: &'a str) -> Result<Self, Self::Error> {
        RoxUserIdStr::parse_from_str(value)
    }
}

impl<'a> TryFrom<&'a str> for BorrowedUserIdStr<'a> {
    type Error = ParseErr;

    fn try_from(value: &'a str) -> Result<Self, Self::Error> {
        RoxUserId::parse_from_str(value).map(BorrowedUserIdStr)
    }
}

impl<'a> From<RoxUserIdStr<'a>> for String {
    fn from(value: RoxUserIdStr<'a>) -> Self {
        value.0.as_ref().to_string()
    }
}

#[cfg(feature = "sqlx")]
impl<'a> sqlx::Type<sqlx::Postgres> for RoxUserIdStr<'a> {
    fn type_info() -> sqlx::postgres::PgTypeInfo {
        <String as sqlx::Type<sqlx::Postgres>>::type_info()
    }

    fn compatible(ty: &sqlx::postgres::PgTypeInfo) -> bool {
        <String as sqlx::Type<sqlx::Postgres>>::compatible(ty)
    }
}

#[cfg(feature = "sqlx")]
impl<'a> sqlx::postgres::PgHasArrayType for RoxUserIdStr<'a> {
    fn array_type_info() -> sqlx::postgres::PgTypeInfo {
        <String as sqlx::postgres::PgHasArrayType>::array_type_info()
    }
}

#[cfg(feature = "sqlx")]
impl<'q> sqlx::Encode<'q, sqlx::Postgres> for RoxUserIdStr<'q> {
    fn encode_by_ref(
        &self,
        buf: &mut sqlx::postgres::PgArgumentBuffer,
    ) -> Result<sqlx::encode::IsNull, sqlx::error::BoxDynError> {
        <&str as sqlx::Encode<sqlx::Postgres>>::encode_by_ref(&self.as_ref(), buf)
    }

    fn size_hint(&self) -> usize {
        <&str as sqlx::Encode<sqlx::Postgres>>::size_hint(&self.as_ref())
    }
}

#[cfg(feature = "sqlx")]
impl<'r> sqlx::Decode<'r, sqlx::Postgres> for RoxUserIdStr<'static> {
    fn decode(value: sqlx::postgres::PgValueRef<'r>) -> Result<Self, sqlx::error::BoxDynError> {
        let value = <String as sqlx::Decode<sqlx::Postgres>>::decode(value)?;
        RoxUserIdStr::try_from(value).map_err(Into::into)
    }
}

impl<'a> CowLike<'a> for RoxUserIdStr<'a> {
    type Owned<'b> = RoxUserIdStr<'b>;

    fn into_owned(self) -> Self::Owned<'static> {
        RoxUserIdStr(self.0.into_owned())
    }

    fn copied(&'a self) -> Self {
        RoxUserIdStr(self.0.copied())
    }
}

impl<T> RoxUserId<T> {
    fn map<F, U>(self, f: F) -> RoxUserId<U>
    where
        F: FnOnce(T) -> U,
    {
        RoxUserId {
            prefix: self.prefix,
            email_part: self.email_part,
            email_part_offset: self.email_part_offset,
            user_id: f(self.user_id),
        }
    }
}

impl<T> AsRef<str> for RoxUserId<T>
where
    T: AsRef<str>,
{
    fn as_ref(&self) -> &str {
        self.user_id.as_ref()
    }
}

impl<T> RoxUserId<T>
where
    T: AsRef<str>,
{
    /// Which prefix the original input carried.
    pub fn prefix(&self) -> UserIdPrefix {
        self.prefix
    }

    /// True when this id still carries the legacy `macro|` prefix.
    pub fn has_legacy_prefix(&self) -> bool {
        self.prefix == UserIdPrefix::Macro
    }

    /// return the [EmailParts] contained within self
    pub fn email_part<'a>(&'a self) -> Email<ArcCowStr<'a>> {
        let email_str = self.email_str();
        self.email_part.map(|_| ArcCowStr::Borrowed(email_str))
    }

    /// return the email as a string slice
    pub fn email_str(&self) -> &str {
        let id_str = self.user_id.as_ref();
        &id_str[self.email_part_offset..]
    }

    /// True when this user belongs to the `rox.one` staff domain.
    ///
    /// Plus-aliases such as `name+tag@rox.one` still match.
    pub fn is_macro_staff(&self) -> bool {
        self.email_part()
            .domain_part()
            .eq_ignore_ascii_case("rox.one")
    }
}

impl<'a, T> CowLike<'a> for RoxUserId<T>
where
    T: CowLike<'a>,
{
    type Owned<'b> = RoxUserId<T::Owned<'b>>;

    fn into_owned(self) -> RoxUserId<T::Owned<'static>> {
        self.map(CowLike::into_owned)
    }

    fn copied(&'a self) -> Self {
        RoxUserId {
            prefix: self.prefix,
            email_part: self.email_part,
            email_part_offset: self.email_part_offset,
            user_id: self.user_id.copied(),
        }
    }
}

impl<'a> RoxUserId<ArcCowStr<'a>> {
    /// attempt to create a borrowed version of self from an input string
    pub fn parse_from_str(input: &'a str) -> Result<Self, ParseErr> {
        let (_, out) = user_id(input).finish().map_err(|e| e.cloned())?;
        Ok(out)
    }

    /// convert the inner email to unicode lowercase characters.
    /// This will not allocate if the inner email is already lowercase
    pub fn lowercase(self) -> RoxUserId<Lowercase<'a>> {
        self.map(Lowercase::new)
    }
}
