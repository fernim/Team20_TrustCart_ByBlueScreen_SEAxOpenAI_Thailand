import importlib.util
from pathlib import Path


def load_script():
    spec = importlib.util.spec_from_file_location('slack_push', Path(__file__).parents[1] / 'scripts' / 'slack_push.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_push_payload_handles_nested_branch_and_untrusted_text():
    module = load_script()
    event = {'ref': 'refs/heads/feature/cart', 'after': 'abcdef123456', 'sender': {'login': 'developer'}, 'repository': {'full_name': 'team/store', 'html_url': 'https://github.com/team/store'}, 'head_commit': {'message': '<!channel> fix & refine\nMore details'}, 'compare': 'https://github.com/team/store/compare/a...b'}
    payload = module.build_payload(event)
    assert 'feature/cart' in payload['text']
    assert '<!channel>' not in payload['text']
    assert '&lt;!channel&gt;' in payload['text']
    assert 'abcdef1' in payload['text']
    assert 'More details' not in payload['text']
    assert 'passed' not in payload['text'].lower()


def test_deleted_branch_and_tag_do_not_send():
    module = load_script()
    assert module.build_payload({'ref': 'refs/tags/v1'}) is None
    assert module.build_payload({'ref': 'refs/heads/main', 'deleted': True}) is None


def test_missing_secret_fails_without_network(tmp_path, monkeypatch, capsys):
    module = load_script()
    event = tmp_path / 'event.json'
    event.write_text('{"ref":"refs/heads/main","after":"abc","repository":{"full_name":"team/store","html_url":"https://github.com/team/store"}}')
    monkeypatch.setenv('GITHUB_EVENT_PATH', str(event))
    monkeypatch.delenv('SLACK_WEBHOOK_URL', raising=False)
    assert module.main() == 1
    assert 'Configure the SLACK_WEBHOOK_URL' in capsys.readouterr().out


def test_delivery_failure_does_not_log_credentials(tmp_path, monkeypatch, capsys):
    module = load_script()
    event = tmp_path / 'event.json'
    event.write_text('{"ref":"refs/heads/main","after":"abc","repository":{"full_name":"team/store","html_url":"https://github.com/team/store"}}')
    monkeypatch.setenv('GITHUB_EVENT_PATH', str(event))
    monkeypatch.setenv('SLACK_WEBHOOK_URL', 'https://example.invalid/private-test-value')
    def fail(*args, **kwargs):
        raise RuntimeError('private-test-value')
    monkeypatch.setattr(module, 'urlopen', fail)
    assert module.main() == 1
    assert 'private-test-value' not in capsys.readouterr().out
