#!/bin/bash
set -e
cd /app

# If RAILS_MASTER_KEY is set, verify credentials can be decrypted.
# The nixpacks build may have generated credentials.yml.enc with an
# empty/wrong key during assets:precompile.
if [ -n "$RAILS_MASTER_KEY" ]; then
  RAILS_MASTER_KEY="$RAILS_MASTER_KEY" \
    bin/rails runner "Rails.application.credentials.config" >/dev/null 2>&1 || {
      echo "[entrypoint] credentials.yml.enc unreadable — regenerating …"
      rm -f config/credentials.yml.enc
      SECRET=$(ruby -r securerandom -e 'puts SecureRandom.hex(64)')
      RAILS_MASTER_KEY="$RAILS_MASTER_KEY" \
        EDITOR="ruby -e 'File.write ARGV[0], \"secret_key_base: ${SECRET}\\n\"'" \
        bin/rails credentials:edit 2>/dev/null
      echo "[entrypoint] done"
    }
fi

exec "$@"
