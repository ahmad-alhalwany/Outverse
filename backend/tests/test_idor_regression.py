"""Regression tests for IDOR / access-control findings from the manual audit.

Each test reproduces the exact exploit verified by hand in Burp against the
local dev server, so a future change can't silently reopen the hole.
"""
import io
import threading

import pytest
from PIL import Image
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from posts.models import Post, PostMedia, PostShareLog, PostVote
from users.models import Follow, Profile


def _login(client, user):
    client.force_authenticate(user=user)
    return user


def _png():
    buf = io.BytesIO()
    Image.new('RGB', (4, 4), (10, 120, 200)).save(buf, 'PNG')
    buf.seek(0)
    buf.name = 'attack.png'
    return buf


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def alice(django_user_model):
    return django_user_model.objects.create_user(username='alice', password='pass1234')


@pytest.fixture
def bob(django_user_model):
    return django_user_model.objects.create_user(username='bob', password='pass1234')


@pytest.mark.django_db
def test_add_media_rejects_a_non_owner(api_client, alice, bob):
    """add_media (posts/views.py): Bob must not be able to attach media to Alice's post.

    Before the fix this returned 201 and attached the file — confirmed live in
    Burp (post/views.py:873 had no ownership check, unlike update()/destroy()).
    """
    post = Post.objects.create(user=alice, text='alice post')

    _login(api_client, bob)
    res = api_client.post(f'/api/posts/{post.id}/add_media/', {'media': _png()}, format='multipart')

    assert res.status_code == 403
    assert PostMedia.objects.filter(post=post).count() == 0


@pytest.mark.django_db
def test_add_media_allows_the_owner(api_client, alice):
    post = Post.objects.create(user=alice, text='alice post')

    _login(api_client, alice)
    res = api_client.post(f'/api/posts/{post.id}/add_media/', {'media': _png()}, format='multipart')

    assert res.status_code == 201
    assert PostMedia.objects.filter(post=post).count() == 1


@pytest.mark.django_db
def test_add_media_requires_authentication(api_client, alice):
    post = Post.objects.create(user=alice, text='alice post')

    res = api_client.post(f'/api/posts/{post.id}/add_media/', {'media': _png()}, format='multipart')

    assert res.status_code in (401, 403)
    assert PostMedia.objects.filter(post=post).count() == 0


# --- thread / reactors / repost / share: missing can_view_post() ------------
# All four skipped the visibility check that retrieve()/edits() already had,
# so a follower-only or subscriber-only post leaked through these side doors.

@pytest.mark.django_db
def test_thread_rejects_a_stranger_on_a_followers_only_post(api_client, alice, bob):
    post = Post.objects.create(user=alice, text='followers only', visibility='followers')

    _login(api_client, bob)
    res = api_client.get(f'/api/posts/{post.id}/thread/')

    assert res.status_code == 403


@pytest.mark.django_db
def test_thread_allows_an_actual_follower(api_client, alice, bob):
    post = Post.objects.create(user=alice, text='followers only', visibility='followers')
    Follow.objects.create(follower=bob, following=alice)

    _login(api_client, bob)
    res = api_client.get(f'/api/posts/{post.id}/thread/')

    assert res.status_code == 200


@pytest.mark.django_db
def test_reactors_rejects_a_stranger_on_a_followers_only_post(api_client, alice, bob):
    post = Post.objects.create(user=alice, text='followers only', visibility='followers')

    _login(api_client, bob)
    res = api_client.get(f'/api/posts/{post.id}/reactors/')

    assert res.status_code == 403


@pytest.mark.django_db
def test_share_rejects_a_stranger_on_a_subscribers_only_post(api_client, alice, bob):
    post = Post.objects.create(user=alice, text='subscribers only', visibility='subscribers')

    _login(api_client, bob)
    res = api_client.post(f'/api/posts/{post.id}/share/')

    assert res.status_code == 403
    assert PostShareLog.objects.filter(post=post).count() == 0


@pytest.mark.django_db
def test_share_allows_an_anonymous_visitor_on_a_public_post(api_client, alice):
    post = Post.objects.create(user=alice, text='public', visibility='public')

    res = api_client.post(f'/api/posts/{post.id}/share/')

    assert res.status_code == 200


@pytest.mark.django_db
def test_repost_rejects_a_stranger_on_a_subscribers_only_post(api_client, alice, bob):
    post = Post.objects.create(user=alice, text='subscribers only', visibility='subscribers')

    _login(api_client, bob)
    res = api_client.post(f'/api/posts/{post.id}/repost/')

    assert res.status_code == 403
    assert Post.objects.filter(repost_of=post).count() == 0


