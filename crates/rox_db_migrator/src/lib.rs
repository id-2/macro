//! The sole responsibility of this crate is to expose the statically imported sql migrations for rox_db.
//!
//! We explicitly do not want these migrations to exist as part of rox_db_client crate because that crate is very heavy.
pub static ROX_DB_MIGRATIONS: sqlx::migrate::Migrator =
    sqlx::migrate!("../rox_db_client/migrations");

#[cfg(test)]
mod test;
