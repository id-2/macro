import os
import unittest
from unittest.mock import patch, sentinel

import transcriber


class TranscriberConfigurationTest(unittest.TestCase):
    def _build(self, **env):
        with (
            patch.object(
                transcriber.groq,
                "STT",
                return_value=sentinel.stt,
            ) as create_stt,
            patch.object(transcriber.Agent, "__init__", return_value=None) as init_agent,
            patch.dict(os.environ, env, clear=False),
        ):
            for key in ("STT_LANGUAGE", "STT_DETECT_LANGUAGE"):
                if key not in env:
                    os.environ.pop(key, None)
            transcriber.Transcriber(
                participant_identity="participant-id",
                channel_id="channel-id",
                http_client=sentinel.http_client,
            )
        return create_stt, init_agent

    def test_pins_russian_language_by_default(self):
        create_stt, init_agent = self._build()

        create_stt.assert_called_once()
        args, kwargs = create_stt.call_args
        self.assertEqual(args, ())
        self.assertEqual(kwargs["model"], "whisper-large-v3-turbo")
        self.assertEqual(kwargs["base_url"], transcriber.groq_api_base())
        self.assertEqual(kwargs["language"], "ru")
        self.assertNotIn("detect_language", kwargs)
        self.assertNotIn("api_key", kwargs)
        init_agent.assert_called_once_with(
            instructions="Transcribe user speech.",
            stt=sentinel.stt,
        )

    def test_stt_language_env_overrides_default(self):
        create_stt, _ = self._build(STT_LANGUAGE="de")

        _, kwargs = create_stt.call_args
        self.assertEqual(kwargs["language"], "de")
        self.assertNotIn("detect_language", kwargs)

    def test_detect_language_switch_skips_pinned_language(self):
        create_stt, _ = self._build(STT_DETECT_LANGUAGE="1")

        _, kwargs = create_stt.call_args
        self.assertTrue(kwargs["detect_language"])
        self.assertNotIn("language", kwargs)

    def test_blank_language_falls_back_to_russian(self):
        create_stt, _ = self._build(STT_LANGUAGE="  ")

        _, kwargs = create_stt.call_args
        self.assertEqual(kwargs["language"], "ru")


if __name__ == "__main__":
    unittest.main()