@pytest.mark.django_db
def test_repost_allows_the_owner_to_echo_their_own_restricted_post(api_client, alice):
    post = Post.objects.create(user=alice, text='subscribers only', visibility='subscribers')

    _login(api_client, alice)
    res = api_client.post(f'/api/posts/{post.id}/repost/')

    assert res.status_code == 201


# --- vote: lost-update race on karma -----------------------------------------
# vote() read PostVote then wrote it back without a lock. Two concurrent
# requests on the same (post, user) could both act on the same stale snapshot
# — e.g. one deletes the row while the other does an UPDATE that silently
# matches zero rows but still applies its own karma delta — corrupting the
# post owner's karma with no error anywhere. select_for_update() now
# serializes same-(post, user) writes inside one transaction.

@pytest.mark.django_db(transaction=True)
def test_vote_concurrent_requests_keep_karma_consistent(alice, bob):
    """Best-effort race: a Barrier maximizes overlap, but thread/DB timing
    isn't 100% deterministic. The assertion holds under either interleaving
    order *because* the fix is correct — it does not depend on who "wins".
    """
    post = Post.objects.create(user=alice, text='race target')
    PostVote.objects.create(post=post, user=bob, value=PostVote.BOOST)  # initial contrib: +1
    profile, _ = Profile.objects.get_or_create(user=alice)
    Profile.objects.filter(pk=profile.pk).update(karma=0)

    token, _ = Token.objects.get_or_create(user=bob)
    barrier = threading.Barrier(2)
    results = []

    def fire(payload):
        from django.db import connection

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        barrier.wait()
        try:
            results.append(client.post(f'/api/posts/{post.id}/vote/', payload).status_code)
        finally:
            connection.close()  # each Thread gets its own DB connection; close it explicitly

    threads = [
        threading.Thread(target=fire, args=({'vote': 'boost'},)),  # toggles the existing BOOST off
        threading.Thread(target=fire, args=({'vote': 'dim'},)),    # flips it to DIM
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert results == [200, 200]

    final = PostVote.objects.filter(post=post, user=bob).first()
    final_contrib = (1 if final.value == PostVote.BOOST else -1) if final else 0
    profile.refresh_from_db()
    # Correct regardless of execution order: total karma change telescopes to
    # (final state - initial state). A lost update would make this wrong.
    assert profile.karma == final_contrib - 1


@pytest.mark.django_db
def test_vote_toggle_and_switch_still_work(api_client, alice, bob):
    """Non-concurrent sanity check that select_for_update() didn't change behavior."""
    post = Post.objects.create(user=alice, text='vote target')
    _login(api_client, bob)

    res = api_client.post(f'/api/posts/{post.id}/vote/', {'vote': 'boost'})
    assert res.status_code == 200 and res.data['my_vote'] == 'boost'

    res = api_client.post(f'/api/posts/{post.id}/vote/', {'vote': 'dim'})
    assert res.status_code == 200 and res.data['my_vote'] == 'dim'

    res = api_client.post(f'/api/posts/{post.id}/vote/', {'vote': 'dim'})
    assert res.status_code == 200 and res.data['my_vote'] is None  # toggled off
    assert PostVote.objects.filter(post=post, user=bob).count() == 0


@pytest.mark.django_db
def test_react_toggle_still_works(api_client, alice, bob):
    """Non-concurrent sanity check for the matching react() fix."""
    post = Post.objects.create(user=alice, text='react target')
    _login(api_client, bob)

    res = api_client.post(f'/api/posts/{post.id}/react/', {'reaction': 'inspired'})
    assert res.status_code == 200 and res.data['my_reaction'] == 'inspired'

    res = api_client.post(f'/api/posts/{post.id}/react/', {'reaction': 'inspired'})
    assert res.status_code == 200 and res.data['my_reaction'] is None  # toggled off


# --- bottles: update()/partial_update() had no permission at all ------------
# get_permissions() fell through to AllowAny() for update/partial_update
# (unlike destroy(), which was already explicit) — update() wasn't overridden
# at all, so DRF's default UpdateModelMixin ran with zero ownership check.
# A fully anonymous request could rewrite anyone's bottle message/emotion/location.

from bottles.models import MessageBottle  # noqa: E402


@pytest.mark.django_db
def test_bottle_update_requires_authentication(api_client, alice):
    bottle = MessageBottle.objects.create(sender=alice, message='original', emotion_type='joy')

    res = api_client.patch(f'/api/bottles/{bottle.id}/', {'message': 'pwned'}, format='json')

    assert res.status_code in (401, 403)
    bottle.refresh_from_db()
    assert bottle.message == 'original'


@pytest.mark.django_db
def test_bottle_update_rejects_a_non_owner(api_client, alice, bob):
    bottle = MessageBottle.objects.create(sender=alice, message='original', emotion_type='joy')

    _login(api_client, bob)
    res = api_client.patch(f'/api/bottles/{bottle.id}/', {'message': 'pwned'}, format='json')

    assert res.status_code == 403
    bottle.refresh_from_db()
    assert bottle.message == 'original'


@pytest.mark.django_db
def test_bottle_update_allows_the_sender(api_client, alice):
    bottle = MessageBottle.objects.create(sender=alice, message='original', emotion_type='joy')

    _login(api_client, alice)
    res = api_client.patch(f'/api/bottles/{bottle.id}/', {'message': 'edited by owner'}, format='json')

    assert res.status_code == 200
    bottle.refresh_from_db()
    assert bottle.message == 'edited by owner'


# --- bottles: sender_anon_id was an unsalted hash --------------------------
# get_sender_anon_id() hashed "outverse-bottle-<sender_id>" with plain SHA256
# and no secret — confirmed by hand in Burp Decoder: hashing the sender's own
# id locally reproduced the exact value the API returned, de-anonymizing them.
# Fix: HMAC-SHA256 keyed with settings.SECRET_KEY, which never leaves the server.

import hashlib

from bottles.serializers import BottleCatchSerializer


@pytest.mark.django_db
def test_sender_anon_id_cannot_be_reproduced_without_the_secret_key(alice):
    bottle = MessageBottle.objects.create(sender=alice, message='hi', emotion_type='joy')

    actual = BottleCatchSerializer(bottle).data['sender_anon_id']
    guessed = hashlib.sha256(f'outverse-bottle-{alice.id}'.encode()).hexdigest()[:12]

    assert actual != guessed


@pytest.mark.django_db
def test_sender_anon_id_is_deterministic(alice):
    bottle = MessageBottle.objects.create(sender=alice, message='hi', emotion_type='joy')

    first = BottleCatchSerializer(bottle).data['sender_anon_id']
    second = BottleCatchSerializer(bottle).data['sender_anon_id']

    assert first == second
    assert len(first) == 12


@pytest.mark.django_db
def test_catch_still_returns_a_sender_anon_id(api_client, alice, bob):
    bottle = MessageBottle.objects.create(sender=alice, message='hi', emotion_type='joy')

    _login(api_client, bob)
    res = api_client.post('/api/bottles/catch/', {'bottle_id': bottle.id})

    assert res.status_code == 200
    assert len(res.data['sender_anon_id']) == 12


# --- questions/generate: unauthenticated, unthrottled LLM calls -------------
# AllowAny + no ThrottleMixin on the whole ViewSet, unlike every other
# content-creating endpoint in the codebase — confirmed live with Burp
# Intruder: 30/30 anonymous requests succeeded, zero 401s or 429s. In
# production (an LLM key configured) each one is a paid API call.

from questions.models import Question


@pytest.mark.django_db
def test_generate_requires_authentication(api_client):
    res = api_client.post('/api/questions/generate/?lang=en&category=all')
    assert res.status_code == 401


@pytest.mark.django_db
def test_generate_is_rate_limited(api_client, alice):
    Question.objects.create(text='fallback question', category='surreal', language='en')
    _login(api_client, alice)

    statuses = [
        api_client.post('/api/questions/generate/?lang=en&category=all').status_code
        for _ in range(6)
    ]

    assert statuses.count(200) <= 5  # ai.generate = 5/min
    assert 429 in statuses


# --- ThrottleMixin: the shared scope-wiring bug, tested in isolation -------
# Direct proof the fix sets what DRF actually reads, independent of any one
# app. See questions/generate's own tests above for the real-world case —
# this guards the shared mixin itself, used by 10 files (bottles,
# communities, speculative, resources, subscriptions, collab, saved,
# comments, notes, questions).

from rest_framework.permissions import AllowAny as _AllowAny
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView

from outverse.throttles import ThrottleMixin


class _ThrottleProbeView(ThrottleMixin, APIView):
    permission_classes = [_AllowAny]
    throttle_scopes = {'get': 'ai.generate'}  # reuse an existing low scope: 5/min

    def get(self, request):
        return Response({'ok': True})


def test_throttle_mixin_wires_the_scope_onto_the_view():
    """Before the fix: get_throttles() set `throttle.scope` on the throttle
    *instance*, but DRF's ScopedRateThrottle.allow_request() overwrites that
    with `getattr(view, 'throttle_scope', None)` and returns True — i.e.
    unthrottled — whenever that view attribute is unset. It always was.
    """
    factory = APIRequestFactory()
    view_func = _ThrottleProbeView.as_view()

    statuses = [view_func(factory.get('/probe/')).status_code for _ in range(6)]

    assert statuses.count(200) <= 5
    assert 429 in statuses
