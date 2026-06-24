#!/bin/sh
set -e

# Wait for dependencies if requested
if [ -n "$WAIT_FOR_HOST" ] && [ -n "$WAIT_FOR_PORT" ]; then
  echo "Waiting for $WAIT_FOR_HOST:$WAIT_FOR_PORT ..."
  while ! nc -z "$WAIT_FOR_HOST" "$WAIT_FOR_PORT"; do
    sleep 1
  done
  echo "Dependency ready"
fi

# Only run migrations/collectstatic when explicitly requested by role
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running migrations..."
  python manage.py migrate --noinput
fi

if [ "$RUN_COLLECTSTATIC" = "true" ]; then
  echo "Collecting static files..."
  python manage.py collectstatic --noinput --clear
fi

# Create default superuser from env if requested
if [ "$DJANGO_CREATE_SUPERUSER" = "true" ]; then
  python manage.py shell <<'PY'
import os
from django.contrib.auth import get_user_model
User = get_user_model()
username = os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin')
email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@outverse.local')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')
if password and not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username=username, email=email, password=password)
    print(f'Superuser {username} created')
PY
fi

echo "Starting: $@"
exec "$@"
