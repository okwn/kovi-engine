# Backup and Restore Notes

## Scripts

- `infra/scripts/backup-postgres.sh`
- `infra/scripts/restore-postgres.sh`
- `infra/scripts/verify-restore.sh`

## Backup Cadence

- Full daily PostgreSQL backup.
- Additional snapshot before schema migrations.

## Restore Verification

After restore:

1. Run verify script.
2. Check tenant/source counts.
3. Run migration verification in dry environment.
4. Replay recent delivery events where required.
