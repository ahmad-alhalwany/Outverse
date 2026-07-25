"""Route read queries to an optional read replica; writes stay on primary."""


class PrimaryReplicaRouter:
    def db_for_read(self, model, **hints):
        from django.conf import settings

        if 'replica' in settings.DATABASES:
            return 'replica'
        return 'default'

    def db_for_write(self, model, **hints):
        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        return db == 'default'
