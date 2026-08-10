#!/bin/sh
# Cosmory scheduled jobs - runs inside the Docker cron sidecar.
# Every minute: publish due posts + premieres.
# Once daily at 08:00 UTC: email digests (daily + weekly-on-Monday).
# Once daily at CRON_DAILY_CHALLENGE_HOUR:UTC: AI daily Lab challenge.
set -eu

DIGEST_HOUR="${CRON_DIGEST_HOUR:-08}"
DIGEST_MINUTE="${CRON_DIGEST_MINUTE:-00}"
CHALLENGE_HOUR="${CRON_DAILY_CHALLENGE_HOUR:-06}"
CHALLENGE_MINUTE="${CRON_DAILY_CHALLENGE_MINUTE:-00}"
CHALLENGE_LANG="${CRON_DAILY_CHALLENGE_LANG:-en}"
LAST_DIGEST_DAY=""
LAST_CHALLENGE_DAY=""

echo "[cron] Cosmory job loop started"
echo "[cron] digest at ${DIGEST_HOUR}:${DIGEST_MINUTE} UTC"
echo "[cron] daily challenge at ${CHALLENGE_HOUR}:${CHALLENGE_MINUTE} UTC (lang=${CHALLENGE_LANG})"

while true; do
  NOW_UTC="$(date -u +%Y-%m-%dT%H:%M:%S)"
  HOUR="$(date -u +%H)"
  MINUTE="$(date -u +%M)"
  DAY="$(date -u +%Y-%m-%d)"

  echo "[cron] ${NOW_UTC} publish_scheduled_posts"
  python manage.py publish_scheduled_posts || echo "[cron] publish_scheduled_posts failed"

  echo "[cron] ${NOW_UTC} publish_premiere_videos"
  python manage.py publish_premiere_videos || echo "[cron] publish_premiere_videos failed"

  if [ "$HOUR" = "$DIGEST_HOUR" ] && [ "$MINUTE" = "$DIGEST_MINUTE" ] && [ "$DAY" != "$LAST_DIGEST_DAY" ]; then
    echo "[cron] ${NOW_UTC} send_email_digests"
    if python manage.py send_email_digests; then
      LAST_DIGEST_DAY="$DAY"
    else
      echo "[cron] send_email_digests failed"
    fi
  fi

  if [ "$HOUR" = "$CHALLENGE_HOUR" ] && [ "$MINUTE" = "$CHALLENGE_MINUTE" ] && [ "$DAY" != "$LAST_CHALLENGE_DAY" ]; then
    echo "[cron] ${NOW_UTC} generate_daily_challenge"
    if python manage.py generate_daily_challenge --lang "$CHALLENGE_LANG"; then
      LAST_CHALLENGE_DAY="$DAY"
    else
      echo "[cron] generate_daily_challenge failed"
    fi
  fi

  sleep 60
done
