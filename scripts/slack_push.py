"""Send GitHub branch-push metadata to a channel-bound Slack webhook."""
import json
import os
import sys
from urllib.request import Request, urlopen


def escape(value):
    return str(value).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def build_payload(event):
    ref = event.get('ref', '')
    if not ref.startswith('refs/heads/') or event.get('deleted'):
        return None
    repo = event['repository']
    sha = event['after']
    title = ((event.get('head_commit') or {}).get('message') or 'Branch updated').splitlines()[0][:250]
    text = '\n'.join([
        '*TrustCart · branch pushed*',
        'Repository: ' + escape(repo['full_name']),
        'Branch: ' + escape(ref[len('refs/heads/'):]),
        'Pushed by: ' + escape(event.get('sender', {}).get('login', 'unknown')),
        'Commit: ' + escape(sha[:7]) + ' · ' + escape(title),
        repo['html_url'] + '/commit/' + sha,
        'Push received; test/deployment status is not reported by this notification.',
    ])
    return {'text': text, 'unfurl_links': False, 'unfurl_media': False}


def main():
    with open(os.environ['GITHUB_EVENT_PATH'], encoding='utf-8') as handle:
        payload = build_payload(json.load(handle))
    if payload is None:
        return 0
    webhook = os.environ.get('SLACK_WEBHOOK_URL')
    if not webhook:
        print('::error::Configure the SLACK_WEBHOOK_URL repository secret for #trustcart.')
        return 1
    request = Request(webhook, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urlopen(request, timeout=20) as response:
            if response.read().strip() != b'ok':
                print('::error::Slack did not acknowledge the notification.')
                return 1
    except Exception:
        # Exception messages can contain the secret webhook URL.
        print('::error::Slack notification failed. Check the webhook and channel configuration.')
        return 1
    print('Slack push notification sent.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
